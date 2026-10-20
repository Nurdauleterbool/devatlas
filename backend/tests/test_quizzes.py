import copy

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.quizzes import quiz_seeds, validate_quiz_seeds


@pytest.fixture
def app():
    return create_app()


def register(app, email):
    client = TestClient(app)
    response = client.post("/api/v1/auth/signup", json={
        "displayName": "Student", "email": email, "password": "ExamplePassword123!"
    })
    assert response.status_code == 201, response.text
    return client, response.json()["user"]["id"]


def answers(quiz, count_correct=5):
    """Use server-side test fixtures, never public response keys, to assert outcomes."""
    keys = quiz_seeds()["answerKeys"]
    responses = []
    for index, question in enumerate(quiz["questions"]):
        correct = keys[question["id"]]["correctOptionId"]
        chosen = correct if index < count_correct else next(
            option["id"] for option in question["options"] if option["id"] != correct
        )
        responses.append({"questionId": question["id"], "optionId": chosen})
    return {"responses": responses}


def test_quiz_catalogue_matches_all_ten_skills_and_hides_keys(app):
    with TestClient(app) as client:
        skills = client.get("/api/v1/skills").json()
        assert len(skills) == 10
        for skill in skills:
            response = client.get(f'/api/v1/skills/{skill["id"]}/quiz')
            assert response.status_code == 200
            quiz = response.json()
            assert quiz["skillId"] == skill["id"]
            assert quiz["passThreshold"] == 80
            assert len(quiz["questions"]) == 5
            assert all(len(q["options"]) == 4 for q in quiz["questions"])
            text = response.text
            assert "correctOptionId" not in text
            assert "explanation" not in text
            assert "answerKeys" not in text


def test_unknown_skill_returns_404_and_known_without_quiz_204(app):
    with TestClient(app) as client:
        response = client.get("/api/v1/skills/missing/quiz")
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"
        app.state.repositories.create("quizzes").delete("quiz-html")
        absent = client.get("/api/v1/skills/html/quiz")
        assert absent.status_code == 204
        assert absent.content == b""


def test_grades_60_80_100_and_best_score_retained(app):
    client, user_id = register(app, "alice@example.test")
    quiz = client.get("/api/v1/skills/html/quiz").json()
    scores = [(3, 60, False), (4, 80, True), (5, 100, True), (1, 20, False)]
    for count, score, passed in scores:
        result = client.post("/api/v1/quizzes/quiz-html/attempts", json=answers(quiz, count))
        assert result.status_code == 201, result.text
        assert result.headers["cache-control"] == "no-store"
        attempt = result.json()["attempt"]
        assert attempt["userId"] == user_id
        assert attempt["score"] == score
        assert attempt["passed"] is passed
        assert attempt["correctCount"] == count
        assert len(result.json()["feedback"]) == 5
        assert all(feedback["explanation"] for feedback in result.json()["feedback"])
    attempts = client.get("/api/v1/me/quiz-attempts?quizId=quiz-html").json()
    assert [a["score"] for a in attempts] == [60, 80, 100, 20]
    html = next(item for item in client.get("/api/v1/progress").json() if item["skillId"] == "html")
    assert html["verified"] is True
    assert html["bestQuizScore"] == 100
    assert html["status"] == "not_started"


def test_failed_retakes_do_not_remove_verification(app):
    client, _ = register(app, "alice@example.test")
    quiz = client.get("/api/v1/skills/sql/quiz").json()
    for count in (4, 0, 1, 3):
        assert client.post("/api/v1/quizzes/quiz-sql/attempts", json=answers(quiz, count)).status_code == 201
    rows = {row["skillId"]: row for row in client.get("/api/v1/progress").json()}
    assert rows["sql"]["bestQuizScore"] == 80
    assert rows["sql"]["verified"] is True
    assert client.put("/api/v1/me/progress/sql", json={"status": "completed"}).status_code == 200
    assert client.put("/api/v1/me/progress/sql", json={"status": "not_started"}).status_code == 200
    updated = next(row for row in client.get("/api/v1/progress").json() if row["skillId"] == "sql")
    assert updated["verified"] is True


def test_invalid_quiz_submission_is_atomic(app):
    client, _ = register(app, "alice@example.test")
    quiz = client.get("/api/v1/skills/html/quiz").json()
    original = answers(quiz)
    bad = [
        {"responses": original["responses"][:4]},
        {"responses": original["responses"] + [original["responses"][0]]},
        {"responses": [original["responses"][0]] * 5},
        {"responses": [dict(r, optionId="foreign-option") if i == 0 else r
                       for i, r in enumerate(original["responses"])]},
        {"responses": [dict(r, questionId="foreign-question") if i == 0 else r
                       for i, r in enumerate(original["responses"])]},
        dict(original, userId="forged-user"),
        dict(original, score=100),
        {"responses": [dict(r, correct=True) if i == 0 else r
                       for i, r in enumerate(original["responses"])]},
    ]
    for payload in bad:
        response = client.post("/api/v1/quizzes/quiz-html/attempts", json=payload)
        assert response.status_code == 422, response.text
        assert response.json()["error"]["code"] == "VALIDATION"
    assert client.get("/api/v1/me/quiz-attempts").json() == []
    assert client.get("/api/v1/progress").json()[0]["bestQuizScore"] is None


def test_unknown_quiz_submission_and_filter_return_404(app):
    client, _ = register(app, "alice@example.test")
    invalid = client.post("/api/v1/quizzes/unknown/attempts", json={"responses": []})
    assert invalid.status_code in (404, 422)
    assert client.get("/api/v1/me/quiz-attempts?quizId=unknown").status_code == 404


def test_anonymous_requests_and_foreign_origin_rejected(app):
    client = TestClient(app)
    quiz = client.get("/api/v1/skills/html/quiz").json()
    assert client.post("/api/v1/quizzes/quiz-html/attempts", json=answers(quiz)).status_code == 401
    assert client.get("/api/v1/me/quiz-attempts").status_code == 401
    owner, _ = register(app, "alice@example.test")
    for headers in ({"Origin": "https://evil.example"}, {"Sec-Fetch-Site": "cross-site"}):
        response = owner.post("/api/v1/quizzes/quiz-html/attempts", json=answers(quiz), headers=headers)
        assert response.status_code == 403
    assert owner.get("/api/v1/me/quiz-attempts").json() == []


def test_attempts_are_user_scoped_even_with_shared_quiz(app):
    alice, alice_id = register(app, "alice@example.test")
    bob, bob_id = register(app, "bob@example.test")
    quiz = alice.get("/api/v1/skills/html/quiz").json()
    assert alice.post("/api/v1/quizzes/quiz-html/attempts", json=answers(quiz, 5)).status_code == 201
    assert bob.post("/api/v1/quizzes/quiz-html/attempts", json=answers(quiz, 2)).status_code == 201
    assert [r["userId"] for r in alice.get("/api/v1/me/quiz-attempts").json()] == [alice_id]
    assert [r["userId"] for r in bob.get("/api/v1/me/quiz-attempts").json()] == [bob_id]
    row_a = next(r for r in alice.get("/api/v1/progress").json() if r["skillId"] == "html")
    row_b = next(r for r in bob.get("/api/v1/progress").json() if r["skillId"] == "html")
    assert row_a["verified"] is True
    assert row_b["verified"] is False


def test_server_rejects_bad_seed_keys_or_wrong_references(app):
    seed = quiz_seeds()
    validate_quiz_seeds(seed, app.state.repositories)
    corrupted = copy.deepcopy(seed)
    corrupted["answerKeys"]["html-q1"]["correctOptionId"] = "foreign"
    with pytest.raises(ValueError):
        validate_quiz_seeds(corrupted, app.state.repositories)
    corrupted = copy.deepcopy(seed)
    corrupted["quizzes"][0]["questions"][0]["options"].pop()
    with pytest.raises(ValueError):
        validate_quiz_seeds(corrupted, app.state.repositories)


def test_quiz_routes_match_http_contract(app):
    with TestClient(app) as client:
        paths = client.get("/openapi.json").json()["paths"]
        assert paths["/api/v1/skills/{skillId}/quiz"]["get"]["operationId"] == "getQuizForSkill"
        assert paths["/api/v1/quizzes/{quizId}/attempts"]["post"]["operationId"] == "submitQuizAttempt"
        assert paths["/api/v1/me/quiz-attempts"]["get"]["operationId"] == "getQuizAttempts"

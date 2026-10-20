import pytest
from fastapi.testclient import TestClient

from app.analytics import round_nonnegative
from app.main import create_app
from app.quizzes import quiz_seeds


@pytest.fixture
def app():
    return create_app()


def register(app, email):
    client = TestClient(app)
    response = client.post("/api/v1/auth/signup", json={
        "email": email, "password": "ExamplePassword123!", "displayName": "Student"
    })
    assert response.status_code == 201, response.text
    return client, response.json()["user"]["id"]


def status(client, skill, value):
    r = client.put(f"/api/v1/me/progress/{skill}", json={"status": value})
    assert r.status_code == 200, r.text


def submit(client, skill, correct_count):
    quiz = client.get(f"/api/v1/skills/{skill}/quiz").json()
    keys = quiz_seeds()["answerKeys"]
    responses = []
    for index, question in enumerate(quiz["questions"]):
        correct = keys[question["id"]]["correctOptionId"]
        chosen = correct if index < correct_count else next(
            option["id"] for option in question["options"] if option["id"] != correct
        )
        responses.append({"questionId": question["id"], "optionId": chosen})
    result = client.post(f'/api/v1/quizzes/{quiz["id"]}/attempts', json={"responses": responses})
    assert result.status_code == 201, result.text
    return result.json()


def recommendations(client, career):
    response = client.get(f"/api/v1/career-paths/{career}/recommendations")
    assert response.status_code == 200, response.text
    return response.json()


def test_anonymous_recommendations_use_neutral_preview(app):
    with TestClient(app) as anonymous:
        result = recommendations(anonymous, "frontend")
        assert [item["skillId"] for item in result] == ["html"]
        assert result[0]["priority"] == "start_next"
        assert result[0]["prerequisiteIds"] == []
        assert "no prerequisites" in result[0]["reason"]
        assert result[0]["rank"] == 1


def test_prerequisite_chain_and_ranking(app):
    alice, _ = register(app, "alice@example.test")
    status(alice, "html", "completed")
    choices = recommendations(alice, "frontend")
    assert [item["skillId"] for item in choices] == ["css", "javascript"]
    assert [item["rank"] for item in choices] == [1, 2]
    assert choices[0]["prerequisiteIds"] == ["html"]
    assert "HTML" in choices[0]["reason"]

    status(alice, "css", "learning")
    choices = recommendations(alice, "frontend")
    assert [item["skillId"] for item in choices] == ["css", "javascript"]
    assert choices[0]["priority"] == "continue_learning"
    assert choices[1]["priority"] == "start_next"

    status(alice, "javascript", "completed")
    assert [r["skillId"] for r in recommendations(alice, "frontend")] == ["css", "react"]


def test_verified_prerequisite_opens_children_and_skips_verified(app):
    alice, _ = register(app, "alice@example.test")
    submit(alice, "html", 4)
    choices = recommendations(alice, "frontend")
    assert [item["skillId"] for item in choices] == ["css", "javascript"]
    submit(alice, "javascript", 4)
    choices = recommendations(alice, "frontend")
    assert [item["skillId"] for item in choices] == ["css", "react"]
    assert choices[1]["prerequisiteIds"] == ["javascript"]


def test_completed_career_returns_empty_and_is_deterministic(app):
    alice, _ = register(app, "alice@example.test")
    for skill in ("html", "css", "javascript", "react"):
        status(alice, skill, "completed")
    assert recommendations(alice, "frontend") == []
    assert recommendations(alice, "backend") == recommendations(alice, "backend")
    assert [r["skillId"] for r in recommendations(alice, "backend")] == ["python", "sql"]


def test_analytics_initial_state_and_shared_skill_deduplication(app):
    alice, uid = register(app, "alice@example.test")
    initial = alice.get("/api/v1/me/analytics")
    assert initial.status_code == 200
    assert initial.headers["cache-control"] == "no-store"
    payload = initial.json()
    assert payload["userId"] == uid
    assert (payload["totalSkills"], payload["completedSkills"],
            payload["learningSkills"], payload["verifiedSkills"]) == (10, 0, 0, 0)
    assert payload["quizzes"] == {"attemptCount": 0, "passedCount": 0,
                                   "bestScore": None, "averageScore": None}
    assert len(payload["careers"]) == 3
    status(alice, "python", "completed")
    after = alice.get("/api/v1/me/analytics").json()
    assert after["completedSkills"] == 1
    assert next(c for c in after["careers"] if c["careerId"] == "backend")["completedSkills"] == 1
    assert next(c for c in after["careers"] if c["careerId"] == "analyst")["completedSkills"] == 1


def test_analytics_matches_attempts_progress_history_and_retakes(app):
    alice, uid = register(app, "alice@example.test")
    status(alice, "html", "learning")
    status(alice, "html", "completed")
    status(alice, "python", "learning")
    submit(alice, "sql", 4)
    submit(alice, "sql", 1)
    submit(alice, "html", 0)
    analytics = alice.get("/api/v1/me/analytics").json()
    assert analytics["userId"] == uid
    assert analytics["totalSkills"] == len(alice.get("/api/v1/progress").json())
    assert analytics["completedSkills"] == 1
    assert analytics["learningSkills"] == 1
    assert analytics["verifiedSkills"] == 1
    assert analytics["quizzes"] == {
        "attemptCount": 3, "passedCount": 1, "bestScore": 80, "averageScore": 33
    }
    assert analytics["history"] == alice.get("/api/v1/me/progress/history").json()
    assert len(analytics["history"]) == 3
    frontend = next(c for c in analytics["careers"] if c["careerId"] == "frontend")
    assert frontend == {"careerId": "frontend", "totalSkills": 4,
                        "completedSkills": 1, "verifiedSkills": 0, "completionPercent": 25}
    backend = next(c for c in analytics["careers"] if c["careerId"] == "backend")
    assert backend["verifiedSkills"] == 1


def test_analytics_isolation_across_two_users_and_anonymous(app):
    alice, aid = register(app, "alice@example.test")
    bob, bid = register(app, "bob@example.test")
    status(alice, "html", "completed")
    submit(alice, "python", 5)
    status(bob, "sql", "learning")
    data_a = alice.get("/api/v1/me/analytics").json()
    data_b = bob.get("/api/v1/me/analytics").json()
    assert data_a["userId"] == aid and data_b["userId"] == bid
    assert data_a["completedSkills"] == 1 and data_b["completedSkills"] == 0
    assert data_a["verifiedSkills"] == 1 and data_b["verifiedSkills"] == 0
    assert data_a["quizzes"]["attemptCount"] == 1
    assert data_b["quizzes"]["attemptCount"] == 0
    assert data_a["history"][0]["skillId"] == "html"
    assert data_b["history"][0]["skillId"] == "sql"
    assert [item["skillId"] for item in recommendations(bob, "frontend")] == ["html"]
    with TestClient(app) as anon:
        assert anon.get("/api/v1/me/analytics").status_code == 401
        assert [item["skillId"] for item in recommendations(anon, "frontend")] == ["html"]


def test_missing_career_404_and_api_ids(app):
    with TestClient(app) as client:
        error = client.get("/api/v1/career-paths/not-real/recommendations")
        assert error.status_code == 404
        assert error.json()["error"]["code"] == "NOT_FOUND"
        routes = client.get("/openapi.json").json()["paths"]
        assert routes["/api/v1/me/analytics"]["get"]["operationId"] == "getAnalytics"
        assert routes["/api/v1/career-paths/{careerId}/recommendations"]["get"]["operationId"] == "getRecommendations"


def test_half_up_rounding_without_float_bias():
    assert round_nonnegative(1, 2) == 1
    assert round_nonnegative(4, 3) == 1
    assert round_nonnegative(1, 3) == 0
    assert round_nonnegative(0, 0) == 0
    assert round_nonnegative(50, 100) == 1

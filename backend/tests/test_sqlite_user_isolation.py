"""Real SQLite multi-account persistence and rollback regression tests."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import make_engine
from app.main import create_app
from app import models as m
from app.quizzes import quiz_seeds


@pytest.fixture
def url(tmp_path: Path):
    # Never use the developer's default database path.
    return f"sqlite:///{(tmp_path / 'issue18-test.db').as_posix()}"


def app_for(url):
    return create_app(Settings(storage_backend="sqlite", database_url=url))


def register(client, email):
    response = client.post("/api/v1/auth/signup", json={
        "email": email, "displayName": email.split("@")[0],
        "password": "ExamplePassword123!",
    })
    assert response.status_code == 201, response.text
    return response.json()["user"]["id"]


def quiz_submission(client, skill="html", correct=5):
    quiz = client.get(f"/api/v1/skills/{skill}/quiz").json()
    keys = quiz_seeds()["answerKeys"]
    responses = []
    for i, question in enumerate(quiz["questions"]):
        correct_id = keys[question["id"]]["correctOptionId"]
        choice = correct_id if i < correct else next(
            o["id"] for o in question["options"] if o["id"] != correct_id
        )
        responses.append({"questionId": question["id"], "optionId": choice})
    response = client.post(f'/api/v1/quizzes/{quiz["id"]}/attempts',
                           json={"responses": responses})
    assert response.status_code == 201, response.text
    return response.json()["attempt"]


def progress(client, skill, status):
    response = client.put(f"/api/v1/me/progress/{skill}", json={"status": status})
    assert response.status_code == 200, response.text
    return response.json()


def test_two_users_persist_separate_progress_attempts_and_recommendations(url):
    app = app_for(url)
    with TestClient(app) as alice, TestClient(app) as bob:
        alice_id = register(alice, "alice@example.test")
        bob_id = register(bob, "bob@example.test")
        progress(alice, "html", "completed")
        progress(bob, "sql", "learning")
        a = quiz_submission(alice, "html", 5)
        b = quiz_submission(bob, "sql", 2)
        assert a["userId"] == alice_id and b["userId"] == bob_id
        assert [row["skillId"] for row in alice.get("/api/v1/me/quiz-attempts").json()] == ["html"]
        assert [row["skillId"] for row in bob.get("/api/v1/me/quiz-attempts").json()] == ["sql"]
        assert [row["skillId"] for row in alice.get("/api/v1/me/progress/history").json()] == ["html"]
        assert [row["skillId"] for row in bob.get("/api/v1/me/progress/history").json()] == ["sql"]
        assert [r["skillId"] for r in alice.get("/api/v1/career-paths/frontend/recommendations").json()] == ["css", "javascript"]
        assert [r["skillId"] for r in bob.get("/api/v1/career-paths/frontend/recommendations").json()] == ["html"]
        a_cookie = alice.cookies["devatlas_session"]
        b_cookie = bob.cookies["devatlas_session"]

    with TestClient(app_for(url)) as restarted_a, TestClient(app_for(url)) as restarted_b:
        restarted_a.cookies.set("devatlas_session", a_cookie, path="/api/v1")
        restarted_b.cookies.set("devatlas_session", b_cookie, path="/api/v1")
        assert restarted_a.get("/api/v1/auth/me").json()["id"] == alice_id
        assert restarted_b.get("/api/v1/auth/me").json()["id"] == bob_id
        a_analytics = restarted_a.get("/api/v1/me/analytics").json()
        b_analytics = restarted_b.get("/api/v1/me/analytics").json()
        assert (a_analytics["completedSkills"], a_analytics["verifiedSkills"]) == (1, 1)
        assert (b_analytics["completedSkills"], b_analytics["verifiedSkills"]) == (0, 0)
        assert a_analytics["history"][0]["userId"] == alice_id
        assert b_analytics["history"][0]["userId"] == bob_id
        assert a_analytics["quizzes"]["bestScore"] == 100
        assert b_analytics["quizzes"]["bestScore"] == 40


def test_logout_and_new_login_do_not_expose_previous_owner(url):
    app = app_for(url)
    with TestClient(app) as client:
        owner_a = register(client, "alice@example.test")
        progress(client, "html", "completed")
        token_a = client.cookies["devatlas_session"]
        assert client.post("/api/v1/auth/logout").status_code == 204
        assert client.get("/api/v1/me/analytics").status_code == 401
        owner_b = register(client, "bob@example.test")
        assert owner_a != owner_b
        assert client.get("/api/v1/me/progress/history").json() == []
        assert client.get("/api/v1/me/quiz-attempts").json() == []
        assert next(x for x in client.get("/api/v1/progress").json() if x["skillId"] == "html")["status"] == "not_started"
    with TestClient(app_for(url)) as restart:
        restart.cookies.set("devatlas_session", token_a, path="/api/v1")
        assert restart.get("/api/v1/auth/me").status_code == 401


def test_parallel_accounts_independent_under_sqlite(url):
    # The same configured app has independent authenticated HTTP clients.
    app = app_for(url)
    def workflow(index):
        with TestClient(app) as client:
            owner = register(client, f"person{index}@example.test")
            skill = "html" if index % 2 == 0 else "python"
            progress(client, skill, "learning")
            quiz_submission(client, skill, 4)
            return owner, skill
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(workflow, (0, 1)))
    assert results[0][0] != results[1][0]
    with TestClient(app_for(url)) as client:
        assert client.get("/api/v1/progress").json()[0]["userId"] == "preview"
    engine = make_engine(url)
    try:
        with Session(engine) as session:
            assert session.scalar(select(func.count()).select_from(m.User)) == 2
            assert session.scalar(select(func.count()).select_from(m.QuizAttempt)) == 2
            assert session.scalar(select(func.count()).select_from(m.ProgressEvent)) == 2
    finally:
        engine.dispose()


def test_invalid_foreign_key_rolls_back_atomically(url):
    app_for(url)
    engine = make_engine(url)
    try:
        with pytest.raises(IntegrityError):
            with Session(engine) as session, session.begin():
                session.add(m.User(
                    id="rolled-back", display_name="Temp", email="temp@example.test",
                    password_hash="hash", created_at="2026-10-20T00:00:00.000Z",
                ))
                session.flush()
                session.add(m.UserSkillProgress(
                    user_id="rolled-back", skill_id="nonexistent",
                    status="learning", updated_at="2026-10-20T00:00:00.000Z",
                ))
        with Session(engine) as session:
            assert session.get(m.User, "rolled-back") is None
            assert session.scalar(select(func.count()).select_from(m.UserSkillProgress)) == 0
    finally:
        engine.dispose()


def test_invalid_quiz_submission_keeps_stored_attempts_unchanged(url):
    app = app_for(url)
    with TestClient(app) as client:
        register(client, "student@example.test")
        quiz_submission(client, "html", 4)
        before = client.get("/api/v1/me/quiz-attempts").json()
        quiz = client.get("/api/v1/skills/html/quiz").json()
        invalid = {"responses": [
            {"questionId": question["id"], "optionId": "wrong-option"}
            for question in quiz["questions"]
        ]}
        response = client.post("/api/v1/quizzes/quiz-html/attempts", json=invalid)
        assert response.status_code == 422
        assert client.get("/api/v1/me/quiz-attempts").json() == before
    with TestClient(app_for(url)) as restarted:
        response = restarted.post("/api/v1/auth/login", json={
            "email": "student@example.test", "password": "ExamplePassword123!"
        })
        assert response.status_code == 200
        assert restarted.get("/api/v1/me/quiz-attempts").json() == before

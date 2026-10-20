"""SQLite integration: real repositories, migrations and server restarts."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import make_engine
from app.main import create_app
from app import models as m
from app.quizzes import quiz_seeds


@pytest.fixture
def database_url(tmp_path: Path):
    return f"sqlite:///{(tmp_path / 'persistent.db').as_posix()}"


def app_for(url):
    return create_app(Settings(storage_backend="sqlite", database_url=url))


def sign_up(client, email="student@example.test"):
    response = client.post("/api/v1/auth/signup", json={
        "email": email, "password": "ExamplePassword123!", "displayName": "Student"
    })
    assert response.status_code == 201, response.text
    return response.json()["user"]["id"]


def make_answers(quiz):
    keys = quiz_seeds()["answerKeys"]
    return {"responses": [
        {"questionId": q["id"], "optionId": keys[q["id"]]["correctOptionId"]}
        for q in quiz["questions"]
    ]}


def test_sqlite_seeding_is_repeatable_and_graph_remains_valid(database_url):
    for _ in range(3):
        with TestClient(app_for(database_url)) as client:
            careers = client.get("/api/v1/career-paths").json()
            skills = client.get("/api/v1/skills").json()
            edges = client.get("/api/v1/dependencies").json()
            assert [career["id"] for career in careers] == ["frontend", "backend", "analyst"]
            assert len(skills) == 10 and len(edges) == 6
            assert len({skill["id"] for skill in skills}) == 10
            assert all(edge["skillId"] in {s["id"] for s in skills} for edge in edges)
            assert all(edge["prerequisiteId"] in {s["id"] for s in skills} for edge in edges)
            assert len(client.get("/api/v1/skills/html/quiz").json()["questions"]) == 5
    engine = make_engine(database_url)
    try:
        with Session(engine) as db:
            assert db.scalar(select(func.count()).select_from(m.Skill)) == 10
            assert db.scalar(select(func.count()).select_from(m.Quiz)) == 10
            assert db.scalar(select(func.count()).select_from(m.QuizQuestion)) == 50
            assert db.scalar(select(func.count()).select_from(m.AnswerOption)) == 200
            assert db.scalar(select(func.count()).select_from(m.PathSkill)) == 12
    finally:
        engine.dispose()


def test_restart_preserves_auth_and_progress_and_quiz(database_url):
    first = app_for(database_url)
    with TestClient(first) as client:
        owner = sign_up(client)
        token = client.cookies["devatlas_session"]
        changed = client.put("/api/v1/me/progress/html", json={"status": "completed"})
        assert changed.status_code == 200, changed.text
        quiz = client.get("/api/v1/skills/html/quiz").json()
        result = client.post("/api/v1/quizzes/quiz-html/attempts", json=make_answers(quiz))
        assert result.status_code == 201, result.text
        assert result.json()["attempt"]["score"] == 100

    second = app_for(database_url)
    with TestClient(second) as restarted:
        restarted.cookies.set("devatlas_session", token, path="/api/v1")
        session = restarted.get("/api/v1/auth/session").json()
        assert session["user"]["id"] == owner
        saved = next(p for p in restarted.get("/api/v1/progress").json() if p["skillId"] == "html")
        assert saved["userId"] == owner
        assert saved["status"] == "completed"
        assert saved["bestQuizScore"] == 100 and saved["verified"] is True
        assert len(restarted.get("/api/v1/me/progress/history").json()) == 1
        assert len(restarted.get("/api/v1/me/quiz-attempts").json()) == 1
        analytics = restarted.get("/api/v1/me/analytics").json()
        assert analytics["completedSkills"] == 1
        assert analytics["verifiedSkills"] == 1
        assert analytics["quizzes"]["attemptCount"] == 1


def test_sqlite_repositories_and_inmemory_can_coexist(database_url):
    from app.repositories import InMemoryRepositoryFactory
    from app.sql_repositories import SQLAlchemyRepositoryFactory
    persistent = app_for(database_url)
    assert isinstance(persistent.state.repositories, SQLAlchemyRepositoryFactory)
    memory = create_app(repository_factory=InMemoryRepositoryFactory())
    assert isinstance(memory.state.repositories, InMemoryRepositoryFactory)
    with TestClient(memory) as client:
        sign_up(client, "memory-only@example.test")
    with TestClient(persistent) as client:
        assert client.get("/api/v1/auth/session").json() is None
        assert client.get("/api/v1/career-paths").status_code == 200


def test_sqlite_isolated_by_database_file(tmp_path):
    one = f"sqlite:///{(tmp_path / 'one.db').as_posix()}"
    two = f"sqlite:///{(tmp_path / 'two.db').as_posix()}"
    with TestClient(app_for(one)) as first:
        sign_up(first, "only-one@example.test")
    with TestClient(app_for(two)) as second:
        assert second.get("/api/v1/progress").json()[0]["userId"] == "preview"
    engine = make_engine(two)
    try:
        with Session(engine) as db:
            assert db.scalar(select(func.count()).select_from(m.User)) == 0
    finally:
        engine.dispose()

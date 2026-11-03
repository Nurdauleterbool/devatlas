"""Regression tests for batched seed and non-blocking Render initialization."""
import time
from threading import Event

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app import models as m
from app.db import Base, make_engine, make_session_factory
from app.deferred import DeferredDatabaseApp
from app.fast_sql_seed import seed_sql_reference
from app.sql_repositories import SQLAlchemyRepositoryFactory


def test_batched_seed_populates_reference_data_without_duplication(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'seed-test.sqlite'}")
    try:
        Base.metadata.create_all(engine)
        sessions = make_session_factory(engine)
        factory = SQLAlchemyRepositoryFactory(sessions)
        first = seed_sql_reference(sessions, factory)
        assert first["skills"] == 10
        assert first["career_paths"] == 3
        assert first["quizzes"] == 10
        assert first["quiz_questions"] >= 50
        assert first["answer_options"] == first["quiz_questions"] * 4
        assert len(factory.create("career_paths").list()) == 3
        assert len(factory.create("quizzes").list()) == 10
        with sessions.begin() as session:
            session.add(m.User(id="customer", email="test@example.invalid",
                               display_name="Test", password_hash="not-real",
                               created_at="2026-01-01T00:00:00.000Z"))
        second = seed_sql_reference(sessions, factory)
        assert all(count == 0 for count in second.values())
        with sessions() as session:
            assert session.scalar(select(func.count()).select_from(m.User)) == 1
    finally:
        engine.dispose()


def test_deferred_server_binds_before_database_is_ready():
    db_gate = Event()
    started = Event()

    def build_app():
        started.set()
        if not db_gate.wait(timeout=3):
            raise RuntimeError("fixture was not released")
        nested = FastAPI()

        @nested.get("/api/v1/health")
        def health():
            return {"status": "ok"}

        return nested

    with TestClient(DeferredDatabaseApp(build_app)) as client:
        assert started.wait(timeout=2)
        response = client.get("/api/v1/health")
        assert response.status_code == 503
        assert response.json()["status"] == "initializing"
        assert response.headers["retry-after"] == "10"
        db_gate.set()
        for _ in range(100):
            response = client.get("/api/v1/health")
            if response.status_code == 200:
                break
            time.sleep(0.01)
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

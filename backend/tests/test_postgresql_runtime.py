"""PostgreSQL engine and real-DB user isolation integration tests."""
import os
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.db import normalize_url
from app.main import create_app


def test_postgresql_url_normalization():
    assert normalize_url("postgres://dev:password@db:5432/devatlas").startswith("postgresql+psycopg://")
    assert normalize_url("postgresql://dev:password@db/devatlas").startswith("postgresql+psycopg://")
    assert normalize_url("sqlite:///test.db") == "sqlite:///test.db"


def test_live_postgresql_user_data_persists_and_is_private():
    url = os.environ.get("DEVATLAS_TEST_POSTGRES_URL")
    if not url:
        pytest.skip("Set DEVATLAS_TEST_POSTGRES_URL to an isolated disposable database")
    settings = Settings(storage_backend="postgres", database_url=url)
    email = f"postgres-test-{uuid4().hex}@example.test"
    with TestClient(create_app(settings=settings)) as alice:
        created = alice.post("/api/v1/auth/signup", json={
            "displayName": "Postgres Tester", "email": email, "password": "CI-only-test-password-123"
        })
        assert created.status_code == 201, created.text
        selected = alice.put("/api/v1/me/careers", json={"careerIds": ["frontend"]})
        assert selected.status_code == 200, selected.text
        assert [x["careerId"] for x in alice.get("/api/v1/me/careers").json()] == ["frontend"]
        cookie = alice.cookies.get("devatlas_session")
    assert cookie
    with TestClient(create_app(settings=settings)) as reopened:
        reopened.cookies.set("devatlas_session", cookie, path="/api/v1")
        assert [x["careerId"] for x in reopened.get("/api/v1/me/careers").json()] == ["frontend"]
        reopened.cookies.clear()
        assert reopened.get("/api/v1/me/careers").status_code == 401

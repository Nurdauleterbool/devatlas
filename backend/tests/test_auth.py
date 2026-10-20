from datetime import datetime, timedelta, timezone
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from app.auth import enforce_owner, require_user
from app.config import Settings
from app.main import create_app

@pytest.fixture
def client():
    with TestClient(create_app()) as test_client:
        yield test_client

def signup(client, email="Ada@Example.Test", password="ExamplePassword123!"):
    return client.post("/api/v1/auth/signup", json={
        "email": email, "password": password, "displayName": "  Ada Student  "
    })

def test_signup_session_cookie_and_no_credential_leak(client):
    response = signup(client)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["kind"] == "http" and body["user"]["email"] == "ada@example.test"
    assert body["user"]["displayName"] == "Ada Student"
    assert "password" not in str(body).lower()
    assert response.headers["cache-control"] == "no-store"
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/api/v1" in cookie
    assert client.get("/api/v1/auth/session").json()["user"]["id"] == body["user"]["id"]
    assert client.get("/api/v1/auth/me").json() == body["user"]

def test_hash_only_in_repository(client):
    signup(client)
    users = client.app.state.repositories.create("users").list()
    assert len(users) == 1
    assert users[0]["passwordHash"].startswith("pbkdf2_sha256$")
    assert "ExamplePassword123!" not in str(users)
    assert len(client.app.state.repositories.create("sessions").list()) == 1

def test_duplicate_email_case_insensitive_and_state_unchanged(client):
    assert signup(client).status_code == 201
    response = signup(client, " ada@example.test ")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMAIL_IN_USE"
    assert len(client.app.state.repositories.create("users").list()) == 1

def test_invalid_credential_is_generic_and_does_not_rotate(client):
    signup(client)
    before = client.cookies["devatlas_session"]
    for email, password in (("unknown@example.test", "somethingwrong"), ("ada@example.test", "wrongpass")):
        response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"
    assert client.cookies["devatlas_session"] == before

def test_login_rotates_session_and_revokes_previous_cookie(client):
    signup(client)
    old = client.cookies["devatlas_session"]
    response = client.post("/api/v1/auth/login", json={
        "email": " ADA@EXAMPLE.TEST ", "password": "ExamplePassword123!"
    })
    assert response.status_code == 200
    assert client.cookies["devatlas_session"] != old
    other = TestClient(client.app)
    other.cookies.set("devatlas_session", old, path="/api/v1")
    assert other.get("/api/v1/auth/me").status_code == 401

def test_logout_revokes_and_is_idempotent(client):
    signup(client)
    old = client.cookies["devatlas_session"]
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/auth/session").json() is None
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.post("/api/v1/auth/logout").status_code == 204
    other = TestClient(client.app)
    other.cookies.set("devatlas_session", old, path="/api/v1")
    assert other.get("/api/v1/auth/me").status_code == 401

def test_session_expiry():
    now = [datetime(2026, 10, 20, tzinfo=timezone.utc)]
    app = create_app()
    app.state.auth.clock = lambda: now[0]
    with TestClient(app) as client:
        signup(client)
        now[0] += timedelta(hours=8)
        assert client.get("/api/v1/auth/session").json() is None
        assert client.get("/api/v1/auth/me").status_code == 401

def test_cookie_secure_in_production():
    with TestClient(create_app(settings=Settings(environment="production"))) as client:
        assert "Secure" in signup(client).headers["set-cookie"]

def test_unsafe_origin_and_cross_site_requests_rejected(client):
    payload = {"email": "someone@example.test", "password": "Password123!", "displayName": "X"}
    for headers in ({"Origin": "https://evil.example"}, {"Origin": "null"}, {"Sec-Fetch-Site": "cross-site"}):
        response = client.post("/api/v1/auth/signup", json=payload, headers=headers)
        assert response.status_code == 403, response.text
    assert len(client.app.state.repositories.create("users").list()) == 0
    assert client.post("/api/v1/auth/signup", json=payload, headers={
        "Origin": "http://localhost:5173"
    }).status_code == 201

def test_validation_error_envelope_and_reject_owner_fields(client):
    response = client.post("/api/v1/auth/signup", json={
        "email": "bad", "password": "12345678", "displayName": "X", "userId": "attacker"
    })
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION"

def test_require_user_and_cross_user_boundary(client):
    @client.app.get("/api/v1/_my-record")
    def mine(user=Depends(require_user)):
        return {"userId": user.id}

    @client.app.get("/api/v1/_owned/{owner_id}")
    def owned(owner_id: str, user=Depends(require_user)):
        enforce_owner(owner_id, user)
        return {"userId": owner_id}

    assert client.get("/api/v1/_my-record").status_code == 401
    alice = signup(client, email="alice@example.test").json()["user"]["id"]
    assert client.get("/api/v1/_my-record").json()["userId"] == alice
    bob_client = TestClient(client.app)
    bob = signup(bob_client, email="bob@example.test").json()["user"]["id"]
    assert client.get(f"/api/v1/_owned/{bob}").status_code == 403
    assert bob_client.get(f"/api/v1/_owned/{alice}").status_code == 403
    assert client.get(f"/api/v1/_owned/{alice}").status_code == 200

def test_repository_and_session_isolated_between_app_instances():
    first, second = create_app(), create_app()
    with TestClient(first) as a, TestClient(second) as b:
        signup(a)
        b.cookies.set("devatlas_session", a.cookies["devatlas_session"], path="/api/v1")
        assert b.get("/api/v1/auth/me").status_code == 401

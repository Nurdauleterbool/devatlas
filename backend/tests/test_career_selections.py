from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app


def make_client(database_url=None):
    if database_url:
        return TestClient(create_app(Settings(storage_backend="sqlite", database_url=database_url)))
    return TestClient(create_app())


def signup(client, email):
    r = client.post("/api/v1/auth/signup", json={
        "displayName": "Student", "email": email, "password": "ExamplePassword123!"
    })
    assert r.status_code == 201, r.text
    return r.json()["user"]["id"]


@pytest.mark.parametrize("persistent", [False, True])
def test_owned_career_selections_validate_and_preserve_timestamp(tmp_path: Path, persistent):
    url = f"sqlite:///{(tmp_path / 'career-selection.db').as_posix()}" if persistent else None
    with make_client(url) as alice, make_client(url) as bob:
        alice_id = signup(alice, "alice@example.test")
        bob_id = signup(bob, "bob@example.test")
        assert alice.get("/api/v1/me/careers").json() == []
        result = alice.put("/api/v1/me/careers", json={"careerIds": ["frontend", "analyst"]})
        assert result.status_code == 200, result.text
        saved = result.json()
        assert [row["careerId"] for row in saved] == ["frontend", "analyst"]
        assert all(row["userId"] == alice_id for row in saved)
        assert all(set(row) == {"userId", "careerId", "selectedAt"} for row in saved)
        again = alice.put("/api/v1/me/careers", json={"careerIds": ["analyst", "frontend"]})
        assert again.status_code == 200, again.text
        assert {row["careerId"]: row["selectedAt"] for row in again.json()} == {
            row["careerId"]: row["selectedAt"] for row in saved
        }
        for payload, status in [
            ({"careerIds": ["frontend", "frontend"]}, 422),
            ({"careerIds": ["missing"]}, 404),
            ({"careerIds": ["frontend"], "userId": bob_id}, 422),
        ]:
            invalid = alice.put("/api/v1/me/careers", json=payload)
            assert invalid.status_code == status
            assert alice.get("/api/v1/me/careers").json() == again.json()
        assert bob.get("/api/v1/me/careers").json() == []
        assert alice.put("/api/v1/me/careers", json={"careerIds": []}).json() == []
        assert bob.get("/api/v1/me/careers").json() == []


def test_persisted_selection_survives_restart_and_is_owned(tmp_path: Path):
    url = f"sqlite:///{(tmp_path / 'reopen.db').as_posix()}"
    with make_client(url) as first:
        owner = signup(first, "alice@example.test")
        cookie = first.cookies["devatlas_session"]
        r = first.put("/api/v1/me/careers", json={"careerIds": ["backend"]})
        assert r.status_code == 200, r.text
        before = r.json()
    with make_client(url) as reopened:
        reopened.cookies.set("devatlas_session", cookie, path="/api/v1")
        assert reopened.get("/api/v1/me/careers").json() == before
        assert reopened.get("/api/v1/me/careers").json()[0]["userId"] == owner


def test_unauthed_and_cross_origin_selection_requests_fail():
    with make_client() as client:
        assert client.get("/api/v1/me/careers").status_code == 401
        assert client.put("/api/v1/me/careers", json={"careerIds": ["frontend"]}).status_code == 401
        signup(client, "alice@example.test")
        response = client.put("/api/v1/me/careers", json={"careerIds": ["frontend"]},
                              headers={"Origin": "https://untrusted.example"})
        assert response.status_code == 403
        assert client.get("/api/v1/me/careers").json() == []

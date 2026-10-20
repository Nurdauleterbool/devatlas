from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


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


def test_public_progress_is_synthetic_not_a_real_account(app):
    alice, _ = register(app, "alice@example.test")
    assert alice.put("/api/v1/me/progress/html", json={"status": "completed"}).status_code == 200
    with TestClient(app) as anonymous:
        response = anonymous.get("/api/v1/progress")
        assert response.status_code == 200
        progress = response.json()
        assert len(progress) == 10
        assert all(p["userId"] == "preview" and p["status"] == "not_started"
                   and p["verified"] is False and p["bestQuizScore"] is None
                   and p["updatedAt"] == "1970-01-01T00:00:00.000Z" for p in progress)


def test_authenticated_default_progress_uses_account_creation(app):
    alice, alice_id = register(app, "alice@example.test")
    response = alice.get("/api/v1/progress")
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    data = response.json()
    assert len(data) == 10
    assert all(p["userId"] == alice_id and p["status"] == "not_started" for p in data)
    assert all(p["verified"] is False and p["bestQuizScore"] is None for p in data)
    assert len({p["skillId"] for p in data}) == len(data)


def test_status_transitions_and_noop_are_recorded_once(app):
    alice, alice_id = register(app, "alice@example.test")
    for status in ("learning", "completed", "not_started"):
        response = alice.put("/api/v1/me/progress/html", json={"status": status})
        assert response.status_code == 200, response.text
        assert response.json()["status"] == status
        assert response.json()["userId"] == alice_id
        assert response.headers["Cache-Control"] == "no-store"
    assert alice.put("/api/v1/me/progress/html", json={"status": "not_started"}).status_code == 200
    history = alice.get("/api/v1/me/progress/history").json()
    assert [h["fromStatus"] for h in history] == ["not_started", "learning", "completed"]
    assert [h["toStatus"] for h in history] == ["learning", "completed", "not_started"]
    assert all(h["skillId"] == "html" and h["userId"] == alice_id and h["changedAt"] for h in history)
    assert len({h["id"] for h in history}) == 3


def test_user_isolation_and_account_switch(app):
    alice, alice_id = register(app, "alice@example.test")
    bob, bob_id = register(app, "bob@example.test")
    assert alice.put("/api/v1/me/progress/sql", json={"status": "completed"}).status_code == 200
    assert bob.put("/api/v1/me/progress/python", json={"status": "learning"}).status_code == 200
    rows_a = {row["skillId"]: row for row in alice.get("/api/v1/progress").json()}
    rows_b = {row["skillId"]: row for row in bob.get("/api/v1/progress").json()}
    assert rows_a["sql"]["status"] == "completed" and rows_a["python"]["status"] == "not_started"
    assert rows_b["sql"]["status"] == "not_started" and rows_b["python"]["status"] == "learning"
    assert {row["userId"] for row in rows_a.values()} == {alice_id}
    assert {row["userId"] for row in rows_b.values()} == {bob_id}
    assert {e["skillId"] for e in alice.get("/api/v1/me/progress/history").json()} == {"sql"}
    assert {e["skillId"] for e in bob.get("/api/v1/me/progress/history").json()} == {"python"}


def test_unauthenticated_personal_requests_rejected(app):
    with TestClient(app) as client:
        assert client.get("/api/v1/me/progress/history").status_code == 401
        assert client.put("/api/v1/me/progress/html", json={"status": "learning"}).status_code == 401
        assert client.get("/api/v1/me/progress/history").json()["error"]["code"] == "UNAUTHENTICATED"


def test_invalid_status_unknown_skill_and_forged_owner_do_not_write(app):
    alice, _ = register(app, "alice@example.test")
    for payload in (
        {"status": "verified"},
        {"status": "completed", "userId": "other"},
        {"status": "learning", "updatedAt": "2000-01-01T00:00:00Z"},
        {"status": "learning", "verified": True},
    ):
        response = alice.put("/api/v1/me/progress/html", json=payload)
        assert response.status_code == 422, response.text
        assert response.json()["error"]["code"] == "VALIDATION"
    unknown = alice.put("/api/v1/me/progress/unknown", json={"status": "learning"})
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "NOT_FOUND"
    assert alice.get("/api/v1/me/progress/history").json() == []
    assert all(p["status"] == "not_started" for p in alice.get("/api/v1/progress").json())


def test_unsafe_origins_do_not_change_progress(app):
    alice, _ = register(app, "alice@example.test")
    for headers in ({"Origin": "https://evil.example"}, {"Sec-Fetch-Site": "cross-site"}):
        response = alice.put("/api/v1/me/progress/html", json={"status": "completed"}, headers=headers)
        assert response.status_code == 403
    assert alice.get("/api/v1/me/progress/history").json() == []


def test_chronological_history_and_stable_ties(app):
    alice, _ = register(app, "alice@example.test")
    clock = [datetime(2026, 10, 20, tzinfo=timezone.utc)]
    app.state.auth.clock = lambda: clock[0]
    alice.put("/api/v1/me/progress/html", json={"status": "learning"})
    alice.put("/api/v1/me/progress/sql", json={"status": "completed"})
    clock[0] += timedelta(minutes=1)
    alice.put("/api/v1/me/progress/html", json={"status": "completed"})
    history = alice.get("/api/v1/me/progress/history").json()
    assert [event["skillId"] for event in history] == ["html", "sql", "html"]
    assert history[0]["changedAt"] == history[1]["changedAt"]
    assert history[2]["changedAt"] > history[1]["changedAt"]


def test_attempt_metadata_is_derived_and_independent_of_status(app):
    alice, owner = register(app, "alice@example.test")
    attempt_repo = app.state.repositories.create("quiz_attempts")
    attempt_repo.put("a1", {"userId": owner, "skillId": "html", "score": 80,
                            "passed": True, "submittedAt": "2030-10-20T10:00:00.000Z"})
    attempt_repo.put("a2", {"userId": owner, "skillId": "html", "score": 20,
                            "passed": False, "submittedAt": "2030-10-20T11:00:00.000Z"})
    row = next(p for p in alice.get("/api/v1/progress").json() if p["skillId"] == "html")
    assert row["verified"] is True and row["bestQuizScore"] == 80
    assert row["updatedAt"] == "2030-10-20T11:00:00.000Z"
    assert alice.put("/api/v1/me/progress/html", json={"status": "completed"}).json()["verified"] is True
    assert alice.put("/api/v1/me/progress/html", json={"status": "not_started"}).json()["verified"] is True


def test_progress_operation_ids_match_contract(app):
    with TestClient(app) as client:
        paths = client.get("/openapi.json").json()["paths"]
    assert paths["/api/v1/progress"]["get"]["operationId"] == "getProgress"
    assert paths["/api/v1/me/progress/{skillId}"]["put"]["operationId"] == "updateProgress"
    assert paths["/api/v1/me/progress/history"]["get"]["operationId"] == "getProgressHistory"

from fastapi import Depends
from fastapi.testclient import TestClient
from app.config import Settings
from app.dependencies import get_user_repository
from app.main import create_app
from app.repositories import InMemoryRepository, InMemoryRepositoryFactory


def test_health_endpoint_follows_contract():
    with TestClient(create_app()) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_openapi_documents_health():
    with TestClient(create_app()) as client:
        body = client.get("/openapi.json").json()
    assert "/api/v1/health" in body["paths"]


def test_repositories_are_isolated_by_name():
    factory = InMemoryRepositoryFactory()
    users = factory.create("users")
    users.put("u1", {"name": "Ada"})
    assert factory.create("users").get("u1") == {"name": "Ada"}
    assert factory.create("progress").get("u1") is None


def test_repositories_are_defensively_copied():
    repo = InMemoryRepository({"u1": {"tags": ["a"]}})
    value = repo.get("u1")
    value["tags"].append("b")
    assert repo.get("u1") == {"tags": ["a"]}
    listed = repo.list()
    listed[0]["tags"].append("c")
    assert repo.get("u1") == {"tags": ["a"]}


def test_repo_crud_and_validation():
    repo = InMemoryRepository()
    repo.put("a", {"v": 1})
    assert repo.list() == [{"v": 1}]
    assert repo.delete("a") is True
    assert repo.delete("a") is False
    assert repo.get("a") is None


def test_app_storage_instances_are_independent():
    first = create_app()
    second = create_app()
    first.state.repositories.create("users").put("a", {"x": 1})
    assert second.state.repositories.create("users").get("a") is None


def test_configurable_cors():
    app = create_app(settings=Settings(frontend_origin="https://example.test"))
    with TestClient(app) as client:
        good = client.options("/api/v1/health", headers={
            "Origin": "https://example.test", "Access-Control-Request-Method": "GET"})
        bad = client.options("/api/v1/health", headers={
            "Origin": "https://wrong.test", "Access-Control-Request-Method": "GET"})
    assert good.headers.get("access-control-allow-origin") == "https://example.test"
    assert "access-control-allow-origin" not in bad.headers


def test_can_replace_storage_without_changing_route():
    class ReplacementFactory:
        def create(self, name):
            return InMemoryRepository({"replacement": {"value": name}})

    app = create_app(repository_factory=ReplacementFactory())

    @app.get("/api/v1/_dependency-test")
    def example(repo=Depends(get_user_repository)):
        return repo.get("replacement")

    with TestClient(app) as client:
        response = client.get("/api/v1/_dependency-test")
    assert response.status_code == 200
    assert response.json() == {"value": "users"}

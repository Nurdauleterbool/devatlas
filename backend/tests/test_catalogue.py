from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.catalogue_seed import CATALOGUE, validate_catalogue
from app.main import create_app
from app.repositories import InMemoryRepositoryFactory

BASE = "/api/v1"

@pytest.fixture
def client():
    with TestClient(create_app()) as client:
        yield client

def test_three_career_paths_and_shared_skills(client):
    response = client.get(f"{BASE}/career-paths")
    assert response.status_code == 200
    paths = response.json()
    assert [path["id"] for path in paths] == ["frontend", "backend", "analyst"]
    assert len(client.get(f"{BASE}/skills").json()) == 10
    assert "python" in next(path["skillIds"] for path in paths if path["id"] == "backend")
    assert "python" in next(path["skillIds"] for path in paths if path["id"] == "analyst")

def test_all_career_detail_matches_list_and_contract_shape(client):
    paths = client.get(f"{BASE}/career-paths").json()
    for path in paths:
        response = client.get(f'{BASE}/career-paths/{path["id"]}')
        assert response.status_code == 200
        assert response.json() == path
        assert set(path) == {"id", "name", "description", "skillIds"}

def test_all_skill_details_and_learning_materials(client):
    skills = client.get(f"{BASE}/skills").json()
    for skill in skills:
        skill_id = skill["id"]
        assert client.get(f"{BASE}/skills/{skill_id}").json() == skill
        resources = client.get(f"{BASE}/skills/{skill_id}/resources")
        tasks = client.get(f"{BASE}/skills/{skill_id}/practice-tasks")
        assert resources.status_code == tasks.status_code == 200
        assert resources.json() and tasks.json()
        assert all(row["skillId"] == skill_id for row in resources.json() + tasks.json())
        assert all(row["isFree"] is True and row["url"].startswith("https://") for row in resources.json())

def test_missing_path_and_skill_return_contract_error(client):
    for suffix in (
        "/career-paths/does-not-exist",
        "/skills/does-not-exist",
        "/skills/does-not-exist/resources",
        "/skills/does-not-exist/practice-tasks",
    ):
        response = client.get(f"{BASE}{suffix}")
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"
        assert response.headers.get("cache-control") == "no-store"

def test_edges_reference_existing_skills_and_have_no_cycles(client):
    skills = {row["id"] for row in client.get(f"{BASE}/skills").json()}
    edges = client.get(f"{BASE}/dependencies").json()
    assert len(edges) == 6
    assert all(set(e) == {"skillId", "prerequisiteId"} for e in edges)
    assert all(e["skillId"] in skills and e["prerequisiteId"] in skills for e in edges)
    validate_catalogue(CATALOGUE)

def test_reject_invalid_graph_refs_cycles_duplicate_and_insecure_resource():
    def mutate(section, fn):
        data = deepcopy(CATALOGUE)
        fn(data[section])
        with pytest.raises(ValueError):
            validate_catalogue(data)
    mutate("dependencies", lambda edges: edges.append({"skillId": "react", "prerequisiteId": "unknown"}))
    mutate("dependencies", lambda edges: edges.append({"skillId": "html", "prerequisiteId": "react"}))
    mutate("skills", lambda skills: skills.append(deepcopy(skills[0])))
    mutate("learning_resources", lambda resources: resources[0].update(url="http://insecure.test"))

def test_read_only_catalogue_is_public_without_cookie(client):
    paths = client.get(f"{BASE}/career-paths")
    assert paths.status_code == 200
    assert client.get(f"{BASE}/auth/me").status_code == 401

def test_seeded_factory_is_application_scoped_and_can_be_replaced():
    a = create_app()
    b = create_app()
    a.state.repositories.create("skills").put("extra", {"id": "extra", "name": "Extra", "description": "Test"})
    with TestClient(a) as first, TestClient(b) as second:
        assert len(first.get(f"{BASE}/skills").json()) == 11
        assert len(second.get(f"{BASE}/skills").json()) == 10

def test_preloaded_repository_is_respected():
    factory = InMemoryRepositoryFactory()
    factory.create("skills").put("custom", {"id": "custom", "name": "Custom", "description": "Injected"})
    with TestClient(create_app(repository_factory=factory)) as client:
        assert client.get(f"{BASE}/skills").json() == [{"id": "custom", "name": "Custom", "description": "Injected"}]

def test_openapi_catalogue_operations_are_exposed(client):
    schema = client.get("/openapi.json").json()
    assert schema["paths"]["/api/v1/career-paths"]["get"]["operationId"] == "getCareerPaths"
    assert schema["paths"]["/api/v1/dependencies"]["get"]["operationId"] == "getDependencies"
    assert schema["paths"]["/api/v1/skills/{skillId}/resources"]["get"]["operationId"] == "getLearningResources"

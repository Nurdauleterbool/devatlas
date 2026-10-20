"""Read-only public career, skill, prerequisite and learning catalogue APIs."""
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict

from .auth import denied
from .repositories import RepositoryFactory

router = APIRouter(prefix="/api/v1", tags=["Catalogue"])

class PublicModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

class CareerPath(PublicModel):
    id: str
    name: str
    description: str
    skillIds: list[str]

class Skill(PublicModel):
    id: str
    name: str
    description: str

class Dependency(PublicModel):
    skillId: str
    prerequisiteId: str

class LearningResource(PublicModel):
    id: str
    skillId: str
    title: str
    url: str
    kind: str
    isFree: bool

class PracticeTask(PublicModel):
    id: str
    skillId: str
    title: str
    description: str

def get_factory(request: Request) -> RepositoryFactory:
    return request.app.state.repositories

Factory = Annotated[RepositoryFactory, Depends(get_factory)]

def require_item(factory: RepositoryFactory, collection: str, identifier: str) -> dict:
    record = factory.create(collection).get(identifier)
    if record is None:
        raise denied("NOT_FOUND", f"{collection.replace('_', ' ').title()} not found.", 404)
    return record

@router.get("/career-paths", response_model=list[CareerPath], operation_id="getCareerPaths")
def get_careers(factory: Factory):
    return factory.create("career_paths").list()

@router.get("/career-paths/{careerId}", response_model=CareerPath, operation_id="getCareerPath")
def get_career(careerId: str, factory: Factory):
    return require_item(factory, "career_paths", careerId)

@router.get("/skills", response_model=list[Skill], operation_id="getSkills")
def get_skills(factory: Factory):
    return factory.create("skills").list()

@router.get("/skills/{skillId}", response_model=Skill, operation_id="getSkill")
def get_skill(skillId: str, factory: Factory):
    return require_item(factory, "skills", skillId)

@router.get("/dependencies", response_model=list[Dependency], operation_id="getDependencies")
def get_dependencies(factory: Factory):
    return factory.create("dependencies").list()

@router.get("/skills/{skillId}/resources", response_model=list[LearningResource], operation_id="getLearningResources")
def get_resources(skillId: str, factory: Factory):
    require_item(factory, "skills", skillId)
    return [r for r in factory.create("learning_resources").list() if r["skillId"] == skillId]

@router.get("/skills/{skillId}/practice-tasks", response_model=list[PracticeTask], operation_id="getPracticeTasks")
def get_practice(skillId: str, factory: Factory):
    require_item(factory, "skills", skillId)
    return [r for r in factory.create("practice_tasks").list() if r["skillId"] == skillId]

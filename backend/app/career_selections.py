"""Authenticated career selections, compatible with the frozen HTTP contract."""
from threading import RLock
from typing import Annotated
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from .auth import PublicUser, check_unsafe_origin, denied, iso_time, require_user
from .repositories import RepositoryFactory

router = APIRouter(prefix="/api/v1", tags=["Learning progress"])
lock = RLock()

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

class SelectCareersInput(StrictModel):
    careerIds: list[str]

class UserCareerPath(StrictModel):
    userId: str
    careerId: str
    selectedAt: str

def factory_from_request(request: Request) -> RepositoryFactory:
    return request.app.state.repositories

Factory = Annotated[RepositoryFactory, Depends(factory_from_request)]
CurrentUser = Annotated[PublicUser, Depends(require_user)]

def owned(factory: RepositoryFactory, owner: str) -> list[dict]:
    return [
        {key: item[key] for key in ("userId", "careerId", "selectedAt")}
        for item in factory.create("selected_careers").list() if item["userId"] == owner
    ]

@router.get("/me/careers", response_model=list[UserCareerPath], operation_id="getSelectedCareers")
def get_careers(factory: Factory, user: CurrentUser):
    return owned(factory, user.id)

@router.put("/me/careers", response_model=list[UserCareerPath], operation_id="setSelectedCareers",
            dependencies=[Depends(check_unsafe_origin)])
def put_careers(payload: SelectCareersInput, request: Request, factory: Factory, user: CurrentUser):
    ids = payload.careerIds
    if len(ids) != len(set(ids)) or any(not value for value in ids):
        raise denied("VALIDATION", "Career IDs must be unique and nonblank.", 422)
    careers = factory.create("career_paths")
    for identifier in ids:
        if careers.get(identifier) is None:
            raise denied("NOT_FOUND", "Career path not found.", 404)
    # The repository API is synchronous. Serialize writes for this application.
    with lock:
        previous = owned(factory, user.id)
        existing = {row["careerId"]: row for row in previous}
        timestamp = iso_time(request.app.state.auth.clock())
        repo = factory.create("selected_careers")
        for row in previous:
            repo.delete(f'{user.id}:{row["careerId"]}')
        for career_id in ids:
            row = existing.get(career_id) or {
                "userId": user.id, "careerId": career_id, "selectedAt": timestamp,
            }
            repo.put(f"{user.id}:{career_id}", row)
        return owned(factory, user.id)

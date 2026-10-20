"""Owned learning progress, immutable change history, and anonymous previews.

The service uses replaceable repository protocols. Updates serialize within one
FastAPI process; durable transactions are the responsibility of #16–#18.
"""
from __future__ import annotations

from threading import RLock
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict

from .auth import PublicUser, check_unsafe_origin, denied, iso_time, require_user
from .repositories import RepositoryFactory

router = APIRouter(prefix="/api/v1", tags=["Learning progress"])
PREVIEW_TIME = "1970-01-01T00:00:00.000Z"
Status = Literal["not_started", "learning", "completed"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class UpdateProgressInput(StrictModel):
    status: Status


class Progress(StrictModel):
    userId: str
    skillId: str
    status: Status
    updatedAt: str
    verified: bool
    bestQuizScore: int | None


class ProgressEvent(StrictModel):
    id: str
    userId: str
    skillId: str
    fromStatus: Status
    toStatus: Status
    changedAt: str


class ProgressManager:
    def __init__(self, factory: RepositoryFactory, auth):
        self.factory = factory
        self.auth = auth
        self._lock = RLock()

    def _progress_repository(self):
        return self.factory.create("progress")

    def _history_repository(self):
        return self.factory.create("progress_history")

    def _attempt_repository(self):
        return self.factory.create("quiz_attempts")

    def _user_created(self, user_id: str) -> str:
        user = self.factory.create("users").get(user_id)
        if user is None:
            raise denied("UNAUTHENTICATED", "Sign in to continue.", 401)
        return user["createdAt"]

    def _attempts(self, user_id: str, skill_id: str) -> list[dict]:
        return [
            attempt for attempt in self._attempt_repository().list()
            if attempt.get("userId") == user_id and attempt.get("skillId") == skill_id
        ]

    def _single(self, user_id: str, skill_id: str) -> Progress:
        if user_id == "preview":
            return Progress(userId="preview", skillId=skill_id,
                            status="not_started", updatedAt=PREVIEW_TIME,
                            verified=False, bestQuizScore=None)
        record = self._progress_repository().get(f"{user_id}:{skill_id}")
        attempts = self._attempts(user_id, skill_id)
        times = [record["updatedAt"] if record else self._user_created(user_id)]
        times.extend(attempt["submittedAt"] for attempt in attempts)
        return Progress(
            userId=user_id, skillId=skill_id,
            status=record["status"] if record else "not_started",
            updatedAt=max(times),
            verified=any(bool(attempt["passed"]) for attempt in attempts),
            bestQuizScore=max((attempt["score"] for attempt in attempts), default=None),
        )

    def all(self, user_id: str) -> list[Progress]:
        with self._lock:
            return [self._single(user_id, skill["id"]) for skill in self.factory.create("skills").list()]

    def update(self, user_id: str, skill_id: str, status: Status) -> Progress:
        with self._lock:
            if self.factory.create("skills").get(skill_id) is None:
                raise denied("NOT_FOUND", "Skill not found.", 404)
            previous = self._single(user_id, skill_id)
            if previous.status == status:
                return previous
            changed_at = iso_time(self.auth.clock())
            self._progress_repository().put(f"{user_id}:{skill_id}", {
                "userId": user_id, "skillId": skill_id,
                "status": status, "updatedAt": changed_at,
            })
            event_id = f"progress-{uuid4().hex}"
            self._history_repository().put(event_id, {
                "id": event_id, "userId": user_id, "skillId": skill_id,
                "fromStatus": previous.status, "toStatus": status,
                "changedAt": changed_at,
            })
            return self._single(user_id, skill_id)

    def history(self, user_id: str) -> list[ProgressEvent]:
        with self._lock:
            events = [e for e in self._history_repository().list() if e["userId"] == user_id]
            # Python's stable sort retains recorded order for identical timestamps.
            return [ProgressEvent(**event) for event in sorted(events, key=lambda e: e["changedAt"])]


def get_manager(request: Request) -> ProgressManager:
    return request.app.state.progress_manager


Manager = Annotated[ProgressManager, Depends(get_manager)]
CurrentUser = Annotated[PublicUser, Depends(require_user)]


def current_owner(request: Request) -> str:
    current = request.app.state.auth.current_user(request.cookies.get("devatlas_session"))
    return current[0]["id"] if current else "preview"


@router.get("/progress", response_model=list[Progress], operation_id="getProgress")
def get_progress(request: Request, manager: Manager):
    return manager.all(current_owner(request))


@router.put("/me/progress/{skillId}", response_model=Progress,
            operation_id="updateProgress", dependencies=[Depends(check_unsafe_origin)])
def put_progress(skillId: str, payload: UpdateProgressInput, manager: Manager, user: CurrentUser):
    return manager.update(user.id, skillId, payload.status)


@router.get("/me/progress/history", response_model=list[ProgressEvent],
            operation_id="getProgressHistory")
def get_history(manager: Manager, user: CurrentUser):
    return manager.history(user.id)

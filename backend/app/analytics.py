"""Explainable deterministic recommendations and cookie-owned dashboard analytics."""
from __future__ import annotations

from collections import defaultdict
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict

from .auth import PublicUser, denied, require_user
from .progress import ProgressEvent, ProgressManager, current_owner
from .quizzes import QuizManager
from .repositories import RepositoryFactory

router = APIRouter(prefix="/api/v1", tags=["Analytics"])


def round_nonnegative(numerator: int, denominator: int) -> int:
    """Integer half-up rounding, consistent with nonnegative JavaScript Math.round."""
    return (2 * numerator + denominator) // (2 * denominator) if denominator else 0


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CareerProgress(Model):
    careerId: str
    totalSkills: int
    completedSkills: int
    verifiedSkills: int
    completionPercent: int


class QuizStatistics(Model):
    attemptCount: int
    passedCount: int
    bestScore: int | None
    averageScore: int | None


class Analytics(Model):
    userId: str
    totalSkills: int
    completedSkills: int
    learningSkills: int
    verifiedSkills: int
    careers: list[CareerProgress]
    quizzes: QuizStatistics
    history: list[ProgressEvent]


class Recommendation(Model):
    careerId: str
    skillId: str
    rank: int
    priority: Literal["continue_learning", "start_next"]
    prerequisiteIds: list[str]
    reason: str


class AnalyticsManager:
    def __init__(self, factory: RepositoryFactory, progress: ProgressManager, quizzes: QuizManager):
        self.factory = factory
        self.progress = progress
        self.quizzes = quizzes

    def _paths(self) -> list[dict]:
        return self.factory.create("career_paths").list()

    def analytics(self, user_id: str) -> Analytics:
        # Reuse the existing user-isolated progress, attempt and history services.
        progress = {item.skillId: item for item in self.progress.all(user_id)}
        attempts = self.quizzes.attempts_for(user_id)
        scores = [attempt.score for attempt in attempts]
        summaries: list[CareerProgress] = []
        for career in self._paths():
            ids = list(dict.fromkeys(career["skillIds"]))
            completed = sum(progress[id_].status == "completed" for id_ in ids)
            verified = sum(progress[id_].verified for id_ in ids)
            summaries.append(CareerProgress(
                careerId=career["id"], totalSkills=len(ids),
                completedSkills=completed, verifiedSkills=verified,
                completionPercent=round_nonnegative(completed * 100, len(ids)),
            ))
        return Analytics(
            userId=user_id, totalSkills=len(progress),
            completedSkills=sum(record.status == "completed" for record in progress.values()),
            learningSkills=sum(record.status == "learning" for record in progress.values()),
            verifiedSkills=sum(record.verified for record in progress.values()),
            careers=summaries,
            quizzes=QuizStatistics(
                attemptCount=len(attempts),
                passedCount=sum(attempt.passed for attempt in attempts),
                bestScore=max(scores) if scores else None,
                averageScore=round_nonnegative(sum(scores), len(scores)) if scores else None,
            ),
            history=self.progress.history(user_id),
        )

    def recommendations(self, career_id: str, user_id: str) -> list[Recommendation]:
        career = self.factory.create("career_paths").get(career_id)
        if career is None:
            raise denied("NOT_FOUND", "Career path not found.", 404)
        skill_names = {
            item["id"]: item["name"] for item in self.factory.create("skills").list()
        }
        progress = {item.skillId: item for item in self.progress.all(user_id)}
        parents: dict[str, list[str]] = defaultdict(list)
        for edge in self.factory.create("dependencies").list():
            parents[edge["skillId"]].append(edge["prerequisiteId"])
        eligible: list[tuple[int, int, Recommendation]] = []
        for index, skill_id in enumerate(dict.fromkeys(career["skillIds"])):
            item = progress[skill_id]
            if item.status == "completed" or item.verified:
                continue
            prerequisites = parents[skill_id]
            if not all(progress[parent].status == "completed" or progress[parent].verified for parent in prerequisites):
                continue
            priority = "continue_learning" if item.status == "learning" else "start_next"
            action = "Continue learning" if priority == "continue_learning" else "Start learning"
            if prerequisites:
                description = ", ".join(skill_names[parent] for parent in prerequisites)
                reason = f"{action} {skill_names[skill_id]}; prerequisites completed or verified: {description}."
            else:
                reason = f"{action} {skill_names[skill_id]}; no prerequisites required."
            eligible.append((0 if priority == "continue_learning" else 1, index, Recommendation(
                careerId=career_id, skillId=skill_id, rank=0, priority=priority,
                prerequisiteIds=prerequisites, reason=reason,
            )))
        eligible.sort(key=lambda item: (item[0], item[1]))
        return [recommendation.model_copy(update={"rank": rank})
                for rank, (_, _, recommendation) in enumerate(eligible, start=1)]


def get_analytics_manager(request: Request) -> AnalyticsManager:
    return request.app.state.analytics_manager


Manager = Annotated[AnalyticsManager, Depends(get_analytics_manager)]
CurrentUser = Annotated[PublicUser, Depends(require_user)]


@router.get("/me/analytics", response_model=Analytics, operation_id="getAnalytics")
def get_analytics(manager: Manager, user: CurrentUser):
    return manager.analytics(user.id)


@router.get("/career-paths/{careerId}/recommendations", response_model=list[Recommendation],
            operation_id="getRecommendations")
def get_recommendations(careerId: str, request: Request, manager: Manager):
    return manager.recommendations(careerId, current_owner(request))

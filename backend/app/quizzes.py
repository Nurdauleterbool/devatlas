"""Server-graded quiz attempts, with grading keys outside public API models."""
from __future__ import annotations

import json
from pathlib import Path
from threading import RLock
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from .auth import PublicUser, check_unsafe_origin, denied, iso_time, require_user
from .repositories import RepositoryFactory

router = APIRouter(prefix="/api/v1", tags=["Quizzes"])


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AnswerOption(StrictModel):
    id: str
    text: str


class QuizQuestion(StrictModel):
    id: str
    prompt: str
    options: list[AnswerOption]


class PublicQuiz(StrictModel):
    id: str
    skillId: str
    title: str
    passThreshold: int
    questions: list[QuizQuestion]


class QuizResponse(StrictModel):
    questionId: str = Field(min_length=1)
    optionId: str = Field(min_length=1)


class Submission(StrictModel):
    responses: list[QuizResponse] = Field(min_length=5, max_length=10)


class Attempt(StrictModel):
    id: str
    userId: str
    quizId: str
    skillId: str
    responses: list[QuizResponse]
    correctCount: int
    totalQuestions: int
    score: int
    passed: bool
    submittedAt: str


class Feedback(StrictModel):
    questionId: str
    selectedOptionId: str
    correctOptionId: str
    correct: bool
    explanation: str


class QuizResult(StrictModel):
    attempt: Attempt
    feedback: list[Feedback]


def quiz_seeds() -> dict:
    # Only server-side handlers read the private answer key.
    return json.loads(Path(__file__).with_name("quiz_data.json").read_text(encoding="utf-8"))


def validate_quiz_seeds(seeds: dict, factory: RepositoryFactory) -> None:
    skills = {item["id"] for item in factory.create("skills").list()}
    quizzes = seeds["quizzes"]
    keys = seeds["answerKeys"]
    if len({quiz["id"] for quiz in quizzes}) != len(quizzes):
        raise ValueError("Duplicate quiz ID")
    if len({quiz["skillId"] for quiz in quizzes}) != len(quizzes):
        raise ValueError("More than one quiz for a skill")
    all_question_ids = set()
    for quiz in quizzes:
        if quiz["skillId"] not in skills or quiz["passThreshold"] != 80:
            raise ValueError("Unknown quiz skill or unsupported pass threshold")
        questions = quiz["questions"]
        if not 5 <= len(questions) <= 10:
            raise ValueError("Quizzes must have 5–10 questions")
        ids = [question["id"] for question in questions]
        if len(set(ids)) != len(ids) or all_question_ids.intersection(ids):
            raise ValueError("Duplicate quiz question")
        all_question_ids.update(ids)
        for question in questions:
            options = question["options"]
            option_ids = [item["id"] for item in options]
            if len(options) != 4 or len(set(option_ids)) != 4:
                raise ValueError("Every question must have four distinct answers")
            if keys.get(question["id"], {}).get("correctOptionId") not in option_ids:
                raise ValueError("Missing/invalid private grading key")
            if not keys[question["id"]].get("explanation"):
                raise ValueError("Missing grading explanation")
    if all_question_ids != set(keys):
        raise ValueError("Orphaned grading key")


class QuizManager:
    def __init__(self, factory: RepositoryFactory, auth, seeds: dict | None = None):
        self.factory = factory
        self.auth = auth
        self._lock = RLock()
        self._data = seeds if seeds is not None else quiz_seeds()
        validate_quiz_seeds(self._data, factory)
        self._keys = self._data["answerKeys"]
        repository = factory.create("quizzes")
        if not repository.list():
            for quiz in self._data["quizzes"]:
                repository.put(quiz["id"], quiz)

    def quiz_for_skill(self, skill_id: str) -> dict | None:
        if self.factory.create("skills").get(skill_id) is None:
            raise denied("NOT_FOUND", "Skill not found.", 404)
        return next(
            (quiz for quiz in self.factory.create("quizzes").list() if quiz["skillId"] == skill_id),
            None,
        )

    def quiz_by_id(self, quiz_id: str) -> dict:
        quiz = self.factory.create("quizzes").get(quiz_id)
        if quiz is None:
            raise denied("NOT_FOUND", "Quiz not found.", 404)
        return quiz

    def submit(self, user_id: str, quiz_id: str, submission: Submission) -> QuizResult:
        with self._lock:
            quiz = self.quiz_by_id(quiz_id)
            questions = quiz["questions"]
            responses = [response.model_dump() for response in submission.responses]
            if len(responses) != len(questions):
                raise denied("VALIDATION", "Submit exactly one answer for every question.", 422)
            by_id = {response["questionId"]: response for response in responses}
            question_ids = {question["id"] for question in questions}
            if len(by_id) != len(responses) or set(by_id) != question_ids:
                raise denied("VALIDATION", "Unknown or repeated quiz question.", 422)
            for question in questions:
                response = by_id[question["id"]]
                if response["optionId"] not in {option["id"] for option in question["options"]}:
                    raise denied("VALIDATION", "Answer option does not belong to this question.", 422)
            feedback = []
            for question in questions:
                selected = by_id[question["id"]]["optionId"]
                answer_key = self._keys[question["id"]]
                feedback.append({
                    "questionId": question["id"],
                    "selectedOptionId": selected,
                    "correctOptionId": answer_key["correctOptionId"],
                    "correct": selected == answer_key["correctOptionId"],
                    "explanation": answer_key["explanation"],
                })
            count = sum(item["correct"] for item in feedback)
            total = len(questions)
            attempt = {
                "id": f"attempt-{uuid4().hex}",
                "userId": user_id,
                "quizId": quiz_id,
                "skillId": quiz["skillId"],
                "responses": responses,
                "correctCount": count,
                "totalQuestions": total,
                "score": (count * 200 + total) // (total * 2),
                "passed": count * 5 >= total * 4,
                "submittedAt": iso_time(self.auth.clock()),
            }
            self.factory.create("quiz_attempts").put(attempt["id"], attempt)
            return QuizResult(attempt=Attempt(**attempt), feedback=[Feedback(**item) for item in feedback])

    def attempts_for(self, user_id: str, quiz_id: str | None = None) -> list[Attempt]:
        with self._lock:
            if quiz_id is not None:
                self.quiz_by_id(quiz_id)
            data = [
                record for record in self.factory.create("quiz_attempts").list()
                if record["userId"] == user_id and (quiz_id is None or record["quizId"] == quiz_id)
            ]
            return [Attempt(**record) for record in sorted(data, key=lambda record: record["submittedAt"])]


def manager_from_request(request: Request) -> QuizManager:
    return request.app.state.quiz_manager


Manager = Annotated[QuizManager, Depends(manager_from_request)]
CurrentUser = Annotated[PublicUser, Depends(require_user)]


@router.get("/skills/{skillId}/quiz", response_model=PublicQuiz,
            operation_id="getQuizForSkill", response_model_exclude_none=True)
def get_skill_quiz(skillId: str, manager: Manager, response: Response):
    quiz = manager.quiz_for_skill(skillId)
    if quiz is None:
        response.status_code = 204
        return None
    # Explicit public model prevents any future internal private fields from leaking.
    return PublicQuiz(**quiz)


@router.post("/quizzes/{quizId}/attempts", status_code=201,
             response_model=QuizResult, operation_id="submitQuizAttempt",
             dependencies=[Depends(check_unsafe_origin)])
def post_attempt(quizId: str, payload: Submission, manager: Manager, user: CurrentUser):
    return manager.submit(user.id, quizId, payload)


@router.get("/me/quiz-attempts", response_model=list[Attempt], operation_id="getQuizAttempts")
def get_attempts(manager: Manager, user: CurrentUser, quizId: str | None = Query(default=None, min_length=1, max_length=128)):
    return manager.attempts_for(user.id, quizId)

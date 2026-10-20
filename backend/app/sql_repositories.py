"""SQLAlchemy-backed repositories implementing the existing dictionary API."""
from __future__ import annotations
import re
from threading import RLock
from sqlalchemy import select, delete
from sqlalchemy.orm import Session, sessionmaker
from . import models as m
from .repositories import Repository, RepositoryFactory

_CAMEL = re.compile(r"(?<!^)(?=[A-Z])")
def snake(value: str) -> str:
    return _CAMEL.sub("_", value).lower()

COLLECTIONS = {
    "users": m.User, "sessions": m.SessionToken,
    "career_paths": m.CareerPath, "skills": m.Skill,
    "dependencies": m.SkillDependency,
    "learning_resources": m.LearningResource, "practice_tasks": m.PracticeTask,
    "selected_careers": m.UserCareer, "progress": m.UserSkillProgress,
    "progress_history": m.ProgressEvent, "quizzes": m.Quiz,
    "quiz_attempts": m.QuizAttempt,
}
KEYS = {
    "users": ("id",), "sessions": ("token_digest",),
    "career_paths": ("id",), "skills": ("id",),
    "dependencies": ("skill_id", "prerequisite_id"),
    "learning_resources": ("id",), "practice_tasks": ("id",),
    "selected_careers": ("user_id", "career_id"),
    "progress": ("user_id", "skill_id"),
    "progress_history": ("id",), "quizzes": ("id",), "quiz_attempts": ("id",),
}

def decode(session: Session, name: str, row) -> dict:
    data = {}
    for col in row.__table__.columns:
        if name == "sessions" and col.name == "token_digest":
            continue
        key = "".join(word.capitalize() if i else word for i, word in enumerate(col.name.split("_")))
        data[key] = getattr(row, col.name)
    if name == "career_paths":
        members = session.scalars(
            select(m.PathSkill).where(m.PathSkill.career_id == row.id).order_by(m.PathSkill.position)
        ).all()
        data["skillIds"] = [x.skill_id for x in members]
    elif name == "quizzes":
        questions = session.scalars(
            select(m.QuizQuestion).where(m.QuizQuestion.quiz_id == row.id).order_by(m.QuizQuestion.position)
        ).all()
        data["questions"] = []
        for question in questions:
            options = session.scalars(
                select(m.AnswerOption).where(m.AnswerOption.question_id == question.id)
                .order_by(m.AnswerOption.position)
            ).all()
            data["questions"].append({
                "id": question.id, "prompt": question.prompt,
                "options": [{"id": o.id, "text": o.text} for o in options],
            })
    elif name == "quiz_attempts":
        quiz = session.get(m.Quiz, row.quiz_id)
        data["skillId"] = quiz.skill_id if quiz else ""
        question_order = {q.id: q.position for q in session.scalars(
            select(m.QuizQuestion).where(m.QuizQuestion.quiz_id == row.quiz_id)
        ).all()}
        answers = session.scalars(
            select(m.QuizResponse).where(m.QuizResponse.attempt_id == row.id)
        ).all()
        answers.sort(key=lambda a: question_order.get(a.question_id, 9999))
        data["responses"] = [
            {"questionId": a.question_id, "optionId": a.option_id} for a in answers
        ]
    return data


class SQLAlchemyRepository(Repository[dict]):
    def __init__(self, name: str, sessions: sessionmaker, lock: RLock):
        if name not in COLLECTIONS:
            raise ValueError(f"Unknown repository collection: {name}")
        self.name = name
        self.model = COLLECTIONS[name]
        self.sessions = sessions
        self.lock = lock

    def _key(self, identifier: str):
        count = len(KEYS[self.name])
        if count == 1:
            return identifier
        values = identifier.split(":", 1)
        return tuple(values) if len(values) == count else ("", "")

    def get(self, item_id: str) -> dict | None:
        with self.lock, self.sessions() as session:
            row = session.get(self.model, self._key(item_id))
            return decode(session, self.name, row) if row is not None else None

    def list(self) -> list[dict]:
        with self.lock, self.sessions() as session:
            rows = session.scalars(select(self.model)).all()
            if self.name == "selected_careers":
                rows.sort(key=lambda row: (row.user_id, row.position))
            elif self.name == "progress_history":
                rows.sort(key=lambda row: row.changed_at)
            elif self.name == "quiz_attempts":
                rows.sort(key=lambda row: row.submitted_at)
            return [decode(session, self.name, row) for row in rows]

    def put(self, item_id: str, value: dict) -> None:
        if not item_id:
            raise ValueError("Item ID is required")
        with self.lock, self.sessions.begin() as session:
            name = self.name
            if name == "career_paths":
                session.merge(m.CareerPath(
                    id=value["id"], name=value["name"], description=value["description"]
                ))
                session.flush()
                session.execute(delete(m.PathSkill).where(m.PathSkill.career_id == value["id"]))
                for pos, skill_id in enumerate(value["skillIds"]):
                    session.add(m.PathSkill(career_id=value["id"], skill_id=skill_id, position=pos))
                return
            if name == "quizzes":
                session.merge(m.Quiz(
                    id=value["id"], skill_id=value["skillId"],
                    title=value["title"], pass_threshold=value["passThreshold"]
                ))
                session.flush()
                existing = session.scalars(select(m.QuizQuestion.id).where(
                    m.QuizQuestion.quiz_id == value["id"]
                )).all()
                if existing:
                    session.execute(delete(m.AnswerOption).where(m.AnswerOption.question_id.in_(existing)))
                    session.execute(delete(m.QuizQuestion).where(m.QuizQuestion.quiz_id == value["id"]))
                from .quizzes import quiz_seeds
                keys = quiz_seeds()["answerKeys"]
                for pos, question in enumerate(value["questions"]):
                    grading = keys[question["id"]]
                    session.add(m.QuizQuestion(
                        id=question["id"], quiz_id=value["id"], prompt=question["prompt"],
                        explanation=grading["explanation"], position=pos,
                    ))
                    for option_pos, option in enumerate(question["options"]):
                        session.add(m.AnswerOption(
                            id=option["id"], question_id=question["id"], text=option["text"],
                            position=option_pos, is_correct=option["id"] == grading["correctOptionId"],
                        ))
                return
            if name == "quiz_attempts":
                data = {snake(k): v for k, v in value.items() if k not in ("responses", "skillId")}
                session.add(m.QuizAttempt(**data))
                for answer in value["responses"]:
                    session.add(m.QuizResponse(
                        attempt_id=value["id"],
                        question_id=answer["questionId"], option_id=answer["optionId"],
                    ))
                return
            data = {snake(k): v for k, v in value.items()}
            if name == "sessions":
                data["token_digest"] = item_id
            if name == "dependencies":
                data = {"skill_id": value["skillId"], "prerequisite_id": value["prerequisiteId"]}
            if name == "selected_careers" and "position" not in data:
                rows = session.scalars(select(m.UserCareer).where(
                    m.UserCareer.user_id == data["user_id"]
                )).all()
                data["position"] = max((r.position for r in rows), default=-1) + 1
            session.merge(self.model(**data))

    def delete(self, item_id: str) -> bool:
        with self.lock, self.sessions.begin() as session:
            row = session.get(self.model, self._key(item_id))
            if row is None:
                return False
            session.delete(row)
            return True


class SQLAlchemyRepositoryFactory(RepositoryFactory):
    def __init__(self, sessions: sessionmaker):
        self.sessions = sessions
        self._lock = RLock()
        self._repositories: dict[str, SQLAlchemyRepository] = {}

    def create(self, name: str) -> Repository[dict]:
        with self._lock:
            if name not in self._repositories:
                self._repositories[name] = SQLAlchemyRepository(name, self.sessions, self._lock)
            return self._repositories[name]

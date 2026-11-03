"""Fast, idempotent PostgreSQL reference seeding.

The general Repository interface deliberately commits individual writes. That is
fine for ordinary requests, but hundreds of quiz seed writes during process boot
can exceed the Render Free deploy readiness window. This path batches initial
reference inserts in one transaction without touching accounts or user progress.
"""
from __future__ import annotations

import logging
import time

from sqlalchemy import insert, select
from sqlalchemy.orm import sessionmaker

from . import models as m
from .catalogue_seed import (
    CAREERS, DEPENDENCIES, RESOURCES, SKILLS, TASKS, CATALOGUE,
    validate_catalogue,
)
from .quizzes import quiz_seeds, validate_quiz_seeds

log = logging.getLogger("uvicorn.error")


def seed_sql_reference(sessions: sessionmaker, factory=None) -> dict[str, int]:
    """Fill empty reference tables; never change user-owned records.

    Existing reference collections are left untouched (matching seed_catalogue).
    A transaction keeps the entire new catalogue consistent if an insert fails.
    """
    started = time.monotonic()
    validate_catalogue(CATALOGUE)
    quiz_data = quiz_seeds()
    validate_quiz_seeds(quiz_data, factory)
    counts: dict[str, int] = {}

    with sessions.begin() as session:
        def fill(model, rows: list[dict], label: str) -> bool:
            if session.execute(select(model).limit(1)).first() is not None:
                counts[label] = 0
                return False
            if rows:
                session.execute(insert(model), rows)
            counts[label] = len(rows)
            return True

        fill(m.Skill, SKILLS, "skills")

        careers_added = fill(
            m.CareerPath,
            [{"id": x["id"], "name": x["name"], "description": x["description"]} for x in CAREERS],
            "career_paths",
        )
        if careers_added:
            fill(m.PathSkill, [
                {"career_id": career["id"], "skill_id": skill_id, "position": index}
                for career in CAREERS for index, skill_id in enumerate(career["skillIds"])
            ], "path_skills")

        fill(m.SkillDependency, [
            {"skill_id": edge["skillId"], "prerequisite_id": edge["prerequisiteId"]}
            for edge in DEPENDENCIES
        ], "dependencies")

        fill(m.LearningResource, [
            {"id": x["id"], "skill_id": x["skillId"], "title": x["title"],
             "url": x["url"], "kind": x["kind"], "is_free": x["isFree"]}
            for x in RESOURCES
        ], "learning_resources")

        fill(m.PracticeTask, [
            {"id": x["id"], "skill_id": x["skillId"], "title": x["title"],
             "description": x["description"]}
            for x in TASKS
        ], "practice_tasks")

        quizzes_added = fill(m.Quiz, [
            {"id": q["id"], "skill_id": q["skillId"], "title": q["title"],
             "pass_threshold": q["passThreshold"]}
            for q in quiz_data["quizzes"]
        ], "quizzes")
        if quizzes_added:
            answers = quiz_data["answerKeys"]
            questions = [
                {"id": q["id"], "quiz_id": quiz["id"], "prompt": q["prompt"],
                 "explanation": answers[q["id"]]["explanation"], "position": i}
                for quiz in quiz_data["quizzes"] for i, q in enumerate(quiz["questions"])
            ]
            options = [
                {"id": option["id"], "question_id": q["id"], "text": option["text"],
                 "position": i,
                 "is_correct": option["id"] == answers[q["id"]]["correctOptionId"]}
                for quiz in quiz_data["quizzes"] for q in quiz["questions"]
                for i, option in enumerate(q["options"])
            ]
            fill(m.QuizQuestion, questions, "quiz_questions")
            fill(m.AnswerOption, options, "answer_options")

    log.info("PostgreSQL reference data ready in %.2fs; rows inserted: %s",
             time.monotonic() - started, counts)
    return counts

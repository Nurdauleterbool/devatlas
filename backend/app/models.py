"""MVP persistence schema: shared catalogue, authenticated owners, dated attempts."""
from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base

Id = str


class User(Base):
    __tablename__ = "users"
    id: Mapped[Id] = mapped_column(String(128), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[str] = mapped_column(String(24), nullable=False)


class SessionToken(Base):
    __tablename__ = "sessions"
    token_digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[Id] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    authenticated_at: Mapped[str] = mapped_column(String(24), nullable=False)
    expires_at: Mapped[str] = mapped_column(String(24), nullable=False)


class CareerPath(Base):
    __tablename__ = "career_paths"
    id: Mapped[Id] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)


class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[Id] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)


class PathSkill(Base):
    __tablename__ = "path_skills"
    career_id: Mapped[Id] = mapped_column(ForeignKey("career_paths.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[Id] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    __table_args__ = (UniqueConstraint("career_id", "position", name="uq_path_skill_position"),)


class SkillDependency(Base):
    __tablename__ = "skill_dependencies"
    skill_id: Mapped[Id] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
    prerequisite_id: Mapped[Id] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
    __table_args__ = (CheckConstraint("skill_id != prerequisite_id", name="ck_no_self_prerequisite"),)


class LearningResource(Base):
    __tablename__ = "learning_resources"
    id: Mapped[Id] = mapped_column(String(128), primary_key=True)
    skill_id: Mapped[Id] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    is_free: Mapped[bool] = mapped_column(Boolean, nullable=False)


class PracticeTask(Base):
    __tablename__ = "practice_tasks"
    id: Mapped[Id] = mapped_column(String(128), primary_key=True)
    skill_id: Mapped[Id] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)


class UserCareer(Base):
    __tablename__ = "user_careers"
    user_id: Mapped[Id] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    career_id: Mapped[Id] = mapped_column(ForeignKey("career_paths.id", ondelete="CASCADE"), primary_key=True)
    selected_at: Mapped[str] = mapped_column(String(24), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    __table_args__ = (UniqueConstraint("user_id", "position", name="uq_user_career_position"),)


class UserSkillProgress(Base):
    __tablename__ = "user_skill_progress"
    user_id: Mapped[Id] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[Id] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="not_started")
    updated_at: Mapped[str] = mapped_column(String(24), nullable=False)
    __table_args__ = (CheckConstraint("status IN ('not_started', 'learning', 'completed')", name="ck_valid_progress_status"),)


class ProgressEvent(Base):
    __tablename__ = "progress_events"
    id: Mapped[Id] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[Id] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_id: Mapped[Id] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    from_status: Mapped[str] = mapped_column(String(20), nullable=False)
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_at: Mapped[str] = mapped_column(String(24), nullable=False)
    __table_args__ = (
        CheckConstraint("from_status IN ('not_started', 'learning', 'completed')", name="ck_event_from_status"),
        CheckConstraint("to_status IN ('not_started', 'learning', 'completed')", name="ck_event_to_status"),
    )


class Quiz(Base):
    __tablename__ = "quizzes"
    id: Mapped[Id] = mapped_column(String(128), primary_key=True)
    skill_id: Mapped[Id] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    pass_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=80)
    __table_args__ = (CheckConstraint("pass_threshold = 80", name="ck_quiz_threshold"),)


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    id: Mapped[Id] = mapped_column(String(128), primary_key=True)
    quiz_id: Mapped[Id] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    __table_args__ = (UniqueConstraint("quiz_id", "position", name="uq_quiz_question_position"),)


class AnswerOption(Base):
    __tablename__ = "answer_options"
    id: Mapped[Id] = mapped_column(String(128), primary_key=True)
    question_id: Mapped[Id] = mapped_column(ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    __table_args__ = (UniqueConstraint("question_id", "position", name="uq_answer_position"),)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id: Mapped[Id] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[Id] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    quiz_id: Mapped[Id] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    correct_count: Mapped[int] = mapped_column(Integer, nullable=False)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    submitted_at: Mapped[str] = mapped_column(String(24), nullable=False)
    __table_args__ = (
        CheckConstraint("total_questions BETWEEN 5 AND 10", name="ck_attempt_question_count"),
        CheckConstraint("correct_count BETWEEN 0 AND total_questions", name="ck_attempt_correct_count"),
        CheckConstraint("score BETWEEN 0 AND 100", name="ck_attempt_score"),
    )


class QuizResponse(Base):
    __tablename__ = "quiz_responses"
    attempt_id: Mapped[Id] = mapped_column(ForeignKey("quiz_attempts.id", ondelete="CASCADE"), primary_key=True)
    question_id: Mapped[Id] = mapped_column(ForeignKey("quiz_questions.id", ondelete="CASCADE"), primary_key=True)
    option_id: Mapped[Id] = mapped_column(ForeignKey("answer_options.id", ondelete="CASCADE"), nullable=False)

"""Create initial DevAtlas MVP tables and relational constraints.

Revision ID: 0001_initial_mvp
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial_mvp"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("users",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("display_name", sa.String(80), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.String(24), nullable=False),
        sa.UniqueConstraint('email'),
    )
    op.create_table("career_paths",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
    )
    op.create_table("skills",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
    )
    op.create_table("sessions",
        sa.Column("token_digest", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column("authenticated_at", sa.String(24), nullable=False),
        sa.Column("expires_at", sa.String(24), nullable=False),
    )
    op.create_table("path_skills",
        sa.Column("career_id", sa.String(128), sa.ForeignKey('career_paths.id', ondelete='CASCADE'), primary_key=True),
        sa.Column("skill_id", sa.String(128), sa.ForeignKey('skills.id', ondelete='CASCADE'), primary_key=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint('career_id', 'position', name='uq_path_skill_position'),
    )
    op.create_table("skill_dependencies",
        sa.Column("skill_id", sa.String(128), sa.ForeignKey('skills.id', ondelete='CASCADE'), primary_key=True),
        sa.Column("prerequisite_id", sa.String(128), sa.ForeignKey('skills.id', ondelete='CASCADE'), primary_key=True),
        sa.CheckConstraint('skill_id != prerequisite_id', name='ck_no_self_prerequisite'),
    )
    op.create_table("learning_resources",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("skill_id", sa.String(128), sa.ForeignKey('skills.id', ondelete='CASCADE'), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(50), nullable=False),
        sa.Column("is_free", sa.Boolean(), nullable=False),
    )
    op.create_table("practice_tasks",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("skill_id", sa.String(128), sa.ForeignKey('skills.id', ondelete='CASCADE'), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
    )
    op.create_table("user_careers",
        sa.Column("user_id", sa.String(128), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column("career_id", sa.String(128), sa.ForeignKey('career_paths.id', ondelete='CASCADE'), primary_key=True),
        sa.Column("selected_at", sa.String(24), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint('user_id', 'position', name='uq_user_career_position'),
    )
    op.create_table("user_skill_progress",
        sa.Column("user_id", sa.String(128), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column("skill_id", sa.String(128), sa.ForeignKey('skills.id', ondelete='CASCADE'), primary_key=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("updated_at", sa.String(24), nullable=False),
        sa.CheckConstraint("status IN ('not_started', 'learning', 'completed')", name='ck_valid_progress_status'),
    )
    op.create_table("progress_events",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column("skill_id", sa.String(128), sa.ForeignKey('skills.id', ondelete='CASCADE'), nullable=False),
        sa.Column("from_status", sa.String(20), nullable=False),
        sa.Column("to_status", sa.String(20), nullable=False),
        sa.Column("changed_at", sa.String(24), nullable=False),
        sa.CheckConstraint("from_status IN ('not_started', 'learning', 'completed')", name='ck_event_from_status'),
        sa.CheckConstraint("to_status IN ('not_started', 'learning', 'completed')", name='ck_event_to_status'),
    )
    op.create_table("quizzes",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("skill_id", sa.String(128), sa.ForeignKey('skills.id', ondelete='CASCADE'), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("pass_threshold", sa.Integer(), nullable=False),
        sa.UniqueConstraint('skill_id'),
        sa.CheckConstraint('pass_threshold = 80', name='ck_quiz_threshold'),
    )
    op.create_table("quiz_questions",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("quiz_id", sa.String(128), sa.ForeignKey('quizzes.id', ondelete='CASCADE'), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint('quiz_id', 'position', name='uq_quiz_question_position'),
    )
    op.create_table("answer_options",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("question_id", sa.String(128), sa.ForeignKey('quiz_questions.id', ondelete='CASCADE'), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.UniqueConstraint('question_id', 'position', name='uq_answer_position'),
    )
    op.create_table("quiz_attempts",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column("quiz_id", sa.String(128), sa.ForeignKey('quizzes.id', ondelete='CASCADE'), nullable=False),
        sa.Column("correct_count", sa.Integer(), nullable=False),
        sa.Column("total_questions", sa.Integer(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("passed", sa.Boolean(), nullable=False),
        sa.Column("submitted_at", sa.String(24), nullable=False),
        sa.CheckConstraint('total_questions BETWEEN 5 AND 10', name='ck_attempt_question_count'),
        sa.CheckConstraint('correct_count BETWEEN 0 AND total_questions', name='ck_attempt_correct_count'),
        sa.CheckConstraint('score BETWEEN 0 AND 100', name='ck_attempt_score'),
    )
    op.create_table("quiz_responses",
        sa.Column("attempt_id", sa.String(128), sa.ForeignKey('quiz_attempts.id', ondelete='CASCADE'), primary_key=True),
        sa.Column("question_id", sa.String(128), sa.ForeignKey('quiz_questions.id', ondelete='CASCADE'), primary_key=True),
        sa.Column("option_id", sa.String(128), sa.ForeignKey('answer_options.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index("ix_learning_resources_skill_id", "learning_resources", ["skill_id"])
    op.create_index("ix_practice_tasks_skill_id", "practice_tasks", ["skill_id"])
    op.create_index("ix_progress_events_user_id", "progress_events", ["user_id"])
    op.create_index("ix_quiz_questions_quiz_id", "quiz_questions", ["quiz_id"])
    op.create_index("ix_answer_options_question_id", "answer_options", ["question_id"])
    op.create_index("ix_quiz_attempts_user_id", "quiz_attempts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_quiz_attempts_user_id", table_name="quiz_attempts")
    op.drop_index("ix_answer_options_question_id", table_name="answer_options")
    op.drop_index("ix_quiz_questions_quiz_id", table_name="quiz_questions")
    op.drop_index("ix_progress_events_user_id", table_name="progress_events")
    op.drop_index("ix_practice_tasks_skill_id", table_name="practice_tasks")
    op.drop_index("ix_learning_resources_skill_id", table_name="learning_resources")
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_table("quiz_responses")
    op.drop_table("quiz_attempts")
    op.drop_table("answer_options")
    op.drop_table("quiz_questions")
    op.drop_table("quizzes")
    op.drop_table("progress_events")
    op.drop_table("user_skill_progress")
    op.drop_table("user_careers")
    op.drop_table("practice_tasks")
    op.drop_table("learning_resources")
    op.drop_table("skill_dependencies")
    op.drop_table("path_skills")
    op.drop_table("sessions")
    op.drop_table("skills")
    op.drop_table("career_paths")
    op.drop_table("users")

"""Migration verification for a fresh SQLite database."""
from pathlib import Path
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db import Base, make_engine
from app import models as m

def config_for(path: Path) -> Config:
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{path.as_posix()}")
    return cfg

@pytest.fixture
def db(tmp_path):
    path = tmp_path / "fresh.sqlite"
    config = config_for(path)
    command.upgrade(config, "head")
    engine = make_engine(f"sqlite:///{path.as_posix()}")
    try:
        yield engine
    finally:
        engine.dispose()

def test_migration_builds_all_model_tables(db):
    assert set(inspect(db).get_table_names()) - {"alembic_version"} == set(Base.metadata.tables)
    assert len(Base.metadata.tables) == 16

def test_rejects_missing_user_or_skill_foreign_keys(db):
    with Session(db) as session:
        session.add(m.UserSkillProgress(user_id="absent", skill_id="unknown",
                      status="learning", updated_at="2026-10-20T00:00:00.000Z"))
        with pytest.raises(IntegrityError):
            session.commit()

def test_duplicate_user_email_is_rejected(db):
    timestamp = "2026-10-20T00:00:00.000Z"
    with Session(db) as session:
        session.add(m.User(id="u1", display_name="One", email="one@example.test",
                           password_hash="stored-hash", created_at=timestamp))
        session.commit()
    with Session(db) as session:
        session.add(m.User(id="u2", display_name="Two", email="one@example.test",
                           password_hash="stored-hash", created_at=timestamp))
        with pytest.raises(IntegrityError):
            session.commit()

def test_one_progress_per_user_skill_and_valid_status(db):
    at = "2026-10-20T00:00:00.000Z"
    with Session(db) as session:
        session.add_all([
            m.User(id="u1", display_name="Student", email="one@example.test",
                   password_hash="stored-hash", created_at=at),
            m.Skill(id="html", name="HTML", description="Markup")])
        session.commit()
    with Session(db) as session:
        session.add(m.UserSkillProgress(user_id="u1", skill_id="html",
                                        status="completed", updated_at=at))
        session.commit()
    with Session(db) as session:
        session.add(m.UserSkillProgress(user_id="u1", skill_id="html",
                                        status="learning", updated_at=at))
        with pytest.raises(IntegrityError):
            session.commit()
    with Session(db) as session:
        session.add(m.UserSkillProgress(user_id="u1", skill_id="html",
                                        status="invalid", updated_at=at))
        with pytest.raises(IntegrityError):
            session.commit()

def test_rejects_self_prerequisite_and_missing_targets(db):
    with Session(db) as session:
        session.add_all([m.Skill(id="a", name="A", description="A"),
                         m.Skill(id="b", name="B", description="B")])
        session.commit()
    for edge in [("a", "a"), ("a", "missing")]:
        with Session(db) as session:
            session.add(m.SkillDependency(skill_id=edge[0], prerequisite_id=edge[1]))
            with pytest.raises(IntegrityError):
                session.commit()

def test_orm_inserts_and_queries(db):
    at = "2026-10-20T00:00:00.000Z"
    with Session(db) as session:
        session.add_all([
            m.User(id="u1", display_name="Student", email="one@example.test",
                   password_hash="stored-hash", created_at=at),
            m.CareerPath(id="frontend", name="Frontend", description="Web"),
            m.Skill(id="html", name="HTML", description="Markup")])
        session.commit()
        session.add_all([
            m.PathSkill(career_id="frontend", skill_id="html", position=0),
            m.UserCareer(user_id="u1", career_id="frontend", position=0, selected_at=at)])
        session.commit()
        assert session.scalar(select(m.UserCareer).where(m.UserCareer.user_id == "u1")).career_id == "frontend"

def test_downgrade_and_upgrade_again(tmp_path):
    path = tmp_path / "roundtrip.sqlite"
    cfg = config_for(path)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    engine = make_engine(f"sqlite:///{path.as_posix()}")
    try:
        assert set(inspect(engine).get_table_names()) == {"alembic_version"}
    finally:
        engine.dispose()
    command.upgrade(cfg, "head")
    engine = make_engine(f"sqlite:///{path.as_posix()}")
    try:
        assert "users" in inspect(engine).get_table_names()
        assert "quiz_responses" in inspect(engine).get_table_names()
    finally:
        engine.dispose()

"""Migration environment for SQLite, with ORM metadata for drift checks."""
from __future__ import annotations
import os
from logging.config import fileConfig
from alembic import context
from app.db import Base, make_engine
from app import models  # noqa: F401: register all tables

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)
target_metadata = Base.metadata

def migration_url() -> str:
    return os.environ.get("DEVATLAS_DATABASE_URL") or config.get_main_option("sqlalchemy.url")

def run_migrations_offline() -> None:
    context.configure(url=migration_url(), target_metadata=target_metadata,
                      literal_binds=True, dialect_opts={"paramstyle": "named"},
                      compare_type=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    url = migration_url()
    if not url.startswith("sqlite"):
        raise ValueError("Only SQLite migrations are enabled for MVP development")
    engine = make_engine(url)
    try:
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=target_metadata,
                              compare_type=True, render_as_batch=True)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

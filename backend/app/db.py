"""SQLAlchemy engine and sessions for SQLite tests and PostgreSQL production."""
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def normalize_url(database_url: str) -> str:
    """Use psycopg3 for hosted postgres:// and postgresql:// URLs."""
    for scheme in ("postgres://", "postgresql://"):
        if database_url.startswith(scheme):
            return "postgresql+psycopg://" + database_url[len(scheme):]
    return database_url


def make_engine(database_url: str = "sqlite:///./devatlas.db") -> Engine:
    url = normalize_url(database_url)
    if url.startswith("sqlite:"):
        engine = create_engine(url, connect_args={"check_same_thread": False}, pool_pre_ping=True)

        @event.listens_for(engine, "connect")
        def enable_foreign_keys(dbapi_connection, _connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return engine

    if url.startswith("postgresql+psycopg://"):
        return create_engine(url, pool_pre_ping=True, pool_size=5,
                             max_overflow=0, pool_timeout=20,
                             connect_args={"connect_timeout": 10})

    raise ValueError("Supported database URLs: SQLite or PostgreSQL via psycopg3")


def make_session_factory(engine: Engine):
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

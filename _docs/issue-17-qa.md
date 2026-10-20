# Issue #17 — SQLite repositories and repeatable seed data

## Implementation

The existing in-memory repository interfaces now have a SQLAlchemy implementation under `backend/app/sql_repositories.py`. The deployed `app.main:app` instance enables SQLite, runs Alembic upgrade to head, seeds skills, career paths, dependencies, curated resources, practice tasks, and 10 quizzes with 50 questions/200 answer options. Account credentials remain hashed and session token digests remain opaque; user-owned histories and attempts are stored in normalized tables.

Tests using `create_app()` or an explicit in-memory factory retain isolated behavior. A configured SQLite `create_app(Settings(storage_backend="sqlite", database_url=...))` reconnects to existing data across independent app instances.

## QA gate

The full Python 3.12 GitHub Actions backend suite must pass before merging; check `backend/tests/test_sqlite_integration.py` for fresh database initialization, repeatable seed, durable account/session/progress/quiz data across restarts, and per-file database isolation. The existing backend regression suite must remain green.

## Limitations

This is the persistence adapter stage, not production database operations. Application managers currently use in-process locks, not SQL transaction scopes spanning multiple repository mutations; complete concurrency/rollback and cross-user verification belongs to Issue #18. Development SQLite is not suitable for high-throughput multiworker production deployment. The HTTP frontend adapter is deferred to Issue #19.

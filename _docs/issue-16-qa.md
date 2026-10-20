# Issue #16 — SQLite schema and migration QA

This stage adds the SQLAlchemy declarative schema and Alembic migration without switching current FastAPI routes away from their already-tested in-memory repositories. SQL repository replacement and seeding follow in Issue #17.

Sixteen ORM tables cover accounts, digest-only sessions, careers, skills and prerequisites, public learning materials, saved user careers, statuses, dated events, quizzes, questions, answer choices, attempts and answers. Foreign keys enforce ownership and references. Unique constraints protect normalized email, membership, ordering and progress identity; checks constrain status names, quiz thresholds, self-loops and scored attempt bounds.

Run in the `backend/` folder with Python 3.12:
```sh
pip install -e '.[test]'
python -m alembic upgrade head
python -m alembic current
python -m pytest -q
```
Default database: `sqlite:///./devatlas.db`; override via `DEVATLAS_DATABASE_URL`. The SQLite engine enables foreign key enforcement on every connection. The initial revision supports upgrade and downgrade from a clean database.

`backend/tests/test_db_schema.py` checks clean migration, all model tables, user/skill foreign keys, duplicate email, one progress row per owner and skill, allowed statuses, invalid prerequisites, ORM writes and downgrade/re-upgrade. Review actual GitHub Actions Python 3.12 logs before merging.

Application-side validation must still enforce multi-edge cycle detection, quiz answer ownership and exactly one correct option per question. These cross-row constraints cannot all be expressed by individual SQL CHECK constraints. Database files are not version-controlled. Persistent repositories and real-user data writes are not activated until Issue #17.

## Verified GitHub Actions results

- Initial CI run `39393345514`: **66 passed, 0 failed, 10 warnings** on Python 3.12.15. All migration tests passed on a clean temporary SQLite database.
- Corrected the Alembic `path_separator` setting to remove a deprecated configuration fallback.
- Final CI run `39393496609`: **66 passed, 0 failed, 1 third-party Starlette/httpx warning**, 11.98 seconds. The GitHub Actions `pytest` step was successful. No tests were skipped to bypass the checks.
- Production database backup, cross-process concurrency, and actual persistent application adapters are outside this schema-only Issue and are deferred to #17–#18.

# DevAtlas FastAPI backend

Python 3.12+; install and run from `backend/`:

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e '.[test]'
uvicorn app.main:app --reload
python -m pytest -q
```

API prefix: `/api/v1`. Routes:
- Health: `GET /health`.
- Auth: `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/session`, `/auth/me`.
- Public catalogue: `/career-paths`, `/skills`, `/dependencies`, skill resources and practice tasks.
- Progress: `GET /progress` (authenticated or synthetic anonymous), `PUT /me/progress/{skillId}` (status only), `GET /me/progress/history`.
- Quizzes: `GET /skills/{skillId}/quiz`, `POST /quizzes/{quizId}/attempts`, `GET /me/quiz-attempts`.
- Analytics: `GET /me/analytics` authenticated, shows shared-skill counts, all career summaries, attempts and learning history.
- Recommendations: `GET /career-paths/{careerId}/recommendations` authenticated or neutral anonymous preview. Completed/verified and locked skills are excluded; continue-learning precedes start-next.

Authentication uses hashed passwords, opaque HttpOnly cookie sessions, and server-side access controls. No raw quiz grading keys are exposed before a submission. Set `DEVATLAS_FRONTEND_ORIGIN` and `DEVATLAS_ENVIRONMENT` for deployment settings.

This stage uses in-memory repositories and is not production-safe with multiple workers. Persistence (#16–#18), frontend HTTP integration (#19) and full manual QA remain future work. See `_docs/api-contract.md` for authoritative API rules.


## SQLite schema (Issue #16)

The portable SQLAlchemy schema and initial Alembic migration are available for development; the running API still uses in-memory repositories until Issue #17.

From `backend/` after `pip install -e '.[test]'`:

```bash
python -m alembic upgrade head
python -m alembic current
python -m pytest -q
```

This creates local `devatlas.db` by default; set `DEVATLAS_DATABASE_URL=sqlite:////absolute/path/to/app.db` to override. Never commit local DB files. The schema includes 16 tables with relational and uniqueness constraints. See `_docs/issue-16-qa.md`.

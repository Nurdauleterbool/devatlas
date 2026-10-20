# DevAtlas FastAPI backend

In-memory API, Python 3.12+.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e '.[test]'
uvicorn app.main:app --reload
python -m pytest -q
```

The health endpoint is `GET /api/v1/health`. Auth endpoints provide signup, login, logout, session and current user. They use server-side PBKDF2 password digests, opaque HttpOnly cookies and session expiry. Set `DEVATLAS_FRONTEND_ORIGIN` and `DEVATLAS_ENVIRONMENT` as needed.

Issue #12 adds seven public career/skill catalogue routes, matching `_docs/openapi.yml`. The three career paths, ten skills and prerequisite edges are shared reference data. For complete skill detail, combine `GET /skills/{skillId}`, `GET /dependencies`, `GET /skills/{skillId}/resources` and `GET /skills/{skillId}/practice-tasks`. `GET /career-paths/{careerId}` contains `skillIds`, with definitions read through `GET /skills`.

Personal progress, session-derived ownership and quizzes are implemented in later Issues (#13–#15); SQLite persistence follows in #16–#18. All current repositories are ephemeral per app and are not production-safe multiworker storage.

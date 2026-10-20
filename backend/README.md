# DevAtlas backend — FastAPI, SQLite and Alembic

Python 3.12+. The server's imported `app.main:app` defaults to SQLite with automatic Alembic migrations and deterministic catalogue seeding; `create_app()` is in-memory by default for isolated unit tests.

## Install and run

From the `backend/` directory:

```sh
python -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -e '.[test]'
python -m alembic upgrade head
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health check: `http://127.0.0.1:8000/api/v1/health` returns `{"status":"ok"}`. Interactive OpenAPI docs: `http://127.0.0.1:8000/docs`. Default database file: `backend/devatlas.db`, ignored by git. `DEVATLAS_DATABASE_URL` can select an absolute SQLite path. Set `DEVATLAS_FRONTEND_ORIGIN=http://localhost:5173` for the default browser origin; `DEVATLAS_ENVIRONMENT=production` is for HTTPS-only deployments with Secure cookies.

## Routes

All routes start with `/api/v1`. Public catalogue: careers, skills, dependencies, resources and practice tasks; signed-in `/me/careers`, `/me/progress`, progress history, quiz submissions and attempt history, and `/me/analytics`. Public progress/recommendations show a neutral synthetic preview to anonymous visitors. Quiz answers are graded on the server and only exposed after submission. See [the API mapping](../_docs/api-contract.md) and [normative OpenAPI](../_docs/openapi.yml).

## Verification

```sh
python -m pytest -q
python -m alembic current
```

From the repository root, follow [full stack installation and demo](../README.md). The [Issue #17](../_docs/issue-17-qa.md), [Issue #18](../_docs/issue-18-qa.md) and [Issue #20](../_docs/issue-20-qa.md) documents cover durable storage, owner isolation and full browser QA.

**Limitations:** local SQLite / in-process locks are not production multiworker architecture; no dedicated login rate limiting or verified email flow. Human acceptance tests are pending Issue #21.

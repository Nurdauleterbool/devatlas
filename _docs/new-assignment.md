# DevAtlas — Test, Containerise and Deploy assignment

## Requirement / GitHub Issue matrix

| Requested deliverable | Issue | Evidence |
|---|---|---|
| React static and FastAPI combined in one Dockerfile | #52 | `Dockerfile`, existing FastAPI static mounting |
| SQLAlchemy / Alembic PostgreSQL support | #50 | `backend/app/db.py`, `backend/alembic/env.py` |
| Transfer SQLite rows into PostgreSQL | #51 | `backend/scripts/migrate_sqlite_to_postgres.py` |
| Docker Compose app + PostgreSQL | #52 | `compose.yaml`, persistent Docker volume |
| Backend unit/API & frontend tests | #53 | `.github/workflows/fullstack-ci.yml` |
| Independent live Playwright E2E tests for ten features | #57–66 | `frontend/e2e/features/01*.spec.ts` through `10*.spec.ts`, GitHub label `e2e-test` |
| Deploy to provider and verify real HTTPS URL | #54 | Render live at https://devatlas-z0e0.onrender.com; persisted selection reported by user; see [deployment evidence](assignment-deployment-evidence.md) |
| AWS CloudFormation option | #55 | EC2/Compose/Caddy/PostgreSQL deployed at https://54.89.51.192.sslip.io and verified by user; guarded template `cloud/aws/cloudformation.yaml` |
| Automatic redeploy after successful tests | #53 | Render **After CI Checks Pass** is configured, but trigger not yet independently verified; AWS GHCR image publishing is CI-gated, but EC2 automatic pull/restart is not configured |
| Evidence & submission | #56 | [Verified deployment summary and CI run links](assignment-deployment-evidence.md); actual screenshots still need attaching to Issue #56 |

## Local run (Docker Desktop, Docker Compose v2)

```sh
cp .env.compose.example .env
docker compose config --quiet
docker compose up --build --wait -d
curl http://localhost:8000/api/v1/health
```

Visit http://localhost:8000 for both React and FastAPI on the same origin. PostgreSQL is private on the Compose bridge, its optional host port is bound to loopback only. The database uses the named volume `postgres_data`.

**Data retention:** `docker compose down` preserves the database. `docker compose down -v` deletes the volume and its data. For local development, only use disposable accounts/passwords.

## One-time SQLite data import

The default Compose startup **seeds** new database tables, so **do not import over an already-started database**. To preserve real SQLite data:

1. Stop the app and back up `backend/devatlas.db`.
2. Create a *new empty* PostgreSQL database; the user/role must be able to create schema tables.
3. From `backend/`, install Python dependencies and run `DEVATLAS_DATABASE_URL=postgresql+psycopg://... python -m alembic upgrade head`.
4. In the same folder, run `DEVATLAS_DATABASE_URL=postgresql+psycopg://... python scripts/migrate_sqlite_to_postgres.py --sqlite ./devatlas.db`.
5. Verify row counts, login and user isolation. The script uses one transaction, copies FK order, and refuses an already-populated destination.

Do not paste connection strings or passwords into GitHub Issues or logs. For a local Windows PowerShell session use `$env:DEVATLAS_DATABASE_URL="..."` instead of POSIX inline assignment.

## Independent Playwright tests

After Compose reaches healthy status:

```sh
cd frontend
npm ci
npx playwright install chromium
npm run test:e2e:compose
```

Ten Playwright files cover navigation, authentication, career selection, skill graph, learning progress, quizzes, recommendations, analytics, account isolation and responsive accessibility. They target the real HTTP app and PostgreSQL, not mocked browser services. Existing mock test suite and real FastAPI browser journey remain in their own workflows.

## CI/CD and deploy guard

`.github/workflows/fullstack-ci.yml` runs frontend build/lint/Vitest, backend pytest, Docker Compose/PostgreSQL startup, API integration, all feature Playwright specs and artifacts. Its optional `RENDER_DEPLOY_HOOK` step requires a repository secret and skips if unset. Render's own **After CI Checks Pass** setting is configured in the dashboard; a newly triggered automatic deploy remains to be verified. AWS's GHCR image publication is gated on successful Full-stack CI, but the running EC2 server does not yet automatically pull/restart that image.

Render does **not** run whole Compose YAML natively: configure a Dockerfile web service and separately managed PostgreSQL, setting `DEVATLAS_DATABASE_URL`, `DEVATLAS_ENVIRONMENT=production` and `DEVATLAS_FRONTEND_ORIGIN` to exact HTTPS origin. If enabling the GitHub hook, disable the service's own automatic-on-commit redeploy to preserve the test-first guarantee. Railway may import Compose definitions as mapped services; verify the provider plan and persistence.

## CloudFormation and cost safety

The AWS template is intentionally **disabled** by default (`AllowCreation=no`). The user approved creating a single AWS EC2 stack on a Free Plan account and verified the running HTTPS app, PostgreSQL and persisted selection on 2026-11-03. The stack is **currently live** and consumes AWS credit while resources are allocated. The initial cloud-init installation conflict was repaired on the existing EC2 and fixed in source by PR #71; fully automatic first boot with the corrected template has not been re-tested. See [live deployment evidence](assignment-deployment-evidence.md) and [AWS teardown guidance](../cloud/aws/README.md).

## Completion criteria

- [x] CI green on actual PR; [run links](assignment-deployment-evidence.md).
- [ ] Validate app and DB restart persistence.
- [x] Record real Render and AWS public HTTPS URLs and user-confirmed health check; see [deployment evidence](assignment-deployment-evidence.md).
- [ ] Confirm automated redeployment **after CI**.
- [x] Deploy and validate CloudFormation with authorized Free Plan account; AWS app and DB healthy, HTTPS and persistence confirmed; see [deployment evidence](assignment-deployment-evidence.md).
- [ ] Submit GitHub repository URL with the linked Issues and PR.

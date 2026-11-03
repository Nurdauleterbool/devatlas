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
| Deploy to provider and verify real HTTPS URL | #54 | **Not complete until live provider deploy is verified** |
| AWS CloudFormation option | #55 | `cloud/aws/cloudformation.yaml` guarded infrastructure template (**not deployed**) |
| Automatic redeploy after successful tests | #53 | CI job guarded by repository secret `RENDER_DEPLOY_HOOK`; not enabled until configured |
| Evidence & submission | #56 | GitHub CI results, provider logs and screenshots **to be added after verification** |

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

`.github/workflows/fullstack-ci.yml` runs frontend build/lint/Vitest, backend pytest, Docker Compose/PostgreSQL startup, API integration, all feature Playwright specs and artifacts. Deployment is allowed only from `main`, after `unit` and `integration` succeed, using a `RENDER_DEPLOY_HOOK` GitHub Actions secret. No deploy happens if the secret is absent.

Render does **not** run whole Compose YAML natively: configure a Dockerfile web service and separately managed PostgreSQL, setting `DEVATLAS_DATABASE_URL`, `DEVATLAS_ENVIRONMENT=production` and `DEVATLAS_FRONTEND_ORIGIN` to exact HTTPS origin. If enabling the GitHub hook, disable the service's own automatic-on-commit redeploy to preserve the test-first guarantee. Railway may import Compose definitions as mapped services; verify the provider plan and persistence.

## CloudFormation and cost safety

The AWS template is intentionally **disabled** by default (`AllowCreation=no`). Cloud resource provisioning requires user authorization, an eligible account, supported free-plan resources, billing alerts, network configuration and review of credentials, TLS and persistence. A $100 promotion is a credit, not a guarantee of zero charges. Never activate paid-only account features or commit passwords.

## Completion criteria

- [ ] CI green on actual PR; attach run links.
- [ ] Validate app and DB restart persistence.
- [ ] Record real provider public HTTPS URL and smoke verification.
- [ ] Confirm automated redeployment **after CI**.
- [ ] Deploy and validate CloudFormation on eligible Free-plan account only with authorization, otherwise report that step pending.
- [ ] Submit GitHub repository URL with the linked Issues and PR.

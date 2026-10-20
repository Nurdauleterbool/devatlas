# Issue #20 — repeatable MVP quality gates

This issue brings existing Vitest and pytest coverage together with real browser automation. No external user database or credentials are required.

## CI suites

- **Frontend CI** (frontend changes): `npm ci && npm run build && npm test && npm run lint`. Unit tests cover adapter error mapping, application state and learning calculations.
- **Backend tests** (backend changes): `python -m pytest -q` on Python 3.12. Includes quiz scoring/80% threshold, verified prerequisites, ownership isolation, SQLite persistence, request schemas, and invalid-submission rollback.
- **Browser E2E**: `npm run test:e2e` runs existing **mock-mode** Playwright tests with Chromium. Separate `npm run test:e2e -- --config=playwright.live.config.ts` runs a **live HTTP** browser test against a freshly migrated SQLite FastAPI server. The live test covers signup, career selection, graph, an actual server-graded quiz, analytics, refresh/persistence and a second isolated browser account. Mock and live suites intentionally run on different Vite ports and must not reuse fixtures or share application state.

## Run locally

Terminal 1 (from repository root, Python 3.12):
```sh
cd backend
python -m pip install -e '.[test]'
DEVATLAS_DATABASE_URL=sqlite:///./devatlas-e2e.sqlite3 DEVATLAS_FRONTEND_ORIGIN=http://127.0.0.1:4175 python -m uvicorn app.main:app --port 8000
```

Terminal 2 (Node 24):
```sh
cd frontend
npm ci
npx playwright install chromium
npm run build
npm test
npm run lint
npm run test:e2e
npm run test:e2e -- --config=playwright.live.config.ts
```

Never run integration tests against a development or production database containing real user data. GitHub CI uses a unique temporary SQLite path under runner temp and uploads Playwright traces on failure.

## Signoff requirements

Confirm all three GitHub checks are green on the PR: Backend tests, Frontend CI and Browser E2E. Document actual counts, verify any failure and rerun after fixes; do not merge on an unverified browser run. This project remains an educational MVP, and passing automated checks do not certify production readiness.

# DevAtlas — Interactive IT Career & Skill Gap Analyzer

DevAtlas helps Software Engineering and IT students choose a career path, understand skill prerequisites, track learning and identify what to study next. The MVP includes three paths—**Frontend Developer, Backend Developer and Data Analyst**—with ten shared skills, quizzes and personalized analytics.

**Current implementation (October 2026):** React + TypeScript + Vite + Tailwind CSS + React Flow frontend; FastAPI backend; SQLAlchemy + SQLite persistent repositories; Alembic migrations; Vitest, pytest and Playwright QA. The frontend uses the **real API by default**. The isolated mock adapter is available for demonstration and regression testing.

## Requirements

- Git and **Node.js 24** with npm for the frontend
- **Python 3.12+** for FastAPI
- Two terminals and available local ports **8000** (API) and **5173** (UI)

No cloud credentials, API keys or hosted database are required for local development. SQLite creates a local database file. Use **test credentials only**.

## Fresh-clone setup: run the full application

```sh
git clone https://github.com/Nurdauleterbool/devatlas.git
cd devatlas
```

**Terminal A — backend** (run commands from the `backend` directory):

```sh
cd backend
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -e '.[test]'
python -m alembic upgrade head
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The API startup also applies Alembic migrations and seeds a deterministic catalogue when using SQLite. From another terminal, check `http://127.0.0.1:8000/api/v1/health`; expected JSON is `{"status":"ok"}`. API documentation is available at `http://127.0.0.1:8000/docs`.

**Terminal B — frontend** (from repository root, in a different terminal):

```sh
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` to the local backend. Leave both terminal processes running while testing. Use localhost (not a different frontend hostname) for the default allowed browser Origin.

**Persistence:** the local default SQLite file is `backend/devatlas.db` (ignored by git). Accounts, hashed credentials, session digests, path selections, progress, history and quiz attempts survive backend restarts. Changing/deleting this file changes local test data; do not remove it to reset an account unintentionally.

### Windows PowerShell commands

Run backend commands inside `backend`; if Python is invoked through the Windows launcher, use `py -3.12 -m venv .venv` and `.\.venv\Scripts\Activate.ps1`, then the same `python -m pip install -e '.[test]'`, `python -m alembic upgrade head` and `python -m uvicorn ...`. Run `npm ci` and `npm run dev` in a separate PowerShell terminal inside `frontend`. Execution-policy configuration varies by local machine; avoid disabling system protections globally.

## Optional configuration

Copy `backend/.env.example` to `backend/.env` if you need local settings, or set environment variables:

| Setting | Default / meaning |
| --- | --- |
| `DEVATLAS_DATABASE_URL` | `sqlite:///./devatlas.db` from `backend/`; SQLite file path |
| `DEVATLAS_FRONTEND_ORIGIN` | `http://localhost:5173`; browser Origin allowlist |
| `DEVATLAS_ENVIRONMENT` | `development`; set `production` only behind HTTPS with Secure cookies |
| `DEVATLAS_STORAGE_BACKEND` | App server runs SQLite by default; `create_app()` test factory uses isolated memory |
| `VITE_SERVICE_MODE` | `http` (default live API), or `mock` (demo/test mode) |

To run only the mock frontend without FastAPI, use `VITE_SERVICE_MODE=mock npm run dev` on macOS/Linux, or set `$env:VITE_SERVICE_MODE='mock'` before `npm run dev` in PowerShell. **Mock-mode accounts and progress are temporary**, unlike the SQLite-backed app.

## Feature walkthrough (roughly 5 minutes)

1. Open `/`, examine the public dashboard preview, the `/careers` list and `/graph` prerequisite graph.
2. Go to `/signup`; create a test user with a valid email and a unique password. Choose **Frontend Developer** on the Dashboard or Career Paths screen.
3. View `/graph?path=frontend`: HTML unlocks prerequisite-dependent CSS/JavaScript learning; open a node or use its accessible keyboard control.
4. Visit `/skills/html`: read prerequisites and free resources, mark your self-assessment as **Learning** and then **Completed**.
5. Open `/skills/html/quiz`: answer the five multiple-choice questions and submit. **80% or better** marks the skill quiz-verified; verification is independent of self-assessed completion. Review the explanations and attempt a retake.
6. Visit `/analytics` for completion, quiz statistics, dated progress history and per-career results. Reload the browser and confirm persistence.
7. Log out and create a second test account. Verify that its learning history, quiz results and saved paths are distinct from the first account.

**Important:** passing an in-app practice quiz is **not** professional certification.

## API and data model

All API endpoints use `/api/v1`: session authentication (`/auth/*`), public careers and skills, prerequisite dependencies, resources, per-user career selections, learning progress and history, quiz submissions/attempts, recommendations and owned analytics. The canonical schema is [_docs/openapi.yml](_docs/openapi.yml); mapping, validation and ownership are described in [_docs/api-contract.md](_docs/api-contract.md). The SQLite/Alembic ORM has 16 relational tables. The frontend's `DevAtlasService` interface supports both HTTP and mock adapters without components importing persistence internals.

## Tests and evidence

From `frontend/`:

```sh
npm ci
npm run build
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

The last command runs the **mock** browser suite via its isolated Vite web server. To execute the **live** end-to-end browser suite, first launch the backend (using a disposable test SQLite database) as explained in [_docs/issue-20-qa.md](_docs/issue-20-qa.md), then run:

```sh
npm run test:e2e -- --config=playwright.live.config.ts
```

From `backend/`:

```sh
python -m pytest -q
python -m alembic current
```

GitHub Actions workflows are [Frontend CI](.github/workflows/frontend-ci.yml), [Backend tests](.github/workflows/backend-tests.yml) and [Browser E2E](.github/workflows/browser-e2e.yml). Their logs (not an unverified static count) are the authoritative test evidence. A fresh-clone setup smoke workflow also validates the commands in this README.

For historical QA reports see the `_docs/issue-*-qa.md` files. Full-stack user journey and browser evidence are documented in [_docs/issue-20-qa.md](_docs/issue-20-qa.md); the manual accessibility and user-testing matrix is [_docs/issue-21-manual-uat.md](_docs/issue-21-manual-uat.md).

## Known limitations / submission status

- This is a **local educational MVP**, not a production-hardened hosted service. SQLite and in-process locks are not designed for distributed multiworker deployment. Authentication lacks email verification and dedicated rate limiting.
- Session cookies require HTTPS and correct secure origin settings for any production deployment. No OAuth, AI chat, social features or external data synchronization is included.
- Real mobile/desktop **human** UAT and accessibility signoff are still pending under [Issue #21](https://github.com/Nurdauleterbool/devatlas/issues/21). Browser automation is additional evidence, not manual testing.
- Final submission documentation is [Issue #22](https://github.com/Nurdauleterbool/devatlas/issues/22); **do not close it until #21 has human QA verification and the final checklist is signed off**.
- `chat-brainstorm.md` is a decision summary, **not** the original brainstorming chat transcript. If the course requires that original transcript, attach the real export separately; do not manufacture it.

## Development process and project materials

[Product plan](_docs/plan.md) · [Architecture](_docs/architecture.md) · [API decisions](_docs/api-contract.md) · [Engineering process](process.md) · [Agent guidelines](AGENTS.md) · [Issue backlog](_docs/issue-backlog.md) · [Role definitions](roles/) · [Submission readiness](_docs/issue-22-submission.md).

Follow the stage gates: issue → implementation branch → tests/evidence → PR → QA review → verified closure. Post-MVP issues are deferred unless separately prioritized.

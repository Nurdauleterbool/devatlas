# DevAtlas

DevAtlas is an IT Career & Skill Gap Analyzer for IT students. The current implementation is a **frontend scaffold with mock data**: React, TypeScript, Vite, Tailwind CSS and React Router. FastAPI, SQLAlchemy/SQLite, authentication, quizzes and persistent personal progress are planned, not implemented.

## Run locally

Use Node.js 24 LTS and npm (validated with Node 24.19.0 and npm 11.9.0). No environment variables, credentials or database are required.

```sh
cd frontend
npm ci
npm run dev
```

Open the address printed by Vite. To serve on a specific interface, use `npm run dev -- --host 0.0.0.0`. To check a production build locally, run `npm run build` followed by `npm run preview`. Production hosting must serve `index.html` for client-side routes.

## Current features

| Route | Status |
| --- | --- |
| `/` — Dashboard | Three mock career paths, loading/error/empty states, temporary career selection |
| `/careers` — Career Paths | Frontend, backend and data analyst roadmaps; seeded skill statuses, prerequisites and completion progress |
| `/graph` — Skill Graph | Placeholder |
| `/learning` — Learning | Placeholder |
| `/analytics` — Analytics | Placeholder |

Unknown routes show a page-not-found screen. The desktop sidebar and mobile modal drawer link to all five routes. Navigation supports visible keyboard focus, a skip link, an active-route indicator, Escape dismissal and focus restoration. Career selection is temporary; skill progress is fixture data, not personal tracking.

Shared `Button`, `Card`, `Input` and `Dialog` components preserve the dark navy/indigo design. See [frontend setup and design conventions](frontend/README.md) for component usage and accessibility behavior.

## Verification

Run from `frontend`:

```sh
npm run build
npm run lint
npx playwright install chromium
npm run test:e2e
```

For an installed Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` instead of downloading a browser. Browser tests cover routes, mock states, component semantics and desktop/mobile keyboard interaction. They start a dedicated Vite server on port 4173. See [Issue #1 QA evidence and manual checklist](_docs/issue-1-qa.md).

## Project workflow

Read [AGENTS.md](AGENTS.md), [process.md](process.md), [_docs/plan.md](_docs/plan.md), [_docs/architecture.md](_docs/architecture.md), [_docs/issue-backlog.md](_docs/issue-backlog.md) and the relevant [role](roles/) before development. Work from an issue with testable acceptance criteria, use a separate branch/PR, and leave issue closure to QA.

Required sequence: mock frontend → OpenAPI contract → in-memory FastAPI backend → SQLite via SQLAlchemy → frontend/backend integration → QA. React Flow, Vitest and Pytest are part of the planned stack but are not installed in this scaffold. Playwright is installed for browser regression checks.

`chat-brainstorm.md` is a decision summary, **not the complete original transcript**. Export the original chat and add it separately before submission.

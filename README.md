# DevAtlas

DevAtlas is an IT Career & Skill Gap Analyzer for IT students. The current implementation is a **frontend with a typed in-memory mock service**: React, TypeScript, Vite, Tailwind CSS and React Router. Mock registration, login and logout are implemented. FastAPI, SQLAlchemy/SQLite, production authentication, quiz screens and persistent personal progress are planned.

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
| `/` — Dashboard | Personal selected paths, unique-skill progress, completion/verification, skill gaps and explained recommendations |
| `/careers` — Career Paths | Service-backed single/multiple path selection, skill roadmaps, prerequisites and progress |
| `/graph` — Skill Graph | Interactive React Flow prerequisite graph, career switching, five skill states and keyboard-accessible skill details |
| `/learning` — Learning | Ten unique skills with free resources, practice exercises and personal status controls |
| `/skills/:skillId` — Skill details | Prerequisites, safe resource links, practice and quiz entry |
| `/analytics` — Analytics | Placeholder |
| `/login`, `/signup` — Account | Accessible mock login, registration, demo sign-in and session states |

Unknown routes show a page-not-found screen. The desktop sidebar and mobile modal drawer link to all five routes. Navigation supports visible keyboard focus, a skip link, an active-route indicator, Escape dismissal and focus restoration. Visitors see explicitly labelled sample progress. Registered mock users have their own in-memory progress; switching accounts refreshes personalized views. Career selections are saved through the service for the current mock instance and update the Dashboard after confirmation. Shared skills count once across selected paths.

The replaceable `DevAtlasService` contract supplies users, careers, shared skills/dependencies, per-user progress/history, resources, practical tasks, quizzes/attempts, analytics and deterministic recommendations. The mock supports validated in-memory updates, quiz scoring and configurable loading/empty/error states. Fixtures include 10 unique skills shared across the three paths, with one five-question quiz per skill. See [mock service contract and scenarios](_docs/mock-service.md) and [career selection/dashboard conventions](_docs/career-dashboard.md).

To try the seeded demo account, open `/login` and choose **Try mock demo account**; no demo password is displayed or required. Alternatively, register a test account with a name, email and an 8–128 character password. Accounts, sessions and changes last only until a full page reload; this is a frontend prototype, not production authentication. See [mock authentication](_docs/mock-auth.md) for service usage and limitations.

Shared `Button`, `Card`, `Input` and `Dialog` components preserve the dark navy/indigo design. See [frontend setup and design conventions](frontend/README.md) for component usage and accessibility behavior.

## Verification

Run from `frontend`:

```sh
npm run build
npm run lint
npm run test
npx playwright install chromium
npm run test:e2e
```

For an installed Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` instead of downloading a browser. Vitest covers fixtures, service behavior, authentication validation and account isolation; browser tests cover routes, actual mock scenarios, component semantics and desktop/mobile keyboard interaction. They start a dedicated Vite server on port 4173. See [Issue #4 QA evidence](_docs/issue-4-qa.md), [Issue #3 QA evidence](_docs/issue-3-qa.md), [Issue #2 QA evidence](_docs/issue-2-qa.md) and the earlier [Issue #1 QA checklist](_docs/issue-1-qa.md).

## Project workflow

See [verified development progress and continuation checkpoint](_docs/development-progress.md) for actual issue/PR states and remaining dependencies.

Read [AGENTS.md](AGENTS.md), [process.md](process.md), [_docs/plan.md](_docs/plan.md), [_docs/architecture.md](_docs/architecture.md), [_docs/issue-backlog.md](_docs/issue-backlog.md) and the relevant [role](roles/) before development. Work from an issue with testable acceptance criteria, use a separate branch/PR, and leave issue closure to QA.

Required sequence: mock frontend → OpenAPI contract → in-memory FastAPI backend → SQLite via SQLAlchemy → frontend/backend integration → QA. Vitest and Playwright are installed for unit and browser tests. React Flow is installed for the interactive graph. Pytest remains part of the planned backend stage.

`chat-brainstorm.md` is a decision summary, **not the complete original transcript**. Export the original chat and add it separately before submission.

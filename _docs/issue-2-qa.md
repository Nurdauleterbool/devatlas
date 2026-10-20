# Issue #2 — Typed mock service and fixtures QA

Scope: [MVP-02: Create typed mockService and seed fixtures](https://github.com/Nurdauleterbool/devatlas/issues/2). Based on the latest fetched `main`, `eb0063e` (merge of Issue #1 PR #27), on separate branch `feat/issue-2-typed-mock-service`. The issue body was read through GitHub's public web page after the API read returned `Forbidden`.

## Changes and acceptance evidence

- `frontend/src/types/domain.ts`: shared types for users, careers, skills/dependencies, user selections, progress/history, resources/tasks, quizzes/responses/results/attempts, analytics and recommendations. Shared skill definitions contain no user status.
- `frontend/src/services/DevAtlasService.ts` and `services/index.ts`: session-scoped asynchronous interface, typed errors, and a single replaceable application binding. No frontend page imports fixtures or the mock implementation.
- `frontend/src/services/fixtures/`: deterministic data for all three careers, 10 unique skills, shared Python/SQL definitions, acyclic prerequisites, free resources, practical tasks, 10 five-question quizzes, two users and coherent per-user histories/attempts. Fixture validation rejects invalid references, cycles, grading data and ownership.
- `frontend/src/services/mockService.ts`: isolated in-memory state; asynchronous reads, selected-career replacement, progress/history updates and quiz submission. Validates inputs before mutations, retains retakes/best scores, derives verification and analytics, and generates deterministic explained recommendations. Ownership comes from the mock session, never from mutation input.
- `frontend/src/services/mockConfig.ts`: successful/empty/error states, finite latency, per-method failure support through factory options, environment settings and development-only query overrides.
- `frontend/src/services/careerRoadmaps.ts`, `src/hooks/useCareerRoadmaps.ts`, `src/App.tsx`, `src/pages/CareerPathsPage.tsx`: adapt the existing pages through the interface and compose shared definitions with per-user progress. Existing five routes, Dashboard selection, dark styling and accessibility are preserved. Prerequisites display skill names.
- `frontend/src/services/__tests__/`, `vitest.config.ts`, `package.json` and lockfile: add Vitest and unit coverage. Existing package versions, integrity values and platform metadata are preserved; no production dependency was added.
- `frontend/e2e/scaffold.spec.ts`: retains the 11 existing browser tests. Loading/empty/error checks now exercise actual mock configuration instead of replacing the mock module; the missing-default-career test supplies normalized contract data.
- Root/frontend READMEs, `_docs/architecture.md`, and [mock service documentation](mock-service.md): actual contract, lifecycle, behavior, scenario configuration, commands and limitations.

No backend, OpenAPI specification, authentication flow, SQLite persistence or unrelated page feature was implemented. Existing UI components/sidebar/styles and Issue #1 QA history are unchanged.

## Verified commands

Executed from `/workspace/devatlas/frontend` on 2026-10-20 with Node.js 24.19.0, npm 11.9.0, Vitest 5.0.5 and Chromium 154.0.8037.57:

| Command | Outcome | Execution evidence |
| --- | --- | --- |
| `npm ci --cache /workspace/.npm` | **PASS**, exit 0 | 71 packages installed from the updated lockfile |
| `npm run build` | **PASS**, exit 0 | TypeScript check and Vite build completed; 1945 modules transformed |
| `npm run lint` | **PASS**, exit 0 | No lint errors or warnings |
| `npm run test` | **PASS**, exit 0 | 4 test files, **73 passed, 0 failed, 0 skipped**; actual Vitest execution, 1.00s |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npx playwright test` | **PASS**, exit 0 | **11 passed, 0 failed, 0 skipped**; actual Chromium execution, 16.5s; no uncaught page runtime errors |
| `git diff --check` | **PASS**, exit 0 | No whitespace errors |

No required checks are unrun or blocked. The documented executable override uses the browser installed in this cloud environment; an unconfigured bundled-browser run was not performed for Issue #2. Playwright emits `Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.` This runner warning did not block any test and is unrelated to application lint/runtime diagnostics.

## Test coverage

The four Vitest files cover fixture integrity and corrupt-fixture rejection; asynchronous read contracts and optional lookups; per-user progress/attempt/history isolation; defensive copies and fresh-instance resets; reversible/idempotent progress changes; atomic validation failures and forged fields; career replacement/clearing; injected clocks and latency; pending input snapshots; quiz answer redaction, exact 80% threshold, invalid/partial/duplicate/foreign submissions, unlimited retained retakes and best score; independent verification; unique-skill and per-career analytics; prerequisite-aware, stable recommendations; empty/error/per-method scenarios; development/production configuration; and adapter-independent roadmap composition.

The 11 browser tests verify the existing Dashboard/career interactions, all five routes and page-not-found recovery, keyboard skip/route focus, mobile navigation at 320px/375px, Tab/Shift+Tab wrapping, Escape/backdrop/close-button dismissal, focus/scroll restoration, desktop resize, real mock latency/empty/error UI states, fallback selection, and Input/Dialog accessibility semantics.

## Review checklist and limits

- [ ] Review the shared types and service methods against the upcoming MVP screens; backend/OpenAPI design remains a later stage.
- [ ] In development, inspect Dashboard and Career Paths with `?mockLatencyMs=1500`, `?mockScenario=empty`, and `?mockScenario=error`; reload without parameters to restore normal fixtures.
- [ ] Confirm the current dark layout and keyboard/mobile navigation manually. Chromium automation passed; screen-reader, Firefox/Safari and manual zoom/reduced-motion review were not performed in this task.

State is intentionally in memory: a full reload or a new instance resets mutations. There is no real authentication. Grading keys exist in the client-side mock bundle even though pre-submission service responses omit them; future backend grading must enforce actual answer secrecy and authorization. Current pages read progress; editing/quiz/analytics screens remain assigned to later issues.

Engineering recommendation: **READY FOR REVIEW**. All requested automated checks executed successfully. No PR was merged and Issue #2 was not closed; QA retains responsibility for approval and closure.

Career choices previously lived only in Dashboard component state. This change saves signed-in users' single/multiple path selections through DevAtlasService and presents a personalized Dashboard with selected careers, scoped progress, independent quiz verification, skill gaps and explained next steps.

Related to #4. Based on main `2fd8a8a`, after Issue #3 merged in PR #29. Close the issue only after the PR is merged and completion is verified.

## Changes

- Reuse existing service methods, fixtures, roadmap composition and UI components. No backend, database, API contract or dependencies added.
- Add shared selection cards and a session-scoped confirmed response cache. Serialize/coalesce rapid writes, ignore stale responses, preserve background saves across application navigation and provide read/write/refresh retry states.
- Deduplicate shared skills and recommendations; retain adapter-authored reasons and consume analytics for per-path summaries. Completion and practice quiz verification remain separate.
- Preserve public previews, all existing routes, mock auth, mobile navigation and keyboard accessibility.
- Document decisions, changed files, QA evidence and the continuation checkpoint under `_docs/`.

## Verification

Full suites rerun from frontend on 2026-10-20; all exit codes 0:

| Command | Result |
| --- | --- |
| `npm run build` | PASS — TypeScript + Vite, 1,957 modules |
| `npm run lint` | PASS — no lint errors/warnings |
| `npm run test` | PASS — 122 passed, 0 failed/skipped, 6 files |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | PASS — 32 passed, 0 failed/skipped, 30.1s |

All nine prior auth tests pass unchanged. Responsive/keyboard checks cover 320, 375, 768 and 1280 px. See `_docs/issue-4-qa.md` for implementation evidence and a human reviewer checklist, and `_docs/development-progress.md` for actual issue/merge status and dependency gates.

## Limits

Mock selections/accounts/progress reset on reload. Progress editing, quizzes, graph interaction and detailed Analytics remain later issues. Screen-reader, Firefox/Safari and physical-device checks remain human QA. No integration or issue closure is implied by passing tests.

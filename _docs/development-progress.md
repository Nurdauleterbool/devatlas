# DevAtlas development progress

Verified snapshot: **2026-10-20, Asia/Qyzylorda**. This records observed GitHub/Git state, not planned completion. Refresh it after every verified merge or meaningful blocker change.

## Current checkpoint

- Issues #1–#4 are **CLOSED / COMPLETED**. PRs [#27](https://github.com/Nurdauleterbool/devatlas/pull/27), [#28](https://github.com/Nurdauleterbool/devatlas/pull/28), [#29](https://github.com/Nurdauleterbool/devatlas/pull/29) and [#30](https://github.com/Nurdauleterbool/devatlas/pull/30) are merged.
- Issue #4 merged as `1591dbd31fee1f827f322ecc81cfaab7006ed051`; its final implementation `eb2720e43377c65616c63b7782c00a78df1b5a1a` was verified as an ancestor of fetched origin/main before QA closed the issue.
- GitHub API access now works using the existing injected authentication. The earlier network blocker is resolved by observed successful PR creation, merge and issue closure. No token was requested or copied.
- Issue #5 is in progress on `feat/issue-5-skill-graph`, based on the fetched #4 merge. Required MVP: **22 issues**, **4 closed**, **18 open (#5–#22)**. Post-MVP #23–#26 remain excluded.
- The full MVP remains under development; backend, persistence and HTTP integration are later stages.

## Live backlog and dependencies

The full descriptions, acceptance criteria, labels and dependencies were read from each actual GitHub issue, rather than inferred from the older draft backlog. Issue #5 is dependency-ready after #4 merged. Continue sequentially through frontend #5–#8, contract #9, in-memory backend, persistence, integration and QA. Do not start later stages early.

| Issue | Stage | Direct dependencies | Verified status |
| --- | --- | --- | --- |
| [#1](https://github.com/Nurdauleterbool/devatlas/issues/1) — Scaffold frontend and design system | Mock frontend | None | CLOSED; merged PR #27 |
| [#2](https://github.com/Nurdauleterbool/devatlas/issues/2) — Create typed mockService and seed fixtures | Mock frontend | #1 | CLOSED; merged PR #28 |
| [#3](https://github.com/Nurdauleterbool/devatlas/issues/3) — Build registration/login UI and states | Mock frontend | #1, #2 | CLOSED; merged PR #29 |
| [#4](https://github.com/Nurdauleterbool/devatlas/issues/4) — Build career selection and dashboard UI | Mock frontend | #1, #2, #3 | CLOSED; merged PR #30 |
| [#5](https://github.com/Nurdauleterbool/devatlas/issues/5) — Implement interactive dependency graph UI | Mock frontend | #1, #2, #4 | OPEN; implementation in progress |
| [#6](https://github.com/Nurdauleterbool/devatlas/issues/6) — Build skill detail and resources UI | Mock frontend | #2, #5 | OPEN; dependency blocked |
| [#7](https://github.com/Nurdauleterbool/devatlas/issues/7) — Build quiz and results UI | Mock frontend | #2, #6 | OPEN; dependency blocked |
| [#8](https://github.com/Nurdauleterbool/devatlas/issues/8) — Build progress analytics and history UI | Mock frontend | #2, #4, #7 | OPEN; dependency blocked |
| [#9](https://github.com/Nurdauleterbool/devatlas/issues/9) — Specify OpenAPI contract and example payloads | API contract | #2, #3, #4, #5, #6, #7, #8 | OPEN; dependency blocked |
| [#10](https://github.com/Nurdauleterbool/devatlas/issues/10) — Scaffold FastAPI and in-memory repositories | In-memory backend | #9 | OPEN; dependency blocked |
| [#11](https://github.com/Nurdauleterbool/devatlas/issues/11) — Implement auth and user ownership checks | In-memory backend | #10 | OPEN; dependency blocked |
| [#12](https://github.com/Nurdauleterbool/devatlas/issues/12) — Implement paths, skills and dependency graph endpoints | In-memory backend | #10, #11 | OPEN; dependency blocked |
| [#13](https://github.com/Nurdauleterbool/devatlas/issues/13) — Implement progress and history endpoints | In-memory backend | #11, #12 | OPEN; dependency blocked |
| [#14](https://github.com/Nurdauleterbool/devatlas/issues/14) — Implement quiz scoring, verification and attempts | In-memory backend | #11, #12, #13 | OPEN; dependency blocked |
| [#15](https://github.com/Nurdauleterbool/devatlas/issues/15) — Implement recommendations and dashboard analytics | In-memory backend | #12, #13, #14 | OPEN; dependency blocked |
| [#16](https://github.com/Nurdauleterbool/devatlas/issues/16) — Define SQLAlchemy models and Alembic migrations | SQLite persistence | #10, #11, #12, #13, #14 | OPEN; dependency blocked |
| [#17](https://github.com/Nurdauleterbool/devatlas/issues/17) — Implement SQLite repositories and seed data | SQLite persistence | #16 | OPEN; dependency blocked |
| [#18](https://github.com/Nurdauleterbool/devatlas/issues/18) — Verify persistence and user isolation | SQLite persistence | #11, #13, #14, #15, #17 | OPEN; dependency blocked |
| [#19](https://github.com/Nurdauleterbool/devatlas/issues/19) — Connect frontend HTTP service to FastAPI | Integration | #8, #9, #15, #18 | OPEN; dependency blocked |
| [#20](https://github.com/Nurdauleterbool/devatlas/issues/20) — Add unit, API and browser E2E coverage | QA | #19 | OPEN; dependency blocked |
| [#21](https://github.com/Nurdauleterbool/devatlas/issues/21) — Run manual user testing and accessibility checks | QA | #19, #20 | OPEN; dependency blocked |
| [#22](https://github.com/Nurdauleterbool/devatlas/issues/22) — Document setup, architecture, test evidence and demo | Submission | #20, #21 | OPEN; dependency blocked |
| [#23](https://github.com/Nurdauleterbool/devatlas/issues/23) — AI learning assistant | Future | #22 | OPEN; post-MVP, excluded |
| [#24](https://github.com/Nurdauleterbool/devatlas/issues/24) — GitHub profile analysis | Future | #22 | OPEN; post-MVP, excluded |
| [#25](https://github.com/Nurdauleterbool/devatlas/issues/25) — OAuth login | Future | #22 | OPEN; post-MVP, excluded |
| [#26](https://github.com/Nurdauleterbool/devatlas/issues/26) — Custom career maps and social features | Future | #22 | OPEN; post-MVP, excluded |

## Issue #4 — implementation and QA evidence

Implemented: signed-in single/multiple career selection via the existing service, session-retained selection, latest-intent write coordination, personalized Dashboard, unique shared-skill totals, independent quiz verification, gaps, explained recommendations, loading/empty/error/retry states, responsive keyboard-accessible controls and per-user isolation. No fixtures, service contract, dependencies, backend or database were added for this issue.

[Issue #4 QA](issue-4-qa.md) lists the implementation files, bugs found/fixed and manual reviewer checklist. [Career dashboard notes](career-dashboard.md) explain calculations/lifecycle. [Prepared PR body](issue-4-pr.md) is committed for manual publication. This branch also contains this progress document, a README link, and the same-account auth-navigation correction described below.

Latest full regression rerun after the auth-navigation correction on 2026-10-20, from `frontend`, Node 24.19.0 / npm 11.9.0:

| Command | Result | Exact counts |
| --- | --- | --- |
| `npm run build` | PASS, exit 0 | TypeScript + Vite, 1,957 modules |
| `npm run lint` | PASS, exit 0 | 0 lint errors/warnings |
| `npm run test` | PASS, exit 0 | 122 passed, 0 failed, 0 skipped; 6 files |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | PASS, exit 0 | 33 passed, 0 failed, 0 skipped; 31.1s |

System Chromium 154.0.8037.57 was used. All suites actually executed; no environment-blocked test is counted as passed. Independent QA reproduced a stale Dashboard when a delayed career write finished after browser Back through the signed-in login page. The keyed career provider now stays mounted across auth-route visits while auth forms remain outside it. A deterministic browser regression failed before the fix and passed afterward; the complete unchanged auth suite and account-isolation checks pass. The correction and earlier signup-remount/test-harness evidence are recorded in the issue QA report. Human screen-reader, Firefox/Safari and physical-device checks remain unexecuted. Backend/SQLite/integration suites are not implemented and were not run; these frontend results do not validate future stages.

## Integration and continuation

The earlier api.github.com CONNECT/403 blocker is resolved: PR #30 was created, its state was checked as MERGEABLE/CLEAN with no configured checks, and the independently reviewed, fully tested exact head was merged without bypassing protections. Only afterward was #4 closed through the API. Existing GitHub authentication supports the requested operations.

Current development: #5 interactive React Flow graph, using existing typed career roadmaps. After its acceptance criteria and full regression pass, commit/push a separate PR, verify merge gates, merge, confirm the implementation in main, and only then close #5. Next is #6 skill details/resources/status controls. Continue the dependency table above, recording actual test counts and PR/issue states after each integration. No post-MVP implementation is authorized.

## Completed issue evidence

| Issue | Result | Features and changes | Validation | Next |
| --- | --- | --- | --- | --- |
| #4 — Career selection and Dashboard | PR #30 MERGED; Issue CLOSED after verification | Service-backed selection/dashboard; auth-route pending-save race fixed in App.tsx with a failing-before/passing-after browser regression; full file list and corrections in issue-4-qa.md | Build/lint PASS; 122 unit and 33 browser tests PASS; independent QA approved | #5 |


## Issue #5 — implementation awaiting integration

Interactive React Flow prerequisite graph with all three career paths, five labelled skill states, missing-prerequisite explanations, zoom/pan/fit, matching detail modal and keyboard skill list. Graph exploration preserves saved choices. See issue-5-qa.md for all files and corrections.

Executed checks: build/lint PASS; 141 unit tests PASS (7 files); final full Chromium suite 40 PASS / 0 failed / 0 skipped in 40.6s, including all prior 33 scenarios and seven new graph scenarios. Nineteen new model tests pass. Independent QA approved. Early Vite reload interruption and small-control sizing were corrected and documented; no tests were disabled. Next dependency-ready issue after verified merge/closure is #6.

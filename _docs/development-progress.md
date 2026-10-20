# DevAtlas development progress

Verified snapshot: **2026-10-20, Asia/Qyzylorda**. This records observed GitHub/Git state, not planned completion. Refresh it after every verified merge or meaningful blocker change.

## Current checkpoint

- `origin/main`: `2fd8a8a9a95c48ff944e4b1e436f3135b39c5451` (merged Issue #3).
- Issues #1–#3 are actually **CLOSED / COMPLETED**. Public PR pages #27, #28 and #29 show **Merged**, and their merge commits `eb0063e`, `b530aae`, `2fd8a8a` are in `origin/main`.
- Issue #4 is **OPEN**. Implementation `4dfd4c589acc5630980008c40900f6e883ada5ca` is pushed on `feat/issue-4-career-dashboard` but is **not merged**. Follow-up documentation commits remain on that same feature branch; read the remote branch tip for the latest revision.
- Public PR search for that branch returns **0 open / 0 closed** PRs. The PR does not exist. No merge or issue closure was attempted without a PR.
- Required MVP backlog: **22 issues**, **3 closed**, **19 open (#4–#22)**. The four post-MVP issues #23–#26 are excluded. Both public issue-list pages were inspected (26 total issues); there were no additional bug issues in that snapshot.
- **Overall project: NOT READY / INTEGRATION BLOCKED.** Issue #4 is ready for review, not complete under the requested merged-and-verified Definition of Done.

## Live backlog and dependencies

The full descriptions, acceptance criteria, labels and dependencies were read from each actual GitHub issue, rather than inferred from the older draft backlog. Every remaining issue #5–#22 depends transitively on #4. There is no independent, dependency-ready required implementation to start while #4 is unmerged. Do not start the API/backend/persistence stages early.

| Issue | Stage | Direct dependencies | Verified status |
| --- | --- | --- | --- |
| [#1](https://github.com/Nurdauleterbool/devatlas/issues/1) — Scaffold frontend and design system | Mock frontend | None | CLOSED; merged PR #27 |
| [#2](https://github.com/Nurdauleterbool/devatlas/issues/2) — Create typed mockService and seed fixtures | Mock frontend | #1 | CLOSED; merged PR #28 |
| [#3](https://github.com/Nurdauleterbool/devatlas/issues/3) — Build registration/login UI and states | Mock frontend | #1, #2 | CLOSED; merged PR #29 |
| [#4](https://github.com/Nurdauleterbool/devatlas/issues/4) — Build career selection and dashboard UI | Mock frontend | #1, #2, #3 | OPEN; implementation pushed; PR/merge blocked |
| [#5](https://github.com/Nurdauleterbool/devatlas/issues/5) — Implement interactive dependency graph UI | Mock frontend | #1, #2, #4 | OPEN; dependency blocked |
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

[Issue #4 QA](issue-4-qa.md) lists the implementation files, bugs found/fixed and manual reviewer checklist. [Career dashboard notes](career-dashboard.md) explain calculations/lifecycle. [Prepared PR body](issue-4-pr.md) is committed for manual publication. This follow-up also adds this progress document and links it from README.

Full regression rerun on the implementation commit on 2026-10-20, from `frontend`, Node 24.19.0 / npm 11.9.0:

| Command | Result | Exact counts |
| --- | --- | --- |
| `npm run build` | PASS, exit 0 | TypeScript + Vite, 1,957 modules |
| `npm run lint` | PASS, exit 0 | 0 lint errors/warnings |
| `npm run test` | PASS, exit 0 | 122 passed, 0 failed, 0 skipped; 6 files |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | PASS, exit 0 | 32 passed, 0 failed, 0 skipped; 30.1s |

System Chromium 154.0.8037.57 was used. All suites actually executed; no environment-blocked test is counted as passed. No new defect or code change was required in this follow-up. Earlier signup-remount and test-harness corrections are recorded in the issue QA report. Human screen-reader, Firefox/Safari and physical-device checks remain unexecuted. Backend/SQLite/integration suites are not implemented and were not run; these frontend results do not validate future stages.

## GitHub blocker and recovery

Read/push through the existing Git proxy works. GitHub API requests do not:

- `gh api 'repos/Nurdauleterbool/devatlas/issues?state=all' --paginate` fails with `Get "https://api.github.com/repos/Nurdauleterbool/devatlas/issues?state=all&per_page=100": Forbidden`.
- `gh pr create --repo Nurdauleterbool/devatlas --base main --head feat/issue-4-career-dashboard --title 'MVP-04: Add career selection and personalized dashboard' --body-file _docs/issue-4-pr.md` fails with `Post "https://api.github.com/graphql": Forbidden` (exit 1).
- No callable GitHub connector was available. Public web pages supplied read-only status evidence; they do not provide write authorization. This was an API access denial, not an automatic approval-review rejection.

**Action needed:** create the [Issue #4 PR targeting main](https://github.com/Nurdauleterbool/devatlas/pull/new/feat/issue-4-career-dashboard) using the committed body, then review the QA evidence/acceptance criteria and required checks. Merge only when all required gates pass; verify the merged implementation in main before closing #4. Alternatively restore GitHub API access in the environment and rerun the documented command. No secret values are needed in chat. Do not push a direct merge to main to bypass the PR requirement.

## Exact continuation instructions

1. Recheck GitHub Issue #4 and the branch PR search first to avoid duplicate PRs or closures. If a PR now exists, record its actual URL/status here.
2. Fetch `origin/main` and the feature branch. Verify that #4 is merged, the actual required checks pass, and its functionality is present in main. Rerun full frontend regression for any changed application code or merge conflict resolution. Close #4 only after verified merge/completion.
3. Read Issue #5 and current repository instructions again. Create `feat/issue-5-skill-graph` from the new `origin/main`; implement the React Flow graph and its tests/QA in a separate PR. #5 is the next issue; no #5 code or branch has been started here.
4. Continue the dependency table above, keeping each issue separate. Finish mock frontend #5–#8 before OpenAPI #9; finish in-memory backend before SQLite; integrate HTTP only when the backend is ready. Keep updating this document with actual tests, PR links and merge/issue states.
5. Preserve the existing #4 commits. Do not mark #5–#22 complete, close issues for metrics, or implement #23–#26.

No continuation is scheduled or running after this turn. The checkpoint and branch are preserved so work can resume once the external integration blocker is resolved. A final full-project verification cannot honestly be performed until the remaining required implementation stages exist.

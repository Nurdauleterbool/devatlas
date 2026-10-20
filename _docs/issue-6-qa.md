# Issue #6 — skill details, resources and progress QA

Date: 2026-10-20, Asia/Qyzylorda. Mock frontend stage, based on fetched main after Issue #5 merge 737dab9. Actual Issue #6 acceptance criteria and repository/role instructions were read before implementation.

## Acceptance criteria and behavior

Graph inspection and direct /skills/:skillId routes use the same typed service-backed detail component. Learning lists all 10 unique seeded skills. Details match the selected skill and show description, linked prerequisites, free safe external resources, practice exercises, progress/verification/best score and a quiz entry point. Prerequisite links navigate standalone details; modal buttons change the inspected graph skill and move focus into its loaded content.

Only signed-in users can save self-assessment. Status changes update shared Dashboard/graph data without reload; they do not forge quiz verification. Forms guard duplicates, show pending/success/error/retry states and preserve unsaved choices during background confirmation. Public preview is read-only. Missing skills and failed/empty material reads remain navigable. Quiz-taking is #7; the entry route is explicitly a temporary upcoming-quiz screen in this stage.

Resource URLs accept HTTPS only, reject credentials/executable schemes and preserve noopener/noreferrer on new-tab links. Invalid or non-free material is omitted with an unavailable-material message. Composition validates catalogue/progress/material references and whitelists public quiz fields so accidental grading metadata is not displayed before submission. Pages do not import fixtures or supply owner IDs.

## Executed verification

From frontend: Node 24.19.0/npm 11.9.0, Chromium 154.0.8037.57.

| Command | Actual result |
| --- | --- |
| npm run build | PASS, exit 0; TypeScript + Vite, 2,119 modules |
| npm run lint | PASS, exit 0 |
| npm run test | 200 passed, 0 failed/skipped; 9 files; exit 0 |
| PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- e2e/skill-details.spec.ts | 11 passed, 0 failed/skipped; 16.1s; exit 0 |
| PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e | 51 passed, 0 failed/skipped; 54.8s; exit 0 |

Added 51 composition/URL tests, 8 shared-writer tests and 11 browser scenarios. Coverage includes all seeded material, malformed references, safe URLs, answer-key stripping, duplicate writes, failed writes/read retry, account isolation, graph/standalone prerequisite navigation, propagation into Dashboard/graph, unknown skills, 320/375/768/1280px layout, and the races below. The existing graph focus assertion now checks the loaded detail heading because async skill content moves focus there; the modal-focus assertion remains meaningful and generic Dialog regressions remain unchanged.

All 10 curated resource URLs were checked using curl --head --location with TLS verification intact; **all returned HTTP 200**. Initial requests were blocked before TLS by the environment proxy. Exact documentation hosts developer.mozilla.org, react.dev, docs.python.org, www.postgresql.org, fastapi.tiangolo.com, pandas.pydata.org and openstax.org were added to the network draft while preserving api.github.com/presets. Subsequent real requests succeeded; this is runtime connectivity evidence, not a publication claim.

## Defects found and fixed during implementation

Independent Chromium QA deterministically reproduced two races with deferred promises:

1. A CSS save started in one detail view could complete after leaving/reopening CSS, while the new view permanently displayed the old status. Details now follow newer same-owner confirmed workspace progress, while nullable form drafts preserve unsaved intention.
2. A slower older save could overwrite a newer save made after remounting the view. A workspace-owned serialized progress writer now snapshots requests, retains ordering across routes, keeps its queue usable after failures, and cancels queued requests on workspace cleanup. The adapter retains in-flight session guards.

Shared snapshot reads also serialize so an older read cannot overwrite a later refresh. Mutations finish their shared refresh even after the initiating detail view unmounts. Three deterministic browser regressions verify reopened confirmation, latest intent and draft preservation; the duplicate/pending-navigation regression verifies one request and correct Dashboard totals. Independent re-review approved both corrections with no further blocking findings. Development-only lint/type integration errors were corrected before the final passing checks; no assertions were removed or tests disabled.

## Changed files and limits

SkillDetails.tsx, SkillDetailPage.tsx and LearningPage.tsx implement the UI; App.tsx and SkillGraphPage.tsx integrate it. skillDetails.ts and its tests own composition/link safety; progressWrites.ts and its tests own shared mutation ordering; CareerProvider/careerContext own refresh/mutation lifecycle. skill-details.spec.ts adds browser coverage; skill-graph.spec.ts updates the loaded-focus expectation. README, frontend/README, architecture, career-dashboard and development-progress document behavior.

Accounts, progress and quizzes still use the in-memory mock and reset on reload. No backend, SQL database or production authorization is claimed. Human screen-reader and non-Chromium/device checks remain unrun. **Ready for review/integration**; closure requires confirmed merge.

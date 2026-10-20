# Issue #4 — career selection and Dashboard QA

Scope: MVP-04, frontend/mock stage. Branch `feat/issue-4-career-dashboard` starts from fetched `origin/main` `2fd8a8a` (Issue #3 merged in PR #29). The initial working tree was clean. Repository instructions and the actual Issue #4 acceptance criteria were read before implementation. No backend, database, OpenAPI, dependency or fixture changes.

## Implemented evidence

- All three career definitions, descriptions and required skills come through `DevAtlasService` and the existing roadmap composer.
- Signed-in users choose one path, include additional paths or clear selections using `setSelectedCareers`. Confirmed selection is reread with `getSelectedCareers`; navigation retains it within the mock instance.
- Dashboard shows selected careers, self-reported completion, quiz verification, unfinished required skills, and adapter-provided recommendations/reasons. Per-path summaries consume analytics. Shared skills/recommendations are grouped by skill ID; Backend + Analyst show six unique skills, not eight memberships.
- Serialized/coalesced writes, copied request inputs, request revisions and cancellation protect rapid switching and account transitions. Pending intentions do not replace confirmed dashboard totals. Background saves continue when visiting other application routes.
- Loading, initial-read retry, write/refresh retry, no selected career, empty catalogue, no skill gaps and no eligible recommendation states are implemented. A failed refresh explicitly warns that a write may already have saved.
- Existing Button/Card, native labelled checkboxes, semantic headings/regions, named progress bars and live feedback retain the navy/indigo design. Existing auth, skip link, focus styles and mobile drawer behavior are preserved.

## Final executed verification

Executed from `frontend`, Node 24.19.0, npm 11.9.0. Browser: installed system Chromium 154.0.8037.57 via the repository-supported override. Every final command exited 0.

| Command | Result | Executed counts |
| --- | --- | --- |
| `npm run build` | PASS — TypeScript + Vite | 1,957 modules; no test count |
| `npm run lint` | PASS — no lint errors or warnings | Static analysis; no test count |
| `npm run test` | PASS | 122 passed, 0 failed, 0 skipped; 6 files |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | PASS | 32 passed, 0 failed, 0 skipped; 2 workers, 38.7 seconds |
| `git diff --check` | PASS | No whitespace errors |

The full suites ran, including the 104 earlier unit tests and 20 earlier browser scenarios. Added 18 unit cases and 12 browser cases. The original scaffold selection test now signs into the demo account and asserts service-backed saving instead of the obsolete anonymous local-only selection. Its route/roadmap coverage remains; the synthetic fallback heading assertion now targets its semantic heading level. All nine Issue #3 auth tests remain unchanged and pass.

No final check was blocked by the environment. Chromium was used directly; Playwright's bundled browser was not needed. npm update notices and the runner's `NO_COLOR`/`FORCE_COLOR` warnings were informational. Two early npm invocations from the repository root failed with missing `package.json`; they did not execute tests and are not counted as verification.

## Coverage and development corrections

Unit cases cover anonymous/public reads, saved selection, all three switches, scoped calculations, shared Python/SQL totals, independent quiz verification, adapter reasons, no selection/empty/completed paths, user-specific selection restoration, failed/inconsistent adapter responses, input snapshots, skipped obsolete writes, already-running writes, cancellation and retry.

Browser cases cover signup-to-selection-to-dashboard, all paths, multiple paths/shared reasons, public preview, clearing selection, latency/rapid switching, navigation during saves, read/write/post-write-refresh failures and retries, empty signed-in catalogue, separate accounts, and native keyboard selection. Responsive checks execute at 320, 375, 768 and 1280 px with assertions against horizontal overflow on Dashboard and Career Paths. Runtime-error checks passed for all exercised scenarios.

An early implementation keyed the career provider around auth pages, remounting signup and losing its success announcement. Existing auth regression tests caught this; auth pages now sit outside the keyed application layout. Early lint warnings were resolved. New browser test setup was corrected to use keyboard modality before checking `:focus-visible`, keep a simulated read failure active through StrictMode loads, and wait for route completion/use a named progress bar. No assertions were disabled or tests skipped. Final full suites pass.

Desktop Dashboard (1440 px) and mobile Dashboard/Career Paths (320 px) screenshots were generated and visually inspected. Cards, hierarchy, progress labels, statuses and controls fit without observed clipping. The mobile browser check also measured no overflow.

## Changed files

| File | Change |
| --- | --- |
| `frontend/src/App.tsx` | Shared keyed application workspace, separate auth routes, extracted Dashboard |
| `frontend/src/pages/DashboardPage.tsx` | Personalized dashboard and public career discovery |
| `frontend/src/pages/CareerPathsPage.tsx` | Saved selection, query-based roadmap preview, correct personal/sample labels |
| `frontend/src/careers/CareerProvider.tsx` | Confirmed response cache, latest-request guards, selection lifecycle/retry |
| `frontend/src/careers/careerContext.ts` | Typed shared career workspace context |
| `frontend/src/components/CareerSelection.tsx` | Shared career cards, selection controls, request feedback |
| `frontend/src/components/CareerProgress.tsx` | Reusable labelled progress indicator |
| `frontend/src/services/careerDashboard.ts` | Contract-only composition and serialized/cancellable selection writer |
| `frontend/src/services/__tests__/careerDashboard.test.ts` | 18 new unit cases |
| `frontend/e2e/career-dashboard.spec.ts` | 12 new browser cases |
| `frontend/e2e/scaffold.spec.ts` | Existing selection-flow/semantic assertion adaptation |
| `README.md`, `frontend/README.md` | Current features, usage, commands and lifecycle |
| `_docs/architecture.md`, `_docs/mock-auth.md` | Updated workspace/session boundaries |
| `_docs/career-dashboard.md`, `_docs/issue-4-qa.md` | Technical decisions and this QA evidence |

## Additional manual reviewer checklist

These are suggested human checks, not claimed completed tests:

- [ ] Use a screen reader for path buttons/checkboxes, save/error announcements and named progress bars.
- [ ] Check browser zoom/preferred text scaling, long account names, reduced motion and a physical mobile keyboard.
- [ ] Review the flow in Firefox and Safari; automated coverage is Chromium only.
- [ ] Select Backend + Data Analyst, confirm six unique skills, then switch to Frontend and inspect its independent completion/verification numbers.
- [ ] Sign out, create another account and confirm no selected careers leak between users; reload and confirm the documented mock reset is understood.

## Limitations and recommendation

Mock accounts, sessions, selections and progress reset on full reload. No server/storage or production authentication is introduced. Progress editing, quiz screens, graph interaction and detailed Analytics remain later issues. External changes from another tab/HTTP API are not subscribed to; current UI writes refresh the service view. Human screen-reader, Firefox/Safari and physical-device checks remain additional review work.

**READY FOR REVIEW** for Issue #4's scope. Publication status and any PR URL are reported after actual Git/GitHub operations; this report does not assert a PR was created. No merge or Issue #4 closure is performed.

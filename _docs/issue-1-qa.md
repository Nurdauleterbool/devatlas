# Issue #1 — Frontend scaffold engineering QA

Scope: [MVP-01: Scaffold frontend and design system](https://github.com/Nurdauleterbool/devatlas/issues/1). Based on fetched `origin/main`, commit `8c2a23e`, on branch `feat/issue-1-frontend-scaffold`. Required repository documents and the issue body were read. The issue was readable through the GitHub web page; GitHub REST/GraphQL API requests returned `Forbidden` in this environment.

## Changes

- `frontend/src/App.tsx`: connects the existing Career Paths page at `/careers`, reuses Button/Card on the Dashboard, adds the mobile Dialog, skip link and route focus management. All five routes and the missing-page fallback are retained.
- `frontend/src/components/SidebarNavigation.tsx`: shares desktop/mobile navigation with active-route semantics and decorative icons hidden from assistive technology.
- `frontend/src/components/ui/Button.tsx`: native props/ref, safe default button type, disabled styles, 44px minimum height and higher-contrast primary colors.
- `frontend/src/components/ui/Card.tsx`: reusable semantic article with a highlighted state.
- `frontend/src/components/ui/Input.tsx`: implements the previously empty file with visible labels, generated IDs, linked hints/errors, native props/ref and invalid state.
- `frontend/src/components/ui/Dialog.tsx`: adds a controlled native modal with a labelled heading/description, inert background, explicit Tab/Shift+Tab wrapping, Escape/backdrop/close-button dismissal, scroll locking and focus restoration. The drawer variant is used for mobile navigation.
- `frontend/src/pages/CareerPathsPage.tsx`: imports/reuses UI components, preserves seeded progress/statuses, removes headings from inside buttons, and selects an available career when the default fixture is absent.
- `frontend/src/pages/PlaceholderPage.tsx`: reuses Card and updates the navigation link's contrast.
- `frontend/src/index.css` and `frontend/index.html`: named dark theme tokens, visible focus, responsive modal/drawer, reduced motion, and application title/description.
- `frontend/package.json`, `frontend/package-lock.json`, `frontend/playwright.config.ts`, `frontend/e2e/` and `frontend/.gitignore`: add one direct development dependency, Playwright, with browser regressions and ignored generated results. No production dependency was added, and existing locked versions/integrity/platform metadata were preserved.
- Root and frontend READMEs: actual setup, feature status, routes, design/component conventions and test commands.

`src/main.tsx` and `src/services/mockService.ts` are unchanged. No backend, authentication, persistence or unrelated product feature was added. The fetched baseline already passed build/lint; no pre-existing compilation failure is claimed. The missing Input/Dialog and unused Career Paths route were the scaffold gaps completed here.

## Final QA verification

Verified application code commit `792b1d0` from `/workspace/devatlas/frontend` on 2026-10-20 with Node.js 24.19.0, npm 11.9.0 and system Chromium 154.0.8037.57. The working tree was clean before verification. No application or test code was changed during this final QA pass.

| Command/check | Result |
| --- | --- |
| `npm run build` | **PASS**, exit 0; TypeScript check and Vite production build actually completed, 1936 modules transformed. No errors. This command is not a test suite. |
| `npm run lint` | **PASS**, exit 0; lint actually executed, no errors or warnings. This command is not a test suite. |
| `npx playwright test` — initial invocation without browser configuration | **FAIL / environment blocked**, exit 1; runner reported 0 passed, 11 failed during browser launch. Application test bodies did not execute because the bundled Chromium executable was absent. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npx playwright test` — corrected environment | **PASS**, exit 0; 11 tests actually executed and passed in 12.4s, 0 failed, 0 skipped. No uncaught browser runtime errors. |
| Development server | Started by Playwright and exercised through actual Chromium navigation and requests in the successful rerun |
| `git diff --check` | Exit 0; no whitespace errors |

The exact error repeated for all 11 cases in the unconfigured invocation was:

```text
Error: browserType.launch: Executable doesn't exist at /home/agent/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell
```

This was a browser-installation limitation, not an application assertion failure. The existing `playwright.config.ts` already supports `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; selecting the installed `/usr/bin/chromium` resolved it without changing application code, assertions or test configuration. To reproduce this environment's successful run, export that variable before `npx playwright test`. Alternatively install Playwright's Chromium as described in the frontend README.

Raw final-QA runner logs in this workspace: `/tmp/devatlas-final-playwright-default.log` (blocked invocation) and `/tmp/devatlas-final-playwright-system.log` (successful rerun).

The browser suite checks Dashboard fixtures and selection; all five direct routes and active links; page-not-found recovery; skip-link and route focus; mobile keyboard navigation at 320px/375px; Tab/Shift+Tab wrapping; Escape/backdrop/close-button dismissal; focus/scroll restoration; desktop resize; loading/empty/error states on Dashboard and Career Paths; missing-default-career fallback; input labels/descriptions/errors/required/disabled state; button form semantics; dialog accessible name/description; and uncaught browser runtime errors.

During implementation, an earlier run exposed missing deterministic Tab wrapping in Chromium's native dialog behavior. Explicit focus wrapping fixed it; the final suite above includes this regression. Browser launch emits `Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.` This runner warning is separate from application lint/runtime diagnostics and did not block execution.

Historical setup evidence, not repeated during this final QA pass: `npm ci --cache /workspace/.npm` installed 53 packages with exit 0; screenshots of the desktop Dashboard (1440px), mobile Career Paths and open drawer (375px) were reviewed during implementation and retained the dark design.

## Git status and review delivery

- Implementation changes are committed as `792b1d0` on `feat/issue-1-frontend-scaffold`. `git ls-remote` confirmed this exact commit on the remote branch. The changed-file inventory is recorded above; `git diff --name-status 8c2a23e..792b1d0` lists 20 files.
- This final QA pass changes only `_docs/issue-1-qa.md`; no frontend source, test, manifest or lockfile changes were required.
- The remote `main` ref was verified at `8c2a23e78e25f33c6027608d829dbbb433b5783f` and was not modified by this work.
- **No GitHub Pull Request exists at the time of verification.** The public GitHub pull-request dashboard, both unfiltered and filtered for this branch, reported 0 open and 0 closed results and no PR links. `gh pr list --repo Nurdauleterbool/devatlas --head feat/issue-1-frontend-scaffold --state all --json number,url,state,headRefName` could not query the API: `Post "https://api.github.com/graphql": Forbidden`.
- The implementation branch is already pushed; branch publication is distinct from PR creation. Next step: [create a Pull Request](https://github.com/Nurdauleterbool/devatlas/pull/new/feat/issue-1-frontend-scaffold) targeting `main` from `feat/issue-1-frontend-scaffold`. A prepared description is available at `/tmp/devatlas-issue-1-pr.md` in this workspace.

Recommendation: **READY FOR REVIEW**. Build, lint and all 11 actual Chromium tests pass with the documented system-browser setting. PR creation remains outstanding; the manual cross-browser and assistive-technology checks below remain unexecuted and should be completed during review before approval.

## Manual QA checklist for review

These are handoff checks, not a claim of independent QA approval:

- [ ] Compare Dashboard, Career Paths and navigation at 320px, 375px, 768px and desktop widths; verify readable content, scrolling, active states and no horizontal overflow.
- [ ] Use only the keyboard: skip to main content, visit all five routes, select each career, and use browser Back/Forward.
- [ ] Open the mobile menu with Enter/Space; cycle Tab/Shift+Tab; close with Escape, the close button and backdrop; confirm focus returns to the opener. Select a route and confirm focus moves to the main content. Resize an open drawer to desktop and confirm scrolling is unlocked.
- [ ] With a screen reader, verify navigation labels/current route, dialog title/description, input labels/hints/error announcement and progress values. The test-only `/e2e/fixtures/ui.html` exercises Input/Dialog under the development server.
- [ ] Check 200% zoom, reduced-motion preferences, Firefox and Safari. These browser/assistive-technology combinations were not executed in this task.

No issue was closed and no changes were merged into `main`. QA remains responsible for independent verification and issue closure.

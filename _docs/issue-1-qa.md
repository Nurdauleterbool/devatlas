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

## Verification

Run from `/workspace/devatlas/frontend` on 2026-10-20 with Node.js 24.19.0, npm 11.9.0 and system Chromium 154.0.8037.57:

| Command/check | Result |
| --- | --- |
| `npm ci --cache /workspace/.npm` | Exit 0; 53 packages installed using the updated lockfile |
| `npm run build` | Exit 0; TypeScript check and Vite production build completed, 1936 modules transformed |
| `npm run lint` | Exit 0; no lint errors or warnings |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | 11 passed; no failed, skipped or disabled tests |
| Development server | Started successfully; exercised through actual Chromium navigation and requests |
| Visual inspection | Reviewed screenshots of the desktop Dashboard (1440px), mobile Career Paths and open drawer (375px); dark design retained |
| `git diff --check` | Exit 0; no whitespace errors |

The browser suite checks Dashboard fixtures and selection; all five direct routes and active links; page-not-found recovery; skip-link and route focus; mobile keyboard navigation at 320px/375px; Tab/Shift+Tab wrapping; Escape/backdrop/close-button dismissal; focus/scroll restoration; desktop resize; loading/empty/error states on Dashboard and Career Paths; missing-default-career fallback; input labels/descriptions/errors/required/disabled state; button form semantics; dialog accessible name/description; and uncaught browser runtime errors.

An initial run exposed missing deterministic Tab wrapping in Chromium's native dialog behavior. Explicit focus wrapping fixed it; the final suite above includes this regression. Browser launch emits a runner warning about `NO_COLOR`/`FORCE_COLOR`; this is separate from application lint/runtime diagnostics.

## Manual QA checklist for review

These are handoff checks, not a claim of independent QA approval:

- [ ] Compare Dashboard, Career Paths and navigation at 320px, 375px, 768px and desktop widths; verify readable content, scrolling, active states and no horizontal overflow.
- [ ] Use only the keyboard: skip to main content, visit all five routes, select each career, and use browser Back/Forward.
- [ ] Open the mobile menu with Enter/Space; cycle Tab/Shift+Tab; close with Escape, the close button and backdrop; confirm focus returns to the opener. Select a route and confirm focus moves to the main content. Resize an open drawer to desktop and confirm scrolling is unlocked.
- [ ] With a screen reader, verify navigation labels/current route, dialog title/description, input labels/hints/error announcement and progress values. The test-only `/e2e/fixtures/ui.html` exercises Input/Dialog under the development server.
- [ ] Check 200% zoom, reduced-motion preferences, Firefox and Safari. These browser/assistive-technology combinations were not executed in this task.

No issue was closed and no changes were merged into `main`. QA remains responsible for independent verification and issue closure.

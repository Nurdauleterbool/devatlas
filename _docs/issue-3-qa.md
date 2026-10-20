# Issue #3 — registration/login QA evidence

Scope: MVP-03, frontend mock authentication. Feature branch: `feat/issue-3-mock-auth`, based on latest fetched `origin/main` `b530aae` (Issue #2 merged through PR #28). No backend, OpenAPI or database changes. No merge or issue closure is performed by this work.

## Executed automated verification

Commands ran from `frontend` with Node 24.19.0, npm 11.9.0 and installed system Chromium 154.0.8037.57. All final commands completed with exit code 0.

| Command | Final result | Executed counts |
| --- | --- | --- |
| `npm run build` | PASS — TypeScript and Vite production build | 1,952 modules transformed; no test count |
| `npm run lint` | PASS — no errors or warnings | Static checks; no test count |
| `npm run test` | PASS | 104 passed, 0 failed, 0 skipped; 5 files |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | PASS | 20 passed, 0 failed, 0 skipped |
| `git diff --check` | PASS | No whitespace errors |

The browser run used the repository-supported executable override, not an unverified downloaded browser. No tests were blocked, disabled or skipped. Runner warnings about `NO_COLOR`/`FORCE_COLOR` did not prevent execution. Chromium coverage does not establish Firefox/Safari coverage.

All 74 Issue #2 unit tests and all 11 earlier Playwright checks remain; 30 auth/validation unit tests and 9 browser checks were added. The only earlier browser fixture adaptation supplies the new `getSession` contract method in its synthetic service. Existing route, empty/error/loading, navigation, keyboard, component and career checks retain their assertions.

## Verified behavior

- Shared validation: missing values, malformed/bounded emails, name/password boundaries, email normalization, exact password whitespace/case handling.
- Service: anonymous/demo/current session, signup/login/logout, generic incorrect credentials, duplicate email, hash matching without credential-bearing public results, account isolation for progress/selections/attempts/analytics, full-instance reset, failed-operation atomicity, in-flight cancellation and competing signup behavior.
- Browser: required/malformed/mismatched form errors and focus, masked passwords, signup → logout → login, incorrect credentials, duplicate email, loading and duplicate-submit guard, seeded demo/reload, mobile keyboard/signup/logout, authentication failure retry and failed logout preserving the active session.
- Browser tests check page errors and reject console output containing their test passwords. No such errors/leaks occurred in the final run. This is scoped to exercised flows, not proof about all browser extensions or developer tooling.
- Desktop login (1440px) and mobile signup (375px) screenshots were inspected for dark design, labels and layout. No horizontal clipping was observed. Automated mobile flows additionally verify navigation and focus.

During development, browser checks found first-error focus following validation-object insertion order and a stale logout announcement overlapping login loading. Both application defects were fixed; the complete final browser suite passes. Early unit test inputs accidentally included signup-only properties in login calls; these were corrected to the strict login contract rather than weakening validation.

## Changed files

- `frontend/src/types/domain.ts`: typed auth inputs and public mock session.
- `frontend/src/services/DevAtlasService.ts`, `index.ts`, `mockService.ts`: auth interface, anonymous application binding, validated session/account operations and request isolation.
- `frontend/src/services/authValidation.ts`, `mockPasswords.ts`: shared validation and private in-memory hashing.
- `frontend/src/auth/AuthProvider.tsx`, `authContext.ts`: adapter-independent session state/actions.
- `frontend/src/pages/AuthPage.tsx`, `components/AccountControls.tsx`: forms, request feedback, preview/session identity and logout.
- `frontend/src/App.tsx`, `main.tsx`, `components/SidebarNavigation.tsx`: provider, auth routes, personalized-view reset and shared desktop/mobile account controls.
- `frontend/src/services/__tests__/auth.test.ts`, `frontend/e2e/auth.spec.ts`, `frontend/e2e/scaffold.spec.ts`: new coverage and compatibility fixture update.
- `README.md`, `frontend/README.md`, `_docs/architecture.md`, `_docs/mock-service.md`, `_docs/mock-auth.md`, this report: current setup, contract, behavior and verified evidence.

## Manual reviewer checklist

These are suggested additional reviewer checks, not claimed completed human tests:

- [ ] Use a screen reader to review labels, field errors, request announcements and focus changes.
- [ ] Try signup/login/logout in Firefox and Safari and with a password manager.
- [ ] Check long names/emails, browser zoom and preferred text scaling on a physical mobile device.
- [ ] Follow signup → Dashboard → Careers → logout → demo; confirm anonymous data is labelled sample and account-specific data does not linger.
- [ ] Reload after signup; confirm the stated mock account/session reset is clear to a new user.

## Limitations and recommendation

Accounts, session and data reset on reload. Demo sign-in is an intentional frontend bypass; this is not production authentication or a security boundary. Web Crypto requires a supported secure context. There is no server, persistence or token/session transport. Existing Skill Graph, Learning and Analytics screens remain placeholders, and Dashboard career selection is still local component state. No dependencies were added.

Recommendation: **READY FOR REVIEW** for Issue #3's mock-frontend scope. Automated verification is complete; human screen-reader, cross-browser and physical-device review remain additional QA. Publication/PR status must be reported separately after the actual Git/GitHub operations; this report does not assert a PR exists or that an issue is closed.

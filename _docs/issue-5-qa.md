# Issue #5 — interactive dependency graph QA

Date: 2026-10-20, Asia/Qyzylorda. Stage: mock frontend. Branch: feat/issue-5-skill-graph, based on fetched main at the verified Issue #4 merge 1591dbd. The actual GitHub issue, dependencies, AGENTS/process and roles were read before implementation.

## Acceptance evidence

- All three careers render the typed service's four skills and directed prerequisite edges (Frontend 3, Backend 2, Analyst 1). Graph browsing does not replace saved career selections.
- React Flow provides zoom, pan and fit controls. Custom node buttons and the visible skill list open the corresponding basic detail dialog, including name, description, assessment, verification and prerequisites.
- Completed, learning, available, locked and quiz-verified states have distinct colors and text. Missing prerequisites are named. Completed or quiz-verified prerequisites unlock eligible skills; verification stays separate from self-assessment. Locks describe learning dependencies, not an authorization restriction on viewing details.
- Native labelled career selection, focusable node buttons, keyboard skill list, modal focus/return and 44px graph controls provide keyboard/mobile access. Automated viewport checks cover 320, 375, 768 and 1280px without horizontal overflow.
- Loading, service failure/retry, empty careers/skills and invalid graph states are handled. The pure model rejects bad references, duplicate edges and cycles and lays out valid DAGs deterministically.

## Executed checks

Node 24.19.0/npm 11.9.0; system Chromium 154.0.8037.57. Commands ran from frontend.

| Command | Actual result |
| --- | --- |
| npm run build | PASS, exit 0; 2,114 modules; graph split into its own 187.22kB JS module, main 330.75kB |
| npm run lint | PASS, exit 0 |
| npm run test | 141 passed, 0 failed/skipped; 7 files; exit 0 |
| PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- e2e/skill-graph.spec.ts | 7 passed; exit 0 |
| PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e | Final cold-cache run: 40 passed, 0 failed/skipped; 40.6s; exit 0 |

Nineteen new unit tests exercise real service-backed fixtures, state/prerequisite cases, deterministic layout, invalid references/cycles and defensive copies. Seven new browser scenarios cover all careers, node detail, missing prerequisites, modal keyboard interaction, zoom/pan/fit, current-user verification, saved-selection preservation, responsive controls and service scenarios. All 33 earlier browser tests remain enabled and pass.

## Review and corrections

Independent review found no blocking correctness/security/accessibility defect. An additional Chromium session activated a graph node and zoom control with the keyboard, verified matching detail and restored focus after Escape, and observed no page errors. Desktop 1440px and mobile 320px screenshots were captured and visually inspected; labels/list/layout fit. The mobile overview scales down the graph; zoom controls and the readable skill list remain available.

An early full regression recorded 39 passes and one shared-form test interrupted by a Vite reload (trace showed reconnection and a detached field). Explicit prebundling of the lazy graph dependency was added, and the entire suite passed from an empty generated dependency cache. No assertion was removed and no retries or timeout increases were used. Visual inspection also caught default 26px library controls; scoped CSS and browser size assertions now enforce 44px. Lazy loading resolved the initial single-bundle size warning.

## Changed files and scope

App.tsx wires the lazy graph route; SkillGraphPage.tsx implements the graph and basic inspection modal; skillGraph.ts supplies the tested pure transformation; index.css scopes control sizing; vite.config.ts prebundles the lazy dependency. package.json/package-lock.json add exact @xyflow/react 12.12.0. New skillGraph.test.ts and skill-graph.spec.ts contain the added checks. README, frontend/README, architecture and development-progress reflect the implemented feature.

Resource/actionable skill detail and progress editing belong to #6; quiz-taking to #7. No backend, persistence or HTTP integration is claimed. Human screen-reader, Safari/Firefox and physical-device checks remain unrun. **Ready for PR review/integration**; issue closure requires a verified merge.

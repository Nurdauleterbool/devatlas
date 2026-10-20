# DevAtlas frontend

React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + React Router + React Flow. This is the frontend/mock stage; no backend or secrets are needed.

## Setup and commands

Use Node.js 24 LTS and npm (validated: 24.19.0 / 11.9.0). From this directory:

```sh
npm ci
npm run dev
```

Vite prints its local address. `npm run dev -- --host 0.0.0.0` binds to all interfaces when needed.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server with hot module replacement |
| `npm run build` | TypeScript project check and production assets in `dist/` |
| `npm run lint` | Oxlint checks, including React hooks |
| `npm run preview` | Serve the existing production build locally |
| `npm run test` | Run Vitest unit tests for fixtures, service methods, authentication and configuration |
| `npm run test:watch` | Watch and rerun unit tests during development |
| `npm run test:e2e` | Chromium browser regression tests; starts Vite on port 4173 |

Before the first browser test run, install Chromium with `npx playwright install chromium`. Alternatively, use an existing compatible browser:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Playwright is a development dependency only. Tests run against Vite with two workers; port 4173 must be free. Failure traces are retained in ignored `test-results/` and can be opened with `npx playwright show-trace <trace.zip>`. `e2e/fixtures/ui.html` is a test-only component fixture and is not included in the production build.

## Structure and routes

- `src/App.tsx`: application layout, mobile drawer and route definitions.
- `src/pages/DashboardPage.tsx`: personalized overview, unique-skill totals, gaps, quiz verification and recommendations.
- `src/careers/`: session-scoped service response cache, selection coordination and retry state shared by Dashboard/Career Paths.
- `src/services/careerDashboard.ts`: adapter-independent dashboard composition and serialized selection writer.
- `src/components/CareerSelection.tsx`, `CareerProgress.tsx`: reusable selection cards, request feedback and labelled progress bars.
- `src/auth/`: contract-backed session provider and typed authentication context.
- `src/pages/AuthPage.tsx`: responsive login/signup, accessible validation and pending/error/success states.
- `src/components/AccountControls.tsx`: anonymous preview, signed-in identity and logout controls shared by both sidebars.
- `src/components/SidebarNavigation.tsx`: the five shared navigation links with `aria-current` supplied by `NavLink`.
- `src/components/ui/`: shared Button, Card, Input and Dialog.
- `src/pages/CareerPathsPage.tsx`: selectable career roadmaps and seeded progress.
- `src/pages/SkillGraphPage.tsx`: React Flow graph, career selector, keyboard skill list and basic skill-detail modal.
- `src/services/skillGraph.ts`: deterministic graph layout/status composition from typed roadmaps, with reference/cycle validation.
- `src/pages/PlaceholderPage.tsx`: Learning, Analytics and missing-page screens.
- `src/types/domain.ts`: shared domain types, with catalogue skills separate from user progress.
- `src/services/DevAtlasService.ts`: replaceable, Promise-returning, session-scoped service interface and typed errors.
- `src/services/index.ts`: composition root binding the application to the current adapter.
- `src/services/mockService.ts`: isolated in-memory adapter with validated progress, selections and quiz mutations.
- `src/services/fixtures/`: deterministic catalogue, users, resources, tasks, quiz data and seeded history/attempts.
- `src/services/careerRoadmaps.ts` and `src/hooks/useCareerRoadmaps.ts`: adapter-independent view composition used by Dashboard and Career Paths.
- `src/services/__tests__/`: Vitest fixtures, contracts, mutation, analytics, recommendation and scenario tests.
- `src/index.css`: Tailwind import, theme tokens, global keyboard focus, modal/drawer styles and reduced-motion support.
- `e2e/`: route, mock-state and UI accessibility regression tests.

Routes: Dashboard `/`, Career Paths `/careers`, Skill Graph `/graph`, Learning `/learning`, Analytics `/analytics`, Login `/login`, Sign Up `/signup`. Skill Graph renders the selected career’s directed prerequisites, completion/learning/available/locked/quiz-verified states, zoom/pan controls and skill details. The graph loads as a separate route module. A native career selector and visible skill-button list provide keyboard alternatives; missing prerequisites are named. Graph browsing does not alter saved career choices. Learning and Analytics remain placeholders. Career selections come from `getSelectedCareers`, and `setSelectedCareers` persists changes across route navigation within this mock instance. Anonymous pages allow roadmap previews but require login to save choices. Signed-in pages read the current user’s progress and reset their cached workspace on account changes; the service also supports in-memory updates and quiz submissions for future screens. A full reload/new service instance resets all mutations. Production hosts must fall back to `index.html` for these browser-history routes.

## Mock data and UI scenarios

Pages import the typed `service` binding from `src/services/index.ts`; they do not read fixtures. A future HTTP adapter can replace that binding while implementing `DevAtlasService`. Shared skills have no status; roadmap views join their definitions/dependencies with `UserSkillProgress`.

Development URLs can use `?mockScenario=empty`, `?mockScenario=error`, or `?mockLatencyMs=1500` to exercise empty, error or visible loading states. These overrides apply on full page load and are ignored in production. Defaults are success and zero added latency. Environment alternatives:

```sh
VITE_MOCK_SCENARIO=error VITE_MOCK_LATENCY_MS=1000 npm run dev
```

Accepted scenarios are `success`, `empty`, and `error`; loading uses finite latency. Empty retains the demo user and clears the catalogue/progress/attempts; unknown writes are rejected. Invalid settings are rejected rather than silently ignored. For programmatic per-method failures and clock/fixture injection, see the [mock service documentation](../_docs/mock-service.md).

## Career selection and Dashboard

Open Dashboard or Career Paths while signed in. **Choose path** replaces the selection with one path; **Include …** checkboxes add/remove additional paths, and **Clear selected paths** clears them. **View roadmap** changes the preview without saving a different career. Roadmap previews use the `path` query parameter, never the saved-selection store. Anonymous **Explore path** links allow public browsing only.

The confirmed selection, progress and metrics are reread through `DevAtlasService` after a write. Pending checkboxes represent request intent, while the Dashboard keeps its last confirmed totals until the latest save and refresh complete. Rapid writes are serialized/coalesced, stale responses are ignored, and failure offers retry. Completed and quiz-verified skills remain separate; overall counts deduplicate skill IDs across selected careers. Gaps mean required skills not self-reported completed, including independently verified skills where appropriate. Recommendations and reasons come from the adapter, with shared recommendations grouped by skill and retaining each path's explanation.

No selection and an empty catalogue have explicit empty states. Loading and retry messages use live feedback; native buttons/checkboxes support keyboard selection. Selection/session/data reset on a full page reload. Progress editing, quiz screens, interactive graphs and detailed analytics remain later issues. See [technical notes](../_docs/career-dashboard.md) and [Issue #4 QA](../_docs/issue-4-qa.md).

## Mock accounts and sessions

The application starts signed out. Open `/login` and choose **Try mock demo account** for seeded sample progress, or use `/signup` to create an isolated test account. No preset password is displayed or needed for the demo action. Logout is available above the five navigation links, including inside the mobile drawer. Existing public routes remain available when signed out.

Forms reuse Button, Card and Input. Required name/email/password fields, email syntax, 8–128 character passwords, and signup password confirmation have associated errors. Email is trimmed/lowercased; passwords retain their exact characters. Invalid submission focuses the first invalid field, and request errors/success are announced. Passwords stay masked, are cleared after authentication requests, and are never logged. Disabled fieldsets/buttons and an immediate submission guard prevent duplicate requests. Web Crypto hashes signup passwords into memory; accounts and sessions reset on reload. Use a disposable test password.

`AuthProvider` consumes only `DevAtlasService`: `getSession`, `signUp`, `logIn`, `logInDemo` and `logOut`. The composition root opts into an anonymous initial session. The factory retains its default demo session for existing non-UI consumers and tests. Personal writes/history/attempts/analytics require a session; public progress is a read-only sample when anonymous. The mock is not an authorization boundary or production authentication. No tokens or credentials are persisted. See [authentication contract and limitations](../_docs/mock-auth.md).

## Design and accessibility conventions

Use Tailwind and the existing tokens: `bg-canvas` (`#0b1020`), `bg-sidebar` (`#11182b`), `bg-surface` (`#161e34`). Indigo accents, slate text, rounded panels and responsive spacing define the current design. Primary actions use indigo-600/700 with white text. Global `:focus-visible` adds a high-contrast outline; do not remove it from interactive controls. Motion is reduced when the user requests it.

Reuse the components rather than copying their classes:

- **Button** defaults to `type="button"`, supports `primary` and `ghost`, native button props/ref, disabled state and a minimum 44px height. Set `type="submit"` explicitly for form submission. Icon-only actions need an accessible label; decorative icons use `aria-hidden="true"`.
- **Card** is a non-interactive `<article>` with native article props/ref and optional `highlighted` state. Add a meaningful heading. Put actions inside it rather than making the article clickable.
- **Input** requires a visible `label`, generates a stable input ID unless one is supplied, and associates `hint` and `error` text through `aria-describedby`. Existing description IDs are retained; an error sets `aria-invalid` and is announced. Native `required`, `disabled`, `type`, `name`, `ref` and other input props are supported. Placeholders do not replace labels.
- **Dialog** is controlled by `open`/`onClose`, requires a title, and accepts an optional description. It uses native `showModal()` for an inert background, with explicit Tab/Shift+Tab wrapping. Escape, the labelled close button and backdrop clicks request closure. Closing restores focus to the opener and unlocks scrolling. Use `variant="drawer"` for the mobile sidebar. Set `open` to false in `onClose`; custom actions should use the same state update.

Example:

```tsx
import { useState } from 'react'
import Button from './components/ui/Button'
import Card from './components/ui/Card'
import Dialog from './components/ui/Dialog'
import Input from './components/ui/Input'

export default function GoalExample() {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <h2>Learning goal</h2>
      <Button onClick={() => setOpen(true)}>Edit goal</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Learning goal">
        <Input label="Skill" name="skill" hint="Choose a skill to practice." />
        <Button onClick={() => setOpen(false)}>Done</Button>
      </Dialog>
    </Card>
  )
}
```

Use links for navigation and buttons for actions. On mobile (below 768px), the drawer traps Tab/Shift+Tab, closes after route selection, and closes when resized to desktop. Route changes move focus to the main content. A skip link is the first keyboard stop. Keep text labels alongside progress/status colors and preserve loading, empty and error states.

## QA

Run build, lint, unit and browser tests before review. Vitest uses Node and includes only `src/**/*.test.ts`, so Playwright specs are not collected as unit tests. Browser coverage is Chromium only and does not replace manual screen-reader or visual review. The [Issue #4 QA report](../_docs/issue-4-qa.md) records current verification; [Issue #3 QA](../_docs/issue-3-qa.md) retains the auth baseline; [Issue #2 QA](../_docs/issue-2-qa.md) records the earlier service baseline; the [Issue #1 QA report](../_docs/issue-1-qa.md) retains earlier scaffold evidence.

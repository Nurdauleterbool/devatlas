# DevAtlas frontend

React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + React Router. This is the frontend/mock stage; no backend or secrets are needed.

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
| `npm run test:e2e` | Chromium browser regression tests; starts Vite on port 4173 |

Before the first browser test run, install Chromium with `npx playwright install chromium`. Alternatively, use an existing compatible browser:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Playwright is a development dependency only. Tests run against Vite with two workers; port 4173 must be free. Failure traces are retained in ignored `test-results/` and can be opened with `npx playwright show-trace <trace.zip>`. `e2e/fixtures/ui.html` is a test-only component fixture and is not included in the production build.

## Structure and routes

- `src/App.tsx`: application layout, mobile drawer, Dashboard and route definitions.
- `src/components/SidebarNavigation.tsx`: the five shared navigation links with `aria-current` supplied by `NavLink`.
- `src/components/ui/`: shared Button, Card, Input and Dialog.
- `src/pages/CareerPathsPage.tsx`: selectable career roadmaps and seeded progress.
- `src/pages/PlaceholderPage.tsx`: Skill Graph, Learning, Analytics and missing-page screens.
- `src/services/mockService.ts`: typed asynchronous career fixtures; each call returns a clone.
- `src/index.css`: Tailwind import, theme tokens, global keyboard focus, modal/drawer styles and reduced-motion support.
- `e2e/`: route, mock-state and UI accessibility regression tests.

Routes: Dashboard `/`, Career Paths `/careers`, Skill Graph `/graph`, Learning `/learning`, Analytics `/analytics`. The last three remain placeholders. Dashboard selection is local component state and resets when the page is remounted. Roadmap progress comes from fixture statuses and cannot be edited or persisted yet. Production hosts must fall back to `index.html` for these browser-history routes.

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

Run build, lint and browser tests before review. Browser coverage is Chromium only and does not replace manual screen-reader or visual review. The [Issue #1 QA report](../_docs/issue-1-qa.md) records exact results and the remaining manual checklist.

# DevAtlas — Agent Instructions

Read `_docs/plan.md` and `process.md` before doing any work. Work only from a GitHub issue with explicit acceptance criteria. Do not implement post-MVP scope without approval.

## Tech constraints
React + TypeScript + Vite + Tailwind + React Flow; FastAPI + SQLAlchemy + SQLite; OpenAPI contract; Vitest, Pytest, Playwright. Use ORM queries, never direct ad hoc SQLite SQL in application services.

## Workflow
Follow `process.md`. Use frontend mockService first, then `_docs/openapi.yml`, then in-memory backend, then SQLite, then integration. Update relevant Markdown files as decisions change. No fabricated test results or GitHub issue states.

## Quality and safety
Validate requests and ownership, hash passwords, use environment variables for secrets, prevent leaking quiz answer keys before submission, handle loading/error/empty states, and add tests. Prefer minimal, accessible, responsive UI.

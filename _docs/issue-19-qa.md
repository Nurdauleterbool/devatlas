# MVP-19 — React ↔ FastAPI integration

## Scope
- Frontend `DevAtlasService` now has a typed fetch implementation (frontend/src/services/httpService.ts).
- Runtime selects live HTTP by default. Mock remains available with `VITE_SERVICE_MODE=mock` and in Playwright's isolated mock webServer.
- Requests use same-origin `/api/v1`, `credentials: include`, no-store and JSON bodies. Vite proxies requests to localhost:8000.
- Login/signup/session/logout and all catalogue, progress, quiz, history, analytics and recommendation methods map to frozen `_docs/api-contract.md`.
- The missing backend `GET/PUT /api/v1/me/careers` route was added, including ownership, strict validation and repeatable selections.
- UI removes the live-mode demo login, displays actual account messages and preserves loading/error handling.

## QA
- HTTP service unit tests cover endpoint mapping, credential forwarding, no client-owned fields, optional response semantics, error handling, auth lifecycle and quiz-attempt no-retry.
- Python tests cover career selections in memory and SQLite, restart persistence, failed writes, foreign origins, owner isolation.
- GitHub Actions: frontend build, unit tests and lint; backend all pytest. Verify **both** runs before merging.
- Manual browser E2E with running FastAPI and Vite remains necessary for full end-user signoff; isolated Playwright mock suite still explicitly runs with VITE_SERVICE_MODE=mock.

## Local live run
Terminal A:
```sh
cd backend
pip install -e '.[test]'
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Terminal B:
```sh
cd frontend
npm ci
npm run dev
```
Visit http://localhost:5173; register a new account, select frontend, mark HTML complete, submit its quiz, visit Analytics, refresh the browser, and verify saved state. Local SQLite database lives in backend/devatlas.db by default.

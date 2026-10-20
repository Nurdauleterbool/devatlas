# DevAtlas — Implemented architecture (MVP, October 2026)

## End-to-end design

```text
React / TypeScript / Vite / Tailwind / React Flow (http://localhost:5173)
  ├── AuthProvider + session-scoped career workspace
  ├── DevAtlasService interface
  │     ├── httpService (default, credentialed /api/v1 requests)
  │     └── mockService (isolated demonstrations/unit/E2E)
  └── Vite /api proxy → FastAPI (http://127.0.0.1:8000)
                         ├── Auth / catalogue / career selections
                         ├── Progress and chronological events / quizzes
                         ├── Recommendations / analytics
                         ├── repository protocols and dependency injection
                         └── SQLAlchemy adapters
                               └── SQLite + Alembic initial migration
```

The boundary is documented by the OpenAPI 3.1 specification [_docs/openapi.yml](openapi.yml) and the method-by-method mapping in [api-contract.md](api-contract.md). The HTTP client maps transport/error envelopes to the same `DevAtlasService` domain shapes as the original mock, without exposing SQL schemas to UI components.

### Frontend

- `frontend/src/types/domain.ts`: user, career, skill, progress, quiz and analytics types.
- `frontend/src/services/DevAtlasService.ts`: typed asynchronous adapter contract; `services/index.ts` selects HTTP unless `VITE_SERVICE_MODE=mock`.
- `frontend/src/services/httpService.ts`: versioned `/api/v1` calls with `credentials: include`, JSON validation, no implicit repeat of a potentially recorded quiz submission; `mockService.ts` remains test-only and offers deterministic fixtures.
- `AuthProvider`, career workspace and adapter-independent view compositions: refresh progress across routes while keeping per-account UI state separate; late responses from an earlier account are rejected.
- `/careers`, `/graph`, `/learning`, `/skills/:skillId`, `/skills/:skillId/quiz`, `/analytics`, `/login` and `/signup` are React Router screens. Graph uses React Flow for nodes/edges, status labels, prerequisite checks and keyboard-accessible details.

### Backend

- `backend/app/main.py`: FastAPI composition root, application services/routers, CORS, standardized error responses, OpenAPI UI, response no-store rules. The imported `app` uses SQLite; `create_app()` defaults to in-memory for isolated tests, or accepts an injected repository factory.
- `backend/app/auth.py`: normalized email/password signup and login, salted PBKDF2-HMAC password hashes, 8-hour sessions in HttpOnly SameSite=Lax cookies (Secure in production), digest-only stored tokens and authenticated owner dependency. Requests with disallowed Origin or cross-site Fetch Metadata are rejected.
- `backend/app/catalogue.py`, `catalogue_seed.py`: shared reference read APIs, three career paths, ten skills, directed prerequisites, resources and practical tasks; startup validates DAGs and seeds only empty collections.
- `backend/app/career_selections.py`: authenticated career ID selection (server-owned `userId` and timestamps).
- `backend/app/progress.py`: personal self-assessment and dated change history; anonymous GET progress returns a synthetic neutral preview, never another account's data.
- `backend/app/quizzes.py`, `quiz_data.json`: server-only answer keys, five questions per skill, 80% pass, all attempts and retakes retained. `verified` and `bestQuizScore` are **derived**, not client-editable.
- `backend/app/analytics.py`: unique-skill progress, quiz and career statistics; deterministic prerequisite-eligible recommendations with explanation. A skill is considered unlocked after prerequisites are completed **or** quiz-verified.
- `backend/app/repositories.py`: replaceable repository protocols and in-memory implementation.
- `backend/app/sql_repositories.py`, `db.py`, `models.py`: SQLAlchemy adapters, SQLite engine/foreign-key enforcement and ORM entities. Alembic schema migration is in `backend/alembic/versions/0001_initial_mvp.py`.

### Relational model

There are 16 ORM tables: `users`, `sessions`, `career_paths`, `skills`, `path_skills`, `skill_dependencies`, `learning_resources`, `practice_tasks`, `user_careers`, `user_skill_progress`, `progress_events`, `quizzes`, `quiz_questions`, `answer_options`, `quiz_attempts`, `quiz_responses`. Shared career and quiz records are separated from user-owned statuses and attempts; foreign keys constrain references and a uniqueness constraint prevents duplicate user/skill progress records.

## Data ownership and API security

Authenticated mutations use the currently signed-in cookie, never a request-supplied owner ID. All personal reads (selections, history, attempts, analytics) are owner-scoped. Public catalogue and quiz questions omit private answer keys; grading feedback is returned only after submission. CORS allows only the configured browser origin; credentialed requests use same-origin Vite proxy in local development. Hashes, raw session tokens and secret keys are not exposed in API JSON.

Current SQLite storage with process-local locks is for a local MVP and not a distributed concurrency or production deployment architecture. There is no email verification, login throttling service, OAuth, AI assistant or multiworker synchronization.

## Testing layers and stage history

- **Vitest:** frontend data/view and HTTP/mock service unit regression.
- **Pytest:** HTTP routes, auth, owners, quiz scoring, SQLite ORM constraints, Alembic upgrade/downgrade, repeatable seed and restart persistence.
- **Playwright mock:** 66 existing simulated-user browser scenarios.
- **Playwright live:** end-to-end registration, selection, graph, 80% quiz, analytics, refresh, second account; responsive, semantic/navigation and signup-error smoke coverage.
- **GitHub Actions:** `frontend-ci.yml`, `backend-tests.yml`, `browser-e2e.yml` and submission setup smoke workflow. See recent workflow logs for exact run counts and failures.

Development stages were carried out as mock UI (#1–#8), API contract (#9), FastAPI in-memory (#10–#15), SQLite schema/storage/isolation (#16–#18), live frontend integration (#19), E2E (#20), automation plus manual UAT checklist (#21), and submission readiness (#22).

**Remaining gate:** Issue #21 is still open until human desktop/mobile sessions and bug triage are completed. Issue #22 depends on that signoff. Browser automation is useful verification but does not establish manual acceptance.

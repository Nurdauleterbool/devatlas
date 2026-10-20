# Issue #13 — Progress and history API QA

Implements OpenAPI operations `getProgress`, `updateProgress`, `getProgressHistory` in a per-application, replaceable in-memory service.

- Anonymous `GET /api/v1/progress` returns ten synthetic `preview` rows with stable reference timestamp, no real account data.
- Authenticated progress provides one row per unique skill and uses the signed-in owner from the cookie.
- `PUT /api/v1/me/progress/{skillId}` accepts only `status` (three allowed values), records actual status changes with server timestamps, and leaves unchanged statuses idempotent. Unknown skills return 404; invalid fields and statuses return 422.
- `GET /api/v1/me/progress/history` returns signed-in owner's stable chronological history, excluding all other accounts.
- Progress verification and best quiz score derive from existing retained quiz-attempt records when available; they are never client-writable.
- Personal reads and mutations return no-store responses; unsafe cross-origin mutations are rejected.

## Verification
`backend/tests/test_progress.py` adds ten integration cases covering transitions, replay/idempotency, per-user isolation, anonymous preview, 401/403/404/422, stable timestamps, quiz-derived verification and generated OpenAPI operation IDs. GitHub Actions `Backend tests` executes the complete backend suite on Python 3.12 for this PR. Merge only if that run is successful, and read its actual results/logs.

## Limitations
In-memory storage and locking operate within one application process and are not safe for multiple workers. Transactions, durable histories and concurrency across workers require SQLAlchemy/SQLite Issues #16–#18. Current endpoints do not implement quiz submission (#14) or full dashboard analytics (#15). No real frontend HTTP integration (#19).

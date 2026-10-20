# Issue #18 — Persistent multi-user QA

Adds `backend/tests/test_sqlite_user_isolation.py`: SQLite-only integration tests using pytest temporary database files (never the default developer database).

Coverage: two accounts with different progress and quizzes, recommendations and analytics scoped to the signed-in cookie; app restart retains distinct sessions, progress history, verification and attempts; logout invalidates token and account switching does not leak history; two parallel authenticated workflows with independent clients; SQLite foreign-key violation rolls back the entire transaction; invalid quiz submissions never append partial attempts, including across a restart.

## QA approval gate

Review the GitHub Actions Python 3.12 `Backend tests` full suite and actual summary before merge. Reproduce two-account workflows against the temporary SQLite database; confirm all results satisfy the original Issue acceptance criteria. The database remains local per test and is never committed.

This issue adds verification, not production concurrency guarantees or a deployment; integration with browser UI is handled later.
# Issue #15 — Explainable recommendations and owned analytics

Implements two OpenAPI endpoints: `GET /api/v1/me/analytics` (authenticated, no-store) and `GET /api/v1/career-paths/{careerId}/recommendations` (authenticated or neutral synthetic anonymous preview).

## Algorithm

Recommendations use the existing catalogue's authored skill ordering and direct prerequisite edges. Completed or independently quiz-verified skills are excluded. Skills with any unfinished/unverified direct prerequisite are locked and excluded. Eligible `learning` skills take precedence over eligible `not_started` skills; ties follow path order. Each result has a stable sequential rank, ordered prerequisite IDs and a human-readable reason. Unknown career ID returns 404 NOT_FOUND. Public preview cannot read any real account.

Analytics combines the existing cookie-owned progress and history services with retained quiz attempts. Skills are deduplicated by ID globally and within each career, but shared skills appear in every applicable career summary. Quiz statistics count all attempts including later failures; empty-score fields stay null. Completion and independent quiz verification are separate. Percentages use nonnegative half-up rounding.

## Regression coverage

`backend/tests/test_analytics.py` covers neutral anonymous preview, chained and branched prerequisites, verified vs completed unlocking, deterministic ordering and empty completed paths, shared skills in two careers, original progress/attempt consistency, zero-attempt stats, user isolation, 401/404 error cases and OpenAPI operation IDs. The complete backend suite is run by GitHub Actions Python 3.12 for this PR. Read the **actual** workflow result before merging.

### Limits
This is still a single-process in-memory app. Durable transactions and SQLite storage are future Issues #16–#18. Frontend HTTP integration is #19. Do not claim browser E2E or deployment verification at this stage.

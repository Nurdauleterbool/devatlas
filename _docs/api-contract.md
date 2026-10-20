# DevAtlas HTTP contract

Issue #9 freezes the boundary after the verified mock frontend (#1–#8) and before backend implementation. The normative machine-readable contract is [openapi.yml](openapi.yml), OpenAPI 3.1. The service prefix is `/api/v1`. JSON uses the existing camelCase domain fields and UTC ISO 8601 timestamps. IDs are opaque strings; clients must URL-encode path/query values.

## Service mapping

Every asynchronous method in `frontend/src/services/DevAtlasService.ts` has one mapping below. The document records the same mapping in each operation's `x-service-methods`. The validator checks completeness and duplicates against the actual interface.

| Service method | HTTP operation | Adapter behavior |
| --- | --- | --- |
| getSession | GET /auth/session | Session or null; expired/revoked/missing cookie yields null |
| signUp | POST /auth/signup | 201 session and new cookie |
| logIn | POST /auth/login | 200 session and rotated cookie |
| logInDemo | Mock only | No production endpoint; live UI hides demo action and adapter rejects accidental use |
| logOut | POST /auth/logout | Idempotent 204, revokes current session and clears cookie |
| getCurrentUser | GET /auth/me | Current account; unauthenticated is 401 |
| getCareerPaths | GET /career-paths | Shared catalogue |
| getCareerPath | GET /career-paths/{careerId} | 404 maps to undefined |
| getSkills | GET /skills | Shared catalogue |
| getSkill | GET /skills/{skillId} | 404 maps to undefined |
| getDependencies | GET /dependencies | Directed skill/prerequisite pairs |
| getLearningResources | GET /skills/{skillId}/resources | Unknown skill 404; known skill may return [] |
| getPracticeTasks | GET /skills/{skillId}/practice-tasks | Unknown skill 404; known skill may return [] |
| getSelectedCareers | GET /me/careers | Current user's saved selections |
| setSelectedCareers | PUT /me/careers | `{careerIds}` atomically replaces the set; [] clears it |
| getProgress | GET /progress | Current user's progress, or synthetic public preview |
| updateProgress | PUT /me/progress/{skillId} | `{status}` only; skill ID comes from path |
| getProgressHistory | GET /me/progress/history | Current user's chronological events |
| getQuizForSkill | GET /skills/{skillId}/quiz | Public questions; known skill without quiz returns 204 → undefined; unknown skill 404 remains an error |
| submitQuizAttempt | POST /quizzes/{quizId}/attempts | `{responses}` only; 201 result includes grading feedback |
| getQuizAttempts | GET /me/quiz-attempts | Optional quizId filter; unknown quiz 404 |
| getAnalytics | GET /me/analytics | Global unique-skill and quiz statistics, career summaries, owned history |
| getRecommendations | GET /career-paths/{careerId}/recommendations | Deterministic, prerequisite-eligible next steps with reasons |

Dashboard uses the same endpoints: catalogue/dependencies/progress, saved careers, analytics and recommendations. Its selected-path total is the union of skill IDs in saved paths; analytics is global across all catalogue skills. The frontend composes those views, so there is no extra dashboard mutation or duplicate aggregation endpoint.

## Authentication and ownership

An opaque random session ID is carried only by the `devatlas_session` cookie, with HttpOnly, SameSite=Lax, Path=/api/v1 and Secure in production. The server stores a digest rather than the raw session token, expires sessions after eight hours, revokes logout sessions and rotates tokens on successful authentication. Passwords are hashed using a password-specific algorithm in the auth implementation; passwords/hashes/tokens never appear in user or session JSON. The session response has `kind: http`; issue #19 will extend the current frontend's mock-only discriminant without changing the other fields.

Credentialed CORS accepts explicitly configured frontend origins, never `*`. Every unsafe browser request (including signup, login and logout) checks an Origin header when present and rejects an unapproved origin. Cross-site Fetch Metadata requests are rejected. Requests without Origin remain available to non-browser clients. Development uses the configured loopback frontend origin and non-Secure cookies; production serves frontend/API on the same site and enables Secure over HTTPS. Rejected origin requests return 403 FORBIDDEN.

Public catalogue, materials and public quiz questions need no account. Anonymous progress is a synthetic read-only catalogue projection: owner `preview`, all statuses not_started, verified false, bestQuizScore null, and a stable documented reference timestamp. It never reads a real demo user's records. Anonymous recommendations use that same projection. A missing/expired/invalid cookie on these public reads behaves anonymously; personal reads return 401. No public endpoint exposes personal histories, selections or attempts.

All selections, progress events, quiz attempts, analytics and mutations derive the owner from the authenticated session. Requests never accept userId, score, verified, bestQuizScore, timestamps or answer keys. Unknown request fields are rejected. Another user's identifier cannot be used as an ownership selector.

## Mutation and calculation rules

Email is trimmed and lowercased; display names are trimmed. Password characters are preserved exactly. Signup passwords have 8–128 characters; login accepts 1–128 characters so a short incorrect password receives the same invalid-credentials response. Duplicate normalized email is 409. Failed login uses one generic message for unknown account and wrong password.

Career selection IDs must be unique and exist. Invalid replacement changes nothing. Retained selections keep selectedAt; new selections receive server timestamps. Every skill has one derived progress row for the current user, including untouched skills (not_started and the user's createdAt). All three status values can transition to each other. A changed status appends one event atomically; an identical write adds none. Resetting completion never removes independent quiz verification.

Public quizzes contain 5–10 questions with exactly four choices each and an 80% threshold. Correct choices and explanations are excluded from all public quiz schemas. Submission requires exactly one response per question, valid question/option membership and no duplicates; all validation precedes storage. Score is `floor(correctCount / totalQuestions * 100 + 0.5)`, matching JavaScript Math.round for nonnegative values. Passing uses the unrounded ratio >= 0.8. Submission returns one immutable attempt and question feedback. Retakes retain all attempts; best score is the maximum, and verification means any retained passing attempt. No professional certification is implied.

Histories/attempts are chronological, with stable insertion order for equal timestamps. Current progress updatedAt is the latest status-change or quiz-attempt timestamp, or user creation for untouched skills. Analytics counts unique catalogue skills, retains all quiz attempts and uses null for best/average without attempts; a genuine zero score remains 0. Percentages and averages use the same rounding rule. Per-career counts deduplicate skills within each path. Recommendations exclude completed/verified skills and unmet prerequisites; completed OR verified satisfies a prerequisite. Continue-learning precedes start-next, with deterministic catalogue-order ties and a human-readable reason.

## Errors and retries

Personal, session/auth and error responses use Cache-Control: no-store. All JSON errors use `{error: {code, message}}`. Status/code pairs are 422 VALIDATION, 404 NOT_FOUND, 401 UNAUTHENTICATED, login-only 401 INVALID_CREDENTIALS, signup-only 409 EMAIL_IN_USE, 403 FORBIDDEN and 503 UNAVAILABLE. Error examples and descriptions appear in OpenAPI. Backend handlers normalize framework validation failures to this envelope and never return stack traces, secrets or SQL.

The HTTP adapter will map network/server failures to UNAVAILABLE and protect in-flight results when the account changes (local SESSION_CHANGED). SESSION_CHANGED is a client lifecycle error, not a server error code. Issue #19 also adds the documented FORBIDDEN code to the current frontend error union, which does not yet contain it. Optional lookups map only their documented absence responses to undefined. Never automatically replay a quiz submission after an ambiguous network failure: an attempt may already be stored. A result followed by failed refresh uses a read-only refresh retry, preserving the existing frontend behavior.

## Validation

Use Python 3.12 and an isolated environment from the repository root:

```sh
python3 -m venv /workspace/.venvs/devatlas-contract
/workspace/.venvs/devatlas-contract/bin/python -m pip install -r _docs/requirements-contract.txt
/workspace/.venvs/devatlas-contract/bin/python scripts/validate_openapi.py
```

The validator checks OpenAPI schema validity, local references and typed examples, all service mappings, unique operation IDs, private-route security and absence of public grading fields. Backend implementation and executable server contract tests follow in #10–#18; frontend HTTP integration follows in #19. This issue does not claim those implementations exist.

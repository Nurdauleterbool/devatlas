# Issue #14 — Server graded quizzes and retained attempts

## Implementation

- Backend seeded from the existing frontend-authored quiz data: 10 quizzes, 50 unique questions, four options per question, 80% required. `backend/app/quiz_data.json` holds authoring questions and private answer key, read only by backend service; its keys are never exposed through the public quiz route.
- GET `/api/v1/skills/{skillId}/quiz` returns public question metadata only. Unknown skills 404, known skill without quiz 204.
- POST `/api/v1/quizzes/{quizId}/attempts` validates one valid answer per question, rejects extra/untrusted score and owner fields, computes score and pass on the server, and inserts exactly one complete attempt. Validation is atomic in a single-process in-memory lock.
- GET `/api/v1/me/quiz-attempts?quizId=...` returns the cookie owner's chronologically ordered attempts; all retakes retained. Progress `verified` and `bestQuizScore` derive from these records.
- Stored attempts are separate from per-user self-assessed status. Changing progress does not erase past passing attempts.

## QA

Added `backend/tests/test_quizzes.py` with 10 integration tests exercising 60%, 80%, 100%, later failure, unlimited attempts, no pre-submit grading key, invalid submission atomicity, 401/403/404/422, ownership isolation, seed integrity and API operation IDs.

Run the `Backend tests` GitHub Actions workflow, introduced in Issue #12, on this PR (Python 3.12). **Do not merge until the workflow is green.** Actual result and counts should be taken from the GitHub workflow logs.

No backend SQLite storage or distributed locking exists at this stage. Client-to-HTTP integration (#19) and full persistence (#16–#18) remain separate work. Practice quiz passing is not a professional certification.

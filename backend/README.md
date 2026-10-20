# DevAtlas FastAPI backend

Python 3.12+; install and run from `backend/`:

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e '.[test]'
uvicorn app.main:app --reload
python -m pytest -q
```

All URLs use `/api/v1`.

- `GET /health` — readiness
- `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/session`, `/auth/me` — session and account access
- `GET /career-paths`, `GET /skills`, `GET /dependencies`, skill resources and practice — public catalogue
- `GET /progress` — signed-in progress or synthetic anonymous preview
- `PUT /me/progress/{skillId}` with `{"status":"learning"}` — authenticated owner-only mutation
- `GET /me/progress/history` — chronological signed-in history
- `GET /skills/{skillId}/quiz` — public multiple-choice quiz without answer keys
- `POST /quizzes/{quizId}/attempts` with `{"responses":[{"questionId":"html-q1","optionId":"html-q1-o2"}, ...]}` — authenticated grading and retained attempt; no client score or user ID
- `GET /me/quiz-attempts` (optional `quizId`) — signed-in owner's attempts only

Quizzes are seeded from `app/quiz_data.json` and graded on the server. Correct IDs and explanations are returned only **after** successful submission. Five questions per skill; 80% passes (4/5). Unlimited retakes preserve best score and independent verification. See `_docs/api-contract.md` and `_docs/issue-14-qa.md`.

`DEVATLAS_FRONTEND_ORIGIN` controls accepted CORS/browser mutation origin; `DEVATLAS_ENVIRONMENT=production` enables Secure cookies. Auth, progress and quiz attempts are in-memory until SQLite Issues #16–#18. Frontend switches from mock to HTTP in #19. Avoid multiworker or public production deployment at this stage.

# DevAtlas FastAPI backend

In-memory API, Python 3.12+.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e '.[test]'
uvicorn app.main:app --reload
python -m pytest -q
```

Versioned API prefix: `/api/v1`.

- Health: `GET /health`
- Authentication: `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/session`, `/auth/me`
- Public catalogue: `/career-paths`, `/skills`, `/dependencies`, skill resources and practice tasks
- Public/signed-in progress: `GET /progress`. Anonymous response contains synthetic `preview` rows with `not_started` state, not another user's data.
- Signed-in status update: `PUT /me/progress/{skillId}` with `{"status":"learning"}`, allowed statuses: `not_started`, `learning`, `completed`.
- Signed-in history: `GET /me/progress/history`.

Progress mutations require a valid session cookie; ownership is derived server-side. Changes append an immutable event; repeated identical statuses do not. Quiz verification and best scores are independently derived from stored attempts (quiz endpoints arrive in #14). Both history and progress are kept in memory and reset when the application restarts.

Configuration: `DEVATLAS_FRONTEND_ORIGIN`, `DEVATLAS_ENVIRONMENT`. Cookies are HttpOnly, SameSite=Lax, and Secure in production. Current in-memory repositories are single-process only; SQL transactions and persistence are deferred to #16–#18. Frontend continues using mockService until #19.

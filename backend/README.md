# DevAtlas Backend

Python 3.12+; in-memory FastAPI API for the MVP backend stage.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e '.[test]'
uvicorn app.main:app --reload
python -m pytest -q
```

GET `/api/v1/health` → `{"status":"ok"}`. The authentication endpoints follow the contract in `_docs/openapi.yml`:

- POST `/api/v1/auth/signup` — public session and HttpOnly cookie
- POST `/api/v1/auth/login` — rotates session cookie
- POST `/api/v1/auth/logout` — revokes and clears cookie (204)
- GET `/api/v1/auth/session` — session or JSON null
- GET `/api/v1/auth/me` — authenticated user only (401 otherwise)

Passwords are stored as salted PBKDF2-HMAC-SHA256 digests. Opaque session tokens are stored by SHA-256 digest (no raw tokens in repositories), expire after 8 hours and never appear in JSON responses. Requests that mutate state reject disallowed Origin or cross-site Fetch Metadata. Cookies set `Secure` in production; use HTTPS and same-site deployment. Configure `DEVATLAS_FRONTEND_ORIGIN`, `DEVATLAS_ENVIRONMENT` via environment or `.env`.

Repositories and cookies reset on server restart. Not production-ready authentication: no persistent storage, distributed session store, email verification or rate limiting. Business endpoints and per-resource ownership implementation are assigned to Issues #12–#15. SQLite/SQLAlchemy in #16–#18.

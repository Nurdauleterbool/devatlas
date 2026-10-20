# Issue #11 — Backend auth and ownership QA

Issue: https://github.com/Nurdauleterbool/devatlas/issues/11

Scope: server-side hashed-password signup, login, logout and current-user/session; duplicate normalized emails, generic invalid credentials, eight-hour expiry, session revocation/rotation, per-user session isolation, reusable authenticated-owner guard, strict validation, error envelope, CORS Origin/Fetch Metadata checks.

## Local verification

Executed from `backend/` with Python 3.13 and installed FastAPI 0.128.2, pytest 9.0.2:

```sh
PYTHONPATH=. pytest -q
```

**20 passed, 0 failed** across the existing eight Issue #10 scaffold tests and twelve new Issue #11 tests. Initially two auth tests exposed malformed error envelopes; exception handler was corrected and the complete suite rerun successfully. No GitHub Actions CI is configured; remote automated checks must not be inferred from this local result.

## Security and architecture

The HTTP API follows `_docs/openapi.yml`: `/api/v1/auth/{signup,login,logout,session,me}`, `kind=http` session, public-only user payload, secure production cookie, HttpOnly/SameSite=Lax and eight-hour expiry, no-store responses, typed 401/403/409/422 errors. Untrusted Origin and cross-site browser mutation requests are forbidden; no client-selected account ID is accepted. The dependency `require_user` derives the owner from a valid opaque cookie; `enforce_owner` denies attempts to access another ID. Real personal business endpoints will be added and tested under Issues #12–#15.

The in-memory repositories remain replaceable. Credentials and un-hashed tokens are never stored in repository records. A lock serializes email uniqueness and session changes in this process; database-backed unique constraints/transactions will be required when SQLite is implemented.

## Limitations and review checklist

- [ ] Fresh Python 3.12 install with declared pyproject dependencies.
- [ ] Verify OpenAPI auth route payload parity and cookie attributes using a real development browser.
- [ ] Review concurrent signup under a deployed multi-worker model. Current in-memory model is single-process.
- [ ] Verify frontend to HTTP integration separately in Issue #19.
- [ ] Consider login rate limiting, distributed sessions, persistent unique email constraint, key/password rotation and CSRF deployment review before production.

State is intentionally not persisted. This Issue does not implement future progress, quiz or catalogue endpoints, and cannot prove their authorization until they exist. Complete review before merging and closing the Issue.

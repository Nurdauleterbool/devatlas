# DevAtlas FastAPI backend — Issue #10

This is an in-memory scaffold: the FastAPI app factory, versioned health route, configuration and replaceable repository protocols. Authentication, catalogue and progress are assigned to Issues #11–#15; SQLite is assigned to Issues #16–#18.

Requires Python 3.12+.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e '.[test]'
uvicorn app.main:app --reload
```

GET http://127.0.0.1:8000/api/v1/health responds with `{"status":"ok"}`.
Swagger UI: http://127.0.0.1:8000/docs.

```bash
python -m pytest -q
```

Optional settings use the `DEVATLAS_` prefix. Copy `.env.example` to `.env` for local customizations. No SQLite setup is required for this stage.

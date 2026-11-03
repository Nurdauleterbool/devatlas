# Deploy DevAtlas to Render with PostgreSQL

Use the existing **Docker** Web Service (`devatlas`) connected to
`Nurdauleterbool/devatlas`, branch `main`. The Dockerfile contains both
the built React frontend and the FastAPI backend, served from one origin.

## Render PostgreSQL (same region as the web service)

Create a separate Render Postgres database on Free compute if eligible. This
database exists independently of the Docker Compose development stack. Keep
the Internal Database URL private; it includes a database password.

In Web Service > Environment, configure:

| Key | Value |
| --- | --- |
| `DEVATLAS_ENVIRONMENT` | `production` |
| `DEVATLAS_STORAGE_BACKEND` | `postgres` |
| `DEVATLAS_FRONTEND_ORIGIN` | Your full Render HTTPS origin (e.g. https://devatlas-z0e0.onrender.com) |
| `DEVATLAS_DATABASE_URL` | The Postgres **Internal Database URL**, pasted only in Render |

Do not commit database credentials. Do not post connection strings in Issues,
chat screenshots, logs or the public README.

Web Service settings: Docker, root directory empty, `./Dockerfile`,
`main`, and **Health Check Path `/api/v1/health`**. This matters:
the Render startup wrapper opens the port immediately, but returns HTTP 503
until database migration and reference seeding have finished. A configured
HTTP health check makes Render report Live only once the DB-backed API is ready.

The first boot logs several distinct stages:
1. `Database startup started`
2. `Alembic migrations starting` / `Alembic migrations complete`
3. `Batched PostgreSQL reference data seed starting` / `complete`
4. `FastAPI application initialized`
5. `Database startup complete; API is ready`

If it remains at the migration stage for many minutes, inspect the PostgreSQL
service's own logs and the Web Service's Runtime Logs. Do not switch to a paid
plan to work around this without measuring the cause.

## Verify

- Render reports **Live** on the new commit.
- `https://devatlas-z0e0.onrender.com/api/v1/health` returns
  `{"status":"ok"}`.
- Site displays React at `/`; a test account can sign up and select a career.
- Reload the page and verify saved quiz/progress records still exist.
- Check the PostgreSQL dashboard to confirm queries and storage use.

Render Free web instances can spin down with inactivity. Render Free PostgreSQL
currently expires after 30 days and has no managed backups. Do not keep
irreplaceable student data on the free database. The private Compose database
uses a named Docker volume locally and is different from Render's managed DB.

See also `_docs/new-assignment.md` and Issues #50, #52, #54, #68.

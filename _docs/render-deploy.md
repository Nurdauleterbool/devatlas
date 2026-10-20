# One-link Render deployment (demonstration only)

Use a **Docker** Web Service connected to `Nurdauleterbool/devatlas`, branch `main`.

- Name: `devatlas` (or another available name).
- Language: **Docker** (not Python 3).
- Root Directory: leave empty (repository root).
- Dockerfile Path: `./Dockerfile` (default).
- Docker Command: leave empty (uses Dockerfile CMD).
- Region: any supported region.
- Plan: Free if available; no payment required.
- Health Check Path, if offered: `/api/v1/health`.

The Docker build installs Node 24, compiles the Vite React app, then builds a Python 3.12 image with FastAPI, Alembic and the React `dist` assets. FastAPI serves the built app and `/api/v1` on **the same public HTTPS origin**, so signup, cookies, graphs, quiz attempts and analytics work without frontend CORS redirects.

Render provides `RENDER_EXTERNAL_URL` automatically; `DEVATLAS_FRONTEND_ORIGIN` defaults to this URL in Render, to allow only the correct site origin. Cookies are Secure in production.

**Important free-hosting limitation:** the container database is stored at `/tmp/devatlas.db` and is **ephemeral**: users, quiz attempts and selections **may be lost whenever the service restarts/redeploys**. Do not enter real passwords or personal information. For durable real accounts, configure a paid persistent disk or managed database and revisit concurrency/migration configuration. This setup is intentionally **for a temporary class demo only**.

After GitHub PR merges and Render deploy reports `Live`, open the exact `https://....onrender.com` link shown by Render and test `/api/v1/health`, `/signup`, and `/analytics`. Do not guess the assigned domain.

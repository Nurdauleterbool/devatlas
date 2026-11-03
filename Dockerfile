# One multistage image serves compiled React static files and FastAPI.
FROM node:24-bookworm-slim AS frontend-build
WORKDIR /site
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
WORKDIR /app/backend
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEVATLAS_ENVIRONMENT=production \
    DEVATLAS_DATABASE_URL=sqlite:////tmp/devatlas.db
COPY backend/pyproject.toml ./
COPY backend/app ./app
RUN python -m pip install --no-cache-dir .
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./
COPY --from=frontend-build /site/dist /app/frontend/dist
RUN useradd --system --create-home --uid 10001 appuser
USER appuser
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=35s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:10000/api/v1/health', timeout=3)" || exit 1
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --proxy-headers"]

"""FastAPI composition root with versioned authentication and health routes."""
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .auth import AuthManager, router as auth_router
from .analytics import AnalyticsManager, router as analytics_router
from .catalogue import router as catalogue_router
from .career_selections import router as career_selections_router
from .catalogue_seed import seed_catalogue
from .progress import ProgressManager, router as progress_router
from .quizzes import QuizManager, router as quiz_router
from .config import Settings
from .repositories import InMemoryRepositoryFactory, RepositoryFactory
from .db import make_engine, make_session_factory
from .sql_repositories import SQLAlchemyRepositoryFactory

class HealthResponse(BaseModel):
    status: str

def create_app(
    settings: Settings | None = None,
    repository_factory: RepositoryFactory | None = None,
) -> FastAPI:
    settings = settings if settings is not None else Settings()
    # Existing unit tests and injected repositories remain memory-backed.
    # The deployed `app` instance selects SQLite by configuration.
    if repository_factory is not None:
        factory = repository_factory
    elif settings.storage_backend == "sqlite":
        from alembic import command
        from alembic.config import Config
        config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        config.set_main_option("sqlalchemy.url", settings.database_url)
        command.upgrade(config, "head")
        engine = make_engine(settings.database_url)
        factory = SQLAlchemyRepositoryFactory(make_session_factory(engine))
    else:
        factory = InMemoryRepositoryFactory()
    app = FastAPI(title=settings.app_name, version="0.1.0")
    seed_catalogue(factory)
    app.state.repositories = factory
    app.state.settings = settings
    app.state.auth = AuthManager(factory)
    app.state.progress_manager = ProgressManager(factory, app.state.auth)
    app.state.quiz_manager = QuizManager(factory, app.state.auth)
    app.state.analytics_manager = AnalyticsManager(factory, app.state.progress_manager, app.state.quiz_manager)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(RequestValidationError)
    async def handle_validation(_request: Request, _exc: RequestValidationError):
        return JSONResponse(status_code=422, content={"error": {"code": "VALIDATION", "message": "Invalid request."}}, headers={"Cache-Control": "no-store"})

    @app.exception_handler(HTTPException)
    async def handle_http_error(_request: Request, exc: HTTPException):
        content = exc.detail if isinstance(exc.detail, dict) and "error" in exc.detail else {
            "error": {"code": "UNAVAILABLE", "message": "Request failed."}
        }
        return JSONResponse(status_code=exc.status_code, content=content, headers={"Cache-Control": "no-store"})

    @app.middleware("http")
    async def no_store_personal_responses(request: Request, call_next):
        response = await call_next(request)
        if (request.url.path.startswith("/api/v1/auth/")
                or request.url.path.startswith("/api/v1/me/")
                or request.url.path == "/api/v1/progress"
                or request.url.path.startswith("/api/v1/quizzes/")
                or response.status_code >= 400):
            response.headers["Cache-Control"] = "no-store"
        return response

    app.include_router(auth_router)
    app.include_router(catalogue_router)
    app.include_router(career_selections_router)
    app.include_router(progress_router)
    app.include_router(quiz_router)
    app.include_router(analytics_router)

    @app.get("/api/v1/health", response_model=HealthResponse, tags=["Operations"])
    def health() -> HealthResponse:
        return HealthResponse(status="ok")

    # In a single-service deployment FastAPI serves React and the API on one origin.
    # Without a built dist directory (e.g. tests and local Vite development),
    # this block is intentionally inert.
    frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if frontend_dist.is_dir():
        assets = frontend_dist / "assets"
        if assets.is_dir():
            app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")

        @app.get("/{requested_path:path}", include_in_schema=False)
        def react_spa(requested_path: str):
            if requested_path.startswith("api/"):
                raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Resource not found."}})
            candidate = (frontend_dist / requested_path).resolve()
            if candidate.is_file() and candidate.is_relative_to(frontend_dist.resolve()):
                return FileResponse(candidate)
            if "." in Path(requested_path).name:
                raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Resource not found."}})
            return FileResponse(frontend_dist / "index.html")

    return app

app = create_app(settings=Settings(storage_backend="sqlite"))

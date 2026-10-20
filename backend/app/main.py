"""FastAPI composition root with versioned authentication and health routes."""
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .auth import AuthManager, router as auth_router
from .catalogue import router as catalogue_router
from .catalogue_seed import seed_catalogue
from .progress import ProgressManager, router as progress_router
from .config import Settings
from .repositories import InMemoryRepositoryFactory, RepositoryFactory

class HealthResponse(BaseModel):
    status: str

def create_app(
    settings: Settings | None = None,
    repository_factory: RepositoryFactory | None = None,
) -> FastAPI:
    settings = settings if settings is not None else Settings()
    factory = repository_factory if repository_factory is not None else InMemoryRepositoryFactory()
    app = FastAPI(title=settings.app_name, version="0.1.0")
    seed_catalogue(factory)
    app.state.repositories = factory
    app.state.settings = settings
    app.state.auth = AuthManager(factory)
    app.state.progress_manager = ProgressManager(factory, app.state.auth)
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
                or response.status_code >= 400):
            response.headers["Cache-Control"] = "no-store"
        return response

    app.include_router(auth_router)
    app.include_router(catalogue_router)
    app.include_router(progress_router)

    @app.get("/api/v1/health", response_model=HealthResponse, tags=["Operations"])
    def health() -> HealthResponse:
        return HealthResponse(status="ok")

    return app

app = create_app()

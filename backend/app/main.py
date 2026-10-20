"""FastAPI composition root. Business routes are added in Issues #11–#15."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
    app.state.repositories = factory
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type"],
    )

    @app.get("/api/v1/health", response_model=HealthResponse, tags=["Operations"])
    def health() -> HealthResponse:
        return HealthResponse(status="ok")

    return app


app = create_app()

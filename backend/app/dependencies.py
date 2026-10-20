"""FastAPI dependency boundary for storage implementations."""
from typing import Annotated
from fastapi import Depends, Request
from .repositories import Repository, RepositoryFactory


def get_repository_factory(request: Request) -> RepositoryFactory:
    return request.app.state.repositories


def get_user_repository(
    factory: Annotated[RepositoryFactory, Depends(get_repository_factory)],
) -> Repository[dict]:
    return factory.create("users")

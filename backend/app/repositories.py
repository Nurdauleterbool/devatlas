"""Storage interfaces and isolated in-memory implementations (MVP-10)."""
from copy import deepcopy
from typing import Generic, Mapping, Protocol, TypeVar

T = TypeVar("T")


class Repository(Protocol[T]):
    def get(self, item_id: str) -> T | None: ...
    def list(self) -> list[T]: ...
    def put(self, item_id: str, value: T) -> None: ...
    def delete(self, item_id: str) -> bool: ...


class InMemoryRepository(Generic[T]):
    def __init__(self, initial: Mapping[str, T] | None = None):
        self._items: dict[str, T] = deepcopy(dict(initial or {}))

    def get(self, item_id: str) -> T | None:
        value = self._items.get(item_id)
        return deepcopy(value) if value is not None else None

    def list(self) -> list[T]:
        return deepcopy(list(self._items.values()))

    def put(self, item_id: str, value: T) -> None:
        if not isinstance(item_id, str) or not item_id:
            raise ValueError("item_id is required")
        self._items[item_id] = deepcopy(value)

    def delete(self, item_id: str) -> bool:
        if item_id not in self._items:
            return False
        del self._items[item_id]
        return True


class RepositoryFactory(Protocol):
    def create(self, name: str) -> Repository[dict]: ...


class InMemoryRepositoryFactory:
    def __init__(self):
        self._repositories: dict[str, InMemoryRepository[dict]] = {}

    def create(self, name: str) -> Repository[dict]:
        if not isinstance(name, str) or not name:
            raise ValueError("repository name is required")
        if name not in self._repositories:
            self._repositories[name] = InMemoryRepository()
        return self._repositories[name]

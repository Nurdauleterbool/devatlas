"""Expose the HTTP port while a slow free-tier database is bootstrapping.

Uvicorn imports this ASGI instance immediately, then the database migration and
reference seeding run in one background thread. While unfinished, requests get
503 (including /api/v1/health) rather than a misleading healthy response.
Render should configure HTTP health checks at /api/v1/health.
"""
from __future__ import annotations

import logging
from threading import Lock, Thread
from typing import Callable

from starlette.responses import JSONResponse

log = logging.getLogger("uvicorn.error")


class DeferredDatabaseApp:
    def __init__(self, build_app: Callable):
        self._build_app = build_app
        self._inner = None
        self._failure = False
        self._started = False
        self._lock = Lock()

    def _load(self) -> None:
        try:
            log.info("Database startup started")
            self._inner = self._build_app()
            log.info("Database startup complete; API is ready")
        except Exception as exc:
            self._failure = True
            # Error class is sufficient for identifying the failure without
            # including credentials from database connection strings.
            log.error("Database startup failed: %s", type(exc).__name__, exc_info=False)

    async def __call__(self, scope, receive, send):
        if scope["type"] == "lifespan":
            while True:
                message = await receive()
                if message["type"] == "lifespan.startup":
                    with self._lock:
                        if not self._started:
                            self._started = True
                            Thread(target=self._load, name="devatlas-db-init", daemon=True).start()
                    await send({"type": "lifespan.startup.complete"})
                elif message["type"] == "lifespan.shutdown":
                    await send({"type": "lifespan.shutdown.complete"})
                    return
            return

        if self._inner is not None:
            await self._inner(scope, receive, send)
            return

        if scope["type"] == "http":
            response = JSONResponse(
                {"status": "initializing" if not self._failure else "unavailable",
                 "message": "The database is preparing; retry shortly." if not self._failure
                 else "Database initialization failed. Check service logs."},
                status_code=503,
                headers={"Retry-After": "10", "Cache-Control": "no-store"},
            )
            await response(scope, receive, send)
        elif scope["type"] == "websocket":
            await send({"type": "websocket.close", "code": 1013})

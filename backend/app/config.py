import os
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DEVATLAS_", env_file=".env", extra="ignore")

    app_name: str = "DevAtlas API"
    frontend_origin: str = os.environ.get("RENDER_EXTERNAL_URL") or "http://localhost:5173"
    environment: str = "development"
    storage_backend: Literal["memory", "sqlite"] = "memory"
    database_url: str = "sqlite:///./devatlas.db"

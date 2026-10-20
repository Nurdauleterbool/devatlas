from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DEVATLAS_", env_file=".env", extra="ignore")

    app_name: str = "DevAtlas API"
    frontend_origin: str = "http://localhost:5173"
    environment: str = "development"

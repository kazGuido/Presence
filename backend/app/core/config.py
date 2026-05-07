from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = f"sqlite:///{_BACKEND_ROOT / 'data' / 'app.db'}"
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7
    public_app_url: str = "http://127.0.0.1:5173"
    whatsapp_bridge_url: str = ""
    whatsapp_bridge_secret: str = ""
    upload_dir: str = str(_BACKEND_ROOT / "uploads")
    max_upload_mb: int = 5


@lru_cache
def get_settings() -> Settings:
    return Settings()

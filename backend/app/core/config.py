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
    jwt_magic_expire_minutes: int = 15
    public_app_url: str = "http://127.0.0.1:5173"
    cors_allowed_origins: str = "http://127.0.0.1:5173,http://localhost:5173"
    whatsapp_bridge_url: str = ""
    whatsapp_bridge_secret: str = ""
    upload_dir: str = str(_BACKEND_ROOT / "uploads")
    max_upload_mb: int = 5

    # Redis (verification codes, ARQ broker)
    redis_url: str = ""

    # SMTP (email notifications — not WhatsApp Cloud API)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "Attendance"
    smtp_use_tls: bool = True

    # MinIO (S3-compatible object storage via FastAPI)
    minio_endpoint: str = ""
    minio_access_key: str = ""
    minio_secret_key: str = ""
    minio_bucket: str = "attendance"
    minio_secure: bool = False
    minio_public_read: bool = False  # if true, store public URL; else presigned GET

    # Worker
    reminder_lead_minutes: int = 30  # send "confirm attendance" this many minutes before schedule start

    # FCM (mobile push) — set FCM_SERVICE_ACCOUNT_FILE to service account JSON from Firebase
    fcm_project_id: str = ""
    fcm_service_account_file: str = ""  # path to Google service account JSON

    @property
    def cors_origins(self) -> list[str]:
        raw = self.cors_allowed_origins.strip()
        if not raw:
            return []
        if raw == "*":
            return ["*"]
        return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

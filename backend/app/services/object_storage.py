import io
from urllib.parse import urlparse

from minio import Minio
from minio.error import S3Error

from app.core.config import get_settings


def minio_enabled() -> bool:
    s = get_settings()
    return bool(s.minio_endpoint and s.minio_access_key and s.minio_secret_key)


def _client() -> Minio:
    s = get_settings()
    raw = s.minio_endpoint.strip()
    if "://" in raw:
        parsed = urlparse(raw)
        host = parsed.hostname or "localhost"
        port = parsed.port or (443 if parsed.scheme == "https" else 9000)
        endpoint = f"{host}:{port}"
        secure = s.minio_secure if parsed.scheme not in ("http", "https") else parsed.scheme == "https"
    else:
        endpoint = raw
        secure = s.minio_secure
    return Minio(
        endpoint,
        access_key=s.minio_access_key,
        secret_key=s.minio_secret_key,
        secure=secure,
    )


def ensure_minio_bucket() -> None:
    if not minio_enabled():
        return
    s = get_settings()
    c = _client()
    try:
        if not c.bucket_exists(s.minio_bucket):
            c.make_bucket(s.minio_bucket)
    except S3Error as e:
        raise RuntimeError(f"MinIO bucket init failed: {e}") from e


def put_object_bytes(object_name: str, data: bytes, content_type: str) -> None:
    s = get_settings()
    c = _client()
    c.put_object(
        s.minio_bucket,
        object_name,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )


def presigned_get_url(object_name: str, expires_seconds: int = 3600) -> str:
    s = get_settings()
    c = _client()
    return c.presigned_get_object(s.minio_bucket, object_name, expires=expires_seconds)


def parse_minio_ref(photo_path: str) -> tuple[str, str] | None:
    if not photo_path.startswith("minio:"):
        return None
    rest = photo_path.removeprefix("minio:")
    if "/" not in rest:
        return None
    bucket, key = rest.split("/", 1)
    return bucket, key

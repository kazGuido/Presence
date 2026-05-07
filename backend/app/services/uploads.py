import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings
from app.services.object_storage import minio_enabled, put_object_bytes

ALLOWED_IMAGE_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})


def save_optional_image(upload: UploadFile | None) -> str | None:
    if not upload or not upload.filename:
        return None
    settings = get_settings()
    if upload.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported image type")
    suffix = Path(upload.filename).suffix.lower()
    ext = ".jpg" if suffix in (".jpg", ".jpeg") else ".png" if suffix == ".png" else ".webp"
    max_b = settings.max_upload_mb * 1024 * 1024

    upload.file.seek(0)
    data = upload.file.read()
    if len(data) > max_b:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File too large")

    ctype = upload.content_type or "application/octet-stream"

    if minio_enabled():
        key = f"punches/{uuid.uuid4().hex}{ext}"
        put_object_bytes(key, data, ctype)
        return f"minio:{settings.minio_bucket}/{key}"

    uid = uuid.uuid4().hex
    dest_dir = Path(settings.upload_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{uid}{ext}"
    dest.write_bytes(data)
    return str(dest.resolve())

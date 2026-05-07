import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings

ALLOWED_IMAGE_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})


def save_optional_image(upload: UploadFile | None) -> str | None:
    if not upload or not upload.filename:
        return None
    settings = get_settings()
    if upload.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported image type")
    suffix = Path(upload.filename).suffix.lower()
    ext = ".jpg" if suffix in (".jpg", ".jpeg") else ".png" if suffix == ".png" else ".webp"
    uid = uuid.uuid4().hex
    dest_dir = Path(settings.upload_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{uid}{ext}"
    max_b = settings.max_upload_mb * 1024 * 1024
    written = 0
    with dest.open("wb") as f:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            written += len(chunk)
            if written > max_b:
                dest.unlink(missing_ok=True)
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "File too large")
            f.write(chunk)
    return f"{settings.upload_dir}/{dest.name}"

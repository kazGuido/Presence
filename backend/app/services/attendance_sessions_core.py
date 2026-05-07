import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import AttendanceSession, AttendanceSessionStatus


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def create_attendance_session(
    db: Session,
    company_id: str,
    employee_id: str,
    work_site_id: str,
    expires_hours: int = 24,
) -> tuple[AttendanceSession, str]:
    raw = secrets.token_urlsafe(32)
    th = hash_token(raw)
    exp = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
    row = AttendanceSession(
        company_id=company_id,
        employee_id=employee_id,
        work_site_id=work_site_id,
        token_hash=th,
        expires_at=exp,
        status=AttendanceSessionStatus.pending,
    )
    db.add(row)
    db.flush()
    db.refresh(row)
    return row, raw

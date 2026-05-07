import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.deps import get_current_company
from app.models import (
    AttendanceSession,
    AttendanceSessionStatus,
    Company,
    Employee,
    Punch,
    PunchKind,
    PunchSource,
    WorkSite,
)
from app.schemas import AttendanceSessionCreate, AttendanceSessionPublicOut, SendWaIn
from app.services.geofence import within_radius
from app.services.uploads import save_optional_image
from app.services.whatsapp_bridge import send_whatsapp_text

router = APIRouter(prefix="/attendance-sessions", tags=["attendance-sessions"])


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@router.post("", status_code=status.HTTP_201_CREATED)
def create_session(
    body: AttendanceSessionCreate,
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
) -> dict:
    emp = db.get(Employee, body.employee_id)
    if not emp or emp.company_id != company.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    site = db.get(WorkSite, body.work_site_id)
    if not site or site.company_id != company.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid work site")
    raw = secrets.token_urlsafe(32)
    th = _hash_token(raw)
    exp = datetime.now(timezone.utc) + timedelta(hours=body.expires_hours)
    row = AttendanceSession(
        company_id=company.id,
        employee_id=emp.id,
        work_site_id=site.id,
        token_hash=th,
        expires_at=exp,
        status=AttendanceSessionStatus.pending,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "token": raw, "expires_at": row.expires_at.isoformat()}


@router.post("/{session_id}/send-whatsapp-with-token")
def send_whatsapp_with_token(
    session_id: str,
    body: SendWaIn,
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
) -> dict:
    row = db.get(AttendanceSession, session_id)
    if not row or row.company_id != company.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if _hash_token(body.token) != row.token_hash:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid token for this session")
    emp = db.get(Employee, row.employee_id)
    site = db.get(WorkSite, row.work_site_id)
    if not emp or not emp.phone_e164:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Employee has no phone_e164")
    settings = get_settings()
    base = settings.public_app_url.rstrip("/")
    link = f"{base}/attend/{body.token}"
    msg = (
        f"Bonjour {emp.display_name}, validez votre présence sur {site.name if site else 'votre site'}: {link}"
    )
    send_whatsapp_text(emp.phone_e164, msg)
    return {"ok": True}


@router.get("/by-token/{token}", response_model=AttendanceSessionPublicOut)
def public_session_info(token: str, db: Session = Depends(get_db)) -> AttendanceSessionPublicOut:
    th = _hash_token(token)
    row = db.query(AttendanceSession).filter(AttendanceSession.token_hash == th).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid or expired link")
    if row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid or expired link")
    emp = db.get(Employee, row.employee_id)
    site = db.get(WorkSite, row.work_site_id)
    completed = row.status == AttendanceSessionStatus.completed
    return AttendanceSessionPublicOut(
        site_name=site.name if site else "",
        employee_display_name=emp.display_name if emp else "",
        expires_at=row.expires_at,
        status=row.status.value,
        already_completed=completed,
    )


@router.post("/by-token/{token}/complete", status_code=status.HTTP_201_CREATED)
async def complete_session(
    token: str,
    db: Session = Depends(get_db),
    lat: float = Form(...),
    lng: float = Form(...),
    file: UploadFile | None = File(None),
) -> dict:
    settings = get_settings()
    th = _hash_token(token)
    row = db.query(AttendanceSession).filter(AttendanceSession.token_hash == th).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid or expired link")
    if row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid or expired link")
    if row.status != AttendanceSessionStatus.pending:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Session already used")

    site = db.get(WorkSite, row.work_site_id)
    if not site:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Site missing")

    ok, dist = within_radius(lat, lng, site.lat, site.lng, site.radius_m)
    if not ok:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail={"error": "out_of_zone", "distance_m": dist, "site_name": site.name},
        )

    photo_path = save_optional_image(file)
    punch = Punch(
        company_id=row.company_id,
        employee_id=row.employee_id,
        kind=PunchKind.punch_in,
        at=datetime.now(timezone.utc),
        lat=lat,
        lng=lng,
        work_site_id=site.id,
        distance_m=dist,
        within_geofence=True,
        photo_path=photo_path,
        source=PunchSource.whatsapp_link,
    )
    db.add(punch)
    db.flush()
    row.status = AttendanceSessionStatus.completed
    row.completed_punch_id = punch.id
    db.commit()
    db.refresh(punch)

    emp = db.get(Employee, row.employee_id)
    if emp and emp.phone_e164 and settings.whatsapp_bridge_url:
        try:
            send_whatsapp_text(
                emp.phone_e164,
                f"Pointage enregistré pour {site.name}. Merci.",
            )
        except Exception:
            pass

    return {"ok": True, "punch_id": punch.id, "at": punch.at.isoformat()}

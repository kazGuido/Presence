"""Kiosk QR sessions for on-site controller → employee scan punch."""

import json
import secrets
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from app.core.database import get_db
from app.core.security import verify_password
from app.deps import get_current_employee, get_employee_company
from app.models import Company, Employee, GeofenceReviewStatus, Punch, PunchKind, PunchSource, WorkSite
from app.schemas import PunchOut
from app.services.audit_log import write_audit
from app.services.geofence import within_radius
from app.services.in_app_notifications import create_employee_notification
from app.services.punch_logic import next_required_kind, punches_for_local_day, today_local_date
from app.services.redis_client import get_redis
from app.services.uploads import save_optional_image

router = APIRouter(prefix="/controller-sessions", tags=["controller-sessions"])

_KIOSK_PREFIX = "kiosk:"
_DEFAULT_TTL = 90


def _kiosk_key(token: str) -> str:
    return f"{_KIOSK_PREFIX}{token}"


def _resolve_target_employee(db: Session, company_id: str, identifier: str) -> Employee | None:
    raw = identifier.strip()
    if not raw:
        return None
    try:
        uid = uuid.UUID(raw)
    except ValueError:
        uid = None
    if uid is not None:
        emp = db.get(Employee, str(uid))
        if emp and emp.company_id == company_id and emp.active:
            return emp
        return None
    email_norm = raw.lower()
    return (
        db.query(Employee)
        .filter(
            Employee.company_id == company_id,
            Employee.email.isnot(None),
            func.lower(Employee.email) == email_norm,
            Employee.active.is_(True),
        )
        .first()
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_kiosk_session(
    employee: Annotated[Employee, Depends(get_current_employee)],
    company: Annotated[Company, Depends(get_employee_company)],
    db: Session = Depends(get_db),
) -> dict:
    r = get_redis()
    if r is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Kiosk requires Redis")
    if not company.allow_kiosk_borne:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Kiosk (host QR) is disabled for your company",
        )
    if not employee.can_show_controller_ui:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Controller UI not enabled for this employee")
    if not employee.default_work_site_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Set a default work site first")
    site = db.get(WorkSite, employee.default_work_site_id)
    if not site or site.company_id != company.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid default work site")

    token = secrets.token_urlsafe(24)
    payload = {
        "company_id": company.id,
        "work_site_id": site.id,
        "controller_employee_id": employee.id,
    }
    r.setex(_kiosk_key(token), _DEFAULT_TTL, json.dumps(payload))
    write_audit(
        db,
        company_id=company.id,
        actor_type="employee",
        actor_id=employee.id,
        action="kiosk_session.create",
        entity_type="work_site",
        entity_id=site.id,
        meta={"ttl_seconds": _DEFAULT_TTL},
    )
    db.commit()
    return {"kiosk_token": token, "ttl_seconds": _DEFAULT_TTL}


@router.post("/{kiosk_token}/punch", response_model=PunchOut, status_code=status.HTTP_201_CREATED)
async def punch_via_kiosk(
    kiosk_token: str,
    employee: Annotated[Employee, Depends(get_current_employee)],
    company: Annotated[Company, Depends(get_employee_company)],
    db: Session = Depends(get_db),
    kind: str = Form(...),
    lat: float | None = Form(None),
    lng: float | None = Form(None),
    location_unavailable: bool = Form(False),
    file: UploadFile | None = File(None),
) -> Punch:
    r = get_redis()
    if r is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Kiosk requires Redis")
    raw = r.get(_kiosk_key(kiosk_token))
    if not raw:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid or expired kiosk session")
    try:
        kiosk = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid kiosk session")

    if str(kiosk.get("company_id")) != company.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Wrong company for this kiosk")

    if not company.allow_punch_kiosk_scan:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Kiosk scan punch is disabled for your company",
        )

    site = db.get(WorkSite, str(kiosk["work_site_id"]))
    if not site or site.company_id != company.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid kiosk site")

    try:
        pk = PunchKind(kind)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid kind")

    tz = ZoneInfo(company.timezone)
    day = today_local_date(tz)
    punches = punches_for_local_day(db, employee.id, day, tz)
    expected = next_required_kind(punches)
    if pk != expected:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Expected {expected.value}, got {pk.value}",
        )

    photo_only = bool(location_unavailable) or lat is None or lng is None

    if photo_only:
        if not company.allow_punch_photo:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Photo attestation is disabled for your company",
            )
    elif not company.allow_punch_gps:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "GPS punch is disabled for your company",
        )

    photo_path = save_optional_image(file)

    if photo_only:
        if not photo_path:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Photo required when location is unavailable",
            )
        use_lat, use_lng = site.lat, site.lng
        ok, dist = False, None
    else:
        use_lat, use_lng = float(lat), float(lng)
        ok, dist = within_radius(use_lat, use_lng, site.lat, site.lng, site.radius_m)

    punch = Punch(
        company_id=company.id,
        employee_id=employee.id,
        kind=pk,
        at=datetime.now(timezone.utc),
        lat=use_lat,
        lng=use_lng,
        work_site_id=site.id,
        distance_m=dist,
        within_geofence=ok and not photo_only,
        photo_only_attestation=photo_only,
        photo_path=photo_path,
        source=PunchSource.controller_scan,
        geofence_review_status=None
        if ok and not photo_only
        else GeofenceReviewStatus.pending,
    )
    db.add(punch)
    db.flush()
    write_audit(
        db,
        company_id=company.id,
        actor_type="employee",
        actor_id=employee.id,
        action="punch.create",
        entity_type="punch",
        entity_id=punch.id,
        meta={
            "kind": pk.value,
            "source": PunchSource.controller_scan.value,
            "within_geofence": punch.within_geofence,
            "distance_m": dist,
            "photo_only_attestation": photo_only,
            "geofence_review_status": punch.geofence_review_status.value
            if punch.geofence_review_status
            else None,
        },
    )
    db.commit()
    db.refresh(punch)
    return punch


@router.post("/{kiosk_token}/manual-punch", response_model=PunchOut, status_code=status.HTTP_201_CREATED)
async def punch_via_kiosk_manual(
    kiosk_token: str,
    controller: Annotated[Employee, Depends(get_current_employee)],
    company: Annotated[Company, Depends(get_employee_company)],
    db: Session = Depends(get_db),
    identifier: str = Form(...),
    pin: str = Form(...),
    file: UploadFile | None = File(None),
) -> Punch:
    """Host-only: record attendance for a colleague using ID/email + PIN + selfie (no login session)."""
    r = get_redis()
    if r is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Kiosk requires Redis")
    if not controller.can_show_controller_ui:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Controller UI not enabled for this employee",
        )
    raw = r.get(_kiosk_key(kiosk_token))
    if not raw:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid or expired kiosk session")
    try:
        kiosk = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid kiosk session")

    if str(kiosk.get("company_id")) != company.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Wrong company for this kiosk")

    if not company.allow_kiosk_borne:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Kiosk (host QR) is disabled for your company",
        )

    if not company.allow_punch_kiosk_scan:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Kiosk scan punch is disabled for your company",
        )

    if not company.allow_punch_photo:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Photo attestation is disabled for your company",
        )

    site = db.get(WorkSite, str(kiosk["work_site_id"]))
    if not site or site.company_id != company.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid kiosk site")

    target = _resolve_target_employee(db, company.id, identifier)
    if target is None or not verify_password(pin, target.pin_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    tz = ZoneInfo(company.timezone)
    day = today_local_date(tz)
    punches = punches_for_local_day(db, target.id, day, tz)
    pk = next_required_kind(punches)

    photo_path = save_optional_image(file)
    if not photo_path:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Selfie photo is required for manual kiosk punch",
        )

    use_lat, use_lng = site.lat, site.lng
    punch = Punch(
        company_id=company.id,
        employee_id=target.id,
        kind=pk,
        at=datetime.now(timezone.utc),
        lat=use_lat,
        lng=use_lng,
        work_site_id=site.id,
        distance_m=None,
        within_geofence=False,
        photo_only_attestation=True,
        photo_path=photo_path,
        source=PunchSource.controller_manual,
        geofence_review_status=GeofenceReviewStatus.pending,
    )
    db.add(punch)
    db.flush()
    create_employee_notification(
        db,
        company_id=company.id,
        employee_id=target.id,
        title="Pointage borne en attente de revue",
        body="Un pointage manuel avec photo a été enregistré et attend la revue d'un superviseur.",
        kind="geofence_review",
        entity_type="punch",
        entity_id=punch.id,
    )
    write_audit(
        db,
        company_id=company.id,
        actor_type="employee",
        actor_id=controller.id,
        action="punch.create",
        entity_type="punch",
        entity_id=punch.id,
        meta={
            "target_employee_id": target.id,
            "kind": pk.value,
            "source": PunchSource.controller_manual.value,
            "within_geofence": False,
            "photo_only_attestation": True,
            "geofence_review_status": GeofenceReviewStatus.pending.value,
        },
    )
    db.commit()
    db.refresh(punch)
    return punch

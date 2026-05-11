"""Kiosk QR sessions for on-site controller → employee scan punch."""

import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import create_access_token, decode_token, verify_password
from app.deps import get_current_company, get_current_employee, get_current_employer, get_employee_company
from app.models import Company, Employee, GeofenceReviewStatus, Punch, PunchKind, PunchSource, WorkSite
from app.schemas import ControllerPublishIn, PunchOut
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


def _load_kiosk_payload(kiosk_token: str) -> dict:
    r = get_redis()
    if r is not None:
        raw = r.get(_kiosk_key(kiosk_token))
        if raw:
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid kiosk session")
    try:
        payload = decode_token(kiosk_token)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid or expired kiosk session")
    if payload.get("typ") != "published_kiosk":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid or expired kiosk session")
    return {
        "company_id": str(payload.get("company_id") or ""),
        "work_site_id": str(payload.get("work_site_id") or ""),
        "published": True,
    }


def _get_kiosk_site(db: Session, kiosk: dict, company_id: str) -> WorkSite:
    site = db.get(WorkSite, str(kiosk.get("work_site_id") or ""))
    if not site or site.company_id != company_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid kiosk site")
    return site


def _next_kind_for(db: Session, company: Company, employee_id: str) -> PunchKind:
    tz = ZoneInfo(company.timezone)
    day = today_local_date(tz)
    punches = punches_for_local_day(db, employee_id, day, tz)
    return next_required_kind(punches)


@router.post("/published", status_code=status.HTTP_201_CREATED)
def publish_borne_session(
    body: ControllerPublishIn,
    company: Annotated[Company, Depends(get_current_company)],
    employer: Annotated[object, Depends(get_current_employer)],
    db: Session = Depends(get_db),
) -> dict:
    if not company.allow_kiosk_borne:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Kiosk (host QR) is disabled for your company",
        )
    site = db.get(WorkSite, body.work_site_id)
    if not site or site.company_id != company.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid work site")
    token = create_access_token(
        {
            "sub": site.id,
            "typ": "published_kiosk",
            "company_id": company.id,
            "work_site_id": site.id,
        },
        expires_delta=timedelta(days=365),
    )
    settings = get_settings()
    base = settings.public_app_url.rstrip("/")
    write_audit(
        db,
        company_id=company.id,
        actor_type="employer",
        actor_id=getattr(employer, "id", "unknown"),
        action="kiosk_borne.publish",
        entity_type="work_site",
        entity_id=site.id,
        meta={"site_name": site.name},
    )
    db.commit()
    return {
        "kiosk_token": token,
        "site_name": site.name,
        "public_url": f"{base}/borne/{token}",
        "scan_url": f"{base}/employee/scan-kiosk/{token}",
    }


@router.get("/{kiosk_token}/public")
def public_borne_info(kiosk_token: str, db: Session = Depends(get_db)) -> dict:
    kiosk = _load_kiosk_payload(kiosk_token)
    company = db.get(Company, str(kiosk.get("company_id") or ""))
    if not company:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid or expired kiosk session")
    site = _get_kiosk_site(db, kiosk, company.id)
    return {
        "company_name": company.name,
        "site_name": site.name,
        "radius_m": site.radius_m,
        "allow_kiosk_scan": company.allow_punch_kiosk_scan,
    }


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
    kiosk = _load_kiosk_payload(kiosk_token)

    if str(kiosk.get("company_id")) != company.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Wrong company for this kiosk")

    if not company.allow_punch_kiosk_scan:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Kiosk scan punch is disabled for your company",
        )

    site = _get_kiosk_site(db, kiosk, company.id)

    try:
        pk = PunchKind(kind)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid kind")

    expected = _next_kind_for(db, company, employee.id)
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


@router.post("/{kiosk_token}/site-login-punch", response_model=PunchOut, status_code=status.HTTP_201_CREATED)
async def punch_via_site_login(
    kiosk_token: str,
    db: Session = Depends(get_db),
    identifier: str = Form(...),
    password: str = Form(...),
    lat: float | None = Form(None),
    lng: float | None = Form(None),
    location_unavailable: bool = Form(False),
) -> Punch:
    kiosk = _load_kiosk_payload(kiosk_token)
    company = db.get(Company, str(kiosk.get("company_id") or ""))
    if not company:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid or expired kiosk session")
    if not company.allow_kiosk_borne or not company.allow_punch_kiosk_scan:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Kiosk scan punch is disabled for your company")
    site = _get_kiosk_site(db, kiosk, company.id)
    target = _resolve_target_employee(db, company.id, identifier)
    if target is None or not verify_password(password, target.pin_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    pk = _next_kind_for(db, company, target.id)
    has_gps = not bool(location_unavailable) and lat is not None and lng is not None
    if has_gps:
        use_lat, use_lng = float(lat), float(lng)
        ok, dist = within_radius(use_lat, use_lng, site.lat, site.lng, site.radius_m)
    else:
        use_lat, use_lng = site.lat, site.lng
        ok, dist = False, None

    punch = Punch(
        company_id=company.id,
        employee_id=target.id,
        kind=pk,
        at=datetime.now(timezone.utc),
        lat=use_lat,
        lng=use_lng,
        work_site_id=site.id,
        distance_m=dist,
        within_geofence=ok,
        photo_only_attestation=False,
        photo_path=None,
        source=PunchSource.controller_manual,
        geofence_review_status=None if ok else GeofenceReviewStatus.pending,
    )
    db.add(punch)
    db.flush()
    write_audit(
        db,
        company_id=company.id,
        actor_type="employee",
        actor_id=target.id,
        action="punch.create",
        entity_type="punch",
        entity_id=punch.id,
        meta={
            "kind": pk.value,
            "source": PunchSource.controller_manual.value,
            "within_geofence": punch.within_geofence,
            "distance_m": dist,
            "site_login_fallback": True,
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

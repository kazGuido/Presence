"""Kiosk QR sessions for on-site controller → employee scan punch."""

import json
import secrets
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from app.core.database import get_db
from app.deps import get_current_employee, get_employee_company
from app.models import Company, Employee, Punch, PunchKind, PunchSource, WorkSite
from app.schemas import PunchOut
from app.services.geofence import within_radius
from app.services.punch_logic import next_required_kind, punches_for_local_day, today_local_date
from app.services.redis_client import get_redis
from app.services.uploads import save_optional_image

router = APIRouter(prefix="/controller-sessions", tags=["controller-sessions"])

_KIOSK_PREFIX = "kiosk:"
_DEFAULT_TTL = 90


def _kiosk_key(token: str) -> str:
    return f"{_KIOSK_PREFIX}{token}"


@router.post("", status_code=status.HTTP_201_CREATED)
def create_kiosk_session(
    employee: Annotated[Employee, Depends(get_current_employee)],
    company: Annotated[Company, Depends(get_employee_company)],
    db: Session = Depends(get_db),
) -> dict:
    r = get_redis()
    if r is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Kiosk requires Redis")
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

    photo_path = save_optional_image(file)
    photo_only = bool(location_unavailable) or lat is None or lng is None

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
    )
    db.add(punch)
    db.commit()
    db.refresh(punch)
    return punch

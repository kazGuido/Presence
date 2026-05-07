from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse
from pathlib import Path
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.core.database import get_db
from app.deps import get_current_employee, get_employee_company
from app.models import Company, Employee, Punch, PunchKind, PunchSource, WorkSite
from app.schemas import PunchCreate, PunchOut, PunchStateOut
from app.services.geofence import within_radius
from app.services.object_storage import parse_minio_ref, presigned_get_url
from app.services.punch_logic import next_required_kind, punches_for_local_day, today_local_date
from app.services.schedule_nudge import clock_in_reminder_fields
from app.services.uploads import save_optional_image

router = APIRouter(prefix="/punches", tags=["punches"])


@router.get("/me/state", response_model=PunchStateOut)
def punch_state(
    employee: Annotated[Employee, Depends(get_current_employee)],
    company: Annotated[Company, Depends(get_employee_company)],
    db: Session = Depends(get_db),
) -> PunchStateOut:
    tz = ZoneInfo(company.timezone)
    day = today_local_date(tz)
    punches = punches_for_local_day(db, employee.id, day, tz)
    nk = next_required_kind(punches)
    exp_str, show_rem = clock_in_reminder_fields(db, employee.id, tz, day, nk)
    return PunchStateOut(
        next_kind=nk.value,
        local_date=day,
        expected_start_local=exp_str,
        show_clock_in_reminder=show_rem,
    )


@router.get("/me", response_model=list[PunchOut])
def list_my_punches(
    employee: Annotated[Employee, Depends(get_current_employee)],
    db: Session = Depends(get_db),
    limit: int = 50,
) -> list[Punch]:
    return (
        db.query(Punch)
        .filter(Punch.employee_id == employee.id)
        .order_by(Punch.at.desc())
        .limit(min(limit, 200))
        .all()
    )


@router.post("/me", response_model=PunchOut, status_code=status.HTTP_201_CREATED)
async def create_my_punch(
    employee: Annotated[Employee, Depends(get_current_employee)],
    company: Annotated[Company, Depends(get_employee_company)],
    db: Session = Depends(get_db),
    kind: str = Form(...),
    lat: float | None = Form(None),
    lng: float | None = Form(None),
    location_unavailable: bool = Form(False),
    file: UploadFile | None = File(None),
) -> Punch:
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

    if not employee.default_work_site_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Employee has no default work site configured"
        )
    site = db.get(WorkSite, employee.default_work_site_id)
    if not site or site.company_id != company.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid default work site")

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
                "Photo required when GPS location is unavailable",
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
        source=PunchSource.app,
    )
    db.add(punch)
    db.commit()
    db.refresh(punch)
    return punch


@router.post("/me/json", response_model=PunchOut, status_code=status.HTTP_201_CREATED)
def create_my_punch_json(
    body: PunchCreate,
    employee: Annotated[Employee, Depends(get_current_employee)],
    company: Annotated[Company, Depends(get_employee_company)],
    db: Session = Depends(get_db),
) -> Punch:
    try:
        pk = PunchKind(body.kind)
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

    if not employee.default_work_site_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Employee has no default work site configured"
        )
    site = db.get(WorkSite, employee.default_work_site_id)
    if not site or site.company_id != company.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid default work site")

    if not company.allow_punch_gps:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "GPS punch is disabled for your company",
        )

    ok, dist = within_radius(body.lat, body.lng, site.lat, site.lng, site.radius_m)
    punch = Punch(
        company_id=company.id,
        employee_id=employee.id,
        kind=pk,
        at=datetime.now(timezone.utc),
        lat=body.lat,
        lng=body.lng,
        work_site_id=site.id,
        distance_m=dist,
        within_geofence=ok,
        photo_path=None,
        source=PunchSource.app,
    )
    db.add(punch)
    db.commit()
    db.refresh(punch)
    return punch


@router.get("/me/photos/{punch_id}", response_model=None)
def get_my_punch_photo(
    punch_id: str,
    employee: Annotated[Employee, Depends(get_current_employee)],
    company: Annotated[Company, Depends(get_employee_company)],
    db: Session = Depends(get_db),
) -> FileResponse | RedirectResponse:
    punch = db.get(Punch, punch_id)
    if not punch or punch.employee_id != employee.id or punch.company_id != company.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Punch not found")
    if not punch.photo_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No photo")
    parsed = parse_minio_ref(punch.photo_path)
    if parsed:
        bucket, key = parsed
        if bucket != get_settings().minio_bucket:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid storage reference")
        url = presigned_get_url(key, expires_seconds=3600)
        return RedirectResponse(url)
    path = Path(punch.photo_path)
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo missing")
    return FileResponse(path)

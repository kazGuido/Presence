from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse
from pathlib import Path
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.core.database import get_db
from app.deps import get_current_company, get_current_employee, get_current_employer, get_employee_company
from app.models import Company, Employee, EmployerUser, GeofenceReviewStatus, Punch, PunchKind, PunchSource, WorkSite
from app.schemas import GeofenceReviewUpdate, PunchCreate, PunchOut, PunchStateOut
from app.services.audit_log import write_audit
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
            "source": PunchSource.app.value,
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
        geofence_review_status=None if ok else GeofenceReviewStatus.pending,
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
            "source": PunchSource.app.value,
            "within_geofence": ok,
            "distance_m": dist,
            "photo_only_attestation": False,
            "geofence_review_status": punch.geofence_review_status.value
            if punch.geofence_review_status
            else None,
        },
    )
    db.commit()
    db.refresh(punch)
    return punch


@router.get("/geofence-review", response_model=list[PunchOut])
def list_geofence_review_punches(
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
    review_status: Literal["pending", "approved", "rejected", "all"] = Query(
        "pending", alias="status"
    ),
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    limit: int = 100,
) -> list[Punch]:
    q = db.query(Punch).filter(Punch.company_id == company.id, Punch.within_geofence.is_(False))
    if review_status != "all":
        q = q.filter(Punch.geofence_review_status == GeofenceReviewStatus(review_status))
    if date_from is not None:
        q = q.filter(Punch.at >= date_from)
    if date_to is not None:
        q = q.filter(Punch.at <= date_to)
    return q.order_by(Punch.at.desc()).limit(min(limit, 500)).all()


@router.patch("/{punch_id}/geofence-review", response_model=PunchOut)
def review_geofence_punch(
    punch_id: str,
    body: GeofenceReviewUpdate,
    company: Annotated[Company, Depends(get_current_company)],
    employer: Annotated[EmployerUser, Depends(get_current_employer)],
    db: Session = Depends(get_db),
) -> Punch:
    punch = db.get(Punch, punch_id)
    if not punch or punch.company_id != company.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Punch not found")
    if punch.within_geofence:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Punch does not require geofence review")

    previous_status = punch.geofence_review_status.value if punch.geofence_review_status else None
    punch.geofence_review_status = GeofenceReviewStatus(body.status)
    punch.geofence_review_note = body.note.strip() if body.note else None
    punch.geofence_reviewed_by = employer.id
    punch.geofence_reviewed_at = datetime.now(timezone.utc)
    write_audit(
        db,
        company_id=company.id,
        actor_type="employer",
        actor_id=employer.id,
        action="punch.geofence_review",
        entity_type="punch",
        entity_id=punch.id,
        meta={
            "previous_status": previous_status,
            "new_status": punch.geofence_review_status.value,
            "note": punch.geofence_review_note,
            "within_geofence": punch.within_geofence,
            "distance_m": punch.distance_m,
        },
    )
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

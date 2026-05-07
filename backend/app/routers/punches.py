from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from app.core.database import get_db
from app.deps import get_current_employee, get_employee_company
from app.models import Company, Employee, Punch, PunchKind, PunchSource, WorkSite
from app.schemas import PunchCreate, PunchOut, PunchStateOut
from app.services.geofence import within_radius
from app.services.punch_logic import next_required_kind, punches_for_local_day, today_local_date
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
    return PunchStateOut(next_kind=nk.value, local_date=day)


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
    lat: float = Form(...),
    lng: float = Form(...),
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

    ok, dist = within_radius(lat, lng, site.lat, site.lng, site.radius_m)
    photo_path = save_optional_image(file)

    punch = Punch(
        company_id=company.id,
        employee_id=employee.id,
        kind=pk,
        at=datetime.now(timezone.utc),
        lat=lat,
        lng=lng,
        work_site_id=site.id,
        distance_m=dist,
        within_geofence=ok,
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

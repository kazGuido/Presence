from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_company
from app.models import Company
from app.schemas import CompanyAttendanceOut, CompanyAttendanceUpdate

router = APIRouter(prefix="/employer", tags=["employer"])


@router.get("/company")
def get_my_company(company: Annotated[Company, Depends(get_current_company)]) -> dict[str, str]:
    return {"id": company.id, "slug": company.slug, "name": company.name}


@router.get("/company/attendance", response_model=CompanyAttendanceOut)
def get_company_attendance(
    company: Annotated[Company, Depends(get_current_company)],
) -> CompanyAttendanceOut:
    return company


@router.put("/company/attendance", response_model=CompanyAttendanceOut)
def update_company_attendance(
    body: CompanyAttendanceUpdate,
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
) -> CompanyAttendanceOut:
    company.allow_punch_gps = body.allow_punch_gps
    company.allow_punch_photo = body.allow_punch_photo
    company.allow_punch_kiosk_scan = body.allow_punch_kiosk_scan
    company.allow_kiosk_borne = body.allow_kiosk_borne
    db.add(company)
    db.commit()
    db.refresh(company)
    return company

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_company, get_current_employer
from app.models import Company, EmployerUser
from app.schemas import CompanyAttendanceOut, CompanyAttendanceUpdate
from app.services.audit_log import write_audit

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
    employer: Annotated[EmployerUser, Depends(get_current_employer)],
    db: Session = Depends(get_db),
) -> CompanyAttendanceOut:
    previous = {
        "allow_punch_gps": company.allow_punch_gps,
        "allow_punch_photo": company.allow_punch_photo,
        "allow_punch_kiosk_scan": company.allow_punch_kiosk_scan,
        "allow_kiosk_borne": company.allow_kiosk_borne,
    }
    company.allow_punch_gps = body.allow_punch_gps
    company.allow_punch_photo = body.allow_punch_photo
    company.allow_punch_kiosk_scan = body.allow_punch_kiosk_scan
    company.allow_kiosk_borne = body.allow_kiosk_borne
    db.add(company)
    write_audit(
        db,
        company_id=company.id,
        actor_type="employer",
        actor_id=employer.id,
        action="company.attendance_policy.update",
        entity_type="company",
        entity_id=company.id,
        meta={"previous": previous, "new": body.model_dump()},
    )
    db.commit()
    db.refresh(company)
    return company

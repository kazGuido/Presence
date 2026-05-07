"""Read-only attendance channel policy for the employee app."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.deps import get_employee_company
from app.models import Company
from app.schemas import CompanyAttendanceOut

router = APIRouter(prefix="/employee", tags=["employee-attendance"])


@router.get("/attendance-policy", response_model=CompanyAttendanceOut)
def get_attendance_policy(
    company: Annotated[Company, Depends(get_employee_company)],
) -> CompanyAttendanceOut:
    return company

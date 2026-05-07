from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password
from app.deps import get_current_company
from app.models import Company, Employee, EmployeeScheduleAssignment, WorkSite, WorkSchedule
from app.schemas import AssignScheduleIn, EmployeeCreate, EmployeeOut

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=list[EmployeeOut])
def list_employees(
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
) -> list[Employee]:
    return db.query(Employee).filter(Employee.company_id == company.id).order_by(Employee.display_name).all()


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(
    body: EmployeeCreate,
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
) -> Employee:
    if body.default_work_site_id:
        site = db.get(WorkSite, body.default_work_site_id)
        if not site or site.company_id != company.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid work site")
    emp = Employee(
        company_id=company.id,
        display_name=body.display_name.strip(),
        phone_e164=body.phone_e164,
        pin_hash=hash_password(body.pin),
        default_work_site_id=body.default_work_site_id,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.put("/{employee_id}/schedule", response_model=dict)
def assign_schedule(
    employee_id: str,
    body: AssignScheduleIn,
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
) -> dict:
    emp = db.get(Employee, employee_id)
    if not emp or emp.company_id != company.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    ws = db.get(WorkSchedule, body.work_schedule_id)
    if not ws or ws.company_id != company.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid schedule")
    row = EmployeeScheduleAssignment(
        employee_id=emp.id,
        work_schedule_id=ws.id,
        effective_from=body.effective_from,
        effective_to=body.effective_to,
    )
    db.add(row)
    db.commit()
    return {"ok": True, "assignment_id": row.id}

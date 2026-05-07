from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import hash_password
from app.deps import get_current_company, get_current_employer
from app.models import Company, Employee, EmployeeScheduleAssignment, EmployerUser, WorkSite, WorkSchedule
from app.schemas import AssignScheduleIn, EmployeeCreate, EmployeeOut, EmployeePatchIn
from app.services.audit_log import write_audit
from app.services.auth_magic import build_magic_token
from app.services.redis_client import get_redis
from app.services.smtp_email import send_plain_email, smtp_configured

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
    employer: Annotated[EmployerUser, Depends(get_current_employer)],
    db: Session = Depends(get_db),
) -> Employee:
    if body.default_work_site_id:
        site = db.get(WorkSite, body.default_work_site_id)
        if not site or site.company_id != company.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid work site")
    emp = Employee(
        company_id=company.id,
        display_name=body.display_name.strip(),
        email=str(body.email) if body.email else None,
        phone_e164=body.phone_e164,
        pin_hash=hash_password(body.pin),
        default_work_site_id=body.default_work_site_id,
        notify_email=body.notify_email,
        notify_whatsapp=body.notify_whatsapp,
    )
    db.add(emp)
    db.flush()
    write_audit(
        db,
        company_id=company.id,
        actor_type="employer",
        actor_id=employer.id,
        action="employee.create",
        entity_type="employee",
        entity_id=emp.id,
        meta={"display_name": emp.display_name},
    )
    db.commit()
    db.refresh(emp)
    return emp


@router.patch("/{employee_id}", response_model=EmployeeOut)
def patch_employee(
    employee_id: str,
    body: EmployeePatchIn,
    company: Annotated[Company, Depends(get_current_company)],
    employer: Annotated[EmployerUser, Depends(get_current_employer)],
    db: Session = Depends(get_db),
) -> Employee:
    emp = db.get(Employee, employee_id)
    if not emp or emp.company_id != company.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    if body.can_show_controller_ui is not None:
        emp.can_show_controller_ui = body.can_show_controller_ui
    write_audit(
        db,
        company_id=company.id,
        actor_type="employer",
        actor_id=employer.id,
        action="employee.patch",
        entity_type="employee",
        entity_id=emp.id,
        meta={"can_show_controller_ui": body.can_show_controller_ui},
    )
    db.commit()
    db.refresh(emp)
    return emp


@router.post("/{employee_id}/send-login-link")
def send_employee_login_link(
    employee_id: str,
    company: Annotated[Company, Depends(get_current_company)],
    employer: Annotated[EmployerUser, Depends(get_current_employer)],
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if get_redis() is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Magic link requires Redis")
    if not smtp_configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Magic link requires SMTP")
    emp = db.get(Employee, employee_id)
    if not emp or emp.company_id != company.id or not emp.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    if not emp.email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Employee has no email")
    try:
        token, _jti = build_magic_token(emp.id, company.id)
    except RuntimeError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from e
    settings = get_settings()
    base = settings.public_app_url.rstrip("/")
    link = f"{base}/employee/magic?token={token}"
    send_plain_email(
        emp.email,
        "Lien de connexion Presence",
        f"Bonjour {emp.display_name},\n\nOuvrez ce lien pour vous connecter (usage unique, court délai):\n{link}\n",
    )
    write_audit(
        db,
        company_id=company.id,
        actor_type="employer",
        actor_id=employer.id,
        action="employee.send_login_link",
        entity_type="employee",
        entity_id=emp.id,
        meta=None,
    )
    db.commit()
    return {"ok": True}


@router.put("/{employee_id}/schedule", response_model=dict)
def assign_schedule(
    employee_id: str,
    body: AssignScheduleIn,
    company: Annotated[Company, Depends(get_current_company)],
    employer: Annotated[EmployerUser, Depends(get_current_employer)],
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
    db.flush()
    write_audit(
        db,
        company_id=company.id,
        actor_type="employer",
        actor_id=employer.id,
        action="employee.assign_schedule",
        entity_type="employee",
        entity_id=emp.id,
        meta={"work_schedule_id": ws.id, "assignment_id": row.id},
    )
    db.commit()
    return {"ok": True, "assignment_id": row.id}

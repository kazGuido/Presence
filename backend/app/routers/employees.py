from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import hash_password
from app.deps import get_current_company, get_current_employer
from app.models import Company, Employee, EmployeeScheduleAssignment, EmployerUser, WorkSite, WorkSchedule
from app.schemas import (
    AssignScheduleIn,
    EmployeeBatchCreateIn,
    EmployeeBatchCreateOut,
    EmployeeBatchCreatedOut,
    EmployeeCreate,
    EmployeeInviteStatusOut,
    EmployeeOut,
    EmployeePatchIn,
)
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


def _validate_default_site(db: Session, company_id: str, work_site_id: str | None) -> None:
    if not work_site_id:
        return
    site = db.get(WorkSite, work_site_id)
    if not site or site.company_id != company_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid work site")


def _build_employee(company_id: str, body: EmployeeCreate) -> Employee:
    display_name = body.display_name.strip()
    if not display_name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Employee name is required")
    return Employee(
        company_id=company_id,
        display_name=display_name,
        email=str(body.email).lower() if body.email else None,
        phone_e164=body.phone_e164.strip() if body.phone_e164 else None,
        pin_hash=hash_password(body.pin),
        default_work_site_id=body.default_work_site_id,
        notify_email=body.notify_email,
        notify_whatsapp=body.notify_whatsapp,
        notify_push=body.notify_push,
    )


def _invite_status(
    *,
    db: Session,
    company: Company,
    employer: EmployerUser,
    employee: Employee,
    strict: bool,
) -> EmployeeInviteStatusOut:
    if not employee.email:
        return EmployeeInviteStatusOut(sent=False, message="Employee has no email")
    if get_redis() is None:
        if strict:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Magic link requires Redis")
        return EmployeeInviteStatusOut(sent=False, message="Magic link requires Redis")
    if not smtp_configured():
        if strict:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Magic link requires SMTP")
        return EmployeeInviteStatusOut(sent=False, message="Magic link requires SMTP")
    try:
        token, _jti = build_magic_token(employee.id, company.id)
    except RuntimeError as e:
        if strict:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from e
        return EmployeeInviteStatusOut(sent=False, message=str(e))
    settings = get_settings()
    base = settings.public_app_url.rstrip("/")
    link = f"{base}/employee/magic?token={token}"
    login_url = f"{base}/employee/login"
    body = (
        f"Bonjour {employee.display_name},\n\n"
        f"Votre espace Presence est pret pour {company.name}.\n\n"
        f"Connexion rapide (lien a usage unique):\n{link}\n\n"
        f"Connexion manuelle:\n{login_url}\n"
        f"Entreprise: {company.slug}\n"
        f"ID employe: {employee.id}\n\n"
        "Si le lien a expire, demandez un nouveau lien a votre responsable.\n"
    )
    try:
        send_plain_email(employee.email, f"Invitation Presence - {company.name}", body)
    except ValueError as e:
        if strict:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from e
        return EmployeeInviteStatusOut(sent=False, message=str(e))
    write_audit(
        db,
        company_id=company.id,
        actor_type="employer",
        actor_id=employer.id,
        action="employee.invite",
        entity_type="employee",
        entity_id=employee.id,
        meta={"email": employee.email, "channel": "email"},
    )
    return EmployeeInviteStatusOut(sent=True, channel="email", message="Invitation sent")


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(
    body: EmployeeCreate,
    company: Annotated[Company, Depends(get_current_company)],
    employer: Annotated[EmployerUser, Depends(get_current_employer)],
    db: Session = Depends(get_db),
) -> Employee:
    _validate_default_site(db, company.id, body.default_work_site_id)
    emp = _build_employee(company.id, body)
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


@router.post("/batch", response_model=EmployeeBatchCreateOut, status_code=status.HTTP_201_CREATED)
def batch_create_employees(
    body: EmployeeBatchCreateIn,
    company: Annotated[Company, Depends(get_current_company)],
    employer: Annotated[EmployerUser, Depends(get_current_employer)],
    db: Session = Depends(get_db),
) -> EmployeeBatchCreateOut:
    for item in body.employees:
        _validate_default_site(db, company.id, item.default_work_site_id)

    created: list[EmployeeBatchCreatedOut] = []
    for item in body.employees:
        emp = _build_employee(company.id, item)
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
            meta={"display_name": emp.display_name, "source": "batch"},
        )
        invite = (
            _invite_status(db=db, company=company, employer=employer, employee=emp, strict=False)
            if body.send_invites
            else EmployeeInviteStatusOut(sent=False, message="Invitation disabled")
        )
        created.append(EmployeeBatchCreatedOut(employee=EmployeeOut.model_validate(emp), invite=invite))

    db.commit()
    return EmployeeBatchCreateOut(created=created)


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
    emp = db.get(Employee, employee_id)
    if not emp or emp.company_id != company.id or not emp.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    _invite_status(db=db, company=company, employer=employer, employee=emp, strict=True)
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

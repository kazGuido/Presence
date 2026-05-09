from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_employee
from app.models import Employee
from app.services.redis_client import get_redis
from app.services.smtp_email import send_plain_email, smtp_configured
from app.services.verification_codes import issue_code, verify_code
from app.core.config import get_settings
from app.services.audit_log import write_audit
from app.services.whatsapp_bridge import send_whatsapp_text

router = APIRouter(prefix="/employee/communication", tags=["employee-communication"])


class CommunicationOut(BaseModel):
    email: str | None
    phone_e164: str | None
    notify_email: bool
    notify_whatsapp: bool
    notify_push: bool = True
    email_verified: bool
    whatsapp_verified: bool
    can_show_controller_ui: bool = False


class CommunicationUpdate(BaseModel):
    notify_email: bool | None = None
    notify_whatsapp: bool | None = None
    notify_push: bool | None = None
    email: EmailStr | None = None


class VerifyRequestIn(BaseModel):
    channel: Literal["email", "whatsapp"]


class VerifyConfirmIn(BaseModel):
    channel: Literal["email", "whatsapp"]
    code: str = Field(min_length=4, max_length=8)


def _out(emp: Employee) -> CommunicationOut:
    return CommunicationOut(
        email=emp.email,
        phone_e164=emp.phone_e164,
        notify_email=emp.notify_email,
        notify_whatsapp=emp.notify_whatsapp,
        notify_push=bool(getattr(emp, "notify_push", True)),
        email_verified=emp.email_verified_at is not None,
        whatsapp_verified=emp.whatsapp_verified_at is not None,
        can_show_controller_ui=bool(getattr(emp, "can_show_controller_ui", False)),
    )


def _require_redis() -> None:
    if get_redis() is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Verification codes require Redis (REDIS_URL).",
        )


@router.get("/me", response_model=CommunicationOut)
def get_communication(
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> CommunicationOut:
    return _out(employee)


@router.put("/me", response_model=CommunicationOut)
def update_communication(
    body: CommunicationUpdate,
    employee: Annotated[Employee, Depends(get_current_employee)],
    db: Session = Depends(get_db),
) -> CommunicationOut:
    if body.notify_email is not None:
        employee.notify_email = body.notify_email
    if body.notify_whatsapp is not None:
        employee.notify_whatsapp = body.notify_whatsapp
    if body.notify_push is not None:
        employee.notify_push = body.notify_push
    if body.email is not None:
        if body.email != employee.email:
            employee.email = body.email
            employee.email_verified_at = None
    db.add(employee)
    write_audit(
        db,
        company_id=employee.company_id,
        actor_type="employee",
        actor_id=employee.id,
        action="employee.communication.update",
        entity_type="employee",
        entity_id=employee.id,
        meta={
            "notify_email": body.notify_email,
            "notify_whatsapp": body.notify_whatsapp,
            "notify_push": body.notify_push,
            "email_changed": body.email is not None,
        },
    )
    db.commit()
    db.refresh(employee)
    return _out(employee)


@router.post("/verify/request")
def request_verify(
    body: VerifyRequestIn,
    employee: Annotated[Employee, Depends(get_current_employee)],
    db: Session = Depends(get_db),
) -> dict[str, str]:
    _require_redis()
    if body.channel == "email":
        if not employee.email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No email on file")
        if not smtp_configured():
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Email delivery is not configured")
        code = issue_code(employee.id, "email")
        send_plain_email(
            employee.email,
            "Code de vérification",
            f"Votre code de vérification: {code}\n\nCe code expire dans 15 minutes.",
        )
        write_audit(
            db,
            company_id=employee.company_id,
            actor_type="employee",
            actor_id=employee.id,
            action="employee.verification.request",
            entity_type="employee",
            entity_id=employee.id,
            meta={"channel": "email"},
        )
        db.commit()
        return {"ok": True, "channel": "email"}
    if not employee.phone_e164:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No phone on file")
    s = get_settings()
    if not s.whatsapp_bridge_url or not s.whatsapp_bridge_secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "WhatsApp bridge is not configured")
    code = issue_code(employee.id, "whatsapp")
    send_whatsapp_text(
        employee.phone_e164,
        f"Votre code de vérification: {code} (valide 15 minutes).",
        company_id=employee.company_id,
    )
    write_audit(
        db,
        company_id=employee.company_id,
        actor_type="employee",
        actor_id=employee.id,
        action="employee.verification.request",
        entity_type="employee",
        entity_id=employee.id,
        meta={"channel": "whatsapp"},
    )
    db.commit()
    return {"ok": True, "channel": "whatsapp"}


@router.post("/verify/confirm", response_model=CommunicationOut)
def confirm_verify(
    body: VerifyConfirmIn,
    employee: Annotated[Employee, Depends(get_current_employee)],
    db: Session = Depends(get_db),
) -> CommunicationOut:
    _require_redis()
    if not verify_code(employee.id, body.channel, body.code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired code")
    now = datetime.now(timezone.utc)
    if body.channel == "email":
        employee.email_verified_at = now
    else:
        employee.whatsapp_verified_at = now
    db.add(employee)
    write_audit(
        db,
        company_id=employee.company_id,
        actor_type="employee",
        actor_id=employee.id,
        action="employee.verification.confirm",
        entity_type="employee",
        entity_id=employee.id,
        meta={"channel": body.channel},
    )
    db.commit()
    db.refresh(employee)
    return _out(employee)

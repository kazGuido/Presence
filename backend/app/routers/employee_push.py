from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_employee
from app.models import Employee, EmployeePushDevice

router = APIRouter(prefix="/employee/push", tags=["employee-push"])


class PushRegisterIn(BaseModel):
    token: str = Field(min_length=20, max_length=4096)
    platform: Literal["android", "ios", "web"] = "android"


class PushUnregisterIn(BaseModel):
    token: str = Field(min_length=20, max_length=4096)


@router.post("/register", status_code=status.HTTP_204_NO_CONTENT)
def register_device(
    body: PushRegisterIn,
    employee: Annotated[Employee, Depends(get_current_employee)],
    db: Session = Depends(get_db),
) -> None:
    now = datetime.now(timezone.utc)
    existing = db.query(EmployeePushDevice).filter(EmployeePushDevice.fcm_token == body.token).first()
    if existing:
        if existing.employee_id != employee.id:
            db.delete(existing)
            db.commit()
        else:
            existing.platform = body.platform
            existing.last_seen_at = now
            db.add(existing)
            db.commit()
            return
    row = EmployeePushDevice(
        employee_id=employee.id,
        fcm_token=body.token,
        platform=body.platform,
        last_seen_at=now,
    )
    db.add(row)
    db.commit()


@router.delete("/register", status_code=status.HTTP_204_NO_CONTENT)
def unregister_device(
    body: PushUnregisterIn,
    employee: Annotated[Employee, Depends(get_current_employee)],
    db: Session = Depends(get_db),
) -> None:
    row = (
        db.query(EmployeePushDevice)
        .filter(
            EmployeePushDevice.fcm_token == body.token,
            EmployeePushDevice.employee_id == employee.id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Token not found")
    db.delete(row)
    db.commit()

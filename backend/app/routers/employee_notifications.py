from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_employee
from app.models import Employee, EmployeeNotification
from app.schemas import EmployeeNotificationOut

router = APIRouter(prefix="/employee/notifications", tags=["employee-notifications"])


@router.get("", response_model=list[EmployeeNotificationOut])
def list_my_notifications(
    employee: Annotated[Employee, Depends(get_current_employee)],
    db: Session = Depends(get_db),
    unread_only: bool = False,
    limit: int = 50,
) -> list[EmployeeNotification]:
    q = db.query(EmployeeNotification).filter(EmployeeNotification.employee_id == employee.id)
    if unread_only:
        q = q.filter(EmployeeNotification.read_at.is_(None))
    return q.order_by(EmployeeNotification.created_at.desc()).limit(min(limit, 200)).all()


@router.post("/{notification_id}/read", response_model=EmployeeNotificationOut)
def mark_notification_read(
    notification_id: str,
    employee: Annotated[Employee, Depends(get_current_employee)],
    db: Session = Depends(get_db),
) -> EmployeeNotification:
    row = db.get(EmployeeNotification, notification_id)
    if not row or row.employee_id != employee.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    if row.read_at is None:
        row.read_at = datetime.now(timezone.utc)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row

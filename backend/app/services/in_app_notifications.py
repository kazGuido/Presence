from sqlalchemy.orm import Session

from app.models import EmployeeNotification


def create_employee_notification(
    db: Session,
    *,
    company_id: str,
    employee_id: str,
    title: str,
    body: str,
    kind: str = "info",
    entity_type: str | None = None,
    entity_id: str | None = None,
) -> EmployeeNotification:
    row = EmployeeNotification(
        company_id=company_id,
        employee_id=employee_id,
        title=title,
        body=body,
        kind=kind,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(row)
    return row

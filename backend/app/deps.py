from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models import Company, Employee, EmployerUser

security = HTTPBearer(auto_error=False)


def get_current_employer(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> EmployerUser:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(creds.credentials)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    if payload.get("typ") != "employer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Employer token required")
    uid = payload.get("sub")
    if not uid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.get(EmployerUser, uid)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def get_current_company(
    employer: Annotated[EmployerUser, Depends(get_current_employer)],
    db: Annotated[Session, Depends(get_db)],
) -> Company:
    c = db.get(Company, employer.company_id)
    if not c:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Company missing")
    return c


def get_current_employee(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> Employee:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(creds.credentials)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    if payload.get("typ") != "employee":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Employee token required")
    eid = payload.get("sub")
    if not eid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    emp = db.get(Employee, eid)
    if not emp or not emp.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Employee not found")
    return emp


def get_employee_company(
    employee: Annotated[Employee, Depends(get_current_employee)],
    db: Annotated[Session, Depends(get_db)],
) -> Company:
    c = db.get(Company, employee.company_id)
    if not c:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Company missing")
    return c


def get_current_super_admin(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> dict[str, str]:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(creds.credentials)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    if payload.get("typ") != "super_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Super admin token required")
    settings = get_settings()
    email = str(payload.get("email") or "").lower()
    if not settings.super_admin_email or email != settings.super_admin_email.lower():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Super admin not configured")
    return {"email": email}

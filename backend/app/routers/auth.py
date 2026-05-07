import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Company, Employee, EmployerUser
from app.schemas import EmployeeLoginIn, LoginIn, RegisterIn, TokenOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower().strip()).strip("-")
    return s or "company"


@router.post("/register", response_model=TokenOut)
def register(body: RegisterIn, db: Session = Depends(get_db)) -> TokenOut:
    if db.query(EmployerUser).filter(EmployerUser.email == body.employer_email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")
    base = _slugify(body.company_name)
    slug = base
    n = 0
    while db.query(Company).filter(Company.slug == slug).first():
        n += 1
        slug = f"{base}-{n}"
    company = Company(name=body.company_name.strip(), slug=slug)
    db.add(company)
    db.flush()
    user = EmployerUser(
        company_id=company.id,
        email=str(body.employer_email).lower(),
        password_hash=hash_password(body.password),
        name=body.employer_name.strip(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(
        {"sub": user.id, "typ": "employer", "company_id": company.id, "email": user.email}
    )
    return TokenOut(access_token=token)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    user = db.query(EmployerUser).filter(EmployerUser.email == str(body.email).lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    token = create_access_token(
        {"sub": user.id, "typ": "employer", "company_id": user.company_id, "email": user.email}
    )
    return TokenOut(access_token=token)


@router.post("/employee-login", response_model=TokenOut)
def employee_login(body: EmployeeLoginIn, db: Session = Depends(get_db)) -> TokenOut:
    company = db.query(Company).filter(Company.slug == body.company_slug.strip().lower()).first()
    if not company:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid company or credentials")
    emp = db.get(Employee, body.employee_id)
    if not emp or emp.company_id != company.id or not emp.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid company or credentials")
    if not verify_password(body.pin, emp.pin_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid company or credentials")
    token = create_access_token(
        {
            "sub": emp.id,
            "typ": "employee",
            "company_id": company.id,
            "employee_id": emp.id,
        }
    )
    return TokenOut(access_token=token)

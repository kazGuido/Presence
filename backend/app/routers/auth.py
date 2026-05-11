import re
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Company, Employee, EmployerUser
from app.schemas import (
    EmployeeLoginIn,
    EmployeeMagicConsumeIn,
    EmployeeMagicRequestIn,
    EmployeeOtpRequestIn,
    EmployeeOtpVerifyIn,
    LoginIn,
    RegisterIn,
    TokenOut,
)
from app.services.auth_magic import build_magic_token, verify_magic_token_and_consume
from app.services.audit_log import write_audit
from app.services.redis_client import get_redis
from app.services.smtp_email import send_plain_email, smtp_configured
from app.services.verification_codes import issue_code, verify_code

router = APIRouter(prefix="/auth", tags=["auth"])

_otp_ip_bucket: dict[str, list[float]] = defaultdict(list)
_REQUEST_WINDOW_SEC = 3600
_REQUEST_MAX_PER_WINDOW = 8


def _auth_request_throttle(ip: str) -> None:
    now = time.time()
    bucket = _otp_ip_bucket[ip]
    bucket[:] = [t for t in bucket if now - t < _REQUEST_WINDOW_SEC]
    if len(bucket) >= _REQUEST_MAX_PER_WINDOW:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests")
    bucket.append(now)


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
    db.flush()
    write_audit(
        db,
        company_id=company.id,
        actor_type="employer",
        actor_id=user.id,
        action="employer.register",
        entity_type="company",
        entity_id=company.id,
        meta={"email": user.email},
    )
    db.commit()
    db.refresh(user)
    token = create_access_token(
        {"sub": user.id, "typ": "employer", "company_id": company.id, "email": user.email}
    )
    return TokenOut(access_token=token)


def _request_meta(request: Request) -> dict[str, str | None]:
    return {
        "ip": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
    }


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)) -> TokenOut:
    user = db.query(EmployerUser).filter(EmployerUser.email == str(body.email).lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        if user:
            write_audit(
                db,
                company_id=user.company_id,
                actor_type="employer",
                actor_id=user.id,
                action="auth.login_failed",
                entity_type="employer",
                entity_id=user.id,
                meta=_request_meta(request),
            )
            db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    write_audit(
        db,
        company_id=user.company_id,
        actor_type="employer",
        actor_id=user.id,
        action="auth.login",
        entity_type="employer",
        entity_id=user.id,
        meta=_request_meta(request),
    )
    db.commit()
    token = create_access_token(
        {"sub": user.id, "typ": "employer", "company_id": user.company_id, "email": user.email}
    )
    return TokenOut(access_token=token)


@router.post("/employee-login", response_model=TokenOut)
def employee_login(body: EmployeeLoginIn, request: Request, db: Session = Depends(get_db)) -> TokenOut:
    company = db.query(Company).filter(Company.slug == body.company_slug.strip().lower()).first()
    if not company:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid company or credentials")
    emp = db.get(Employee, body.employee_id)
    if not emp or emp.company_id != company.id or not emp.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid company or credentials")
    if not verify_password(body.password_value(), emp.pin_hash):
        write_audit(
            db,
            company_id=company.id,
            actor_type="employee",
            actor_id=emp.id,
            action="auth.employee_login_failed",
            entity_type="employee",
            entity_id=emp.id,
            meta=_request_meta(request),
        )
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid company or credentials")
    write_audit(
        db,
        company_id=company.id,
        actor_type="employee",
        actor_id=emp.id,
        action="auth.employee_login",
        entity_type="employee",
        entity_id=emp.id,
        meta=_request_meta(request),
    )
    db.commit()
    token = create_access_token(
        {
            "sub": emp.id,
            "typ": "employee",
            "company_id": company.id,
            "employee_id": emp.id,
        }
    )
    return TokenOut(access_token=token)


@router.post("/employee-magic/request")
def employee_magic_request(
    body: EmployeeMagicRequestIn,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    if get_redis() is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Magic link requires Redis")
    if not smtp_configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Magic link requires SMTP")
    _auth_request_throttle(request.client.host if request.client else "unknown")

    company = db.query(Company).filter(Company.slug == body.company_slug.strip().lower()).first()
    if not company:
        return {"ok": True}
    emp = db.get(Employee, body.employee_id)
    if not emp or emp.company_id != company.id or not emp.active or not emp.email:
        return {"ok": True}

    try:
        token, _jti = build_magic_token(emp.id, company.id)
    except RuntimeError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from e

    settings = get_settings()
    base = settings.public_app_url.rstrip("/")
    link = f"{base}/employee/magic?token={token}"
    try:
        send_plain_email(
            emp.email,
            f"Your Presence sign-in link - {company.name}",
            (
                f"Hello {emp.display_name},\n\n"
                f"Open this one-time link to sign in to Presence:\n{link}\n\n"
                "If you did not request this, you can ignore this email.\n"
            ),
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from e
    write_audit(
        db,
        company_id=company.id,
        actor_type="employee",
        actor_id=emp.id,
        action="auth.employee_magic_request",
        entity_type="employee",
        entity_id=emp.id,
        meta=_request_meta(request),
    )
    db.commit()
    return {"ok": True}


@router.post("/employee-magic/consume", response_model=TokenOut)
def employee_magic_consume(
    body: EmployeeMagicConsumeIn,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenOut:
    try:
        payload = verify_magic_token_and_consume(body.token.strip())
    except ValueError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e)) from e
    eid = str(payload.get("sub") or "")
    cid = str(payload.get("company_id") or "")
    emp = db.get(Employee, eid)
    if not emp or not emp.active or emp.company_id != cid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid employee")
    write_audit(
        db,
        company_id=emp.company_id,
        actor_type="employee",
        actor_id=emp.id,
        action="auth.employee_magic_login",
        entity_type="employee",
        entity_id=emp.id,
        meta=_request_meta(request),
    )
    db.commit()
    token = create_access_token(
        {
            "sub": emp.id,
            "typ": "employee",
            "company_id": emp.company_id,
            "employee_id": emp.id,
        }
    )
    return TokenOut(access_token=token)


@router.post("/employee-otp/request")
def employee_otp_request(
    body: EmployeeOtpRequestIn,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if get_redis() is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "OTP requires Redis")
    if not smtp_configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "OTP email requires SMTP")
    _auth_request_throttle(request.client.host if request.client else "unknown")

    company = db.query(Company).filter(Company.slug == body.company_slug.strip().lower()).first()
    if not company:
        return {"ok": True}
    emp = db.get(Employee, body.employee_id)
    if not emp or emp.company_id != company.id or not emp.active or not emp.email:
        return {"ok": True}
    code = issue_code(emp.id, "employee_otp_email", ttl_seconds=600)
    try:
        send_plain_email(
            emp.email,
            "Votre code de connexion Presence",
            f"Votre code: {code}\n\nIl expire dans 10 minutes.",
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from e
    return {"ok": True}


@router.post("/employee-otp/verify", response_model=TokenOut)
def employee_otp_verify(body: EmployeeOtpVerifyIn, db: Session = Depends(get_db)) -> TokenOut:
    if get_redis() is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "OTP requires Redis")
    company = db.query(Company).filter(Company.slug == body.company_slug.strip().lower()).first()
    if not company:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid code")
    emp = db.get(Employee, body.employee_id)
    if not emp or emp.company_id != company.id or not emp.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid code")
    if not verify_code(emp.id, "employee_otp_email", body.code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid code")
    token = create_access_token(
        {
            "sub": emp.id,
            "typ": "employee",
            "company_id": emp.company_id,
            "employee_id": emp.id,
        }
    )
    return TokenOut(access_token=token)

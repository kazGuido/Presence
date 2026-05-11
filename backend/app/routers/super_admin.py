from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.deps import get_current_super_admin
from app.services.platform_observability import build_platform_overview, send_weekly_platform_report

router = APIRouter(prefix="/super-admin", tags=["super-admin"])


@router.get("/overview")
def overview(
    _admin: Annotated[dict[str, str], Depends(get_current_super_admin)],
    db: Session = Depends(get_db),
) -> dict:
    return build_platform_overview(db)


@router.get("/report-config")
def report_config(
    _admin: Annotated[dict[str, str], Depends(get_current_super_admin)],
) -> dict:
    settings = get_settings()
    return {
        "enabled": settings.super_admin_weekly_report_enabled,
        "recipients": settings.super_admin_report_recipient_list,
        "weekday": settings.super_admin_weekly_report_weekday,
        "hour_utc": settings.super_admin_weekly_report_hour_utc,
        "smtp_configured": bool(settings.smtp_host and settings.smtp_from_email),
    }


@router.post("/weekly-report/send")
def send_report_now(
    _admin: Annotated[dict[str, str], Depends(get_current_super_admin)],
    db: Session = Depends(get_db),
) -> dict:
    result = send_weekly_platform_report(db)
    if result.get("skipped") == "no_recipients":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No super admin report recipients configured")
    if result.get("skipped") == "smtp_not_configured":
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "SMTP is not configured")
    return result

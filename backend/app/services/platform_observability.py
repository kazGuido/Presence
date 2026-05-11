from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import (
    AttendanceSession,
    AttendanceSessionStatus,
    AuditEvent,
    Company,
    Employee,
    EmployerUser,
    GeofenceReviewStatus,
    Punch,
    WorkSite,
    WorkSchedule,
)
from app.services.redis_client import get_redis
from app.services.smtp_email import send_plain_email, smtp_configured


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def build_platform_overview(db: Session) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)
    since_7d = now - timedelta(days=7)

    companies = db.query(Company).count()
    employees_total = db.query(Employee).count()
    employees_active = db.query(Employee).filter(Employee.active.is_(True)).count()
    punches_24h = db.query(Punch).filter(Punch.at >= since_24h).count()
    punches_7d = db.query(Punch).filter(Punch.at >= since_7d).count()
    geofence_pending = (
        db.query(Punch)
        .filter(Punch.geofence_review_status == GeofenceReviewStatus.pending)
        .count()
    )
    photo_only_7d = (
        db.query(Punch)
        .filter(Punch.at >= since_7d, Punch.photo_only_attestation.is_(True))
        .count()
    )
    out_of_geofence_7d = (
        db.query(Punch)
        .filter(Punch.at >= since_7d, Punch.within_geofence.is_(False))
        .count()
    )
    sessions_pending = (
        db.query(AttendanceSession)
        .filter(AttendanceSession.status == AttendanceSessionStatus.pending)
        .count()
    )

    recent_companies = (
        db.query(Company)
        .order_by(Company.created_at.desc())
        .limit(8)
        .all()
    )
    recent_company_rows: list[dict[str, Any]] = []
    for company in recent_companies:
        recent_company_rows.append(
            {
                "id": company.id,
                "name": company.name,
                "slug": company.slug,
                "created_at": _iso(company.created_at),
                "employees": db.query(Employee).filter(Employee.company_id == company.id).count(),
                "sites": db.query(WorkSite).filter(WorkSite.company_id == company.id).count(),
                "punches_7d": db.query(Punch)
                .filter(Punch.company_id == company.id, Punch.at >= since_7d)
                .count(),
            }
        )

    top_companies = (
        db.query(Company.id, Company.name, Company.slug, func.count(Punch.id).label("punches"))
        .outerjoin(Punch, (Punch.company_id == Company.id) & (Punch.at >= since_7d))
        .group_by(Company.id, Company.name, Company.slug)
        .order_by(func.count(Punch.id).desc(), Company.name.asc())
        .limit(8)
        .all()
    )

    recent_audit = (
        db.query(AuditEvent, Company)
        .join(Company, Company.id == AuditEvent.company_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(12)
        .all()
    )

    settings = get_settings()
    return {
        "generated_at": _iso(now),
        "summary": {
            "companies": companies,
            "employers": db.query(EmployerUser).count(),
            "employees_total": employees_total,
            "employees_active": employees_active,
            "work_sites": db.query(WorkSite).count(),
            "schedules": db.query(WorkSchedule).count(),
            "punches_24h": punches_24h,
            "punches_7d": punches_7d,
            "geofence_pending": geofence_pending,
            "out_of_geofence_7d": out_of_geofence_7d,
            "photo_only_7d": photo_only_7d,
            "sessions_pending": sessions_pending,
            "audit_events_24h": db.query(AuditEvent).filter(AuditEvent.created_at >= since_24h).count(),
        },
        "health": {
            "database": "ok",
            "redis": "ok" if get_redis() is not None else "not_configured",
            "smtp": "ok" if smtp_configured() else "not_configured",
            "minio": "configured" if settings.minio_endpoint else "not_configured",
            "weekly_report": "enabled" if settings.super_admin_weekly_report_enabled else "disabled",
            "weekly_report_recipients": len(settings.super_admin_report_recipient_list),
        },
        "recent_companies": recent_company_rows,
        "top_companies_7d": [
            {"id": row.id, "name": row.name, "slug": row.slug, "punches": int(row.punches)}
            for row in top_companies
        ],
        "recent_audit": [
            {
                "id": audit.id,
                "company": company.name,
                "company_slug": company.slug,
                "actor_type": audit.actor_type,
                "action": audit.action,
                "entity_type": audit.entity_type,
                "created_at": _iso(audit.created_at),
            }
            for audit, company in recent_audit
        ],
    }


def build_weekly_platform_report(db: Session) -> tuple[str, str]:
    overview = build_platform_overview(db)
    summary = overview["summary"]
    health = overview["health"]
    subject = "Presence weekly platform report"
    lines = [
        "Presence weekly platform report",
        f"Generated: {overview['generated_at']}",
        "",
        "Platform summary",
        f"- Companies: {summary['companies']}",
        f"- Employers: {summary['employers']}",
        f"- Active employees: {summary['employees_active']} / {summary['employees_total']}",
        f"- Punches last 24h: {summary['punches_24h']}",
        f"- Punches last 7d: {summary['punches_7d']}",
        f"- Pending geofence reviews: {summary['geofence_pending']}",
        f"- Out-of-geofence punches last 7d: {summary['out_of_geofence_7d']}",
        f"- Photo-only punches last 7d: {summary['photo_only_7d']}",
        "",
        "Health",
        f"- Database: {health['database']}",
        f"- Redis: {health['redis']}",
        f"- SMTP: {health['smtp']}",
        f"- MinIO: {health['minio']}",
        "",
        "Top companies by punches last 7d",
    ]
    for row in overview["top_companies_7d"]:
        lines.append(f"- {row['name']} ({row['slug']}): {row['punches']}")
    if not overview["top_companies_7d"]:
        lines.append("- No company activity yet")
    return subject, "\n".join(lines)


def send_weekly_platform_report(db: Session) -> dict[str, Any]:
    settings = get_settings()
    recipients = settings.super_admin_report_recipient_list
    if not recipients:
        return {"sent": 0, "skipped": "no_recipients"}
    if not smtp_configured():
        return {"sent": 0, "skipped": "smtp_not_configured"}
    subject, body = build_weekly_platform_report(db)
    for recipient in recipients:
        send_plain_email(recipient, subject, body)
    return {"sent": len(recipients), "skipped": None}

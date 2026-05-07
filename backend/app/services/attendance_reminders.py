"""Pre-shift attendance link reminders (called from ARQ worker)."""

import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models import (
    Company,
    Employee,
    EmployeeScheduleAssignment,
    PunchKind,
    ScheduledReminderSent,
    WorkScheduleRule,
    WorkSite,
)
from app.services.attendance_notify import send_attendance_link
from app.services.attendance_sessions_core import create_attendance_session
from app.services.punch_logic import punches_for_local_day
from app.core.config import get_settings

logger = logging.getLogger(__name__)

KIND_PRE_SHIFT = "pre_shift_attendance"


def run_scheduled_reminders(db: Session) -> dict[str, int]:
    """Create attendance sessions and notify employees before shift start."""
    settings = get_settings()
    lead = max(1, settings.reminder_lead_minutes)
    checked = 0
    sent = 0
    skipped = 0

    employees = (
        db.query(Employee)
        .filter(Employee.active.is_(True), Employee.default_work_site_id.isnot(None))
        .all()
    )
    for emp in employees:
        checked += 1
        company = db.get(Company, emp.company_id)
        if not company:
            continue
        tz = ZoneInfo(company.timezone)
        now_local = datetime.now(timezone.utc).astimezone(tz)
        local_today = now_local.date()

        if (
            db.query(ScheduledReminderSent)
            .filter(
                ScheduledReminderSent.employee_id == emp.id,
                ScheduledReminderSent.local_date == local_today,
                ScheduledReminderSent.kind == KIND_PRE_SHIFT,
            )
            .first()
        ):
            skipped += 1
            continue

        asg = (
            db.query(EmployeeScheduleAssignment)
            .filter(
                EmployeeScheduleAssignment.employee_id == emp.id,
                EmployeeScheduleAssignment.effective_from <= local_today,
                (
                    EmployeeScheduleAssignment.effective_to.is_(None)
                    | (EmployeeScheduleAssignment.effective_to >= local_today)
                ),
            )
            .order_by(EmployeeScheduleAssignment.effective_from.desc())
            .first()
        )
        if not asg:
            continue

        rule = (
            db.query(WorkScheduleRule)
            .filter(
                WorkScheduleRule.work_schedule_id == asg.work_schedule_id,
                WorkScheduleRule.weekday == local_today.weekday(),
            )
            .first()
        )
        if not rule:
            continue

        shift_start_local = datetime.combine(local_today, rule.start_time, tzinfo=tz)
        reminder_at = shift_start_local - timedelta(minutes=lead)
        window_end = shift_start_local + timedelta(minutes=30)
        if not (reminder_at <= now_local < window_end):
            continue

        day_punches = punches_for_local_day(db, emp.id, local_today, tz)
        if any(p.kind == PunchKind.punch_in for p in day_punches):
            skipped += 1
            continue

        site = db.get(WorkSite, emp.default_work_site_id)
        if not site or site.company_id != company.id:
            continue

        try:
            row, raw = create_attendance_session(
                db,
                company_id=company.id,
                employee_id=emp.id,
                work_site_id=site.id,
                expires_hours=24,
            )
            channels = send_attendance_link(
                emp,
                site.name,
                raw,
                "auto",
                require_verified=True,
                allow_multiple=True,
            )
            db.add(
                ScheduledReminderSent(
                    employee_id=emp.id,
                    company_id=company.id,
                    local_date=local_today,
                    kind=KIND_PRE_SHIFT,
                    attendance_session_id=row.id,
                )
            )
            db.commit()
            sent += 1
            logger.info(
                "Reminder sent employee=%s date=%s channels=%s session=%s",
                emp.id,
                local_today,
                channels,
                row.id,
            )
        except Exception as e:
            db.rollback()
            logger.warning("Reminder skipped employee=%s: %s", emp.id, e)

    return {"checked": checked, "sent": sent, "skipped": skipped}

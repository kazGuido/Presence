from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from app.models import (
    Employee,
    EmployeeScheduleAssignment,
    Punch,
    PunchKind,
    WorkScheduleRule,
)


def _day_window_utc(d: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    start_local = datetime.combine(d, time.min, tzinfo=tz)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def _active_schedule_id(db: Session, employee_id: str, on_day: date) -> str | None:
    q = (
        db.query(EmployeeScheduleAssignment)
        .filter(
            EmployeeScheduleAssignment.employee_id == employee_id,
            EmployeeScheduleAssignment.effective_from <= on_day,
            or_(
                EmployeeScheduleAssignment.effective_to.is_(None),
                EmployeeScheduleAssignment.effective_to >= on_day,
            ),
        )
        .order_by(EmployeeScheduleAssignment.effective_from.desc())
    )
    row = q.first()
    return row.work_schedule_id if row else None


def _expected_window_for_weekday(
    db: Session, schedule_id: str, weekday: int
) -> tuple[time | None, time | None]:
    rule = (
        db.query(WorkScheduleRule)
        .filter(
            WorkScheduleRule.work_schedule_id == schedule_id,
            WorkScheduleRule.weekday == weekday,
        )
        .first()
    )
    if not rule:
        return None, None
    return rule.start_time, rule.end_time


def _combine_local(site_tz: ZoneInfo, d: date, t: time) -> datetime:
    return datetime.combine(d, t, tzinfo=site_tz)


def build_attendance_analytics(
    db: Session,
    company_id: str,
    company_timezone: str,
    date_from: date,
    date_to: date,
    grace_minutes: int = 5,
) -> dict[str, Any]:
    tz = ZoneInfo(company_timezone)
    employees = db.query(Employee).filter(Employee.company_id == company_id, Employee.active.is_(True)).all()
    per_employee: list[dict[str, Any]] = []
    summary = {"employees": 0, "days_flagged": 0, "days_ok": 0}

    for emp in employees:
        days_out: list[dict[str, Any]] = []
        d = date_from
        while d <= date_to:
            start_utc, end_utc = _day_window_utc(d, tz)
            punches = (
                db.query(Punch)
                .filter(
                    Punch.employee_id == emp.id,
                    Punch.at >= start_utc,
                    Punch.at < end_utc,
                )
                .order_by(Punch.at.asc())
                .all()
            )
            first_in = next((p for p in punches if p.kind == PunchKind.punch_in), None)
            last_out = None
            for p in reversed(punches):
                if p.kind == PunchKind.punch_out:
                    last_out = p
                    break
            out_of_geo = any(not p.within_geofence for p in punches)
            location_skipped = any(getattr(p, "photo_only_attestation", False) for p in punches)

            schedule_id = _active_schedule_id(db, emp.id, d)
            missing_in = first_in is None
            missing_out = last_out is None
            late_in = False
            early_out = False
            expected_start: time | None = None
            expected_end: time | None = None

            if schedule_id:
                wd = d.weekday()  # Mon=0
                expected_start, expected_end = _expected_window_for_weekday(db, schedule_id, wd)
                if expected_start and first_in:
                    exp_start_dt = _combine_local(tz, d, expected_start)
                    if first_in.astimezone(tz) > exp_start_dt + timedelta(minutes=grace_minutes):
                        late_in = True
                if expected_end and last_out:
                    exp_end_dt = _combine_local(tz, d, expected_end)
                    if last_out.astimezone(tz) < exp_end_dt - timedelta(minutes=grace_minutes):
                        early_out = True

            flags: list[str] = []
            if missing_in:
                flags.append("missing_in")
            if missing_out:
                flags.append("missing_out")
            if late_in:
                flags.append("late_in")
            if early_out:
                flags.append("early_out")
            if out_of_geo:
                flags.append("out_of_geofence")
            if location_skipped:
                flags.append("location_skipped")

            row = {
                "date": d.isoformat(),
                "employee_id": emp.id,
                "employee_name": emp.display_name,
                "first_punch_in_at": first_in.at.isoformat() if first_in else None,
                "last_punch_out_at": last_out.at.isoformat() if last_out else None,
                "expected_start": expected_start.isoformat() if expected_start else None,
                "expected_end": expected_end.isoformat() if expected_end else None,
                "flags": flags,
            }
            days_out.append(row)
            if flags:
                summary["days_flagged"] += 1
            else:
                summary["days_ok"] += 1
            d += timedelta(days=1)

        per_employee.append({"employee": {"id": emp.id, "name": emp.display_name}, "days": days_out})
        summary["employees"] += 1

    return {"summary": summary, "per_employee": per_employee}

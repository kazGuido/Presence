"""In-app reminder window: scheduled shift start vs local time (employee punch state)."""

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models import PunchKind
from app.services.analytics_service import _active_schedule_id, _expected_window_for_weekday


def clock_in_reminder_fields(
    db: Session,
    employee_id: str,
    tz: ZoneInfo,
    local_day: date,
    next_kind: PunchKind,
) -> tuple[str | None, bool]:
    """
    If the employee still owes a punch_in today and has a schedule rule for this weekday,
    return (expected_start "HH:MM", show_reminder) when local time is within the nudge window.
    """
    if next_kind != PunchKind.punch_in:
        return None, False
    schedule_id = _active_schedule_id(db, employee_id, local_day)
    if not schedule_id:
        return None, False
    wd = local_day.weekday()
    start_t, end_t = _expected_window_for_weekday(db, schedule_id, wd)
    if not start_t:
        return None, False

    now_local = datetime.now(timezone.utc).astimezone(tz)
    start_dt = datetime.combine(local_day, start_t, tzinfo=tz)
    lead = timedelta(minutes=15)
    window_end = start_dt + timedelta(hours=4)
    if end_t:
        end_dt = datetime.combine(local_day, end_t, tzinfo=tz)
        if end_dt <= start_dt:
            end_dt = end_dt + timedelta(days=1)
        window_end = min(window_end, end_dt + timedelta(minutes=30))

    show = (start_dt - lead) <= now_local < window_end
    display = start_t.strftime("%H:%M")
    return display, show

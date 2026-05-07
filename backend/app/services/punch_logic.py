from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models import Punch, PunchKind


def day_bounds_utc(for_local_day: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    start_local = datetime.combine(for_local_day, time.min, tzinfo=tz)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def punches_for_local_day(db: Session, employee_id: str, local_day: date, tz: ZoneInfo) -> list[Punch]:
    start_utc, end_utc = day_bounds_utc(local_day, tz)
    return (
        db.query(Punch)
        .filter(Punch.employee_id == employee_id, Punch.at >= start_utc, Punch.at < end_utc)
        .order_by(Punch.at.asc())
        .all()
    )


def next_required_kind(punches: list[Punch]) -> PunchKind:
    if not punches:
        return PunchKind.punch_in
    return (
        PunchKind.punch_out
        if punches[-1].kind == PunchKind.punch_in
        else PunchKind.punch_in
    )


def today_local_date(tz: ZoneInfo) -> date:
    return datetime.now(timezone.utc).astimezone(tz).date()

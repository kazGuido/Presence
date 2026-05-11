import asyncio
import logging
import os

from arq import cron
from arq.connections import RedisSettings

logger = logging.getLogger(__name__)
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))


async def run_reminders(ctx: dict) -> None:
    from app.core.database import SessionLocal
    from app.services.attendance_reminders import run_scheduled_reminders

    def _job() -> dict[str, int]:
        db = SessionLocal()
        try:
            return run_scheduled_reminders(db)
        finally:
            db.close()

    stats = await asyncio.to_thread(_job)
    logger.info("attendance reminders: %s", stats)


async def run_weekly_platform_report(ctx: dict) -> None:
    from app.core.config import get_settings
    from app.core.database import SessionLocal
    from app.services.platform_observability import send_weekly_platform_report

    settings = get_settings()
    if not settings.super_admin_weekly_report_enabled:
        logger.info("weekly platform report disabled")
        return

    def _job() -> dict:
        db = SessionLocal()
        try:
            return send_weekly_platform_report(db)
        finally:
            db.close()

    stats = await asyncio.to_thread(_job)
    logger.info("weekly platform report: %s", stats)


def _weekly_report_cron() -> dict:
    from app.core.config import get_settings

    settings = get_settings()
    weekday = min(max(settings.super_admin_weekly_report_weekday, 0), 6)
    hour = min(max(settings.super_admin_weekly_report_hour_utc, 0), 23)
    return {"weekday": {weekday}, "hour": {hour}, "minute": {0}}


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    functions: list = []
    cron_jobs = [
        cron(run_reminders, minute=set(range(0, 60, 5))),
        cron(run_weekly_platform_report, **_weekly_report_cron()),
    ]

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


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    functions: list = []
    cron_jobs = [
        cron(run_reminders, minute=set(range(0, 60, 5))),
    ]

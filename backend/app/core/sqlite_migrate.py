"""Lightweight additive migrations for SQLite (no Alembic in this repo)."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def apply_sqlite_migrations(engine: Engine) -> None:
    if not str(engine.url).startswith("sqlite"):
        return
    insp = inspect(engine)
    if not insp.has_table("employees"):
        return
    cols = {c["name"] for c in insp.get_columns("employees")}
    stmts: list[str] = []
    if "email" not in cols:
        stmts.append("ALTER TABLE employees ADD COLUMN email VARCHAR(255)")
    if "notify_email" not in cols:
        stmts.append("ALTER TABLE employees ADD COLUMN notify_email BOOLEAN DEFAULT 1")
    if "notify_whatsapp" not in cols:
        stmts.append("ALTER TABLE employees ADD COLUMN notify_whatsapp BOOLEAN DEFAULT 1")
    if "email_verified_at" not in cols:
        stmts.append("ALTER TABLE employees ADD COLUMN email_verified_at DATETIME")
    if "whatsapp_verified_at" not in cols:
        stmts.append("ALTER TABLE employees ADD COLUMN whatsapp_verified_at DATETIME")
    if stmts:
        with engine.begin() as conn:
            for s in stmts:
                conn.execute(text(s))

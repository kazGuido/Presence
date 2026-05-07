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
    if "can_show_controller_ui" not in cols:
        stmts.append("ALTER TABLE employees ADD COLUMN can_show_controller_ui BOOLEAN DEFAULT 0")
    if "notify_push" not in cols:
        stmts.append("ALTER TABLE employees ADD COLUMN notify_push BOOLEAN DEFAULT 1")
        with engine.begin() as conn:
            for s in stmts:
                conn.execute(text(s))

    if insp.has_table("punches"):
        pcols = {c["name"] for c in insp.get_columns("punches")}
        pstmts: list[str] = []
        if "photo_only_attestation" not in pcols:
            pstmts.append("ALTER TABLE punches ADD COLUMN photo_only_attestation BOOLEAN DEFAULT 0")
        if pstmts:
            with engine.begin() as conn:
                for s in pstmts:
                    conn.execute(text(s))

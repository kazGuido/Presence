"""Lightweight additive migrations for SQLite (no Alembic in this repo)."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def apply_sqlite_migrations(engine: Engine) -> None:
    if not str(engine.url).startswith("sqlite"):
        return
    insp = inspect(engine)
    if insp.has_table("companies"):
        ccols = {c["name"] for c in insp.get_columns("companies")}
        cstmts: list[str] = []
        if "allow_punch_gps" not in ccols:
            cstmts.append("ALTER TABLE companies ADD COLUMN allow_punch_gps BOOLEAN DEFAULT 1")
        if "allow_punch_photo" not in ccols:
            cstmts.append("ALTER TABLE companies ADD COLUMN allow_punch_photo BOOLEAN DEFAULT 1")
        if "allow_punch_kiosk_scan" not in ccols:
            cstmts.append("ALTER TABLE companies ADD COLUMN allow_punch_kiosk_scan BOOLEAN DEFAULT 1")
        if "allow_kiosk_borne" not in ccols:
            cstmts.append("ALTER TABLE companies ADD COLUMN allow_kiosk_borne BOOLEAN DEFAULT 1")
        if cstmts:
            with engine.begin() as conn:
                for s in cstmts:
                    conn.execute(text(s))

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
    if stmts:
        with engine.begin() as conn:
            for s in stmts:
                conn.execute(text(s))

    if insp.has_table("punches"):
        pcols = {c["name"] for c in insp.get_columns("punches")}
        pstmts: list[str] = []
        if "photo_only_attestation" not in pcols:
            pstmts.append("ALTER TABLE punches ADD COLUMN photo_only_attestation BOOLEAN DEFAULT 0")
        if "geofence_review_status" not in pcols:
            pstmts.append("ALTER TABLE punches ADD COLUMN geofence_review_status VARCHAR(32)")
        if "geofence_review_note" not in pcols:
            pstmts.append("ALTER TABLE punches ADD COLUMN geofence_review_note TEXT")
        if "geofence_reviewed_by" not in pcols:
            pstmts.append("ALTER TABLE punches ADD COLUMN geofence_reviewed_by CHAR(36)")
        if "geofence_reviewed_at" not in pcols:
            pstmts.append("ALTER TABLE punches ADD COLUMN geofence_reviewed_at DATETIME")
        if pstmts:
            with engine.begin() as conn:
                for s in pstmts:
                    conn.execute(text(s))

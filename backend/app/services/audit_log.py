"""Append-only audit trail for employer-visible actions."""

from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditEvent


def write_audit(
    db: Session,
    *,
    company_id: str,
    actor_type: str,
    actor_id: str,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditEvent(
            company_id=company_id,
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            meta=meta,
        )
    )

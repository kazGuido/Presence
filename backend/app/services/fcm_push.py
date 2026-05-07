"""Firebase Cloud Messaging HTTP v1 (service account)."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import httpx
from google.auth.transport.requests import Request
from google.oauth2 import service_account
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import EmployeePushDevice

logger = logging.getLogger(__name__)

FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"


def fcm_configured() -> bool:
    s = get_settings()
    return bool(s.fcm_project_id and s.fcm_service_account_file)


def _credentials():
    s = get_settings()
    path = Path(s.fcm_service_account_file).expanduser()
    if not path.is_file():
        raise RuntimeError(f"FCM service account file not found: {path}")
    return service_account.Credentials.from_service_account_file(str(path), scopes=[FCM_SCOPE])


def send_to_fcm_token(
    *,
    fcm_token: str,
    title: str,
    body: str,
    data: dict[str, str],
) -> bool:
    """
    Send a notification+data message. Returns True on success.
    On permanent token failure, raises so caller can drop the device row.
    """
    s = get_settings()
    if not fcm_configured():
        return False
    creds = _credentials()
    creds.refresh(Request())
    path = f"v1/projects/{s.fcm_project_id}/messages:send"
    url = f"https://fcm.googleapis.com/{path}"
    payload = {
        "message": {
            "token": fcm_token,
            "notification": {"title": title, "body": body},
            "data": {k: str(v) for k, v in data.items()},
            "android": {"priority": "HIGH"},
        }
    }
    headers = {"Authorization": f"Bearer {creds.token}", "Content-Type": "application/json; charset=UTF-8"}
    with httpx.Client(timeout=30.0) as client:
        r = client.post(url, headers=headers, json=payload)
    if r.status_code == 200:
        return True
    try:
        err = r.json()
    except Exception:
        err = r.text
    logger.warning("FCM send failed status=%s body=%s", r.status_code, err)
    err_s = json.dumps(err) if isinstance(err, dict) else str(err)
    if r.status_code in (400, 404) and (
        "UNREGISTERED" in err_s or "NOT_FOUND" in err_s or "Registration token" in err_s
    ):
        raise ValueError("invalid_token")
    return False


def try_send_attendance_push(db: Session, employee_id: str, title: str, body: str, raw_token: str) -> int:
    """Send attendance reminder to all registered devices. Returns count delivered."""
    if not fcm_configured():
        return 0
    devices = db.query(EmployeePushDevice).filter(EmployeePushDevice.employee_id == employee_id).all()
    if not devices:
        return 0
    data = {"kind": "attendance_reminder", "path": f"/attend/{raw_token}"}
    ok = 0
    now = datetime.now(timezone.utc)
    for d in devices:
        try:
            if send_to_fcm_token(fcm_token=d.fcm_token, title=title, body=body, data=data):
                d.last_seen_at = now
                ok += 1
        except ValueError:
            db.delete(d)
        except Exception as e:
            logger.warning("FCM device send error employee=%s: %s", employee_id, e)
    db.commit()
    return ok

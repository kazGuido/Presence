from typing import Literal

from app.core.config import get_settings
from app.models import Employee
from app.services.smtp_email import send_plain_email, smtp_configured
from app.services.whatsapp_bridge import send_whatsapp_text

NotifyChannel = Literal["auto", "email", "whatsapp"]


def attendance_public_url(raw_token: str) -> str:
    base = get_settings().public_app_url.rstrip("/")
    return f"{base}/attend/{raw_token}"


def build_attendance_message(display_name: str, site_name: str, raw_token: str) -> str:
    link = attendance_public_url(raw_token)
    return f"Bonjour {display_name}, validez votre présence sur {site_name}: {link}"


def _bridge_configured() -> bool:
    s = get_settings()
    return bool(s.whatsapp_bridge_url and s.whatsapp_bridge_secret)


def send_attendance_link(
    employee: Employee,
    site_name: str,
    raw_token: str,
    channel: NotifyChannel,
    *,
    require_verified: bool,
    allow_multiple: bool = False,
) -> list[str]:
    """
    Deliver the attendance deep link. Returns list of channels used: 'email', 'whatsapp'.

    require_verified: only send to destinations the employee has verified (when strict checks apply).
    allow_multiple: if True and channel is auto, notify every eligible channel; if False, pick email then WhatsApp.
    """
    msg = build_attendance_message(employee.display_name, site_name, raw_token)
    sent: list[str] = []

    def can_email(*, strict: bool) -> bool:
        if not employee.email or not employee.notify_email or not smtp_configured():
            return False
        if strict and not employee.email_verified_at:
            return False
        return True

    def can_whatsapp(*, strict: bool) -> bool:
        if not employee.phone_e164 or not employee.notify_whatsapp or not _bridge_configured():
            return False
        if strict and not employee.whatsapp_verified_at:
            return False
        return True

    if channel == "email":
        if not can_email(strict=require_verified):
            raise ValueError("Cannot send email (missing address, prefs, SMTP, or verification)")
        send_plain_email(employee.email, "Valider votre présence", msg)
        sent.append("email")
        return sent

    if channel == "whatsapp":
        if not can_whatsapp(strict=require_verified):
            raise ValueError("Cannot send WhatsApp (missing phone, prefs, bridge, or verification)")
        send_whatsapp_text(employee.phone_e164, msg)
        sent.append("whatsapp")
        return sent

    # auto
    if allow_multiple:
        if can_email(strict=require_verified):
            send_plain_email(employee.email, "Valider votre présence", msg)
            sent.append("email")
        if can_whatsapp(strict=require_verified):
            send_whatsapp_text(employee.phone_e164, msg)
            sent.append("whatsapp")
    else:
        if can_email(strict=require_verified):
            send_plain_email(employee.email, "Valider votre présence", msg)
            sent.append("email")
        elif can_whatsapp(strict=require_verified):
            send_whatsapp_text(employee.phone_e164, msg)
            sent.append("whatsapp")
    if not sent:
        raise ValueError(
            "No verified notification channel available. Ask the employee to confirm email or WhatsApp in the app."
        )
    return sent

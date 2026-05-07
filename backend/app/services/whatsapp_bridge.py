import httpx

from app.core.config import get_settings


def send_whatsapp_text(phone_e164: str, text: str) -> None:
    settings = get_settings()
    if not settings.whatsapp_bridge_url or not settings.whatsapp_bridge_secret:
        raise ValueError("WhatsApp bridge is not configured (WHATSAPP_BRIDGE_URL / SECRET)")
    url = f"{settings.whatsapp_bridge_url.rstrip('/')}/send"
    with httpx.Client(timeout=30.0) as client:
        r = client.post(
            url,
            json={"phone": phone_e164, "text": text},
            headers={"Authorization": f"Bearer {settings.whatsapp_bridge_secret}"},
        )
        if r.status_code >= 400:
            detail = r.text
            try:
                detail = str(r.json())
            except Exception:
                pass
            raise RuntimeError(f"WhatsApp bridge error ({r.status_code}): {detail}")

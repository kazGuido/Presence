import httpx

from app.core.config import get_settings


def _tenant_base_url(company_id: str) -> str:
    settings = get_settings()
    if not settings.whatsapp_bridge_url or not settings.whatsapp_bridge_secret:
        raise ValueError("WhatsApp bridge is not configured (WHATSAPP_BRIDGE_URL / SECRET)")
    cid = str(company_id).strip()
    if len(cid) != 36:
        raise ValueError("Invalid company_id for WhatsApp tenant")
    return f"{settings.whatsapp_bridge_url.rstrip('/')}/t/{cid}"


def send_whatsapp_text(phone_e164: str, text: str, *, company_id: str) -> None:
    """Send via the Baileys bridge for the given company (one WA session per tenant)."""
    base = _tenant_base_url(company_id)
    url = f"{base}/send"
    settings = get_settings()
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

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.deps import get_current_company, get_current_employer
from app.models import Company, EmployerUser
from app.services.audit_log import write_audit

router = APIRouter(prefix="/whatsapp-bridge", tags=["whatsapp-bridge"])


def _bridge_headers() -> dict[str, str]:
    s = get_settings()
    if not s.whatsapp_bridge_url.strip() or not s.whatsapp_bridge_secret.strip():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "WhatsApp bridge not configured")
    return {"Authorization": f"Bearer {s.whatsapp_bridge_secret}"}


def _bridge_base() -> str:
    return get_settings().whatsapp_bridge_url.rstrip("/")


def _tenant_prefix(company: Company) -> str:
    return f"{_bridge_base()}/t/{company.id}"


@router.get("/health-proxy")
def bridge_health_proxy(company: Annotated[Company, Depends(get_current_company)]) -> dict:
    try:
        r = httpx.get(f"{_tenant_prefix(company)}/health", headers=_bridge_headers(), timeout=15.0)
    except httpx.RequestError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Bridge unreachable: {e}") from e
    if r.status_code >= 400:
        raise HTTPException(r.status_code, r.text)
    return r.json()


@router.get("/qr")
def bridge_qr_proxy(company: Annotated[Company, Depends(get_current_company)]) -> Response:
    try:
        # Bridge may wait for Baileys to emit the pairing QR (avoids "No QR available yet" race).
        r = httpx.get(f"{_tenant_prefix(company)}/qr", headers=_bridge_headers(), timeout=60.0)
    except httpx.RequestError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Bridge unreachable: {e}") from e
    if r.status_code == 204:
        return Response(status_code=204)
    if r.status_code == 404:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No QR available yet")
    if r.status_code >= 400:
        raise HTTPException(r.status_code, r.text)
    ct = r.headers.get("content-type", "image/svg+xml")
    return Response(content=r.content, media_type=ct)


@router.post("/logout")
def bridge_logout_proxy(
    company: Annotated[Company, Depends(get_current_company)],
    employer: Annotated[EmployerUser, Depends(get_current_employer)],
    db: Session = Depends(get_db),
) -> dict:
    try:
        r = httpx.post(f"{_tenant_prefix(company)}/logout", headers=_bridge_headers(), timeout=60.0)
    except httpx.RequestError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Bridge unreachable: {e}") from e
    if r.status_code >= 400:
        raise HTTPException(r.status_code, r.text)
    write_audit(
        db,
        company_id=company.id,
        actor_type="employer",
        actor_id=employer.id,
        action="whatsapp.bridge_logout",
        entity_type="company",
        entity_id=company.id,
        meta=None,
    )
    db.commit()
    try:
        return r.json()
    except Exception:
        return {"ok": True}

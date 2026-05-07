"""Single-use magic login tokens (Redis)."""

import uuid
from datetime import timedelta

from app.core.config import get_settings
from app.core.security import create_access_token, decode_token
from app.services.redis_client import get_redis

_PREFIX = "employee_magic:"

_CONSUME_LUA = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return 1
end
return 0
"""


def issue_magic_jti() -> str:
    return uuid.uuid4().hex


def register_magic_jti(jti: str, ttl_seconds: int = 900) -> None:
    r = get_redis()
    if r is None:
        raise RuntimeError("Redis required for magic links")
    r.setex(f"{_PREFIX}{jti}", ttl_seconds, "pending")


def consume_magic_jti(jti: str) -> bool:
    """Return True if JTI was valid and consumed (first use)."""
    r = get_redis()
    if r is None:
        return False
    key = f"{_PREFIX}{jti}"
    return bool(r.eval(_CONSUME_LUA, 1, key, "pending"))


def build_magic_token(employee_id: str, company_id: str) -> tuple[str, str]:
    jti = issue_magic_jti()
    settings = get_settings()
    exp = timedelta(minutes=settings.jwt_magic_expire_minutes)
    token = create_access_token(
        {
            "sub": employee_id,
            "typ": "employee_magic",
            "company_id": company_id,
            "jti": jti,
        },
        expires_delta=exp,
    )
    register_magic_jti(jti, ttl_seconds=int(exp.total_seconds()))
    return token, jti


def verify_magic_token_and_consume(token: str) -> dict:
    payload = decode_token(token)
    if payload.get("typ") != "employee_magic":
        raise ValueError("Wrong token type")
    jti = payload.get("jti")
    if not jti or not consume_magic_jti(str(jti)):
        raise ValueError("Invalid or used magic link")
    return payload

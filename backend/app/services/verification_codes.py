import random
import string

from app.services.redis_client import require_redis

_PREFIX = "ga_verify:"


def _key(employee_id: str, channel: str) -> str:
    return f"{_PREFIX}{employee_id}:{channel}"


def issue_code(employee_id: str, channel: str, ttl_seconds: int = 900) -> str:
    r = require_redis()
    code = "".join(random.choices(string.digits, k=6))
    r.setex(_key(employee_id, channel), ttl_seconds, code)
    return code


def verify_code(employee_id: str, channel: str, code: str) -> bool:
    r = require_redis()
    key = _key(employee_id, channel)
    expected = r.get(key)
    if not expected or expected.strip() != code.strip():
        return False
    r.delete(key)
    return True

"""Optional Redis (verification codes, ARQ broker)."""

from redis import Redis

from app.core.config import get_settings


def get_redis() -> Redis | None:
    url = get_settings().redis_url.strip()
    if not url:
        return None
    return Redis.from_url(url, decode_responses=True)


def require_redis() -> Redis:
    r = get_redis()
    if r is None:
        raise RuntimeError("Redis is not configured (set REDIS_URL)")
    return r

import asyncio
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.core.config import get_settings


class RateLimiter:
    def __init__(self) -> None:
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, key: str) -> None:
        settings = get_settings()
        now = time.monotonic()
        window_start = now - 60
        async with self._lock:
            bucket = self._hits[key]
            while bucket and bucket[0] < window_start:
                bucket.popleft()
            if len(bucket) >= settings.rate_limit_per_minute:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded",
                )
            bucket.append(now)


rate_limiter = RateLimiter()


async def enforce_rate_limit(request: Request) -> None:
    client_host = request.client.host if request.client else "unknown"
    await rate_limiter.check(client_host)

from __future__ import annotations

from redis.asyncio import Redis

from app.core.config import get_settings


class SubscriptionManager:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis
        self.settings = get_settings()

    async def add(self, user_id: int, symbols: list[str]) -> None:
        key = f"user:{user_id}:subscriptions"
        if symbols:
            await self.redis.sadd(key, *[symbol.upper() for symbol in symbols])

    async def remove(self, user_id: int, symbols: list[str]) -> None:
        key = f"user:{user_id}:subscriptions"
        if symbols:
            await self.redis.srem(key, *[symbol.upper() for symbol in symbols])

    async def list(self, user_id: int) -> list[str]:
        key = f"user:{user_id}:subscriptions"
        values = await self.redis.smembers(key)
        return sorted(
            value.decode() if isinstance(value, bytes) else str(value) for value in values
        )

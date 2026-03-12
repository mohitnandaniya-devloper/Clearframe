from __future__ import annotations

import json
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.logging import logger

ModelT = TypeVar("ModelT", bound=BaseModel)


class RedisCache:
    def __init__(self, redis: Redis, key_prefix: str = "clearframe") -> None:
        self.redis = redis
        self.key_prefix = key_prefix.strip(":") or "clearframe"

    def build_key(self, *parts: str) -> str:
        normalized_parts = [str(part).strip() for part in parts if str(part).strip()]
        return ":".join([self.key_prefix, *normalized_parts])

    async def get_model(self, key: str, model_type: type[ModelT]) -> ModelT | None:
        payload = await self.get_value(key)
        if payload is None:
            return None
        try:
            return model_type.model_validate_json(payload)
        except ValidationError as exc:
            logger.warning("cache_model_decode_failed", key=key, error=str(exc))
            await self.delete(key)
            return None

    async def set_model(self, key: str, value: BaseModel, ttl_seconds: int) -> None:
        await self.set_value(key, value.model_dump_json(), ttl_seconds)

    async def get_json(self, key: str) -> Any | None:
        payload = await self.get_value(key)
        if payload is None:
            return None
        try:
            return json.loads(payload)
        except json.JSONDecodeError as exc:
            logger.warning("cache_json_decode_failed", key=key, error=str(exc))
            await self.delete(key)
            return None

    async def set_json(self, key: str, value: Any, ttl_seconds: int) -> None:
        await self.set_value(
            key,
            json.dumps(value, separators=(",", ":"), default=str),
            ttl_seconds,
        )

    async def get_value(self, key: str) -> bytes | str | None:
        try:
            return await self.redis.get(key)
        except RedisError as exc:
            logger.warning("cache_read_failed", key=key, error=str(exc))
            return None

    async def set_value(self, key: str, value: str, ttl_seconds: int) -> None:
        try:
            await self.redis.set(key, value, ex=max(ttl_seconds, 1))
        except RedisError as exc:
            logger.warning("cache_write_failed", key=key, error=str(exc))

    async def delete(self, *keys: str) -> None:
        if not keys:
            return
        try:
            await self.redis.delete(*keys)
        except RedisError as exc:
            logger.warning("cache_delete_failed", keys=list(keys), error=str(exc))

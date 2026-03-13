from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from redis.asyncio import Redis
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text

from app.core.cache import RedisCache
from app.core.config import get_settings
from app.core.container import AppContainer
from app.db.models import Base
from app.db.session import engine
from app.integrations.angel_one.client import AngelOneClient
from app.integrations.angel_one.token_mapping import TokenMappingService
from app.integrations.angel_one.websocket import SmartAPIWebSocketManager
from app.streaming.broadcaster import broadcast
from app.streaming.market_data_processor import MarketDataProcessor

settings = get_settings()
logger = logging.getLogger(__name__)


async def wait_for_database() -> None:
    attempts = settings.database_connect_max_retries + 1

    for attempt in range(1, attempts + 1):
        try:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
                await connection.execute(text("SELECT 1"))
            return
        except (OSError, SQLAlchemyError) as exc:
            if attempt >= attempts:
                raise
            logger.warning(
                "Database connection attempt %s/%s failed: %s. Retrying in %ss.",
                attempt,
                attempts,
                exc,
                settings.database_connect_retry_delay_seconds,
            )
            await asyncio.sleep(settings.database_connect_retry_delay_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    redis = Redis.from_url(settings.redis_url, decode_responses=False)
    cache = RedisCache(redis, key_prefix=settings.cache_key_prefix)
    market_processor = MarketDataProcessor()
    token_mapping = TokenMappingService()
    websocket_manager = SmartAPIWebSocketManager(token_mapping, market_processor.publish)
    websocket_manager.bind_loop(asyncio.get_running_loop())

    app.state.container = AppContainer(
        redis=redis,
        cache=cache,
        angel_one_client=AngelOneClient(),
        token_mapping=token_mapping,
        market_processor=market_processor,
        websocket_manager=websocket_manager,
    )

    await wait_for_database()

    await broadcast.connect()
    try:
        yield
    finally:
        await broadcast.disconnect()
        await redis.aclose()

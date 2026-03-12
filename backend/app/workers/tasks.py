from arq import create_pool
from arq.connections import RedisSettings

from app.core.config import get_settings
from app.core.logging import logger

settings = get_settings()


async def refresh_broker_sessions(ctx: dict) -> None:
    logger.info("worker.refresh_broker_sessions")


async def cleanup_stale_sockets(ctx: dict) -> None:
    logger.info("worker.cleanup_stale_sockets")


class WorkerSettings:
    functions = [refresh_broker_sessions, cleanup_stale_sockets]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)


async def enqueue_housekeeping() -> None:
    redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    await redis.enqueue_job("refresh_broker_sessions")
    await redis.enqueue_job("cleanup_stale_sockets")

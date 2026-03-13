from collections.abc import AsyncIterator

from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.logging import logger

settings = get_settings()
url = make_url(settings.database_url)
engine_kwargs: dict[str, object] = {}

if url.get_backend_name() == "postgresql":
    connect_args: dict[str, object] = {
        "timeout": settings.database_connect_timeout_seconds,
    }
    if "pooler.supabase.com" in (url.host or ""):
        connect_args["statement_cache_size"] = 0

    engine_kwargs.update(
        pool_pre_ping=True,
        pool_recycle=settings.database_pool_recycle_seconds,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        connect_args=connect_args,
    )

engine = create_async_engine(settings.database_url, echo=False, future=True, **engine_kwargs)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    session = AsyncSessionLocal()
    try:
        yield session
    finally:
        try:
            await session.close()
        except DBAPIError as exc:
            message = str(exc).lower()
            if "connectiondoesnotexisterror" in message or "connection was closed in the middle of operation" in message:
                logger.warning("db.session.close_ignored", error=str(exc))
                return
            raise

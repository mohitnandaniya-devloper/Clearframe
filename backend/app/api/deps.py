from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import RedisCache
from app.core.container import AppContainer
from app.core.security import decode_token
from app.db.models.user import User
from app.db.session import get_db_session
from app.integrations.angel_one.client import BrokerSession
from app.services.broker.service import BrokerConnectionService
from app.services.market.service import MarketService
from app.services.portfolio.service import PortfolioService
from app.streaming.subscription_manager import SubscriptionManager

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user_email(token: Annotated[str, Depends(oauth2_scheme)]) -> str:
    try:
        claims = decode_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        ) from exc
    if claims.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")
    return str(claims["sub"])


async def get_current_user(
    user_email: Annotated[str, Depends(get_current_user_email)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> User:
    result = await session.execute(select(User).where(User.email == user_email))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_redis_from_app(request: Request) -> Redis:
    return get_container(request).redis


def get_cache_from_app(request: Request) -> RedisCache:
    return get_container(request).cache


def get_container(request: Request) -> AppContainer:
    return request.app.state.container


def get_broker_connection_service(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> BrokerConnectionService:
    container = get_container(request)
    return BrokerConnectionService(
        session,
        container.angel_one_client,
        container.token_mapping,
        container.cache,
    )


def get_market_service(
    request: Request,
    redis: Annotated[Redis, Depends(get_redis_from_app)],
) -> MarketService:
    container = get_container(request)
    return MarketService(
        SubscriptionManager(redis),
        container.websocket_manager,
        container.token_mapping,
        container.angel_one_client,
    )


def get_portfolio_service(request: Request) -> PortfolioService:
    container = get_container(request)
    return PortfolioService(container.angel_one_client, container.cache)


async def get_broker_session(
    current_email: Annotated[str, Depends(get_current_user_email)],
    broker_service: Annotated[BrokerConnectionService, Depends(get_broker_connection_service)],
) -> BrokerSession:
    broker_session = await broker_service.get_session(current_email)
    if broker_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broker not connected")
    return broker_session

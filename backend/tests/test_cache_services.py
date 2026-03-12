from __future__ import annotations

from typing import Any

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.cache import RedisCache
from app.db.models import Base
from app.db.models.broker_connection import BrokerConnection
from app.db.models.user import User
from app.integrations.angel_one.client import BrokerSession
from app.services.broker.service import BrokerConnectionService
from app.services.portfolio.service import PortfolioService


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self.store[key] = value

    async def delete(self, *keys: str) -> int:
        deleted = 0
        for key in keys:
            if key in self.store:
                del self.store[key]
                deleted += 1
        return deleted


class FakePortfolioClient:
    def __init__(self) -> None:
        self.calls = 0

    async def get_portfolio(self, session: BrokerSession) -> dict[str, Any]:
        self.calls += 1
        return {
            "holdings": [
                {
                    "tradingsymbol": "RELIANCE",
                    "quantity": 10,
                    "averageprice": 280050,
                    "ltp": 284525,
                    "profitandloss": 4475,
                }
            ],
            "orders": [{"order_id": "demo-1", "status": "OPEN"}],
            "positions": [{"symbol": "NIFTY", "quantity": 50}],
        }


class FakeBrokerClient:
    async def create_session(self, **kwargs: Any) -> BrokerSession:  # pragma: no cover
        raise NotImplementedError

    async def get_portfolio(self, session: BrokerSession) -> dict[str, Any]:  # pragma: no cover
        raise NotImplementedError


def build_broker_session() -> BrokerSession:
    return BrokerSession(
        client_code="ABC123",
        api_key="api-key",
        jwt_token="jwt-token",
        refresh_token="refresh-token",
        feed_token="feed-token",
        profile={"name": "Demo User"},
    )


@pytest.mark.asyncio
async def test_portfolio_service_reuses_cached_snapshot_for_related_endpoints() -> None:
    client = FakePortfolioClient()
    cache = RedisCache(FakeRedis(), key_prefix="test")
    service = PortfolioService(client, cache)
    session = build_broker_session()

    portfolio = await service.get_portfolio("user@example.com", session)
    orders = await service.get_orders("user@example.com", session)
    positions = await service.get_positions("user@example.com", session)

    assert client.calls == 1
    assert portfolio.holdings[0].symbol == "RELIANCE"
    assert orders.orders == [{"order_id": "demo-1", "status": "OPEN"}]
    assert positions.positions == [{"symbol": "NIFTY", "quantity": 50}]


@pytest.mark.asyncio
async def test_broker_status_cache_updates_when_disconnect_changes_state() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        user = User(email="user@example.com", hashed_password="hashed")
        session.add(user)
        await session.flush()
        session.add(
            BrokerConnection(
                user_id=user.id,
                client_code="ABC123",
                api_key="api-key",
                jwt_token="jwt-token",
                refresh_token="refresh-token",
                feed_token="feed-token",
                connection_state="connected",
                metadata_json='{"name":"Demo User"}',
            )
        )
        await session.commit()

        cache = RedisCache(FakeRedis(), key_prefix="test")
        service = BrokerConnectionService(session, FakeBrokerClient(), None, cache)

        first = await service.status("user@example.com")

        connection = (
            await session.get(BrokerConnection, 1)
        )
        assert connection is not None
        connection.connection_state = "disconnected"
        await session.commit()

        cached = await service.status("user@example.com")
        disconnected = await service.disconnect("user@example.com")
        refreshed = await service.status("user@example.com")

        assert first.connection_state == "connected"
        assert cached.connection_state == "connected"
        assert disconnected.connection_state == "disconnected"
        assert refreshed.connection_state == "disconnected"

    await engine.dispose()

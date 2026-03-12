from __future__ import annotations

import json
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import RedisCache
from app.core.config import get_settings
from app.db.models.broker_connection import BrokerConnection
from app.db.models.user import User
from app.integrations.angel_one.client import AngelOneClient, BrokerSession
from app.integrations.angel_one.token_mapping import TokenMappingService
from app.schemas.broker import BrokerConnectRequest, BrokerStatusResponse


class BrokerConnectionService:
    def __init__(
        self,
        session: AsyncSession,
        client: AngelOneClient,
        token_mapping: TokenMappingService | None = None,
        cache: RedisCache | None = None,
    ) -> None:
        self.session = session
        self.client = client
        self.token_mapping = token_mapping
        self.cache = cache
        self.settings = get_settings()

    async def connect(
        self, user_email: str, payload: BrokerConnectRequest
    ) -> tuple[BrokerStatusResponse, BrokerSession]:
        user = await self._get_user(user_email)
        broker_session = await self.client.create_session(
            client_code=payload.client_code,
            password=payload.password,
            totp=payload.totp,
        )
        result = await self.session.execute(
            select(BrokerConnection).where(
                BrokerConnection.user_id == user.id, BrokerConnection.provider == "angel_one"
            )
        )
        connection = result.scalar_one_or_none()
        if connection is None:
            connection = BrokerConnection(
                user_id=user.id,
                client_code=broker_session.client_code,
                api_key=broker_session.api_key,
                jwt_token=broker_session.jwt_token,
                refresh_token=broker_session.refresh_token,
                feed_token=broker_session.feed_token,
                metadata_json=json.dumps(broker_session.profile),
            )
            self.session.add(connection)
        else:
            connection.client_code = broker_session.client_code
            connection.api_key = broker_session.api_key
            connection.jwt_token = broker_session.jwt_token
            connection.refresh_token = broker_session.refresh_token
            connection.feed_token = broker_session.feed_token
            connection.connection_state = "connected"
            connection.metadata_json = json.dumps(broker_session.profile)
        await self.session.commit()
        response = BrokerStatusResponse(
            success=True,
            connection_state="connected",
            reason_code="connected",
            message="Broker connected successfully",
            reconnect_required=False,
            retry_allowed=False,
            next_action="none",
            request_id=str(uuid4()),
            data={"profile": broker_session.profile},
        )
        await self._set_status_cache(user_email, response)
        await self._clear_portfolio_cache(user_email)
        return (response, broker_session)

    async def disconnect(self, user_email: str) -> BrokerStatusResponse:
        user = await self._get_user(user_email)
        result = await self.session.execute(
            select(BrokerConnection).where(
                BrokerConnection.user_id == user.id, BrokerConnection.provider == "angel_one"
            )
        )
        connection = result.scalar_one_or_none()
        if connection is not None:
            connection.connection_state = "disconnected"
            await self.session.commit()
        response = BrokerStatusResponse(
            success=True,
            connection_state="disconnected",
            reason_code="disconnected",
            message="Broker disconnected",
            next_action="none",
            request_id=str(uuid4()),
        )
        await self._set_status_cache(user_email, response)
        await self._clear_portfolio_cache(user_email)
        return response

    async def status(self, user_email: str) -> BrokerStatusResponse:
        cached_response = await self._get_status_cache(user_email)
        if cached_response is not None:
            return cached_response

        user = await self._get_user(user_email)
        result = await self.session.execute(
            select(BrokerConnection).where(
                BrokerConnection.user_id == user.id, BrokerConnection.provider == "angel_one"
            )
        )
        connection = result.scalar_one_or_none()
        if connection is None:
            response = BrokerStatusResponse(
                success=False,
                connection_state="disconnected",
                reason_code="not_connected",
                message="No broker session found",
                retry_allowed=True,
                next_action="relogin",
            )
            await self._set_status_cache(user_email, response)
            return response
        stored_profile: dict = {}
        try:
            stored_profile = json.loads(connection.metadata_json or "{}")
        except (json.JSONDecodeError, TypeError):
            pass
        response = BrokerStatusResponse(
            success=connection.connection_state == "connected",
            connection_state=connection.connection_state,
            reason_code=connection.connection_state,
            message=f"Broker is {connection.connection_state}",
            next_action="none",
            data={"client_code": connection.client_code, "profile": stored_profile},
        )
        await self._set_status_cache(user_email, response)
        return response

    async def get_session(self, user_email: str) -> BrokerSession | None:
        user = await self._get_user(user_email)
        result = await self.session.execute(
            select(BrokerConnection).where(
                BrokerConnection.user_id == user.id, BrokerConnection.provider == "angel_one"
            )
        )
        connection = result.scalar_one_or_none()
        if connection is None:
            return None
        return BrokerSession(
            client_code=connection.client_code,
            api_key=connection.api_key,
            jwt_token=connection.jwt_token,
            refresh_token=connection.refresh_token,
            feed_token=connection.feed_token,
            profile=json.loads(connection.metadata_json or "{}"),
        )

    async def cache_symbols_from_portfolio(self, user_email: str) -> list[str]:
        if self.token_mapping is None:
            return []
        session = await self.get_session(user_email)
        if session is None:
            return []
        portfolio = await self.client.get_portfolio(session)
        cached: list[str] = []
        for item in portfolio.get("holdings", []):
            symbol = str(item.get("tradingsymbol") or item.get("symbol") or "").upper()
            token = item.get("symboltoken") or item.get("token")
            exchange = item.get("exchange") or item.get("exch_seg") or "NSE"
            if symbol and token:
                self.token_mapping.register(symbol, str(token), str(exchange))
                cached.append(symbol)
        return cached

    async def _get_user(self, email: str) -> User:
        result = await self.session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None:
            raise ValueError("User does not exist")
        return user

    async def _get_status_cache(self, user_email: str) -> BrokerStatusResponse | None:
        if self.cache is None:
            return None
        return await self.cache.get_model(
            self._status_cache_key(user_email),
            BrokerStatusResponse,
        )

    async def _set_status_cache(
        self,
        user_email: str,
        response: BrokerStatusResponse,
    ) -> None:
        if self.cache is None:
            return
        await self.cache.set_model(
            self._status_cache_key(user_email),
            response,
            self.settings.broker_status_cache_ttl_seconds,
        )

    async def _clear_portfolio_cache(self, user_email: str) -> None:
        if self.cache is None:
            return
        await self.cache.delete(self._portfolio_snapshot_cache_key(user_email))

    def _status_cache_key(self, user_email: str) -> str:
        assert self.cache is not None
        return self.cache.build_key("broker-status", user_email.strip().lower())

    def _portfolio_snapshot_cache_key(self, user_email: str) -> str:
        assert self.cache is not None
        return self.cache.build_key("portfolio-snapshot", user_email.strip().lower())

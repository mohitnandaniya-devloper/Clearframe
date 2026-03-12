from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from threading import Thread
from typing import Any

from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.core.logging import logger
from app.domain.constants import SubscriptionMode
from app.domain.events import MarketTickEvent
from app.integrations.angel_one.client import AngelOneAuthError, BrokerSession
from app.integrations.angel_one.token_mapping import TokenMappingService

try:
    from SmartApi.smartWebSocketV2 import SmartWebSocketV2  # type: ignore
except ImportError:  # pragma: no cover
    SmartWebSocketV2 = None  # type: ignore


TickHandler = Callable[[MarketTickEvent], Awaitable[None]]


class SmartAPIWebSocketManager:
    def __init__(self, token_mapping: TokenMappingService, tick_handler: TickHandler) -> None:
        self.settings = get_settings()
        self.token_mapping = token_mapping
        self.tick_handler = tick_handler
        self._connections: dict[int, Any] = {}
        self._threads: dict[int, Thread] = {}
        self._user_subscriptions: dict[int, set[str]] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def has_connection(self, user_id: int) -> bool:
        return user_id in self._connections

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        reraise=True,
    )
    async def connect(self, user_id: int, session: BrokerSession) -> None:
        self._user_subscriptions.setdefault(user_id, set())
        if SmartWebSocketV2 is None:
            if self.settings.smartapi_mock_mode:
                logger.info("smartapi.ws.mock_mode", user_id=user_id)
                return
            raise AngelOneAuthError(
                "SmartAPI WebSocket SDK is unavailable in this backend environment"
            )

        if self._loop is None:
            self._loop = asyncio.get_running_loop()

        sws = SmartWebSocketV2(
            session.jwt_token, session.api_key, session.client_code, session.feed_token
        )
        sws.on_open = lambda _ws: logger.info("smartapi.ws.open", user_id=user_id)
        sws.on_error = lambda _ws, error: logger.error(
            "smartapi.ws.error", user_id=user_id, error=str(error)
        )
        sws.on_close = lambda _ws: logger.info("smartapi.ws.close", user_id=user_id)
        sws.on_data = lambda _ws, payload: self._forward_tick(user_id, payload)

        thread = Thread(target=sws.connect, daemon=True)
        thread.start()
        self._connections[user_id] = sws
        self._threads[user_id] = thread

    def _forward_tick(self, user_id: int, payload: dict[str, Any]) -> None:
        if self._loop is None:
            return
        token = str(payload.get("token", ""))
        try:
            symbol = self.token_mapping.get_symbol(token)
        except KeyError:
            symbol = payload.get("symbol", token)
        event = MarketTickEvent(
            symbol=symbol,
            token=token,
            exchange=str(payload.get("exchange", "NSE")),
            ltp=self._normalize_price(payload.get("last_traded_price", payload.get("ltp", 0.0))),
            volume=int(payload["volume"]) if payload.get("volume") is not None else None,
            bid=self._normalize_price(payload["best_bid_price"])
            if payload.get("best_bid_price") is not None
            else None,
            ask=self._normalize_price(payload["best_ask_price"])
            if payload.get("best_ask_price") is not None
            else None,
        )
        asyncio.run_coroutine_threadsafe(self.tick_handler(event), self._loop)

    async def subscribe(self, user_id: int, symbols: list[str], mode: SubscriptionMode) -> None:
        self._user_subscriptions.setdefault(user_id, set()).update(
            symbol.upper() for symbol in symbols
        )
        connection = self._connections.get(user_id)
        if connection is None:
            return
        exchange_buckets: dict[str, list[str]] = {}
        for item in self.token_mapping.batch(symbols):
            exchange_buckets.setdefault(item["exchange"], []).append(item["token"])
        payload = [
            {
                "exchangeType": 1 if exchange == "NSE" else 2,
                "tokens": tokens,
            }
            for exchange, tokens in exchange_buckets.items()
        ]
        connection.subscribe(f"user-{user_id}", int(mode), payload)

    async def unsubscribe(self, user_id: int, symbols: list[str], mode: SubscriptionMode) -> None:
        current = self._user_subscriptions.setdefault(user_id, set())
        for symbol in symbols:
            current.discard(symbol.upper())
        connection = self._connections.get(user_id)
        if connection is None:
            return
        exchange_buckets: dict[str, list[str]] = {}
        for item in self.token_mapping.batch_known(symbols):
            exchange_buckets.setdefault(item["exchange"], []).append(item["token"])
        if not exchange_buckets:
            return
        payload = [
            {
                "exchangeType": 1 if exchange == "NSE" else 2,
                "tokens": tokens,
            }
            for exchange, tokens in exchange_buckets.items()
        ]
        connection.unsubscribe(f"user-{user_id}", int(mode), payload)

    @staticmethod
    def _normalize_price(value: object) -> float:
        numeric = float(value) if value is not None else 0.0
        return numeric / 100 if numeric >= 1000 else numeric

    async def disconnect(self, user_id: int) -> None:
        connection = self._connections.pop(user_id, None)
        self._threads.pop(user_id, None)
        self._user_subscriptions.pop(user_id, None)
        if connection is not None and hasattr(connection, "close_connection"):
            connection.close_connection()

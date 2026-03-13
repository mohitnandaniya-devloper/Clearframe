import asyncio

from app.core.logging import logger
from app.domain.constants import SubscriptionMode
from app.integrations.angel_one.client import AngelOneClient, BrokerSession
from app.integrations.angel_one.token_mapping import TokenMappingService
from app.integrations.angel_one.websocket import SmartAPIWebSocketManager
from app.schemas.market import MarketDataResponse, MarketHistoryCandle
from app.streaming.subscription_manager import SubscriptionManager


class MarketService:
    def __init__(
        self,
        subscription_manager: SubscriptionManager,
        websocket_manager: SmartAPIWebSocketManager,
        token_mapping: TokenMappingService,
        angel_one_client: AngelOneClient,
    ) -> None:
        self.subscription_manager = subscription_manager
        self.websocket_manager = websocket_manager
        self.token_mapping = token_mapping
        self.angel_one_client = angel_one_client

    async def subscribe(
        self,
        user_id: int,
        symbols: list[str],
        mode: SubscriptionMode,
        broker_session: BrokerSession | None = None,
    ) -> dict[str, object]:
        resolved_symbols = [symbol.upper() for symbol in symbols]
        if broker_session is not None:
            if not self.websocket_manager.has_connection(user_id):
                await self.websocket_manager.connect(user_id, broker_session)
            resolved_symbols = await self._ensure_token_mapping(
                broker_session,
                symbols,
                strict=False,
            )
        await self.subscription_manager.add(user_id, resolved_symbols)
        await self.websocket_manager.subscribe(user_id, resolved_symbols, mode)
        return {"subscribed": resolved_symbols, "mode": mode.name}

    async def unsubscribe(
        self,
        user_id: int,
        symbols: list[str],
        mode: SubscriptionMode,
        broker_session: BrokerSession | None = None,
    ) -> dict[str, object]:
        await self.subscription_manager.remove(user_id, symbols)
        await self.websocket_manager.unsubscribe(user_id, symbols, mode)
        return {"unsubscribed": [symbol.upper() for symbol in symbols], "mode": mode.name}

    async def get_ltp(
        self,
        symbols: list[str],
        broker_session: BrokerSession | None = None,
    ) -> list[MarketDataResponse]:
        if broker_session is None:
            raise RuntimeError("Broker connection is required to fetch live market data.")

        resolved_symbols = await self._ensure_token_mapping(
            broker_session,
            symbols,
            strict=False,
        )
        if not resolved_symbols:
            return []
        semaphore = asyncio.Semaphore(4)

        async def load_quote(symbol: str) -> MarketDataResponse:
            token, exchange = self.token_mapping.get_token(symbol)
            async with semaphore:
                quote = await self.angel_one_client.get_market_quote(
                    broker_session,
                    symbol=symbol,
                    token=token,
                    exchange=exchange,
                )
            return MarketDataResponse(
                symbol=str(quote["symbol"]).upper(),
                token=str(quote["token"]),
                exchange=str(quote["exchange"]).upper(),
                ltp=float(quote["ltp"]),
                open=quote.get("open"),
                high=quote.get("high"),
                low=quote.get("low"),
                close=quote.get("close"),
                volume=quote.get("volume"),
                bid=quote.get("bid"),
                ask=quote.get("ask"),
                timestamp=str(quote["timestamp"]),
            )

        return list(await asyncio.gather(*(load_quote(symbol) for symbol in resolved_symbols)))

    async def get_history(
        self,
        symbol: str,
        timeframe: str,
        broker_session: BrokerSession | None = None,
    ) -> list[MarketHistoryCandle]:
        if broker_session is None:
            raise RuntimeError("Broker connection is required to fetch market history.")

        await self._ensure_token_mapping(broker_session, [symbol], strict=True)
        token, exchange = self.token_mapping.get_token(symbol)
        candles = await self.angel_one_client.get_market_history(
            broker_session,
            symbol=symbol,
            token=token,
            exchange=exchange,
            timeframe=timeframe,
        )
        return [MarketHistoryCandle(**candle) for candle in candles]

    async def _ensure_token_mapping(
        self,
        broker_session: BrokerSession,
        symbols: list[str],
        *,
        strict: bool,
    ) -> list[str]:
        resolved_symbols: list[str] = []
        for symbol in symbols:
            try:
                self.token_mapping.get_token(symbol)
                resolved_symbols.append(symbol.upper())
            except KeyError:
                try:
                    mapping = await self.angel_one_client.lookup_symbol(broker_session, symbol)
                except Exception:
                    if strict:
                        raise
                    logger.warning(
                        "market.symbol_lookup_skipped",
                        symbol=symbol.upper(),
                    )
                    continue
                self.token_mapping.register(
                    mapping["symbol"],
                    mapping["token"],
                    mapping["exchange"],
                )
                resolved_symbols.append(mapping["symbol"].upper())
        return resolved_symbols

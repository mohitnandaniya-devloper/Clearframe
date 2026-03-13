from app.domain.constants import SubscriptionMode
from app.integrations.angel_one.client import AngelOneClient, BrokerSession
from app.integrations.angel_one.token_mapping import TokenMappingService
from app.integrations.angel_one.websocket import SmartAPIWebSocketManager
from app.schemas.market import MarketDataResponse
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
        if broker_session is not None:
            if not self.websocket_manager.has_connection(user_id):
                await self.websocket_manager.connect(user_id, broker_session)
            await self._ensure_token_mapping(broker_session, symbols)
        await self.subscription_manager.add(user_id, symbols)
        await self.websocket_manager.subscribe(user_id, symbols, mode)
        return {"subscribed": [symbol.upper() for symbol in symbols], "mode": mode.name}

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

        await self._ensure_token_mapping(broker_session, symbols)
        rows: list[MarketDataResponse] = []
        for symbol in symbols:
            token, exchange = self.token_mapping.get_token(symbol)
            quote = await self.angel_one_client.get_market_quote(
                broker_session,
                symbol=symbol,
                token=token,
                exchange=exchange,
            )
            rows.append(
                MarketDataResponse(
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
            )
        return rows

    async def _ensure_token_mapping(
        self,
        broker_session: BrokerSession,
        symbols: list[str],
    ) -> None:
        for symbol in symbols:
            try:
                self.token_mapping.get_token(symbol)
            except KeyError:
                mapping = await self.angel_one_client.lookup_symbol(broker_session, symbol)
                self.token_mapping.register(
                    mapping["symbol"],
                    mapping["token"],
                    mapping["exchange"],
                )

from typing import Any

from app.core.cache import RedisCache
from app.core.config import get_settings
from app.core.logging import logger
from app.integrations.angel_one.client import AngelOneAuthError, AngelOneClient, BrokerSession
from app.schemas.portfolio import (
    OrdersResponse,
    PortfolioPosition,
    PortfolioResponse,
    PositionsResponse,
)


class PortfolioService:
    def __init__(
        self,
        client: AngelOneClient,
        cache: RedisCache | None = None,
    ) -> None:
        self.client = client
        self.cache = cache
        self.settings = get_settings()

    async def get_portfolio(
        self,
        user_email: str,
        session: BrokerSession,
    ) -> PortfolioResponse:
        try:
            data = await self._get_portfolio_snapshot(user_email, session)
            holdings = self._build_holdings(data)
            return PortfolioResponse(holdings=holdings)
        except AngelOneAuthError:
            raise
        except Exception as exc:
            logger.warning("portfolio_fetch_failed", user_email=user_email, error=str(exc))
            return PortfolioResponse(holdings=[])

    async def get_orders(self, user_email: str, session: BrokerSession) -> OrdersResponse:
        data = await self._get_portfolio_snapshot(user_email, session)
        return OrdersResponse(orders=self._as_records(data.get("orders")))

    async def get_positions(self, user_email: str, session: BrokerSession) -> PositionsResponse:
        data = await self._get_portfolio_snapshot(user_email, session)
        return PositionsResponse(positions=self._as_records(data.get("positions")))

    @staticmethod
    def _normalize_money_value(value: object) -> float:
        if value is None or value == "":
            return 0.0

        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                return 0.0
            if "." in cleaned:
                return float(cleaned)
            return float(cleaned) / 100

        return float(value)

    async def _get_portfolio_snapshot(
        self,
        user_email: str,
        session: BrokerSession,
    ) -> dict[str, Any]:
        if self.cache is not None:
            cache_key = self._portfolio_snapshot_cache_key(user_email)
            cached_snapshot = await self.cache.get_json(cache_key)
            if isinstance(cached_snapshot, dict):
                return cached_snapshot

        data = await self.client.get_portfolio(session)
        if self.cache is not None:
            await self.cache.set_json(
                cache_key,
                data,
                self.settings.portfolio_snapshot_cache_ttl_seconds,
            )
        return data

    def _portfolio_snapshot_cache_key(self, user_email: str) -> str:
        assert self.cache is not None
        return self.cache.build_key("portfolio-snapshot", user_email.strip().lower())

    def _build_holdings(self, data: dict[str, Any]) -> list[PortfolioPosition]:
        holdings: list[PortfolioPosition] = []
        for item in self._as_records(data.get("holdings")):
            symbol = str(item.get("tradingsymbol", item.get("symbol", "UNKNOWN")) or "UNKNOWN")
            quantity_raw = item.get("quantity", item.get("netqty", item.get("qty", 0)))
            quantity = int(float(quantity_raw)) if quantity_raw is not None else 0
            avg_price_raw = item.get(
                "averageprice",
                item.get(
                    "avgprice",
                    item.get("avgnetprice", item.get("average_price", 0.0)),
                ),
            )
            ltp_raw = item.get("ltp", item.get("close", 0.0))
            pnl_raw = item.get("profitandloss", item.get("pnl", 0.0))
            holdings.append(
                PortfolioPosition(
                    symbol=symbol,
                    quantity=quantity,
                    average_price=self._normalize_money_value(avg_price_raw),
                    ltp=self._normalize_money_value(ltp_raw),
                    pnl=self._normalize_money_value(pnl_raw),
                )
            )
        return holdings

    @staticmethod
    def _as_records(value: object) -> list[dict[str, object]]:
        if not isinstance(value, list):
            return []
        return [item for item in value if isinstance(item, dict)]

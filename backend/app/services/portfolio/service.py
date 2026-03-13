from typing import Any

from app.core.cache import RedisCache
from app.core.config import get_settings
from app.core.logging import logger
from app.integrations.angel_one.client import AngelOneAuthError, AngelOneClient, BrokerSession
from app.schemas.portfolio import (
    OrdersResponse,
    PortfolioPosition,
    PortfolioResponse,
    PortfolioSummarySnapshot,
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
        *,
        fresh: bool = False,
    ) -> PortfolioResponse:
        try:
            data = await self._get_portfolio_snapshot(user_email, session, fresh=fresh)
            holdings = self._build_holdings(data)
            summary = self._build_summary(data, holdings)
            return PortfolioResponse(holdings=holdings, summary=summary)
        except AngelOneAuthError:
            raise
        except Exception as exc:
            logger.warning("portfolio_fetch_failed", user_email=user_email, error=str(exc))
            return PortfolioResponse(holdings=[], summary=None)

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
        *,
        fresh: bool = False,
    ) -> dict[str, Any]:
        if self.cache is not None and not fresh:
            cache_key = self._portfolio_snapshot_cache_key(user_email)
            cached_snapshot = await self.cache.get_json(cache_key)
            if isinstance(cached_snapshot, dict):
                return cached_snapshot

        data = await self.client.get_portfolio(session)
        if self.cache is not None:
            cache_key = self._portfolio_snapshot_cache_key(user_email)
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
            current_value_raw = item.get(
                "holdingvalue",
                item.get(
                    "holdingValue",
                    item.get("current_value", item.get("currentValue")),
                ),
            )
            pnl_percentage_raw = item.get("pnlpercentage", item.get("pnlPercentage"))
            average_price = self._normalize_money_value(avg_price_raw)
            ltp = self._normalize_money_value(ltp_raw)
            pnl = self._normalize_money_value(pnl_raw)
            current_value = (
                self._normalize_money_value(current_value_raw)
                if current_value_raw not in (None, "")
                else 0.0
            )
            invested_value = current_value - pnl if current_value > 0 else quantity * average_price
            if current_value <= 0:
                current_value = invested_value + pnl
            holdings.append(
                PortfolioPosition(
                    symbol=symbol,
                    quantity=quantity,
                    average_price=average_price,
                    ltp=ltp,
                    invested_value=invested_value,
                    current_value=current_value,
                    pnl=pnl,
                    pnl_percentage=self._optional_float(pnl_percentage_raw),
                )
            )
        return holdings

    def _build_summary(
        self,
        data: dict[str, Any],
        holdings: list[PortfolioPosition],
    ) -> PortfolioSummarySnapshot | None:
        total_holding = self._normalize_total_holding(data.get("totalholding"))
        if total_holding is not None:
            current_value_raw = total_holding.get(
                "totalholdingvalue",
                total_holding.get("current_value"),
            )
            invested_value_raw = total_holding.get(
                "totalinvvalue",
                total_holding.get("invested_value"),
            )
            total_pnl_raw = total_holding.get(
                "totalprofitandloss",
                total_holding.get("total_pnl"),
            )
            pnl_percentage_raw = total_holding.get(
                "totalpnlpercentage",
                total_holding.get("pnl_percentage"),
            )

            if current_value_raw not in (None, "") and invested_value_raw not in (None, ""):
                return PortfolioSummarySnapshot(
                    current_value=self._normalize_money_value(current_value_raw),
                    invested_value=self._normalize_money_value(invested_value_raw),
                    total_pnl=self._normalize_money_value(total_pnl_raw),
                    pnl_percentage=self._optional_float(pnl_percentage_raw),
                )

        if not holdings:
            return None

        invested_value = sum(holding.invested_value for holding in holdings)
        current_value = sum(holding.current_value for holding in holdings)
        total_pnl = sum(holding.pnl for holding in holdings)
        pnl_percentage = (total_pnl / invested_value * 100) if invested_value > 0 else None
        return PortfolioSummarySnapshot(
            current_value=current_value,
            invested_value=invested_value,
            total_pnl=total_pnl,
            pnl_percentage=pnl_percentage,
        )

    @staticmethod
    def _as_records(value: object) -> list[dict[str, object]]:
        if not isinstance(value, list):
            return []
        return [item for item in value if isinstance(item, dict)]

    @staticmethod
    def _normalize_total_holding(value: object) -> dict[str, object] | None:
        if isinstance(value, dict):
            return value
        if isinstance(value, list) and value and isinstance(value[0], dict):
            return value[0]
        return None

    @staticmethod
    def _optional_float(value: object) -> float | None:
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

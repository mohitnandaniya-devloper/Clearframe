import asyncio
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.core.config import get_settings

try:
    from SmartApi import SmartConnect  # type: ignore
except ImportError:  # pragma: no cover
    SmartConnect = None  # type: ignore


@dataclass(slots=True)
class BrokerSession:
    client_code: str
    api_key: str
    jwt_token: str
    refresh_token: str
    feed_token: str
    profile: dict[str, Any]


class AngelOneAuthError(RuntimeError):
    pass


class AngelOneClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._symbol_cache: dict[str, dict[str, str]] = {}
        self._symbol_lookup_failures: dict[str, float] = {}
        self._symbol_lookup_failure_ttl_seconds = 600

    def _create_connector(self, api_key: str) -> Any:
        if SmartConnect is None:
            if self.settings.smartapi_mock_mode:
                return None
            raise AngelOneAuthError(
                "SmartAPI SDK is unavailable in this backend environment. "
                "Install required dependencies and disable mock mode."
            )
        return SmartConnect(api_key=api_key)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=4),
        reraise=True,
    )
    async def create_session(
        self,
        *,
        client_code: str,
        password: str,
        totp: str,
    ) -> BrokerSession:
        api_key = self.settings.angel_one_api_key.strip()
        if not api_key:
            raise AngelOneAuthError(
                "ANGEL_ONE_TRADING_API_KEY (or ANGEL_ONE_API_KEY) is not configured on the backend."
            )

        connector = self._create_connector(api_key)
        if connector is None:
            return BrokerSession(
                client_code=client_code,
                api_key=api_key,
                jwt_token="mock-jwt-token",
                refresh_token="mock-refresh-token",
                feed_token="mock-feed-token",
                profile={"name": "Demo User", "client_code": client_code},
            )

        response = await self._run_blocking(connector.generateSession, client_code, password, totp)
        if not response or not response.get("status"):
            message = (
                response.get("message", "Session creation failed")
                if response
                else "Session creation failed"
            )
            raise AngelOneAuthError(message)

        data = response["data"]
        jwt_token = str(data["jwtToken"]).removeprefix("Bearer ").strip()
        feed_token = data["feedToken"]
        return BrokerSession(
            client_code=client_code,
            api_key=api_key,
            jwt_token=jwt_token,
            refresh_token=data["refreshToken"],
            feed_token=feed_token,
            profile=data,
        )

    async def get_portfolio(self, session: BrokerSession) -> dict[str, Any]:
        connector = self._create_connector(session.api_key)
        if connector is None:
            return {
                "holdings": [
                    {
                        "symbol": "RELIANCE",
                        "quantity": 10,
                        "average_price": 2800.0,
                        "ltp": 2845.5,
                        "current_value": 28455.0,
                        "invested_value": 28000.0,
                        "pnl": 455.0,
                        "pnl_percentage": 1.625,
                    },
                    {
                        "symbol": "SBIN",
                        "quantity": 20,
                        "average_price": 740.0,
                        "ltp": 751.2,
                        "current_value": 15024.0,
                        "invested_value": 14800.0,
                        "pnl": 224.0,
                        "pnl_percentage": 1.5135,
                    },
                ],
                "totalholding": {
                    "totalinvvalue": 42800.0,
                    "totalholdingvalue": 43479.0,
                    "totalprofitandloss": 679.0,
                    "totalpnlpercentage": 1.5864,
                },
                "orders": [{"order_id": "demo-1", "symbol": "RELIANCE", "status": "OPEN"}],
                "positions": [{"symbol": "NIFTY", "quantity": 50, "pnl": 1220.0}],
            }

        connector.setAccessToken(session.jwt_token)
        connector.setRefreshToken(session.refresh_token)
        connector.setFeedToken(session.feed_token)
        holdings = self._check_response(await self._run_blocking(connector.holding))
        total_holding = await self._fetch_total_holding_snapshot(connector)
        orders = self._check_response(await self._run_blocking(connector.orderBook))
        positions = self._check_response(await self._run_blocking(connector.position))
        return {
            "holdings": holdings.get("data", []),
            "totalholding": total_holding,
            "orders": orders.get("data", []),
            "positions": positions.get("data", []),
        }

    async def get_market_quote(
        self,
        session: BrokerSession,
        *,
        symbol: str,
        token: str,
        exchange: str,
    ) -> dict[str, Any]:
        connector = self._create_connector(session.api_key)
        if connector is None:
            return {
                "symbol": symbol.upper(),
                "token": str(token),
                "exchange": exchange.upper(),
                "ltp": 0.0,
                "open": None,
                "high": None,
                "low": None,
                "close": None,
                "volume": None,
                "bid": None,
                "ask": None,
                "timestamp": "mock",
            }

        connector.setAccessToken(session.jwt_token)
        connector.setRefreshToken(session.refresh_token)
        connector.setFeedToken(session.feed_token)

        response = self._check_response(
            await self._run_blocking(
                connector.ltpData,
                exchange.upper(),
                symbol.upper(),
                str(token),
            )
        )
        data = response.get("data") or {}
        return {
            "symbol": symbol.upper(),
            "token": str(token),
            "exchange": exchange.upper(),
            "ltp": self._as_float(data.get("ltp")),
            "open": self._optional_float(data.get("open")),
            "high": self._optional_float(data.get("high")),
            "low": self._optional_float(data.get("low")),
            "close": self._optional_float(data.get("close")),
            "volume": self._optional_int(
                data.get("tradeVolume") or data.get("volume") or data.get("tradevolume")
            ),
            "bid": self._optional_float(data.get("opnInterest") or data.get("bestBuyPrice")),
            "ask": self._optional_float(data.get("bestSellPrice")),
            "timestamp": str(
                data.get("exchangeTime")
                or data.get("exchFeedTime")
                or data.get("timestamp")
                or "live-quote"
            ),
        }

    async def get_market_history(
        self,
        session: BrokerSession,
        *,
        symbol: str,
        token: str,
        exchange: str,
        timeframe: str,
    ) -> list[dict[str, Any]]:
        connector = self._create_connector(session.api_key)
        if connector is None:
            return []

        connector.setAccessToken(session.jwt_token)
        connector.setRefreshToken(session.refresh_token)
        connector.setFeedToken(session.feed_token)

        interval, from_date, to_date = self._history_window(timeframe)
        response = self._check_response(
            await self._run_blocking(
                connector.getCandleData,
                {
                    "exchange": exchange.upper(),
                    "symboltoken": str(token),
                    "interval": interval,
                    "fromdate": from_date,
                    "todate": to_date,
                },
            )
        )
        rows = response.get("data") or []
        candles: list[dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, list) or len(row) < 5:
                continue
            candles.append(
                {
                    "timestamp": str(row[0]),
                    "open": self._as_float(row[1]),
                    "high": self._as_float(row[2]),
                    "low": self._as_float(row[3]),
                    "close": self._as_float(row[4]),
                    "volume": self._optional_int(row[5]) if len(row) > 5 else None,
                }
            )
        return candles

    def _check_response(self, response: dict[str, Any] | None) -> dict[str, Any]:
        if not response:
            return {}
        if not response.get("status") and not response.get("success"):
            if response.get("errorCode") == "AG8001":
                raise AngelOneAuthError(response.get("message", "Invalid or expired broker token"))
        return response

    async def lookup_symbol(self, session: BrokerSession, symbol: str) -> dict[str, str]:
        normalized_symbol = symbol.upper()
        if normalized_symbol in self._symbol_cache:
            return self._symbol_cache[normalized_symbol]
        last_failed_at = self._symbol_lookup_failures.get(normalized_symbol)
        if (
            last_failed_at is not None
            and time.monotonic() - last_failed_at < self._symbol_lookup_failure_ttl_seconds
        ):
            raise AngelOneAuthError(f"Recently failed to resolve symbol token for {symbol}")

        connector = self._create_connector(session.api_key)
        if connector is None:
            raise AngelOneAuthError(f"Symbol lookup unavailable in mock mode for {symbol}")

        connector.setAccessToken(session.jwt_token)
        connector.setRefreshToken(session.refresh_token)
        connector.setFeedToken(session.feed_token)

        try:
            search_terms = self._build_lookup_search_terms(normalized_symbol)
            exchanges = self._build_lookup_exchanges(normalized_symbol)

            for search_term in search_terms:
                for exchange in exchanges:
                    try:
                        if exchange != exchanges[0]:
                            await asyncio.sleep(0.4)

                        response = await self._run_blocking_with_retry(
                            connector.searchScrip,
                            exchange,
                            search_term,
                        )
                        for item in response.get("data", []) or []:
                            trading_symbol = str(item.get("tradingsymbol", "")).upper()
                            normalized_trading_symbol = self._normalize_lookup_symbol(
                                trading_symbol
                            )
                            if normalized_trading_symbol in {
                                self._normalize_lookup_symbol(normalized_symbol),
                                self._normalize_lookup_symbol(search_term),
                            }:
                                result = {
                                    "symbol": normalized_symbol,
                                    "token": str(item["symboltoken"]),
                                    "exchange": str(item["exchange"]).upper(),
                                }
                                self._symbol_cache[normalized_symbol] = result
                                self._symbol_lookup_failures.pop(normalized_symbol, None)
                                return result
                    except Exception as e:
                        # Back off on rate limits and continue searching other exchanges.
                        if "access rate" in str(e).lower():
                            await asyncio.sleep(2)
                            continue
                        if "internal server error" in str(e).lower():
                            continue
                        raise
        finally:
            if normalized_symbol not in self._symbol_cache:
                self._symbol_lookup_failures[normalized_symbol] = time.monotonic()

        raise AngelOneAuthError(f"Unable to resolve symbol token for {symbol}")

    def _build_lookup_exchanges(self, normalized_symbol: str) -> tuple[str, ...]:
        derivative_markers = (" CE", " PE", "FUT", "OPT", "BANKNIFTY", "NIFTY")
        if any(marker in normalized_symbol for marker in derivative_markers):
            return ("NFO", "BFO", "NSE", "BSE")
        return ("NSE", "BSE")

    def _build_lookup_search_terms(self, normalized_symbol: str) -> list[str]:
        aliases = {
            "BHARTIARTL": ["BHARTIARTL", "BHARTI AIRTEL"],
            "M&M": ["M&M", "M & M", "MAHINDRA & MAHINDRA", "MAHINDRA AND MAHINDRA"],
        }
        return aliases.get(normalized_symbol, [normalized_symbol])

    def _normalize_lookup_symbol(self, value: str) -> str:
        normalized = value.upper().removesuffix("-EQ")
        for token in (" ", "&", "-"):
            normalized = normalized.replace(token, "")
        return normalized

    async def _run_blocking_with_retry(self, func: Any, *args: Any) -> Any:
        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=2, min=2, max=10),
            retry=retry_if_exception(lambda e: "access rate" in str(e).lower()),
            reraise=True,
        )
        async def _internal():
            return await self._run_blocking(func, *args)

        return await _internal()

    async def _run_blocking(self, func: Any, *args: Any) -> Any:
        import asyncio

        return await asyncio.to_thread(func, *args)

    async def _fetch_total_holding_snapshot(self, connector: Any) -> dict[str, Any] | None:
        for method_name in ("allholding", "allHolding", "getAllHolding", "getallholding"):
            method = getattr(connector, method_name, None)
            if method is None:
                continue
            response = self._check_response(await self._run_blocking(method))
            data = response.get("data")
            if isinstance(data, dict):
                total_holding = data.get("totalholding")
                if isinstance(total_holding, dict):
                    return total_holding
                if (
                    isinstance(total_holding, list)
                    and total_holding
                    and isinstance(total_holding[0], dict)
                ):
                    return total_holding[0]
        return None

    def _history_window(self, timeframe: str) -> tuple[str, str, str]:
        now = datetime.now(UTC)
        normalized = timeframe.upper()
        if normalized == "1D":
            start = now - timedelta(days=1)
            interval = "FIVE_MINUTE"
        elif normalized == "1W":
            start = now - timedelta(days=7)
            interval = "ONE_HOUR"
        elif normalized == "1M":
            start = now - timedelta(days=30)
            interval = "ONE_DAY"
        else:
            start = now - timedelta(days=365)
            interval = "ONE_DAY"

        formatter = "%Y-%m-%d %H:%M"
        return interval, start.strftime(formatter), now.strftime(formatter)

    def _as_float(self, value: Any) -> float:
        numeric = self._optional_float(value)
        return numeric if numeric is not None else 0.0

    def _optional_float(self, value: Any) -> float | None:
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _optional_int(self, value: Any) -> int | None:
        if value in (None, ""):
            return None
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None

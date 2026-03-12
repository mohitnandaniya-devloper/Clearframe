import asyncio
from dataclasses import dataclass
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
                        "pnl": 455.0,
                    },
                    {
                        "symbol": "SBIN",
                        "quantity": 20,
                        "average_price": 740.0,
                        "ltp": 751.2,
                        "pnl": 224.0,
                    },
                ],
                "orders": [{"order_id": "demo-1", "symbol": "RELIANCE", "status": "OPEN"}],
                "positions": [{"symbol": "NIFTY", "quantity": 50, "pnl": 1220.0}],
            }

        connector.setAccessToken(session.jwt_token)
        connector.setRefreshToken(session.refresh_token)
        connector.setFeedToken(session.feed_token)
        holdings = self._check_response(await self._run_blocking(connector.holding))
        orders = self._check_response(await self._run_blocking(connector.orderBook))
        positions = self._check_response(await self._run_blocking(connector.position))
        return {
            "holdings": holdings.get("data", []),
            "orders": orders.get("data", []),
            "positions": positions.get("data", []),
        }

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

        connector = self._create_connector(session.api_key)
        if connector is None:
            raise AngelOneAuthError(f"Symbol lookup unavailable in mock mode for {symbol}")

        connector.setAccessToken(session.jwt_token)
        connector.setRefreshToken(session.refresh_token)
        connector.setFeedToken(session.feed_token)

        # Search NSE first as it is most common for Indian markets
        for exchange in ("NSE", "NFO", "BSE", "BFO"):
            try:
                # Add a small delay between exchanges to avoid rapid-fire hits
                if exchange != "NSE":
                    await asyncio.sleep(0.5)

                response = await self._run_blocking_with_retry(
                    connector.searchScrip,
                    exchange,
                    symbol,
                )
                for item in response.get("data", []) or []:
                    if str(item.get("tradingsymbol", "")).upper() == normalized_symbol:
                        result = {
                            "symbol": normalized_symbol,
                            "token": str(item["symboltoken"]),
                            "exchange": str(item["exchange"]).upper(),
                        }
                        self._symbol_cache[normalized_symbol] = result
                        return result
            except Exception as e:
                # Back off on rate limits and continue searching other exchanges.
                if "access rate" in str(e).lower():
                    await asyncio.sleep(2)
                    continue
                raise

        raise AngelOneAuthError(f"Unable to resolve symbol token for {symbol}")

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

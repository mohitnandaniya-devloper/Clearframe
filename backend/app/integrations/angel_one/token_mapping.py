from collections.abc import Iterable

DEFAULT_SYMBOLS: dict[str, tuple[str, str]] = {
    "NIFTY": ("26009", "NSE"),
    "BANKNIFTY": ("26010", "NSE"),
    "RELIANCE": ("2885", "NSE"),
    "SBIN": ("3045", "NSE"),
    "HDFCBANK": ("1333", "NSE"),
    "ICICIBANK": ("4963", "NSE"),
    "INFY": ("1594", "NSE"),
    "TCS": ("11536", "NSE"),
    "LT": ("11483", "NSE"),
    "SUNPHARMA": ("3351", "NSE"),
    "AXISBANK": ("5900", "NSE"),
}


class TokenMappingService:
    def __init__(self, seed: dict[str, tuple[str, str]] | None = None) -> None:
        self._symbol_to_token = seed or DEFAULT_SYMBOLS.copy()
        self._token_to_symbol = {
            token: symbol for symbol, (token, _) in self._symbol_to_token.items()
        }

    def register(self, symbol: str, token: str, exchange: str) -> None:
        normalized_symbol = symbol.upper()
        normalized_token = str(token)
        normalized_exchange = exchange.upper()
        self._symbol_to_token[normalized_symbol] = (normalized_token, normalized_exchange)
        self._token_to_symbol[normalized_token] = normalized_symbol

    def get_token(self, symbol: str) -> tuple[str, str]:
        normalized = symbol.upper()
        if normalized not in self._symbol_to_token:
            raise KeyError(f"Unknown symbol: {symbol}")
        return self._symbol_to_token[normalized]

    def get_symbol(self, token: str) -> str:
        if token not in self._token_to_symbol:
            raise KeyError(f"Unknown token: {token}")
        return self._token_to_symbol[token]

    def batch(self, symbols: Iterable[str]) -> list[dict[str, str]]:
        items: list[dict[str, str]] = []
        for symbol in symbols:
            token, exchange = self.get_token(symbol)
            items.append({"symbol": symbol.upper(), "token": token, "exchange": exchange})
        return items

    def batch_known(self, symbols: Iterable[str]) -> list[dict[str, str]]:
        items: list[dict[str, str]] = []
        for symbol in symbols:
            normalized = symbol.upper()
            token_exchange = self._symbol_to_token.get(normalized)
            if token_exchange is None:
                continue
            token, exchange = token_exchange
            items.append({"symbol": normalized, "token": token, "exchange": exchange})
        return items

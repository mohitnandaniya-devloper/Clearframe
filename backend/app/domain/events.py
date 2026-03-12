from datetime import UTC, datetime

import msgspec


class MarketTickEvent(msgspec.Struct):
    symbol: str
    token: str
    exchange: str
    ltp: float
    volume: int | None = None
    bid: float | None = None
    ask: float | None = None
    timestamp: str = msgspec.field(default_factory=lambda: datetime.now(UTC).isoformat())

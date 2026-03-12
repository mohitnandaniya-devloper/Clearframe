from pydantic import BaseModel, Field


class MarketSubscriptionRequest(BaseModel):
    symbols: list[str] = Field(min_length=1)
    mode: str = "LTP"


class LTPQuery(BaseModel):
    symbols: list[str] = Field(min_length=1)


class MarketDataResponse(BaseModel):
    symbol: str
    token: str
    exchange: str
    ltp: float
    volume: int | None = None
    bid: float | None = None
    ask: float | None = None
    timestamp: str

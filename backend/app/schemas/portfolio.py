from pydantic import BaseModel


class PortfolioPosition(BaseModel):
    symbol: str
    quantity: int
    average_price: float
    ltp: float
    pnl: float


class PortfolioResponse(BaseModel):
    holdings: list[PortfolioPosition]


class OrdersResponse(BaseModel):
    orders: list[dict[str, object]]


class PositionsResponse(BaseModel):
    positions: list[dict[str, object]]

from pydantic import BaseModel


class PortfolioPosition(BaseModel):
    symbol: str
    quantity: int
    average_price: float
    ltp: float
    invested_value: float
    current_value: float
    pnl: float
    pnl_percentage: float | None = None


class PortfolioSummarySnapshot(BaseModel):
    current_value: float
    invested_value: float
    total_pnl: float
    pnl_percentage: float | None = None


class PortfolioResponse(BaseModel):
    holdings: list[PortfolioPosition]
    summary: PortfolioSummarySnapshot | None = None


class OrdersResponse(BaseModel):
    orders: list[dict[str, object]]


class PositionsResponse(BaseModel):
    positions: list[dict[str, object]]

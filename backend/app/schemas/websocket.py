from pydantic import BaseModel, Field


class ClientSubscriptionMessage(BaseModel):
    action: str
    symbols: list[str] = Field(default_factory=list)
    mode: str = "LTP"

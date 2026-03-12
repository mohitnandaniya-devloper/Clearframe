from typing import Any

from pydantic import BaseModel, Field


class BrokerConnectRequest(BaseModel):
    client_code: str
    password: str
    totp: str = Field(min_length=6, max_length=6)


class BrokerStatusResponse(BaseModel):
    success: bool
    provider: str = "angel_one"
    connection_state: str
    reason_code: str
    message: str
    reconnect_required: bool = False
    retry_allowed: bool = False
    next_action: str = "none"
    request_id: str | None = None
    data: dict[str, Any] | None = None

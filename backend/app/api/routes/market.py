from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_broker_session, get_current_user, get_market_service
from app.core.rate_limit import enforce_rate_limit
from app.db.models.user import User
from app.domain.constants import SubscriptionMode
from app.integrations.angel_one.client import BrokerSession
from app.schemas.market import MarketDataResponse, MarketSubscriptionRequest
from app.services.market.service import MarketService

router = APIRouter(prefix="/market", tags=["market"], dependencies=[Depends(enforce_rate_limit)])


def parse_mode(value: str) -> SubscriptionMode:
    try:
        return SubscriptionMode[value.upper()]
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid mode") from exc


@router.post("/subscribe")
async def subscribe_market(
    payload: MarketSubscriptionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    broker_session: Annotated[BrokerSession, Depends(get_broker_session)],
    market_service: Annotated[MarketService, Depends(get_market_service)],
) -> dict[str, object]:
    try:
        return await market_service.subscribe(
            current_user.id,
            payload.symbols,
            parse_mode(payload.mode),
            broker_session,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post("/unsubscribe")
async def unsubscribe_market(
    payload: MarketSubscriptionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    broker_session: Annotated[BrokerSession, Depends(get_broker_session)],
    market_service: Annotated[MarketService, Depends(get_market_service)],
) -> dict[str, object]:
    try:
        return await market_service.unsubscribe(
            current_user.id,
            payload.symbols,
            parse_mode(payload.mode),
            broker_session,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.get("/ltp", response_model=list[MarketDataResponse])
async def market_ltp(
    symbols: Annotated[list[str], Query(min_length=1)],
    current_user: Annotated[User, Depends(get_current_user)],
    broker_session: Annotated[BrokerSession, Depends(get_broker_session)],
    market_service: Annotated[MarketService, Depends(get_market_service)],
) -> list[MarketDataResponse]:
    _ = current_user
    try:
        return await market_service.get_ltp(symbols, broker_session)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

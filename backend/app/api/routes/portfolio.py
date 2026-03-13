from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import (
    get_broker_connection_service,
    get_broker_session,
    get_current_user_email,
    get_portfolio_service,
)
from app.core.rate_limit import enforce_rate_limit
from app.integrations.angel_one.client import AngelOneAuthError, BrokerSession
from app.schemas.portfolio import OrdersResponse, PortfolioResponse, PositionsResponse
from app.services.broker.service import BrokerConnectionService
from app.services.portfolio.service import PortfolioService

router = APIRouter(prefix="", tags=["portfolio"], dependencies=[Depends(enforce_rate_limit)])


@router.get("/portfolio", response_model=PortfolioResponse)
async def portfolio(
    current_email: Annotated[str, Depends(get_current_user_email)],
    broker_session: Annotated[BrokerSession, Depends(get_broker_session)],
    portfolio_service: Annotated[PortfolioService, Depends(get_portfolio_service)],
    broker_service: Annotated[
        BrokerConnectionService, Depends(get_broker_connection_service)
    ],
    fresh: Annotated[bool, Query()] = False,
) -> PortfolioResponse:
    try:
        return await portfolio_service.get_portfolio(
            current_email,
            broker_session,
            fresh=fresh,
        )
    except AngelOneAuthError as exc:
        await broker_service.disconnect(current_email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Broker connection expired. Please reconnect to your broker.",
        ) from exc


@router.get("/orders", response_model=OrdersResponse)
async def orders(
    current_email: Annotated[str, Depends(get_current_user_email)],
    broker_session: Annotated[BrokerSession, Depends(get_broker_session)],
    portfolio_service: Annotated[PortfolioService, Depends(get_portfolio_service)],
    broker_service: Annotated[BrokerConnectionService, Depends(get_broker_connection_service)],
) -> OrdersResponse:
    try:
        return await portfolio_service.get_orders(current_email, broker_session)
    except AngelOneAuthError as exc:
        await broker_service.disconnect(current_email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Broker connection expired. Please reconnect to your broker.",
        ) from exc


@router.get("/positions", response_model=PositionsResponse)
async def positions(
    current_email: Annotated[str, Depends(get_current_user_email)],
    broker_session: Annotated[BrokerSession, Depends(get_broker_session)],
    portfolio_service: Annotated[PortfolioService, Depends(get_portfolio_service)],
    broker_service: Annotated[BrokerConnectionService, Depends(get_broker_connection_service)],
) -> PositionsResponse:
    try:
        return await portfolio_service.get_positions(current_email, broker_session)
    except AngelOneAuthError as exc:
        await broker_service.disconnect(current_email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Broker connection expired. Please reconnect to your broker.",
        ) from exc

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import (
    get_broker_connection_service,
    get_container,
    get_current_user,
    get_current_user_email,
)
from app.core.container import AppContainer
from app.core.rate_limit import enforce_rate_limit
from app.db.models.user import User
from app.schemas.broker import BrokerConnectRequest, BrokerStatusResponse
from app.services.broker.service import BrokerConnectionService

router = APIRouter(prefix="/broker", tags=["broker"], dependencies=[Depends(enforce_rate_limit)])


@router.post("/connect", response_model=BrokerStatusResponse)
async def connect_broker(
    payload: BrokerConnectRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    current_email: Annotated[str, Depends(get_current_user_email)],
    broker_service: Annotated[BrokerConnectionService, Depends(get_broker_connection_service)],
    container: Annotated[AppContainer, Depends(get_container)],
) -> BrokerStatusResponse:
    try:
        response, broker_session = await broker_service.connect(current_email, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    await container.websocket_manager.connect(current_user.id, broker_session)
    return response


@router.post("/disconnect", response_model=BrokerStatusResponse)
async def disconnect_broker(
    current_user: Annotated[User, Depends(get_current_user)],
    current_email: Annotated[str, Depends(get_current_user_email)],
    broker_service: Annotated[BrokerConnectionService, Depends(get_broker_connection_service)],
    container: Annotated[AppContainer, Depends(get_container)],
) -> BrokerStatusResponse:
    response = await broker_service.disconnect(current_email)
    await container.websocket_manager.disconnect(current_user.id)
    return response


@router.get("/status", response_model=BrokerStatusResponse)
async def broker_status(
    current_email: Annotated[str, Depends(get_current_user_email)],
    broker_service: Annotated[BrokerConnectionService, Depends(get_broker_connection_service)],
) -> BrokerStatusResponse:
    return await broker_service.status(current_email)

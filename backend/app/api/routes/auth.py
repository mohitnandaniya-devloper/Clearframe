from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.schemas.auth import RefreshRequest, TokenPair, UserCreate, UserLogin
from app.services.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenPair)
async def register(
    payload: UserCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> TokenPair:
    try:
        return await AuthService(session).register(payload)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="User already exists"
        ) from exc


@router.post("/login", response_model=TokenPair)
async def login(
    payload: UserLogin,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> TokenPair:
    try:
        return await AuthService(session).login(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    payload: RefreshRequest,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> TokenPair:
    try:
        return await AuthService(session).refresh(payload.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

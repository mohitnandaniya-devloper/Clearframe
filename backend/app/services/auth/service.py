from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.models.user import User
from app.schemas.auth import TokenPair, UserCreate, UserLogin


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def register(self, payload: UserCreate) -> TokenPair:
        user = User(email=payload.email, hashed_password=hash_password(payload.password))
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return self._token_pair(user.email)

    async def login(self, payload: UserLogin) -> TokenPair:
        result = await self.session.execute(select(User).where(User.email == payload.email))
        user = result.scalar_one_or_none()
        if user is None or not verify_password(payload.password, user.hashed_password):
            raise ValueError("Invalid credentials")
        return self._token_pair(user.email)

    async def refresh(self, refresh_token: str) -> TokenPair:
        claims = decode_token(refresh_token)
        if claims.get("type") != "refresh":
            raise ValueError("Invalid token type")
        return self._token_pair(str(claims["sub"]))

    def _token_pair(self, subject: str) -> TokenPair:
        return TokenPair(
            access_token=create_access_token(subject),
            refresh_token=create_refresh_token(subject),
        )

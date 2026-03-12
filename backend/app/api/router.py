from fastapi import APIRouter

from app.api.routes import auth, broker, health, market, portfolio
from app.api.websocket.market import router as market_ws_router
from app.core.config import get_settings

settings = get_settings()

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix=settings.api_v1_prefix)
api_router.include_router(broker.router, prefix=settings.api_v1_prefix)
api_router.include_router(market.router, prefix=settings.api_v1_prefix)
api_router.include_router(portfolio.router, prefix=settings.api_v1_prefix)
api_router.include_router(market_ws_router)

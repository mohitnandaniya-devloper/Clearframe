from __future__ import annotations

from dataclasses import dataclass

from redis.asyncio import Redis

from app.core.cache import RedisCache
from app.integrations.angel_one.client import AngelOneClient
from app.integrations.angel_one.token_mapping import TokenMappingService
from app.integrations.angel_one.websocket import SmartAPIWebSocketManager
from app.streaming.market_data_processor import MarketDataProcessor


@dataclass(slots=True)
class AppContainer:
    redis: Redis
    cache: RedisCache
    angel_one_client: AngelOneClient
    token_mapping: TokenMappingService
    market_processor: MarketDataProcessor
    websocket_manager: SmartAPIWebSocketManager

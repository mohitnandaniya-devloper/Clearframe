import msgspec

from app.domain.events import MarketTickEvent
from app.streaming.broadcaster import broadcast


class MarketDataProcessor:
    async def publish(self, event: MarketTickEvent) -> None:
        payload = msgspec.json.encode(event).decode("utf-8")
        await broadcast.publish(channel=f"market:{event.symbol}", message=payload)

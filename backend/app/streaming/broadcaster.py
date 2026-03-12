from broadcaster import Broadcast

from app.core.config import get_settings

settings = get_settings()
broadcast = Broadcast(settings.redis_url)

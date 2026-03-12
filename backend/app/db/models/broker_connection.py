from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base


class BrokerConnection(Base):
    __tablename__ = "broker_connections"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    provider: Mapped[str] = mapped_column(String(100), default="angel_one")
    client_code: Mapped[str] = mapped_column(String(100), index=True)
    api_key: Mapped[str] = mapped_column(String(255))
    jwt_token: Mapped[str] = mapped_column(Text)
    refresh_token: Mapped[str] = mapped_column(Text)
    feed_token: Mapped[str] = mapped_column(Text)
    connection_state: Mapped[str] = mapped_column(String(50), default="connected")
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

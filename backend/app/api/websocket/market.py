import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from redis.asyncio.client import PubSub

from app.core.security import decode_token
from app.schemas.websocket import ClientSubscriptionMessage

router = APIRouter()


@router.websocket("/ws/market")
async def market_socket(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token")
    if token is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    try:
        claims = decode_token(token)
        if claims.get("type") != "access":
            raise ValueError("Invalid access token")
    except ValueError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    subscriptions: set[str] = set()
    pubsub: PubSub = websocket.app.state.container.redis.pubsub()
    listener_task: asyncio.Task[None] | None = None

    async def forward_messages() -> None:
        await pubsub.psubscribe("market:*")
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message.get("type") == "pmessage":
                channel = message["channel"]
                channel_name = (
                    channel.decode("utf-8") if isinstance(channel, bytes) else str(channel)
                )
                symbol = channel_name.split(":")[-1].upper()
                if symbol not in subscriptions:
                    await asyncio.sleep(0.01)
                    continue
                data = message["data"]
                text = data.decode("utf-8") if isinstance(data, bytes) else str(data)
                await websocket.send_text(text)
            await asyncio.sleep(0.01)

    try:
        listener_task = asyncio.create_task(forward_messages())
        while True:
            message = ClientSubscriptionMessage.model_validate_json(await websocket.receive_text())
            if message.action == "subscribe":
                subscriptions.update(symbol.upper() for symbol in message.symbols)
            elif message.action == "unsubscribe":
                removed_symbols = {symbol.upper() for symbol in message.symbols}
                for symbol in removed_symbols:
                    subscriptions.discard(symbol)
    except WebSocketDisconnect:
        pass
    finally:
        if listener_task is not None:
            listener_task.cancel()
        await pubsub.punsubscribe("market:*")
        await pubsub.close()

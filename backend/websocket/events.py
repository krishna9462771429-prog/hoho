from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from typing import Optional
import json
import asyncio
import logging

from websocket.manager import manager
from middleware.auth import get_auth_client, get_current_user
from supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter()


async def verify_ws_token(token: str) -> Optional[str]:
    """Verify WebSocket token and return user ID."""
    if not token:
        logger.warning("WebSocket token is empty")
        return None

    try:
        client = get_auth_client()
        response = client.auth.get_user(token)
        if response.user:
            logger.debug(f"WebSocket auth successful for user {response.user.id}")
            return response.user.id
        else:
            logger.warning("WebSocket token verification returned no user")
    except Exception as e:
        logger.error(f"WebSocket auth failed: {e}", exc_info=True)
    return None


@router.websocket("/ws/logs")
async def websocket_logs_endpoint(websocket: WebSocket, token: str = Query(...)):
    user_id = await verify_ws_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await manager.connect(websocket, user_id)

    welcome = {
        "type": "connected",
        "message": "WebSocket connection established",
        "user_id": user_id,
    }
    try:
        await websocket.send_text(json.dumps(welcome))
    except Exception as e:
        logger.error(f"Failed to send welcome message: {e}")
        await manager.disconnect(websocket, user_id)
        return

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                try:
                    msg = json.loads(data)
                    if msg.get("type") == "ping":
                        await websocket.send_text(json.dumps({"type": "pong"}))
                    elif msg.get("type") == "subscribe":
                        await websocket.send_text(json.dumps({"type": "subscribed", "channel": msg.get("channel", "logs")}))
                except json.JSONDecodeError:
                    pass
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "heartbeat"}))
    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await manager.disconnect(websocket, user_id)


@router.websocket("/ws/events")
async def websocket_events_endpoint(websocket: WebSocket, token: str = Query(...)):
    user_id = await verify_ws_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await manager.connect(websocket, user_id)

    welcome = {
        "type": "connected",
        "message": "Events WebSocket connection established",
        "user_id": user_id,
    }
    try:
        await websocket.send_text(json.dumps(welcome))
    except Exception as e:
        logger.error(f"Failed to send welcome message: {e}")
        await manager.disconnect(websocket, user_id)
        return

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                try:
                    msg = json.loads(data)
                    if msg.get("type") == "ping":
                        await websocket.send_text(json.dumps({"type": "pong"}))
                except json.JSONDecodeError:
                    pass
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "heartbeat"}))
    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await manager.disconnect(websocket, user_id)


@router.get("/ws/stats")
async def websocket_stats(user=Depends(get_current_user)):
    return {
        "active_users": manager.get_user_count(),
        "user_connections": manager.get_connection_count(user["id"]),
    }

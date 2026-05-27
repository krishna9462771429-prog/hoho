from fastapi import WebSocket
from typing import Dict, Set, List, Any
from collections import defaultdict
import asyncio
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        async with self._lock:
            self.active_connections[user_id].add(websocket)
            logger.info(f"WebSocket connected for user {user_id}. Total connections: {len(self.active_connections[user_id])}")

    async def disconnect(self, websocket: WebSocket, user_id: str):
        async with self._lock:
            if user_id in self.active_connections:
                self.active_connections[user_id].discard(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
            logger.info(f"WebSocket disconnected for user {user_id}")

    async def send_personal(self, user_id: str, message: dict):
        message_json = json.dumps(message)
        async with self._lock:
            connections = list(self.active_connections.get(user_id, set()))
        dead_connections = []
        for connection in connections:
            try:
                await connection.send_text(message_json)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            await self.disconnect(dead, user_id)

    async def broadcast(self, message: dict):
        message_json = json.dumps(message)
        async with self._lock:
            all_connections = [
                (user_id, ws)
                for user_id, conns in self.active_connections.items()
                for ws in conns
            ]
        dead_connections = []
        for user_id, connection in all_connections:
            try:
                await connection.send_text(message_json)
            except Exception:
                dead_connections.append((user_id, connection))
        for user_id, dead in dead_connections:
            await self.disconnect(dead, user_id)

    def get_user_count(self) -> int:
        return len(self.active_connections)

    def get_connection_count(self, user_id: str) -> int:
        return len(self.active_connections.get(user_id, set()))


manager = ConnectionManager()


class EventType:
    API_STATUS_UPDATE = "api_status_update"
    NEW_LOG = "new_log"
    AI_FALLBACK_GENERATED = "ai_fallback_generated"
    TICKER_PING = "ticker_ping"
    WORKFLOW_EXECUTION = "workflow_execution"
    FAILURE_DETECTED = "failure_detected"
    DIAGNOSIS_GENERATED = "diagnosis_generated"
    RECOVERY_DETECTED = "recovery_detected"
    HIGH_LATENCY = "high_latency"


def create_event(event_type: str, data: Dict[str, Any], user_id: str = None) -> dict:
    return {
        "type": event_type,
        "data": data,
        "timestamp": data.get("timestamp") or data.get("checked_at") or data.get("created_at"),
        "user_id": user_id,
    }


async def broadcast_api_status(user_id: str, api_id: str, api_name: str, status: str, latency_ms: int, status_code: int = None):
    event = create_event(
        EventType.API_STATUS_UPDATE,
        {
            "api_id": api_id,
            "api_name": api_name,
            "status": status,
            "latency_ms": latency_ms,
            "status_code": status_code,
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        },
        user_id,
    )
    await manager.send_personal(user_id, event)


async def broadcast_new_log(user_id: str, log: Dict[str, Any]):
    event = create_event(EventType.NEW_LOG, log, user_id)
    await manager.send_personal(user_id, event)


async def broadcast_failure(user_id: str, api_id: str, api_name: str, error_message: str, latency_ms: int, status_code: int = None):
    event = create_event(
        EventType.FAILURE_DETECTED,
        {
            "api_id": api_id,
            "api_name": api_name,
            "error_message": error_message,
            "latency_ms": latency_ms,
            "status_code": status_code,
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        },
        user_id,
    )
    await manager.send_personal(user_id, event)


async def broadcast_recovery(user_id: str, api_id: str, api_name: str, latency_ms: int):
    event = create_event(
        EventType.RECOVERY_DETECTED,
        {
            "api_id": api_id,
            "api_name": api_name,
            "latency_ms": latency_ms,
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        },
        user_id,
    )
    await manager.send_personal(user_id, event)


async def broadcast_diagnosis(user_id: str, diagnosis: Dict[str, Any]):
    event = create_event(EventType.DIAGNOSIS_GENERATED, diagnosis, user_id)
    await manager.send_personal(user_id, event)


async def broadcast_ai_fallback(user_id: str, fallback: Dict[str, Any]):
    event = create_event(EventType.AI_FALLBACK_GENERATED, fallback, user_id)
    await manager.send_personal(user_id, event)


async def broadcast_workflow_execution(user_id: str, workflow_id: str, workflow_name: str, status: str, result: Dict[str, Any] = None):
    event = create_event(
        EventType.WORKFLOW_EXECUTION,
        {
            "workflow_id": workflow_id,
            "workflow_name": workflow_name,
            "status": status,
            "result": result,
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        },
        user_id,
    )
    await manager.send_personal(user_id, event)


async def broadcast_ticker_ping(user_id: str, ticker_id: str, ticker_name: str, status: str, latency_ms: int):
    event = create_event(
        EventType.TICKER_PING,
        {
            "ticker_id": ticker_id,
            "ticker_name": ticker_name,
            "status": status,
            "latency_ms": latency_ms,
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        },
        user_id,
    )
    await manager.send_personal(user_id, event)

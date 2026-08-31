"""
WebSocket Real-Time Streaming and Event Distribution Layer for SupplyChain AI Control Tower.
"""

import asyncio
from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, Optional, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages active WebSocket client connections and event broadcasting with Redis Pub/Sub support.
    """

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self.total_broadcasts = 0

    async def connect(self, websocket: WebSocket) -> None:
        """Accept incoming connection and register client."""
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
        client_host = getattr(websocket.client, "host", "unknown") if websocket.client else "unknown"
        logger.info("WebSocket client connected: %s (Total active: %d)", client_host, len(self.active_connections))

    async def disconnect(self, websocket: WebSocket) -> None:
        """Unregister client connection safely."""
        async with self._lock:
            self.active_connections.discard(websocket)
        logger.info("WebSocket client disconnected. Total active: %d", len(self.active_connections))

    async def broadcast(self, event: str, data: Any) -> dict:
        """
        Broadcast structured JSON event to all connected WebSocket clients and Redis channel.
        """
        envelope = {
            "event": event,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }
        message_text = json.dumps(envelope, default=str)
        self.total_broadcasts += 1

        # 1. Local WebSocket Client Broadcast
        dead_connections = []
        async with self._lock:
            clients = list(self.active_connections)

        for ws in clients:
            try:
                await ws.send_text(message_text)
            except Exception as err:
                logger.debug("Error sending message to WebSocket client: %s", err)
                dead_connections.append(ws)

        if dead_connections:
            async with self._lock:
                for dead in dead_connections:
                    self.active_connections.discard(dead)

        # 2. Redis Pub/Sub Distribution (if available)
        try:
            from app.core.config import redis_cache
            client = redis_cache._get_active_redis()
            if client:
                client.publish("supply_chain_events", message_text)
        except Exception as pub_err:
            logger.debug("Redis Pub/Sub event publish skipped/failed: %s", pub_err)

        return envelope

    def publish_event(self, event: str, data: Any) -> None:
        """
        Thread-safe & context-agnostic helper to dispatch events asynchronously.
        """
        try:
            loop = asyncio.get_running_loop()
            if loop.is_running():
                loop.create_task(self.broadcast(event, data))
            else:
                loop.run_until_complete(self.broadcast(event, data))
        except RuntimeError:
            try:
                new_loop = asyncio.new_event_loop()
                new_loop.run_until_complete(self.broadcast(event, data))
                new_loop.close()
            except Exception as e:
                logger.debug("Could not dispatch WebSocket event in sync context: %s", e)

    def count(self) -> int:
        """Return number of currently active client connections."""
        return len(self.active_connections)


ws_manager = ConnectionManager()

websocket_router = APIRouter(tags=["websockets"])


@websocket_router.websocket("/ws")
@websocket_router.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket endpoint for live supply chain telemetry, shipment tracking, and alert streaming.
    """
    await ws_manager.connect(websocket)
    try:
        await websocket.send_text(json.dumps({
            "event": "connection.established",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": {
                "message": "Connected to SupplyChain AI Control Tower live stream",
                "active_connections": ws_manager.count(),
            },
        }))
    except Exception:
        pass

    try:
        while True:
            text_data = await websocket.receive_text()
            try:
                msg = json.loads(text_data)
                msg_type = msg.get("type", "").lower()
                if msg_type == "ping":
                    await websocket.send_text(json.dumps({
                        "event": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "data": {"reply": "pong"},
                    }))
            except json.JSONDecodeError:
                if text_data.strip().lower() == "ping":
                    await websocket.send_text(json.dumps({
                        "event": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "data": {"reply": "pong"},
                    }))
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning("WebSocket client connection terminated: %s", e)
        await ws_manager.disconnect(websocket)


__all__ = ["ConnectionManager", "ws_manager", "websocket_router"]

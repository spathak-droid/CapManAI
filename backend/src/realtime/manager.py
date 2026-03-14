"""WebSocket connection manager for real-time features."""

import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections, user mappings, and rooms."""

    def __init__(self) -> None:
        self.active_connections: dict[int, list[WebSocket]] = {}
        self.rooms: dict[str, set[int]] = {}

    async def connect(self, websocket: WebSocket, user_id: int) -> None:
        """Accept a WebSocket connection and register it for the user."""
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int) -> None:
        """Remove a WebSocket connection for the user."""
        if user_id in self.active_connections:
            self.active_connections[user_id] = [
                ws for ws in self.active_connections[user_id] if ws != websocket
            ]
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_to_user(self, user_id: int, message: dict[str, object]) -> None:
        """Send a message to all connections for a specific user."""
        if user_id in self.active_connections:
            stale: list[WebSocket] = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    logger.warning(
                        "Failed to send to user %d, marking connection stale",
                        user_id,
                    )
                    stale.append(ws)
            # Clean up any broken connections
            for ws in stale:
                self.disconnect(ws, user_id)

    async def broadcast_to_room(
        self, room: str, message: dict[str, object]
    ) -> None:
        """Send a message to all users in a room."""
        if room in self.rooms:
            for user_id in list(self.rooms[room]):
                await self.send_to_user(user_id, message)

    async def broadcast_all(self, message: dict[str, object]) -> None:
        """Send a message to every connected user."""
        for user_id in list(self.active_connections):
            await self.send_to_user(user_id, message)

    def join_room(self, user_id: int, room: str) -> None:
        """Add a user to a named room."""
        if room not in self.rooms:
            self.rooms[room] = set()
        self.rooms[room].add(user_id)

    def leave_room(self, user_id: int, room: str) -> None:
        """Remove a user from a named room."""
        if room in self.rooms:
            self.rooms[room].discard(user_id)
            if not self.rooms[room]:
                del self.rooms[room]


# Singleton instance
manager = ConnectionManager()

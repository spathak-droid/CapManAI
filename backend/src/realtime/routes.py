"""WebSocket route for real-time communication."""

import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.auth.firebase import verify_firebase_token
from src.realtime.manager import manager

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_user_id_from_token(token: str) -> int | None:
    """Verify a Firebase token and extract the user's numeric ID.

    Returns None if the token is invalid.
    """
    try:
        payload: dict[str, Any] = verify_firebase_token(token)
        # The 'sub' claim is the Firebase UID (string).
        # We need a numeric user_id; use the 'user_id' custom claim if present,
        # otherwise hash the uid to get a stable int.
        user_id = payload.get("user_id")
        if isinstance(user_id, int):
            return user_id
        # Fall back: hash the Firebase UID for a stable integer
        firebase_uid: str = payload.get("sub", "")
        if firebase_uid:
            return hash(firebase_uid) % (10**9)
    except Exception:
        logger.warning("WebSocket token verification failed")
    return None


@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str) -> None:
    """Authenticate via token in path, then maintain a persistent connection."""
    user_id = _get_user_id_from_token(token)
    if user_id is None:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            data: dict[str, Any] = await websocket.receive_json()
            action = data.get("action")
            if action == "join_room":
                room = data.get("room")
                if isinstance(room, str):
                    manager.join_room(user_id, room)
            elif action == "leave_room":
                room = data.get("room")
                if isinstance(room, str):
                    manager.leave_room(user_id, room)
    except WebSocketDisconnect:
        logger.info("User %d disconnected", user_id)
    except Exception:
        logger.exception("WebSocket error for user %d", user_id)
    finally:
        manager.disconnect(websocket, user_id)

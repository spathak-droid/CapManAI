"""WebSocket route for real-time communication."""

import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from src.auth.firebase import verify_firebase_token
from src.db.database import async_session_factory
from src.db.models import User
from src.realtime.manager import manager

logger = logging.getLogger(__name__)

router = APIRouter()


async def _get_user_id_from_token(token: str) -> int | None:
    """Verify a Firebase token and look up the DB user.

    Returns None if the token is invalid or the user doesn't exist yet.
    The WebSocket will auto-reconnect, and by then the user should exist.
    """
    try:
        payload: dict[str, Any] = verify_firebase_token(token)
        firebase_uid: str = payload.get("sub", "")
        if not firebase_uid:
            return None

        async with async_session_factory() as db:
            result = await db.execute(
                select(User.id).where(User.firebase_uid == firebase_uid)
            )
            return result.scalar_one_or_none()
    except Exception:
        logger.warning("WebSocket token verification failed")
    return None


@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str) -> None:
    """Authenticate via token in path, then maintain a persistent connection."""
    user_id = await _get_user_id_from_token(token)
    if user_id is None:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await manager.connect(websocket, user_id)
    logger.info("User %d connected via WebSocket", user_id)
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

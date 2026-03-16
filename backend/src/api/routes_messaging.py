"""Messaging routes: announcements, direct messages, inbox, threads."""

import base64
import logging

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response as FastAPIResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import (
    AnnouncementCreate,
    AnnouncementOut,
    DirectMessageCreate,
    DirectMessageOut,
    MessageThreadSummary,
)
from src.auth.dependencies import get_current_user, require_role
from src.db.database import get_db
from src.db.models import (
    Announcement,
    DirectMessage,
    User,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Announcements endpoints
# ---------------------------------------------------------------------------


@router.post("/api/educator/announcements")
async def create_announcement(
    req: AnnouncementCreate,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> AnnouncementOut:
    """Create a new announcement (educator only)."""
    if req.priority not in ("normal", "important", "urgent"):
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Priority must be normal, important, or urgent",
        )
    announcement = Announcement(
        educator_id=_user.id,
        title=req.title,
        content=req.content,
        priority=req.priority,
    )
    db.add(announcement)
    await db.commit()
    await db.refresh(announcement)
    return AnnouncementOut(
        id=announcement.id,
        educator_id=announcement.educator_id,
        educator_name=_user.name or _user.username,
        title=announcement.title,
        content=announcement.content,
        priority=announcement.priority,
        created_at=announcement.created_at.isoformat(),
    )


@router.get("/api/educator/announcements")
async def list_announcements(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AnnouncementOut]:
    """List all announcements, most recent first (max 50)."""
    result = await db.execute(
        select(Announcement)
        .order_by(Announcement.created_at.desc())
        .limit(50)
    )
    announcements = result.scalars().all()

    # Build educator name lookup
    educator_ids = {a.educator_id for a in announcements}
    educators: dict[int, User] = {}
    for eid in educator_ids:
        user = await db.get(User, eid)
        if user:
            educators[eid] = user

    return [
        AnnouncementOut(
            id=a.id,
            educator_id=a.educator_id,
            educator_name=(
                educators[a.educator_id].name or educators[a.educator_id].username
            )
            if a.educator_id in educators
            else "Unknown",
            title=a.title,
            content=a.content,
            priority=a.priority,
            created_at=a.created_at.isoformat(),
        )
        for a in announcements
    ]


@router.delete("/api/educator/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: int,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Delete an announcement (educator only, must own it)."""
    from fastapi import HTTPException, status

    announcement = await db.get(Announcement, announcement_id)
    if announcement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )
    if announcement.educator_id != _user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own announcements",
        )
    await db.delete(announcement)
    await db.commit()
    return {"status": "ok", "message": "Announcement deleted"}


# ---------------------------------------------------------------------------
# Direct Messages endpoints
# ---------------------------------------------------------------------------


@router.post("/api/educator/messages")
async def send_educator_message(
    req: DirectMessageCreate,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> DirectMessageOut:
    """Send a direct message from educator to student."""
    from fastapi import HTTPException, status

    recipient = await db.get(User, req.recipient_id)
    if recipient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found",
        )
    image_data = None
    image_content_type = None
    if req.image_data_b64:
        image_data = base64.b64decode(req.image_data_b64)
        image_content_type = req.image_content_type or "image/png"

    msg = DirectMessage(
        sender_id=_user.id,
        recipient_id=req.recipient_id,
        content=req.content,
        image_data=image_data,
        image_content_type=image_content_type,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    # Push real-time notification to recipient
    from src.realtime.events import EventType, create_event
    from src.realtime.manager import manager

    await manager.send_to_user(
        req.recipient_id,
        create_event(EventType.NEW_MESSAGE, {
            "message_id": msg.id,
            "sender_id": _user.id,
            "sender_name": _user.name or _user.username,
            "preview": msg.content[:100],
        }),
    )

    return DirectMessageOut(
        id=msg.id,
        sender_id=msg.sender_id,
        sender_name=_user.name or _user.username,
        recipient_id=msg.recipient_id,
        recipient_name=recipient.name or recipient.username,
        content=msg.content,
        image_url=f"/api/messages/image/{msg.id}" if msg.image_data else None,
        is_read=msg.is_read,
        created_at=msg.created_at.isoformat(),
    )


@router.get("/api/educator/messages/threads")
async def get_educator_message_threads(
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> list[MessageThreadSummary]:
    """List all message threads for an educator (with last message and unread count)."""
    # Get all users the educator has exchanged messages with
    result = await db.execute(
        select(DirectMessage)
        .where(
            or_(
                DirectMessage.sender_id == _user.id,
                DirectMessage.recipient_id == _user.id,
            )
        )
        .order_by(DirectMessage.created_at.desc())
    )
    messages = result.scalars().all()

    # Group by the other user
    threads: dict[int, dict[str, object]] = {}
    for msg in messages:
        other_id = (
            msg.recipient_id if msg.sender_id == _user.id else msg.sender_id
        )
        if other_id not in threads:
            threads[other_id] = {
                "last_message": msg.content,
                "last_message_at": msg.created_at.isoformat(),
                "unread_count": 0,
            }
        # Count unread messages sent TO the educator
        if msg.recipient_id == _user.id and not msg.is_read:
            threads[other_id]["unread_count"] = int(threads[other_id]["unread_count"]) + 1  # type: ignore[arg-type]

    # Fetch user info for each thread
    summaries: list[MessageThreadSummary] = []
    for other_id, thread_data in threads.items():
        other_user = await db.get(User, other_id)
        if other_user:
            summaries.append(
                MessageThreadSummary(
                    user_id=other_id,
                    username=other_user.username,
                    name=other_user.name,
                    last_message=str(thread_data["last_message"]),
                    last_message_at=str(thread_data["last_message_at"]),
                    unread_count=int(thread_data["unread_count"]),  # type: ignore[arg-type]
                )
            )
    return summaries


@router.get("/api/educator/messages/{user_id}")
async def get_educator_thread(
    user_id: int,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> list[DirectMessageOut]:
    """Get full message thread between educator and a specific student."""
    result = await db.execute(
        select(DirectMessage)
        .where(
            or_(
                (DirectMessage.sender_id == _user.id)
                & (DirectMessage.recipient_id == user_id),
                (DirectMessage.sender_id == user_id)
                & (DirectMessage.recipient_id == _user.id),
            )
        )
        .order_by(DirectMessage.created_at.asc())
    )
    messages = result.scalars().all()

    # Fetch user names
    users_cache: dict[int, User] = {}

    async def _get_user(uid: int) -> User | None:
        if uid not in users_cache:
            u = await db.get(User, uid)
            if u:
                users_cache[uid] = u
        return users_cache.get(uid)

    out: list[DirectMessageOut] = []
    for msg in messages:
        sender = await _get_user(msg.sender_id)
        recipient = await _get_user(msg.recipient_id)
        out.append(
            DirectMessageOut(
                id=msg.id,
                sender_id=msg.sender_id,
                sender_name=(sender.name or sender.username) if sender else "Unknown",
                recipient_id=msg.recipient_id,
                recipient_name=(
                    (recipient.name or recipient.username) if recipient else "Unknown"
                ),
                content=msg.content,
                image_url=f"/api/messages/image/{msg.id}" if msg.image_data else None,
                is_read=msg.is_read,
                created_at=msg.created_at.isoformat(),
            )
        )
    return out


@router.post("/api/messages/reply")
async def student_reply(
    req: DirectMessageCreate,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DirectMessageOut:
    """Student replies to an educator message."""
    from fastapi import HTTPException, status

    recipient = await db.get(User, req.recipient_id)
    if recipient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found",
        )

    image_data = None
    image_content_type = None
    if req.image_data_b64:
        image_data = base64.b64decode(req.image_data_b64)
        image_content_type = req.image_content_type or "image/png"

    msg = DirectMessage(
        sender_id=_user.id,
        recipient_id=req.recipient_id,
        content=req.content,
        image_data=image_data,
        image_content_type=image_content_type,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    # Push real-time notification to recipient
    from src.realtime.events import EventType, create_event
    from src.realtime.manager import manager

    await manager.send_to_user(
        req.recipient_id,
        create_event(EventType.NEW_MESSAGE, {
            "message_id": msg.id,
            "sender_id": _user.id,
            "sender_name": _user.name or _user.username,
            "preview": msg.content[:100],
        }),
    )

    return DirectMessageOut(
        id=msg.id,
        sender_id=msg.sender_id,
        sender_name=_user.name or _user.username,
        recipient_id=msg.recipient_id,
        recipient_name=recipient.name or recipient.username,
        content=msg.content,
        image_url=f"/api/messages/image/{msg.id}" if msg.image_data else None,
        is_read=msg.is_read,
        created_at=msg.created_at.isoformat(),
    )


@router.get("/api/messages/inbox")
async def student_inbox(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MessageThreadSummary]:
    """Student gets their message threads."""
    result = await db.execute(
        select(DirectMessage)
        .where(
            or_(
                DirectMessage.sender_id == _user.id,
                DirectMessage.recipient_id == _user.id,
            )
        )
        .order_by(DirectMessage.created_at.desc())
    )
    messages = result.scalars().all()

    threads: dict[int, dict[str, object]] = {}
    for msg in messages:
        other_id = (
            msg.recipient_id if msg.sender_id == _user.id else msg.sender_id
        )
        if other_id not in threads:
            threads[other_id] = {
                "last_message": msg.content,
                "last_message_at": msg.created_at.isoformat(),
                "unread_count": 0,
            }
        if msg.recipient_id == _user.id and not msg.is_read:
            threads[other_id]["unread_count"] = int(threads[other_id]["unread_count"]) + 1  # type: ignore[arg-type]

    summaries: list[MessageThreadSummary] = []
    for other_id, thread_data in threads.items():
        other_user = await db.get(User, other_id)
        if other_user:
            summaries.append(
                MessageThreadSummary(
                    user_id=other_id,
                    username=other_user.username,
                    name=other_user.name,
                    last_message=str(thread_data["last_message"]),
                    last_message_at=str(thread_data["last_message_at"]),
                    unread_count=int(thread_data["unread_count"]),  # type: ignore[arg-type]
                )
            )
    return summaries


@router.get("/api/messages/thread/{educator_id}")
async def student_thread(
    educator_id: int,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DirectMessageOut]:
    """Student gets thread with a specific educator."""
    result = await db.execute(
        select(DirectMessage)
        .where(
            or_(
                (DirectMessage.sender_id == _user.id)
                & (DirectMessage.recipient_id == educator_id),
                (DirectMessage.sender_id == educator_id)
                & (DirectMessage.recipient_id == _user.id),
            )
        )
        .order_by(DirectMessage.created_at.asc())
    )
    messages = result.scalars().all()

    users_cache: dict[int, User] = {}

    async def _get_user(uid: int) -> User | None:
        if uid not in users_cache:
            u = await db.get(User, uid)
            if u:
                users_cache[uid] = u
        return users_cache.get(uid)

    out: list[DirectMessageOut] = []
    for msg in messages:
        sender = await _get_user(msg.sender_id)
        recipient = await _get_user(msg.recipient_id)
        out.append(
            DirectMessageOut(
                id=msg.id,
                sender_id=msg.sender_id,
                sender_name=(sender.name or sender.username) if sender else "Unknown",
                recipient_id=msg.recipient_id,
                recipient_name=(
                    (recipient.name or recipient.username) if recipient else "Unknown"
                ),
                content=msg.content,
                image_url=f"/api/messages/image/{msg.id}" if msg.image_data else None,
                is_read=msg.is_read,
                created_at=msg.created_at.isoformat(),
            )
        )
    return out


@router.put("/api/messages/{message_id}/read")
async def mark_message_read(
    message_id: int,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Mark a message as read (must be the recipient)."""
    from fastapi import HTTPException, status

    msg = await db.get(DirectMessage, message_id)
    if msg is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found",
        )
    if msg.recipient_id != _user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only mark messages sent to you as read",
        )
    msg.is_read = True
    await db.commit()
    return {"status": "ok", "message": "Message marked as read"}


@router.get("/api/messages/educators")
async def list_educators_for_student(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    """Return all educators so students can initiate conversations."""
    result = await db.execute(
        select(User).where(User.role == "educator").order_by(User.username)
    )
    educators = result.scalars().all()
    return [
        {"id": e.id, "username": e.username, "name": e.name}
        for e in educators
    ]


@router.post("/api/messages/upload-image")
async def upload_message_image(
    file: UploadFile = File(...),
    _user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Upload an image for use in a message. Returns base64-encoded data."""
    from fastapi import HTTPException, status

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image files are allowed",
        )

    # Max 5MB
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image too large (max 5MB)",
        )

    b64 = base64.b64encode(contents).decode("ascii")
    return {"image_data_b64": b64, "content_type": file.content_type or "image/png"}


@router.get("/api/messages/image/{message_id}")
async def get_message_image(
    message_id: int,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FastAPIResponse:
    """Serve a message image from the database."""
    from fastapi import HTTPException, status

    result = await db.execute(
        select(DirectMessage).where(DirectMessage.id == message_id)
    )
    msg = result.scalar_one_or_none()
    if not msg or not msg.image_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Image not found"
        )
    # Verify user is sender or recipient
    if msg.sender_id != _user.id and msg.recipient_id != _user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized"
        )
    return FastAPIResponse(
        content=msg.image_data,
        media_type=msg.image_content_type or "image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/api/messages/unread-count")
async def get_unread_message_count(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    """Get total unread message count for the current user (used for nav badge)."""
    result = await db.execute(
        select(func.count(DirectMessage.id)).where(
            DirectMessage.recipient_id == _user.id,
            DirectMessage.is_read == False,  # noqa: E712
        )
    )
    count = result.scalar() or 0
    return {"unread_count": count}

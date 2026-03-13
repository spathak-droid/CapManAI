"""Conversation and message persistence for the AI assistant."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import AssistantConversation, AssistantMessage


def _title_from_content(content: str, max_len: int = 50) -> str:
    """Use first line or first max_len chars as title."""
    first_line = content.split("\n")[0].strip()
    if len(first_line) <= max_len:
        return first_line or "New chat"
    return first_line[: max_len - 3].rstrip() + "..."


async def list_conversations(
    user_id: int, db: AsyncSession
) -> list[AssistantConversation]:
    """List conversations for the user, newest first."""
    result = await db.execute(
        select(AssistantConversation)
        .where(AssistantConversation.user_id == user_id)
        .order_by(AssistantConversation.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_conversation(
    conversation_id: int, user_id: int, db: AsyncSession
) -> tuple[AssistantConversation, list[AssistantMessage]] | None:
    """Load a conversation with messages; returns None if not found or not owned.
    Returns (conversation, ordered_messages) to avoid lazy-loading the relationship.
    """
    result = await db.execute(
        select(AssistantConversation).where(
            AssistantConversation.id == conversation_id,
            AssistantConversation.user_id == user_id,
        )
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        return None
    msg_result = await db.execute(
        select(AssistantMessage)
        .where(AssistantMessage.conversation_id == conversation_id)
        .order_by(AssistantMessage.created_at.asc())
    )
    messages = list(msg_result.scalars().all())
    return (conv, messages)


async def create_conversation(
    user_id: int, title: str, db: AsyncSession
) -> AssistantConversation:
    """Create an empty conversation."""
    conv = AssistantConversation(user_id=user_id, title=title)
    db.add(conv)
    await db.flush()
    await db.refresh(conv)
    return conv


async def get_or_create_conversation_for_chat(
    conversation_id: int | None,
    user_id: int,
    first_user_content: str,
    db: AsyncSession,
) -> tuple[AssistantConversation, bool]:
    """Get existing conversation or create one. Returns (conversation, created)."""
    if conversation_id is not None:
        pair = await get_conversation(conversation_id, user_id, db)
        if pair is not None:
            conv, _ = pair
            return conv, False
    title = _title_from_content(first_user_content)
    conv = await create_conversation(user_id, title, db)
    return conv, True


async def append_messages(
    conversation_id: int,
    user_content: str,
    assistant_content: str,
    db: AsyncSession,
) -> None:
    """Append one user and one assistant message; update conversation updated_at."""
    db.add(
        AssistantMessage(
            conversation_id=conversation_id,
            role="user",
            content=user_content,
        )
    )
    db.add(
        AssistantMessage(
            conversation_id=conversation_id,
            role="assistant",
            content=assistant_content,
        )
    )
    # updated_at is set by onupdate=datetime.utcnow when we commit
    await db.flush()


async def update_conversation_title(
    conversation_id: int, user_id: int, title: str, db: AsyncSession
) -> bool:
    """Update conversation title; returns False if not found or not owned."""
    result = await db.execute(
        select(AssistantConversation).where(
            AssistantConversation.id == conversation_id,
            AssistantConversation.user_id == user_id,
        )
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        return False
    conv.title = title
    await db.flush()
    return True


async def delete_conversation(
    conversation_id: int, user_id: int, db: AsyncSession
) -> bool:
    """Delete conversation and its messages; returns False if not found or not owned."""
    result = await db.execute(
        select(AssistantConversation).where(
            AssistantConversation.id == conversation_id,
            AssistantConversation.user_id == user_id,
        )
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        return False
    await db.delete(conv)
    await db.flush()
    return True

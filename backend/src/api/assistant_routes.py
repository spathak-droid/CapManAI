"""API routes for the AI assistant (chat + saved conversations)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantConversationDetail,
    AssistantConversationListItem,
    AssistantConversationRenameRequest,
    AssistantMessageOut,
    AssistantMessageSchema,
)
from src.assistant.context import fetch_student_analysis_context, format_student_context
from src.assistant.llm import ASSISTANT_SYSTEM_PROMPT, EDUCATOR_SYSTEM_PROMPT, chat_completion
from src.assistant.service import (
    append_messages,
    delete_conversation,
    get_conversation,
    get_or_create_conversation_for_chat,
    list_conversations,
    update_conversation_title,
)
from src.auth.dependencies import get_current_user
from src.db.database import get_db
from src.db.models import User

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.get("/conversations", response_model=list[AssistantConversationListItem])
async def list_user_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AssistantConversationListItem]:
    """List conversations for the current user, newest first."""
    convs = await list_conversations(user.id, db)
    await db.commit()
    return [
        AssistantConversationListItem(
            id=c.id,
            title=c.title,
            created_at=c.created_at.isoformat() if c.created_at else "",
            updated_at=c.updated_at.isoformat() if c.updated_at else "",
        )
        for c in convs
    ]


@router.get(
    "/conversations/{conversation_id}",
    response_model=AssistantConversationDetail,
)
async def get_one_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssistantConversationDetail:
    """Get one conversation with all messages. 403 if not owner."""
    pair = await get_conversation(conversation_id, user.id, db)
    if pair is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    conv, messages = pair
    await db.commit()
    return AssistantConversationDetail(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at.isoformat() if conv.created_at else "",
        updated_at=conv.updated_at.isoformat() if conv.updated_at else "",
        messages=[
            AssistantMessageOut(
                id=m.id,
                role=m.role,  # type: ignore[arg-type]
                content=m.content,
                created_at=m.created_at.isoformat() if m.created_at else "",
            )
            for m in messages
        ],
    )


@router.post("/chat", response_model=AssistantChatResponse)
async def assistant_chat(
    body: AssistantChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssistantChatResponse:
    """Send messages to the LLM; create or update conversation and return assistant reply."""
    if not body.messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="messages must not be empty",
        )
    last_user = next(
        (m for m in reversed(body.messages) if m.role == "user"),
        None,
    )
    if last_user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Last message must be from user",
        )
    conv, _ = await get_or_create_conversation_for_chat(
        body.conversation_id,
        user.id,
        last_user.content,
        db,
    )
    # Choose system prompt and context based on role
    if user.role == "educator":
        system_prompt = EDUCATOR_SYSTEM_PROMPT
        if body.student_context_id:
            student_data = await fetch_student_analysis_context(db, body.student_context_id)
            student_context = format_student_context(student_data)
            system_prompt = f"{EDUCATOR_SYSTEM_PROMPT}\n\n---\n\n{student_context}"
    else:
        system_prompt = ASSISTANT_SYSTEM_PROMPT

    openrouter_messages = [
        {"role": "system", "content": system_prompt},
        *[{"role": m.role, "content": m.content} for m in body.messages],
    ]
    assistant_content = await chat_completion(openrouter_messages)
    await append_messages(conv.id, last_user.content, assistant_content, db)
    await db.commit()
    return AssistantChatResponse(
        conversation_id=conv.id,
        message=AssistantMessageSchema(role="assistant", content=assistant_content),
    )


@router.patch("/conversations/{conversation_id}")
async def rename_conversation(
    conversation_id: int,
    body: AssistantConversationRenameRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Rename a conversation. 404 if not found or not owner."""
    ok = await update_conversation_title(
        conversation_id, user.id, body.title, db
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    await db.commit()
    return {"status": "ok"}


@router.delete("/conversations/{conversation_id}")
async def remove_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Delete a conversation and its messages. 404 if not found or not owner."""
    ok = await delete_conversation(conversation_id, user.id, db)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    await db.commit()
    return {"status": "ok"}

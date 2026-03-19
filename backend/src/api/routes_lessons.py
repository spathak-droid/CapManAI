"""Lesson module and chunk routes."""

import logging
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import (
    ChunkCompleteResponse,
    LessonChunkDetail,
    LessonModuleDetail,
    LessonModuleSummary,
    LessonProgressSummary,
    QuizAttemptRequest,
    QuizAttemptResponse,
    StreakInfo,
)
from src.auth.dependencies import require_role
from src.db.database import get_db
from src.db.models import (
    LessonChunk,
    LessonModule,
    LessonQuizItem,
    User,
    XPLog,
)
from src.lessons.repository import (
    fetch_chunk_def,
    fetch_chunks_for_module,
    fetch_module_detail,
    fetch_modules,
)
from src.lessons.service import (
    attempt_chunk,
    complete_chunk,
    get_chunk,
    get_module,
    get_progress_summary,
    get_streak,
    list_module_chunks,
    list_modules,
)
from src.rag.retriever import get_context

logger = logging.getLogger(__name__)

router = APIRouter()


def _to_chunk_response(chunk: Any) -> LessonChunkDetail:
    chunk_data = dict(vars(chunk))
    chunk_data["quiz_items"] = [
        {
            "item_id": item.item_id,
            "item_type": item.item_type,
            "prompt": item.prompt,
            "options": item.options,
            "correct_option_id": getattr(item, "correct_option_id", None),
            "explanation": item.explanation,
            "why_it_matters": item.why_it_matters,
        }
        for item in chunk.quiz_items
    ]
    return LessonChunkDetail.model_validate(chunk_data)


@router.get("/api/lessons/modules")
async def get_lesson_modules(
    _user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> list[LessonModuleSummary]:
    """List all lesson modules in learning order (from DB; fallback to in-memory if DB empty)."""
    modules = await fetch_modules(db)
    if not modules:
        modules = list_modules()

    results: list[LessonModuleSummary] = []
    for module in modules:
        locked = False
        locked_reason: str | None = None
        results.append(
            LessonModuleSummary(
                module_id=module.module_id,
                title=module.title,
                track=module.track,
                order=module.order,
                objective=module.objective,
                estimated_minutes=module.estimated_minutes,
                prerequisite_ids=module.prerequisite_ids,
                chunk_ids=module.chunk_ids,
                chunk_count=len(module.chunk_ids),
                locked=locked,
                locked_reason=locked_reason,
            )
        )
    return results


@router.get("/api/lessons/modules/{module_id}")
async def get_lesson_module_detail(
    module_id: str,
    _user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> LessonModuleDetail:
    """Get one lesson module with all chunks (from DB; fallback to in-memory if not in DB)."""
    module = await fetch_module_detail(db, module_id)
    if module is None:
        module = get_module(module_id)
    if module is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson module not found",
        )
    chunks = await fetch_chunks_for_module(db, module_id)
    if not chunks:
        chunks = list_module_chunks(module_id)
    return LessonModuleDetail(
        module_id=module.module_id,
        title=module.title,
        track=module.track,
        order=module.order,
        objective=module.objective,
        estimated_minutes=module.estimated_minutes,
        prerequisite_ids=module.prerequisite_ids,
        chunk_ids=module.chunk_ids,
        chunk_count=len(module.chunk_ids),
        chunks=[_to_chunk_response(chunk) for chunk in chunks],
    )


@router.get("/api/lessons/chunks/{chunk_id}")
async def get_lesson_chunk(
    chunk_id: str,
    _user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> LessonChunkDetail:
    """Get one lesson chunk (from DB; fallback to in-memory if not in DB)."""
    chunk = await fetch_chunk_def(db, chunk_id)
    if chunk is None:
        chunk = get_chunk(chunk_id)
    if chunk is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson chunk not found",
        )
    response = _to_chunk_response(chunk)
    rag_ctx = await get_context(db, query=chunk.learning_goal, top_k=3, for_display=True)
    response.supplementary_context = rag_ctx
    return response


@router.post("/api/lessons/chunks/{chunk_id}/attempt")
async def attempt_lesson_chunk(
    chunk_id: str,
    req: QuizAttemptRequest,
    _user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> QuizAttemptResponse:
    """Submit quiz attempt (chunk from DB; fallback to in-memory if not in DB)."""
    chunk = await fetch_chunk_def(db, chunk_id)
    if chunk is None:
        chunk = get_chunk(chunk_id)
    if chunk is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson chunk not found",
        )
    answers_by_item = {
        answer.item_id: (answer.selected_option_id or answer.response_text or "")
        for answer in req.answers
    }
    result = await attempt_chunk(_user.id, chunk_id, answers_by_item, db, chunk)
    xp_earned = int(result.get("xp_earned", 0))  # type: ignore[arg-type]

    # Log XP event (User row already updated inside service)
    try:
        if isinstance(_user, User) and xp_earned > 0:
            db.add(XPLog(user_id=_user.id, amount=xp_earned, source="lesson_attempt"))
            await db.commit()
    except Exception:
        pass

    return QuizAttemptResponse.model_validate(result)


@router.post("/api/lessons/chunks/{chunk_id}/complete")
async def complete_lesson_chunk(
    chunk_id: str,
    _user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> ChunkCompleteResponse:
    """Mark chunk complete and award chunk XP (chunk from DB or in-memory)."""
    chunk = await fetch_chunk_def(db, chunk_id)
    if chunk is None:
        chunk = get_chunk(chunk_id)
    if chunk is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson chunk not found",
        )
    result = await complete_chunk(_user.id, chunk_id, db)
    xp_earned = int(result.get("xp_earned", 0))  # type: ignore[arg-type]

    # Log XP event (User row already updated inside service)
    try:
        if isinstance(_user, User) and xp_earned > 0:
            db.add(XPLog(user_id=_user.id, amount=xp_earned, source="lesson_complete"))
            await db.commit()
    except Exception:
        pass

    return ChunkCompleteResponse.model_validate(result)


@router.get("/api/lessons/progress/me")
async def get_my_lesson_progress(
    _user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> LessonProgressSummary:
    """Get aggregate lesson progress (modules from DB; fallback to in-memory if DB empty)."""
    modules = await fetch_modules(db)
    if not modules:
        modules = list_modules()
    return LessonProgressSummary.model_validate(
        await get_progress_summary(_user.id, db, modules)
    )


@router.get("/api/lessons/streak/me")
async def get_my_lesson_streak(
    _user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> StreakInfo:
    """Get current lesson streak for the current user."""
    return StreakInfo.model_validate(await get_streak(_user.id, db))


@router.get("/api/lessons/catalog/status")
async def get_lessons_catalog_status(
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Educator-facing DB status of lesson catalog for verification."""
    module_count = (
        await db.execute(select(func.count()).select_from(LessonModule))
    ).scalar_one()
    chunk_count = (
        await db.execute(select(func.count()).select_from(LessonChunk))
    ).scalar_one()
    quiz_count = (
        await db.execute(select(func.count()).select_from(LessonQuizItem))
    ).scalar_one()
    first_chunk = (
        await db.execute(
            select(LessonChunk).where(LessonChunk.chunk_id == "f1-ch1")
        )
    ).scalar_one_or_none()

    return {
        "module_count": int(module_count or 0),
        "chunk_count": int(chunk_count or 0),
        "quiz_item_count": int(quiz_count or 0),
        "seeded_first_chunk_title": first_chunk.title if first_chunk else None,
        "seeded_first_chunk_goal": first_chunk.learning_goal if first_chunk else None,
    }


@router.get("/api/lessons/catalog/chunks/{chunk_id}")
async def get_lessons_catalog_chunk(
    chunk_id: str,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Educator-facing DB preview of one seeded lesson chunk."""
    chunk = (
        await db.execute(
            select(LessonChunk).where(LessonChunk.chunk_id == chunk_id)
        )
    ).scalar_one_or_none()
    if chunk is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson chunk not found in DB",
        )

    quiz_items = (
        await db.execute(
            select(LessonQuizItem)
            .where(LessonQuizItem.chunk_id == chunk_id)
            .order_by(LessonQuizItem.order_index)
        )
    ).scalars().all()

    return {
        "chunk_id": chunk.chunk_id,
        "title": chunk.title,
        "learning_goal": chunk.learning_goal,
        "explain_text": chunk.explain_text,
        "example_text": chunk.example_text,
        "key_takeaway": chunk.key_takeaway,
        "common_mistakes": chunk.common_mistakes,
        "quick_check_prompts": chunk.quick_check_prompts,
        "quiz_items": [
            {
                "item_id": item.item_id,
                "item_type": item.item_type,
                "prompt": item.prompt,
                "options": item.options,
                "correct_option_id": item.correct_option_id,
                "explanation": item.explanation,
                "why_it_matters": item.why_it_matters,
            }
            for item in quiz_items
        ],
    }

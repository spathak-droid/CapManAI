"""Read lesson modules and chunks from the database (source of truth)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.models import LessonChunk, LessonModule, LessonQuizItem
from src.lessons.service import ChunkDef, ModuleDef, QuizItemDef


async def get_ordered_structure(
    db: AsyncSession,
) -> tuple[list[str], dict[str, list[str]]]:
    """Return (ordered_module_ids, module_id -> list[chunk_id])."""
    result = await db.execute(
        select(LessonModule.module_id).order_by(LessonModule.order_index)
    )
    ordered_ids = [row[0] for row in result.all()]
    chunk_ids_by_module: dict[str, list[str]] = {}
    for module_id in ordered_ids:
        chunks = await db.execute(
            select(LessonChunk.chunk_id).where(
                LessonChunk.module_id == module_id
            ).order_by(LessonChunk.order_index)
        )
        chunk_ids_by_module[module_id] = [r[0] for r in chunks.all()]
    return ordered_ids, chunk_ids_by_module


async def fetch_modules(db: AsyncSession) -> list[ModuleDef]:
    """List all modules in order, with chunk_ids from DB."""
    ordered_ids, chunk_ids_by_module = await get_ordered_structure(db)
    if not ordered_ids:
        return []

    result = await db.execute(
        select(LessonModule).where(
            LessonModule.module_id.in_(ordered_ids)
        ).order_by(LessonModule.order_index)
    )
    rows = list(result.scalars().all())
    return [
        ModuleDef(
            module_id=m.module_id,
            title=m.title,
            track=m.track,
            order=m.order_index,
            objective=m.objective,
            estimated_minutes=m.estimated_minutes,
            prerequisite_ids=m.prerequisite_ids or [],
            chunk_ids=chunk_ids_by_module.get(m.module_id, []),
        )
        for m in rows
    ]


async def fetch_module_detail(
    db: AsyncSession, module_id: str
) -> ModuleDef | None:
    """Get one module with chunk_ids; chunks are loaded separately for detail."""
    result = await db.execute(
        select(LessonModule).where(LessonModule.module_id == module_id)
    )
    m = result.scalar_one_or_none()
    if m is None:
        return None
    _, chunk_ids_by_module = await get_ordered_structure(db)
    return ModuleDef(
        module_id=m.module_id,
        title=m.title,
        track=m.track,
        order=m.order_index,
        objective=m.objective,
        estimated_minutes=m.estimated_minutes,
        prerequisite_ids=m.prerequisite_ids or [],
        chunk_ids=chunk_ids_by_module.get(m.module_id, []),
    )


def _quiz_item_from_row(q: LessonQuizItem) -> QuizItemDef:
    options = q.options or []
    return QuizItemDef(
        item_id=q.item_id,
        item_type=q.item_type,
        prompt=q.prompt,
        options=[{"id": o.get("id", ""), "text": o.get("text", "")} for o in options],
        correct_option_id=q.correct_option_id,
        explanation=q.explanation,
        why_it_matters=q.why_it_matters,
    )


async def fetch_chunk_def(db: AsyncSession, chunk_id: str) -> ChunkDef | None:
    """Load a single chunk with quiz items from DB as ChunkDef."""
    result = await db.execute(
        select(LessonChunk).where(LessonChunk.chunk_id == chunk_id)
    )
    c = result.scalar_one_or_none()
    if c is None:
        return None

    items_result = await db.execute(
        select(LessonQuizItem).where(
            LessonQuizItem.chunk_id == chunk_id
        ).order_by(LessonQuizItem.order_index)
    )
    quiz_items = [_quiz_item_from_row(q) for q in items_result.scalars().all()]

    return ChunkDef(
        chunk_id=c.chunk_id,
        module_id=c.module_id,
        order=c.order_index,
        title=c.title,
        estimated_minutes=c.estimated_minutes,
        learning_goal=c.learning_goal,
        explain_text=c.explain_text,
        example_text=c.example_text,
        key_takeaway=c.key_takeaway,
        common_mistakes=c.common_mistakes or [],
        quick_check_prompts=c.quick_check_prompts or [],
        quiz_items=quiz_items,
    )


async def fetch_chunks_for_module(
    db: AsyncSession, module_id: str
) -> list[ChunkDef]:
    """Load all chunks for a module in order."""
    result = await db.execute(
        select(LessonChunk).where(
            LessonChunk.module_id == module_id
        ).order_by(LessonChunk.order_index)
    )
    chunks = list(result.scalars().all())
    out = []
    for c in chunks:
        defn = await fetch_chunk_def(db, c.chunk_id)
        if defn is not None:
            out.append(defn)
    return out

"""Persist lesson catalog content into DB for review/editing."""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import LessonChunk, LessonModule, LessonQuizItem
from src.lessons.service import ORDERED_MODULE_IDS, CHUNKS, MODULES


def _is_placeholder_content(learning_goal: str) -> bool:
    return learning_goal.startswith("Understand ") and "one clear concept" in learning_goal


async def seed_lessons_to_db(db: AsyncSession) -> None:
    """Seed lesson content into DB. Reseeds when placeholder content is detected."""
    existing_modules = await db.execute(select(LessonModule))
    modules = list(existing_modules.scalars().all())

    should_reseed = False
    if len(modules) != len(ORDERED_MODULE_IDS):
        should_reseed = True
    else:
        # Check f1-ch1 for placeholder content
        first_chunk = await db.execute(
            select(LessonChunk).where(LessonChunk.chunk_id == "f1-ch1")
        )
        chunk = first_chunk.scalar_one_or_none()
        if chunk is None or _is_placeholder_content(chunk.learning_goal):
            should_reseed = True

    # Also check if any chunk content has changed (compare a sample chunk's text)
    if not should_reseed:
        for sample_id in ["f3-ch1", "m1-ch1"]:
            if sample_id in CHUNKS:
                result = await db.execute(
                    select(LessonChunk).where(LessonChunk.chunk_id == sample_id)
                )
                db_chunk = result.scalar_one_or_none()
                if db_chunk is not None and db_chunk.explain_text != CHUNKS[sample_id].explain_text:
                    should_reseed = True
                    break

    if not should_reseed:
        return

    await db.execute(delete(LessonQuizItem))
    await db.execute(delete(LessonChunk))
    await db.execute(delete(LessonModule))

    for module_id in ORDERED_MODULE_IDS:
        module = MODULES[module_id]
        db.add(
            LessonModule(
                module_id=module.module_id,
                title=module.title,
                track=module.track,
                order_index=module.order,
                objective=module.objective,
                estimated_minutes=module.estimated_minutes,
                prerequisite_ids=module.prerequisite_ids,
            )
        )
    await db.flush()

    for module_id in ORDERED_MODULE_IDS:
        module = MODULES[module_id]
        for chunk_id in module.chunk_ids:
            chunk = CHUNKS[chunk_id]
            db.add(
                LessonChunk(
                    chunk_id=chunk.chunk_id,
                    module_id=chunk.module_id,
                    order_index=chunk.order,
                    title=chunk.title,
                    estimated_minutes=chunk.estimated_minutes,
                    learning_goal=chunk.learning_goal,
                    explain_text=chunk.explain_text,
                    example_text=chunk.example_text,
                    key_takeaway=chunk.key_takeaway,
                    common_mistakes=chunk.common_mistakes,
                    quick_check_prompts=chunk.quick_check_prompts,
                )
            )
    await db.flush()

    for module_id in ORDERED_MODULE_IDS:
        module = MODULES[module_id]
        for chunk_id in module.chunk_ids:
            chunk = CHUNKS[chunk_id]
            for item_idx, item in enumerate(chunk.quiz_items, start=1):
                db.add(
                    LessonQuizItem(
                        item_id=item.item_id,
                        chunk_id=chunk.chunk_id,
                        order_index=item_idx,
                        item_type=item.item_type,
                        prompt=item.prompt,
                        options=item.options,
                        correct_option_id=item.correct_option_id,
                        explanation=item.explanation,
                        why_it_matters=item.why_it_matters,
                    )
                )

    await db.commit()

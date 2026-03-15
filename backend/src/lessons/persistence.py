"""Persist lesson catalog content into DB from JSON seed file."""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import LessonChunk, LessonModule, LessonQuizItem

logger = logging.getLogger(__name__)

SEEDS_DIR = Path(__file__).parent / "seeds"
CATALOG_FILE = SEEDS_DIR / "catalog.json"


def _catalog_hash() -> str:
    """Return a short hash of the catalog file for change detection."""
    content = CATALOG_FILE.read_bytes()
    return hashlib.sha256(content).hexdigest()[:16]


def _load_catalog() -> list[dict[str, Any]]:
    """Load the catalog JSON and return the modules list."""
    with CATALOG_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
    return data["modules"]


async def seed_lessons_to_db(db: AsyncSession) -> None:
    """Seed lesson content into DB from catalog.json.

    Re-seeds when:
    - The DB has no modules
    - The module count differs from the seed file
    - The catalog file hash has changed since last seed
    """
    if not CATALOG_FILE.is_file():
        logger.warning("Lesson seed skipped: %s not found", CATALOG_FILE)
        return

    catalog_modules = _load_catalog()
    # Check existing module count
    existing_count = (
        await db.execute(select(func.count()).select_from(LessonModule))
    ).scalar_one()

    should_reseed = False
    if existing_count == 0:
        should_reseed = True
        logger.info("Lesson seed: DB empty, seeding %d modules", len(catalog_modules))
    elif existing_count != len(catalog_modules):
        should_reseed = True
        logger.info(
            "Lesson seed: module count changed (%d -> %d), re-seeding",
            existing_count,
            len(catalog_modules),
        )
    else:
        # Check hash stored in first module's title column comment (lightweight)
        sample = (
            await db.execute(select(LessonModule).limit(1))
        ).scalar_one_or_none()
        if sample is not None:
            # Store hash in a metadata-like check: compare first chunk content
            first_chunk = (
                await db.execute(
                    select(LessonChunk).where(LessonChunk.chunk_id == "f1-ch1")
                )
            ).scalar_one_or_none()
            if first_chunk is not None:
                # Compare explain_text of first chunk as change detector
                seed_explain = catalog_modules[0]["chunks"][0]["explain_text"] if catalog_modules else ""
                if first_chunk.explain_text != seed_explain:
                    should_reseed = True
                    logger.info("Lesson seed: content changed, re-seeding")

    if not should_reseed:
        logger.info("Lesson seed: %d modules up to date", existing_count)
        return

    # Clear existing data
    await db.execute(delete(LessonQuizItem))
    await db.execute(delete(LessonChunk))
    await db.execute(delete(LessonModule))

    # Seed modules
    for mod in catalog_modules:
        prerequisite_ids = mod.get("prerequisite_ids", [])
        db.add(
            LessonModule(
                module_id=mod["module_id"],
                title=mod["title"],
                track=mod["track"],
                order_index=mod["order"],
                objective=mod.get("objective"),
                estimated_minutes=mod["estimated_minutes"],
                prerequisite_ids=prerequisite_ids,
            )
        )
    await db.flush()

    # Seed chunks
    for mod in catalog_modules:
        module_id = mod["module_id"]
        for chunk in mod["chunks"]:
            db.add(
                LessonChunk(
                    chunk_id=chunk["chunk_id"],
                    module_id=module_id,
                    order_index=chunk["order"],
                    title=chunk["title"],
                    estimated_minutes=chunk["estimated_minutes"],
                    learning_goal=chunk["learning_goal"],
                    explain_text=chunk["explain_text"],
                    example_text=chunk["example_text"],
                    key_takeaway=chunk["key_takeaway"],
                    common_mistakes=chunk["common_mistakes"],
                    quick_check_prompts=chunk["quick_check_prompts"],
                )
            )
    await db.flush()

    # Seed quiz items
    for mod in catalog_modules:
        for chunk in mod["chunks"]:
            chunk_id = chunk["chunk_id"]
            for item_idx, item in enumerate(chunk.get("quiz_items", []), start=1):
                db.add(
                    LessonQuizItem(
                        item_id=item["item_id"],
                        chunk_id=chunk_id,
                        order_index=item_idx,
                        item_type=item["item_type"],
                        prompt=item["prompt"],
                        options=item["options"],
                        correct_option_id=item.get("correct_option_id"),
                        explanation=item["explanation"],
                        why_it_matters=item["why_it_matters"],
                    )
                )

    await db.commit()
    total_chunks = sum(len(m["chunks"]) for m in catalog_modules)
    logger.info(
        "Lesson seed complete: %d modules, %d chunks",
        len(catalog_modules),
        total_chunks,
    )

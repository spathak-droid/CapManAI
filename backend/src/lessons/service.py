"""Lessons content and progress service.

Content is stored in seeds/catalog.json and loaded into the database
on startup via persistence.seed_lessons_to_db(). The in-memory catalog
below is a lightweight index built from the same JSON for fast lookups
when the DB is not yet available (e.g., tests, CLI tools).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import LessonChunk, LessonModule, User, UserChunkProgress, UserStreak
from src.gamification.xp import calculate_level
from src.lessons._types import ChunkDef, ModuleDef, QuizItemDef

# Re-export for backwards compatibility
__all__ = ["ChunkDef", "ModuleDef", "QuizItemDef"]

# Type alias for pre-loaded progress maps
ProgressMap = dict[str, "UserChunkProgress"]

MASTERY_THRESHOLD = 80.0
BASE_COMPLETION_XP = 20
RETRY_COMPLETION_XP = 10
FIRST_MASTERY_BONUS_XP = 30


# ---------------------------------------------------------------------------
# Catalog loaded from JSON seed file (source of truth lives in the database;
# this in-memory index is a startup fallback used by tests and utilities).
# ---------------------------------------------------------------------------

_CATALOG_FILE = Path(__file__).parent / "seeds" / "catalog.json"


def _load_catalog_from_json() -> tuple[dict[str, ModuleDef], dict[str, ChunkDef], list[str]]:
    """Load module/chunk definitions from the JSON seed file."""
    with _CATALOG_FILE.open(encoding="utf-8") as f:
        data = json.load(f)

    modules: dict[str, ModuleDef] = {}
    chunks: dict[str, ChunkDef] = {}
    order_ids: list[str] = []

    previous_module_id: str | None = None

    for mod_data in data["modules"]:
        module_id = mod_data["module_id"]
        chunk_ids: list[str] = []

        for chunk_data in mod_data["chunks"]:
            chunk_id = chunk_data["chunk_id"]
            chunk_ids.append(chunk_id)

            quiz_items = [
                QuizItemDef(
                    item_id=qi["item_id"],
                    item_type=qi["item_type"],
                    prompt=qi["prompt"],
                    options=qi["options"],
                    correct_option_id=qi.get("correct_option_id"),
                    explanation=qi["explanation"],
                    why_it_matters=qi["why_it_matters"],
                )
                for qi in chunk_data.get("quiz_items", [])
            ]

            chunks[chunk_id] = ChunkDef(
                chunk_id=chunk_id,
                module_id=module_id,
                order=chunk_data["order"],
                title=chunk_data["title"],
                estimated_minutes=chunk_data["estimated_minutes"],
                learning_goal=chunk_data["learning_goal"],
                explain_text=chunk_data["explain_text"],
                example_text=chunk_data["example_text"],
                key_takeaway=chunk_data["key_takeaway"],
                common_mistakes=chunk_data.get("common_mistakes", []),
                quick_check_prompts=chunk_data.get("quick_check_prompts", []),
                quiz_items=quiz_items,
            )

        modules[module_id] = ModuleDef(
            module_id=module_id,
            title=mod_data["title"],
            track=mod_data["track"],
            order=mod_data["order"],
            objective=mod_data.get("objective"),
            estimated_minutes=mod_data["estimated_minutes"],
            prerequisite_ids=[previous_module_id] if previous_module_id else [],
            chunk_ids=chunk_ids,
        )
        order_ids.append(module_id)
        previous_module_id = module_id

    return modules, chunks, order_ids


MODULES, CHUNKS, ORDERED_MODULE_IDS = _load_catalog_from_json()


async def get_user_state(user_id: int, db: AsyncSession) -> UserStreak:
    """Get or create UserStreak row for a user."""
    from sqlalchemy.exc import IntegrityError

    result = await db.execute(select(UserStreak).where(UserStreak.user_id == user_id))
    streak_row = result.scalar_one_or_none()
    if streak_row is None:
        streak_row = UserStreak(
            user_id=user_id,
            current_streak=0,
            last_activity_date=None,
            lesson_xp_total=0,
        )
        db.add(streak_row)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            result = await db.execute(
                select(UserStreak).where(UserStreak.user_id == user_id)
            )
            streak_row = result.scalar_one_or_none()
            if streak_row is None:
                streak_row = UserStreak(
                    user_id=user_id,
                    current_streak=0,
                    last_activity_date=None,
                    lesson_xp_total=0,
                )
    return streak_row


async def bulk_load_progress(user_id: int, db: AsyncSession) -> ProgressMap:
    """Load ALL UserChunkProgress rows for a user in one query."""
    result = await db.execute(
        select(UserChunkProgress).where(UserChunkProgress.user_id == user_id)
    )
    return {row.chunk_id: row for row in result.scalars().all()}


async def check_prerequisites_met(
    user_id: int, module_id: str, db: AsyncSession,
    progress_map: ProgressMap | None = None,
) -> tuple[bool, str | None]:
    """Check if a user has mastered all prerequisite modules.

    Returns (met, reason) where met is True if all prerequisites are satisfied
    (or there are none), and reason describes which prerequisite is unmet.
    """
    # Try DB first for the module's prerequisite_ids
    result = await db.execute(
        select(LessonModule.prerequisite_ids).where(
            LessonModule.module_id == module_id
        )
    )
    row = result.scalar_one_or_none()
    if row is not None:
        prereq_ids: list[str] = row or []
    else:
        # Fallback to in-memory definitions
        module = MODULES.get(module_id)
        if module is None:
            return True, None
        prereq_ids = module.prerequisite_ids

    if not prereq_ids:
        return True, None

    for prereq_module_id in prereq_ids:
        # Get all chunk_ids for the prerequisite module (DB first, fallback in-memory)
        chunk_result = await db.execute(
            select(LessonChunk.chunk_id).where(
                LessonChunk.module_id == prereq_module_id
            )
        )
        chunk_ids = [r[0] for r in chunk_result.all()]
        if not chunk_ids:
            # Fallback to in-memory
            prereq_mod = MODULES.get(prereq_module_id)
            if prereq_mod is None:
                continue
            chunk_ids = prereq_mod.chunk_ids

        if not chunk_ids:
            continue

        # Check that ALL chunks in the prerequisite module are mastered (80%+)
        for chunk_id in chunk_ids:
            if progress_map is not None:
                progress = progress_map.get(chunk_id)
            else:
                prog_result = await db.execute(
                    select(UserChunkProgress).where(
                        UserChunkProgress.user_id == user_id,
                        UserChunkProgress.chunk_id == chunk_id,
                    )
                )
                progress = prog_result.scalar_one_or_none()
            if progress is None or not progress.mastered:
                # Look up prereq title for a helpful message
                prereq_title = prereq_module_id
                title_result = await db.execute(
                    select(LessonModule.title).where(
                        LessonModule.module_id == prereq_module_id
                    )
                )
                title_row = title_result.scalar_one_or_none()
                if title_row:
                    prereq_title = title_row
                elif prereq_module_id in MODULES:
                    prereq_title = MODULES[prereq_module_id].title
                reason = (
                    f"Prerequisite not met: master all chunks in "
                    f"'{prereq_title}' (module {prereq_module_id}) first."
                )
                return False, reason

    return True, None


def list_modules() -> list[ModuleDef]:
    """List modules in sequence."""
    return [MODULES[module_id] for module_id in ORDERED_MODULE_IDS]


def get_module(module_id: str) -> ModuleDef | None:
    """Get a module by ID."""
    return MODULES.get(module_id)


def list_module_chunks(module_id: str) -> list[ChunkDef]:
    """Return ordered chunks for module."""
    module = MODULES[module_id]
    return [CHUNKS[chunk_id] for chunk_id in module.chunk_ids]


def get_chunk(chunk_id: str) -> ChunkDef | None:
    """Get a chunk by ID."""
    return CHUNKS.get(chunk_id)


async def _ensure_chunk_progress(
    user_id: int, chunk_id: str, db: AsyncSession
) -> UserChunkProgress:
    """Get or create UserChunkProgress row for a user/chunk pair."""
    result = await db.execute(
        select(UserChunkProgress).where(
            UserChunkProgress.user_id == user_id,
            UserChunkProgress.chunk_id == chunk_id,
        )
    )
    progress = result.scalar_one_or_none()
    if progress is None:
        progress = UserChunkProgress(
            user_id=user_id,
            chunk_id=chunk_id,
            attempts=0,
            latest_score=0.0,
            best_score=0.0,
            mastered=False,
            completed=False,
            completion_xp_awarded=False,
            mastery_bonus_awarded=False,
        )
        db.add(progress)
        await db.flush()
    return progress


def _update_streak(streak_row: UserStreak) -> None:
    """Update streak fields on the ORM object (no DB I/O — caller commits)."""
    today = datetime.now(UTC).date()
    if streak_row.last_activity_date is None:
        streak_row.current_streak = 1
    elif streak_row.last_activity_date == today:
        return
    elif (today - streak_row.last_activity_date).days == 1:
        streak_row.current_streak += 1
    else:
        streak_row.current_streak = 1
    streak_row.last_activity_date = today


async def attempt_chunk(
    user_id: int,
    chunk_id: str,
    answers_by_item: dict[str, str],
    db: AsyncSession,
    chunk: ChunkDef,
) -> dict[str, object]:
    """Score a quiz attempt and return feedback. Chunk content comes from DB (caller loads via repository)."""
    streak_row = await get_user_state(user_id, db)
    progress = await _ensure_chunk_progress(user_id, chunk_id, db)

    graded_items = [item for item in chunk.quiz_items if item.item_type != "reflection"]
    correct_count = 0
    feedback: list[dict[str, object]] = []

    for item in chunk.quiz_items:
        answer = answers_by_item.get(item.item_id, "")
        if item.item_type == "reflection":
            feedback.append(
                {
                    "item_id": item.item_id,
                    "correct": None,
                    "feedback": "Reflection captured. Keep your rule specific and measurable.",
                    "why_it_matters": item.why_it_matters,
                }
            )
            continue

        is_correct = answer == item.correct_option_id
        if is_correct:
            correct_count += 1
        feedback.append(
            {
                "item_id": item.item_id,
                "correct": is_correct,
                "feedback": item.explanation,
                "why_it_matters": item.why_it_matters,
            }
        )

    score_percent = round((correct_count / len(graded_items)) * 100.0, 1) if graded_items else 0.0
    progress.attempts += 1
    progress.latest_score = score_percent
    if score_percent > progress.best_score:
        progress.best_score = score_percent

    newly_mastered = False
    if score_percent >= MASTERY_THRESHOLD and not progress.mastered:
        progress.mastered = True
        newly_mastered = True

    xp_earned = 0
    if newly_mastered and not progress.mastery_bonus_awarded:
        xp_earned += FIRST_MASTERY_BONUS_XP
        progress.mastery_bonus_awarded = True

    if xp_earned > 0:
        streak_row.lesson_xp_total += xp_earned

    _update_streak(streak_row)

    db.add(progress)
    db.add(streak_row)
    await db.commit()
    await db.refresh(progress)
    await db.refresh(streak_row)

    # Update User.xp_total and level when XP is earned
    if xp_earned > 0:
        user = await db.get(User, user_id)
        if user is not None:
            user.xp_total = (user.xp_total or 0) + xp_earned
            user.level = calculate_level(user.xp_total)
            db.add(user)
            await db.commit()

    _ordered = ORDERED_MODULE_IDS
    _chunk_ids = {mid: MODULES[mid].chunk_ids for mid in _ordered}
    _tracks = {mid: MODULES[mid].track for mid in _ordered}
    _titles = {mid: MODULES[mid].title for mid in _ordered}
    badges = await calculate_new_badges(
        user_id, db, _ordered, _chunk_ids, _tracks, _titles
    )

    return {
        "score_percent": score_percent,
        "mastered": progress.mastered,
        "recommended_retry": score_percent < MASTERY_THRESHOLD,
        "attempt_number": progress.attempts,
        "latest_score": progress.latest_score,
        "best_score": progress.best_score,
        "item_feedback": feedback,
        "xp_earned": xp_earned,
        "badges_awarded": badges,
    }


async def complete_chunk(user_id: int, chunk_id: str, db: AsyncSession) -> dict[str, object]:
    """Mark chunk complete and grant completion XP."""
    streak_row = await get_user_state(user_id, db)
    progress = await _ensure_chunk_progress(user_id, chunk_id, db)
    progress.completed = True

    xp_earned = 0
    if not progress.completion_xp_awarded:
        xp_earned = BASE_COMPLETION_XP if progress.attempts <= 1 else RETRY_COMPLETION_XP
        progress.completion_xp_awarded = True
        streak_row.lesson_xp_total += xp_earned

    _update_streak(streak_row)

    db.add(progress)
    db.add(streak_row)
    await db.commit()
    await db.refresh(progress)
    await db.refresh(streak_row)

    # Update User.xp_total and level when XP is earned
    if xp_earned > 0:
        user = await db.get(User, user_id)
        if user is not None:
            user.xp_total = (user.xp_total or 0) + xp_earned
            user.level = calculate_level(user.xp_total)
            db.add(user)
            await db.commit()

    _ordered = ORDERED_MODULE_IDS
    _chunk_ids = {mid: MODULES[mid].chunk_ids for mid in _ordered}
    _tracks = {mid: MODULES[mid].track for mid in _ordered}
    _titles = {mid: MODULES[mid].title for mid in _ordered}
    badges = await calculate_new_badges(
        user_id, db, _ordered, _chunk_ids, _tracks, _titles
    )

    return {
        "completed": progress.completed,
        "xp_earned": xp_earned,
        "badges_awarded": badges,
    }


async def get_streak(user_id: int, db: AsyncSession) -> dict[str, object]:
    """Return streak details."""
    streak_row = await get_user_state(user_id, db)
    return {
        "current_streak": streak_row.current_streak,
        "last_activity_date": streak_row.last_activity_date.isoformat()
        if streak_row.last_activity_date
        else None,
    }


async def _module_stats(
    user_id: int,
    module_id: str,
    chunk_ids: list[str],
    db: AsyncSession,
    progress_map: ProgressMap | None = None,
) -> dict[str, object]:
    completed = 0
    mastered = 0

    for chunk_id in chunk_ids:
        if progress_map is not None:
            progress = progress_map.get(chunk_id)
        else:
            result = await db.execute(
                select(UserChunkProgress).where(
                    UserChunkProgress.user_id == user_id,
                    UserChunkProgress.chunk_id == chunk_id,
                )
            )
            progress = result.scalar_one_or_none()
        if progress and progress.completed:
            completed += 1
        if progress and progress.mastered:
            mastered += 1

    n = len(chunk_ids) or 1
    return {
        "module_id": module_id,
        "completed_chunks": completed,
        "total_chunks": len(chunk_ids),
        "completion_percent": round((completed / n) * 100.0, 1),
        "mastered_chunks": mastered,
        "mastered": mastered == len(chunk_ids),
    }


async def _next_action(
    user_id: int,
    db: AsyncSession,
    ordered_module_ids: list[str],
    module_chunk_ids: dict[str, list[str]],
    progress_map: ProgressMap | None = None,
) -> tuple[str | None, str | None]:
    for module_id in ordered_module_ids:
        for chunk_id in module_chunk_ids.get(module_id, []):
            if progress_map is not None:
                progress = progress_map.get(chunk_id)
            else:
                result = await db.execute(
                    select(UserChunkProgress).where(
                        UserChunkProgress.user_id == user_id,
                        UserChunkProgress.chunk_id == chunk_id,
                    )
                )
                progress = result.scalar_one_or_none()
            if progress is None or not progress.completed:
                return module_id, chunk_id
    return None, None


async def _foundation_finished(
    user_id: int,
    db: AsyncSession,
    ordered_module_ids: list[str],
    module_chunk_ids: dict[str, list[str]],
    module_tracks: dict[str, str],
    progress_map: ProgressMap | None = None,
) -> bool:
    foundation_ids = [
        m for m in ordered_module_ids
        if module_tracks.get(m) == "foundation"
    ]
    for module_id in foundation_ids:
        for chunk_id in module_chunk_ids.get(module_id, []):
            if progress_map is not None:
                progress = progress_map.get(chunk_id)
            else:
                result = await db.execute(
                    select(UserChunkProgress).where(
                        UserChunkProgress.user_id == user_id,
                        UserChunkProgress.chunk_id == chunk_id,
                    )
                )
                progress = result.scalar_one_or_none()
            if not progress or not progress.completed:
                return False
    return True


async def calculate_new_badges(
    user_id: int,
    db: AsyncSession,
    ordered_module_ids: list[str],
    module_chunk_ids: dict[str, list[str]],
    module_tracks: dict[str, str],
    module_titles: dict[str, str],
    progress_map: ProgressMap | None = None,
) -> list[str]:
    """Calculate currently earned badge set."""
    streak_row = await get_user_state(user_id, db)
    badges: list[str] = []

    if await _foundation_finished(
        user_id, db, ordered_module_ids, module_chunk_ids, module_tracks,
        progress_map=progress_map,
    ):
        badges.append("Foundation Finisher")

    for module_id in ordered_module_ids:
        if module_tracks.get(module_id) != "core":
            continue
        all_mastered = True
        for chunk_id in module_chunk_ids.get(module_id, []):
            if progress_map is not None:
                progress = progress_map.get(chunk_id)
            else:
                result = await db.execute(
                    select(UserChunkProgress).where(
                        UserChunkProgress.user_id == user_id,
                        UserChunkProgress.chunk_id == chunk_id,
                    )
                )
                progress = result.scalar_one_or_none()
            if not progress or not progress.mastered:
                all_mastered = False
                break
        if all_mastered:
            badges.append(f"{module_titles.get(module_id, module_id)} Mastery")

    capstone_id = "c1" if "c1" in ordered_module_ids else (ordered_module_ids[-1] if ordered_module_ids else None)
    all_completed = True
    if capstone_id:
        for chunk_id in module_chunk_ids.get(capstone_id, []):
            if progress_map is not None:
                progress = progress_map.get(chunk_id)
            else:
                result = await db.execute(
                    select(UserChunkProgress).where(
                        UserChunkProgress.user_id == user_id,
                        UserChunkProgress.chunk_id == chunk_id,
                    )
                )
                progress = result.scalar_one_or_none()
            if not progress or not progress.completed:
                all_completed = False
                break
        if all_completed:
            badges.append("Capstone Complete")

    if streak_row.current_streak >= 3:
        badges.append("3-Day Streak")
    if streak_row.current_streak >= 7:
        badges.append("7-Day Streak")
    if streak_row.current_streak >= 30:
        badges.append("30-Day Streak")

    # Level-based badges
    level_badges: dict[int, str] = {
        2: "Rookie Trader",
        3: "Market Watcher",
        4: "Chart Reader",
        5: "Risk Manager",
        6: "Options Strategist",
        7: "Senior Analyst",
        8: "Portfolio Manager",
        9: "Managing Director",
        10: "Trading Legend",
    }
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user:
        level = user.level
        for lvl, badge_name in level_badges.items():
            if level >= lvl:
                badges.append(badge_name)

    return badges


async def get_progress_summary(
    user_id: int, db: AsyncSession, modules: list[ModuleDef]
) -> dict[str, object]:
    """Build user progress summary. Modules must be loaded from DB (e.g. repository.fetch_modules)."""
    streak_row = await get_user_state(user_id, db)

    # Bulk-load all progress in ONE query
    progress_map = await bulk_load_progress(user_id, db)

    ordered_module_ids = [m.module_id for m in modules]
    module_chunk_ids = {m.module_id: m.chunk_ids for m in modules}
    module_tracks = {m.module_id: m.track for m in modules}
    module_titles = {m.module_id: m.title for m in modules}

    module_progress = [
        await _module_stats(user_id, m.module_id, m.chunk_ids, db, progress_map=progress_map)
        for m in modules
    ]

    total_chunks = sum(len(m.chunk_ids) for m in modules)
    completed_chunks = sum(int(item["completed_chunks"]) for item in module_progress)  # type: ignore[arg-type]

    all_chunk_ids = [cid for m in modules for cid in m.chunk_ids]
    chunk_progress: dict[str, dict[str, object]] = {}
    for chunk_id in all_chunk_ids:
        progress = progress_map.get(chunk_id)
        chunk_progress[chunk_id] = {
            "completed": progress.completed if progress else False,
            "best_score": progress.best_score if progress else 0.0,
            "last_score": progress.latest_score if progress else 0.0,
            "mastered": progress.mastered if progress else False,
            "attempts": progress.attempts if progress else 0,
        }

    next_module_id, next_chunk_id = await _next_action(
        user_id, db, ordered_module_ids, module_chunk_ids, progress_map=progress_map
    )

    badges = await calculate_new_badges(
        user_id, db, ordered_module_ids, module_chunk_ids, module_tracks, module_titles,
        progress_map=progress_map,
    )

    return {
        "program_completion_percent": round((completed_chunks / total_chunks) * 100.0, 1)
        if total_chunks
        else 0.0,
        "lesson_xp_total": streak_row.lesson_xp_total,
        "module_progress": module_progress,
        "chunk_progress": chunk_progress,
        "badges": badges,
        "next_module_id": next_module_id,
        "next_chunk_id": next_chunk_id,
    }

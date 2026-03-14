"""MTSS data access layer.

Repository functions for querying and updating MTSS-related
data in the database.
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    Grade,
    LearningObjectiveProgress,
    SkillScore,
    User,
)
from src.mtss.classifier import classify_tier


async def get_student_skill_scores(
    db: AsyncSession, user_id: int
) -> list[SkillScore]:
    """Query SkillScore records for a specific user."""
    result = await db.execute(
        select(SkillScore).where(SkillScore.user_id == user_id)
    )
    return list(result.scalars().all())


async def get_all_student_scores(
    db: AsyncSession,
) -> dict[int, list[SkillScore]]:
    """Query all SkillScore records grouped by user_id."""
    result = await db.execute(select(SkillScore))
    scores = result.scalars().all()
    grouped: dict[int, list[SkillScore]] = {}
    for score in scores:
        grouped.setdefault(score.user_id, []).append(score)
    return grouped


async def get_student_grades(
    db: AsyncSession, user_id: int
) -> list[Grade]:
    """Query Grade records for a user (via their responses)."""
    from src.db.models import Response

    result = await db.execute(
        select(Grade)
        .join(Response, Grade.response_id == Response.id)
        .where(Response.user_id == user_id)
    )
    return list(result.scalars().all())


async def get_objective_progress(
    db: AsyncSession, user_id: int
) -> list[LearningObjectiveProgress]:
    """Query LearningObjectiveProgress records for a user."""
    result = await db.execute(
        select(LearningObjectiveProgress).where(
            LearningObjectiveProgress.user_id == user_id
        )
    )
    return list(result.scalars().all())


async def update_objective_progress(
    db: AsyncSession,
    user_id: int,
    objective_id: str,
    score: float,
) -> LearningObjectiveProgress:
    """Upsert a LearningObjectiveProgress record."""
    result = await db.execute(
        select(LearningObjectiveProgress).where(
            LearningObjectiveProgress.user_id == user_id,
            LearningObjectiveProgress.objective_id == objective_id,
        )
    )
    progress = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    tier = classify_tier(score)

    if progress is None:
        progress = LearningObjectiveProgress(
            user_id=user_id,
            objective_id=objective_id,
            score_history=[{"score": score, "timestamp": now.isoformat()}],
            current_tier=tier.value,
            last_assessed_at=now,
        )
        db.add(progress)
    else:
        history: list[dict[str, object]] = list(progress.score_history or [])
        history.append({"score": score, "timestamp": now.isoformat()})
        progress.score_history = history
        progress.current_tier = tier.value
        progress.last_assessed_at = now

    await db.flush()
    return progress


async def get_class_objective_distribution(
    db: AsyncSession,
) -> dict[str, dict[str, int]]:
    """Aggregate tier counts per objective across all users."""
    result = await db.execute(select(LearningObjectiveProgress))
    rows = result.scalars().all()

    distribution: dict[str, dict[str, int]] = {}
    for row in rows:
        if row.objective_id not in distribution:
            distribution[row.objective_id] = {
                "tier_1": 0,
                "tier_2": 0,
                "tier_3": 0,
                "total": 0,
            }
        bucket = distribution[row.objective_id]
        tier_key = row.current_tier if row.current_tier in ("tier_1", "tier_2", "tier_3") else "tier_1"
        bucket[tier_key] += 1
        bucket["total"] += 1

    return distribution


async def get_user_by_id(
    db: AsyncSession, user_id: int
) -> User | None:
    """Fetch a single user by ID."""
    return await db.get(User, user_id)

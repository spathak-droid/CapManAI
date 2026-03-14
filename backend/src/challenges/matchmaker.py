"""Matchmaking logic for head-to-head challenges."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import MatchmakingQueue


async def join_queue(
    db: AsyncSession,
    user_id: int,
    skill_target: str | None = None,
    elo_rating: float = 1000.0,
) -> MatchmakingQueue:
    """Add a user to the matchmaking queue.

    Raises ValueError if the user is already in the queue.
    """
    existing = await db.execute(
        select(MatchmakingQueue).where(
            MatchmakingQueue.user_id == user_id,
            MatchmakingQueue.matched_at.is_(None),
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError("User is already in the matchmaking queue")

    entry = MatchmakingQueue(
        user_id=user_id,
        skill_target=skill_target,
        elo_rating=elo_rating,
    )
    db.add(entry)
    await db.flush()
    return entry


async def leave_queue(db: AsyncSession, user_id: int) -> bool:
    """Remove a user from the matchmaking queue. Returns True if removed."""
    result = await db.execute(
        select(MatchmakingQueue).where(
            MatchmakingQueue.user_id == user_id,
            MatchmakingQueue.matched_at.is_(None),
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        return False
    await db.delete(entry)
    await db.flush()
    return True


async def find_match(
    db: AsyncSession, user_id: int, elo_range: float = 200.0
) -> int | None:
    """Find an opponent within elo_rating +/- elo_range.

    Returns the matched user_id or None.
    """
    # Get the requesting user's queue entry
    result = await db.execute(
        select(MatchmakingQueue).where(
            MatchmakingQueue.user_id == user_id,
            MatchmakingQueue.matched_at.is_(None),
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        return None

    # Find a compatible opponent
    query = select(MatchmakingQueue).where(
        MatchmakingQueue.user_id != user_id,
        MatchmakingQueue.matched_at.is_(None),
        MatchmakingQueue.elo_rating >= entry.elo_rating - elo_range,
        MatchmakingQueue.elo_rating <= entry.elo_rating + elo_range,
    )
    # If skill_target is set, prefer matching on same skill
    if entry.skill_target:
        query = query.where(
            (MatchmakingQueue.skill_target == entry.skill_target)
            | (MatchmakingQueue.skill_target.is_(None))
        )

    query = query.order_by(MatchmakingQueue.queued_at.asc()).limit(1)
    result = await db.execute(query)
    opponent_entry = result.scalar_one_or_none()
    if opponent_entry is None:
        return None

    return int(opponent_entry.user_id)


async def process_queue(db: AsyncSession) -> list[tuple[int, int]]:
    """Scan the queue and match compatible users.

    Returns list of (user_id, opponent_id) pairs that were matched.
    """
    # Get all unmatched entries ordered by queue time
    result = await db.execute(
        select(MatchmakingQueue)
        .where(MatchmakingQueue.matched_at.is_(None))
        .order_by(MatchmakingQueue.queued_at.asc())
    )
    entries = list(result.scalars().all())
    matched_pairs: list[tuple[int, int]] = []
    matched_ids: set[int] = set()

    for entry in entries:
        if entry.user_id in matched_ids:
            continue

        # Find best match for this entry
        for candidate in entries:
            if candidate.user_id == entry.user_id:
                continue
            if candidate.user_id in matched_ids:
                continue
            if abs(candidate.elo_rating - entry.elo_rating) > 200.0:
                continue
            # Skill target compatibility
            if (
                entry.skill_target
                and candidate.skill_target
                and entry.skill_target != candidate.skill_target
            ):
                continue

            # Mark both as matched
            now = datetime.now(timezone.utc)
            entry.matched_at = now
            candidate.matched_at = now
            matched_ids.add(entry.user_id)
            matched_ids.add(candidate.user_id)
            matched_pairs.append((entry.user_id, candidate.user_id))
            break

    await db.flush()
    return matched_pairs

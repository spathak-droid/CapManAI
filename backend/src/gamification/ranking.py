"""Dynamic leaderboard ranking logic.

Computes composite rankings based on mastery, repetition, and XP,
and manages LeaderboardSnapshot persistence.
"""

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Grade, LeaderboardSnapshot, SkillScore, User


def compute_composite(
    mastery: float,
    repetition: int,
    xp: int,
    max_mastery: float,
    max_repetition: int,
    max_xp: int,
) -> float:
    """Compute a normalized composite ranking score.

    Weights: mastery 60%, repetition 25%, XP 15%.
    If a max value is 0, that component contributes 0.

    Args:
        mastery: User's average mastery score.
        repetition: User's total graded-response count.
        xp: User's total XP.
        max_mastery: Maximum mastery across all users.
        max_repetition: Maximum repetition across all users.
        max_xp: Maximum XP across all users.

    Returns:
        Composite score between 0.0 and 1.0.
    """
    norm_mastery = (mastery / max_mastery) if max_mastery > 0 else 0.0
    norm_repetition = (repetition / max_repetition) if max_repetition > 0 else 0.0
    norm_xp = (xp / max_xp) if max_xp > 0 else 0.0
    return 0.6 * norm_mastery + 0.25 * norm_repetition + 0.15 * norm_xp


async def recalculate_rankings(db: AsyncSession) -> None:
    """Recalculate composite rankings for all users and upsert snapshots.

    For each user:
    - mastery = average of SkillScore.score
    - repetition = count of Grade rows (via responses)
    - xp = User.xp_total

    Args:
        db: The async database session.
    """
    # Gather per-user mastery (avg skill score)
    mastery_q = await db.execute(
        select(
            SkillScore.user_id,
            func.avg(SkillScore.score).label("avg_mastery"),
        ).group_by(SkillScore.user_id)
    )
    mastery_map: dict[int, float] = {
        row.user_id: float(row.avg_mastery) for row in mastery_q
    }

    # Gather per-user repetition (count of grades via responses)
    from src.db.models import Response

    rep_q = await db.execute(
        select(
            Response.user_id,
            func.count(Grade.id).label("rep_count"),
        )
        .join(Grade, Grade.response_id == Response.id)
        .group_by(Response.user_id)
    )
    repetition_map: dict[int, int] = {
        row.user_id: int(row.rep_count) for row in rep_q
    }

    # Gather all users
    users_result = await db.execute(select(User))
    users = users_result.scalars().all()

    if not users:
        return

    # Build per-user data
    user_data: list[dict[str, object]] = []
    for u in users:
        m = mastery_map.get(u.id, 0.0)
        r = repetition_map.get(u.id, 0)
        user_data.append(
            {
                "user_id": u.id,
                "mastery": m,
                "repetition": r,
                "xp": u.xp_total,
            }
        )

    # Compute maximums for normalization
    max_mastery = max((d["mastery"] for d in user_data), default=0.0)  # type: ignore[type-var]
    max_repetition = max((d["repetition"] for d in user_data), default=0)  # type: ignore[type-var]
    max_xp = max((d["xp"] for d in user_data), default=0)  # type: ignore[type-var]

    # Delete old snapshots and insert new ones
    await db.execute(delete(LeaderboardSnapshot))

    for d in user_data:
        composite = compute_composite(
            mastery=float(d["mastery"]),  # type: ignore[arg-type]
            repetition=int(d["repetition"]),  # type: ignore[arg-type]
            xp=int(d["xp"]),  # type: ignore[arg-type]
            max_mastery=float(max_mastery),
            max_repetition=int(max_repetition),
            max_xp=int(max_xp),
        )
        db.add(
            LeaderboardSnapshot(
                user_id=int(d["user_id"]),  # type: ignore[arg-type]
                mastery_score=float(d["mastery"]),  # type: ignore[arg-type]
                repetition_count=int(d["repetition"]),  # type: ignore[arg-type]
                composite_rank=composite,
            )
        )

    await db.flush()


async def get_dynamic_leaderboard(
    db: AsyncSession,
    sort_by: str = "composite",
    limit: int = 20,
) -> list[dict[str, object]]:
    """Return the dynamic leaderboard sorted by the given criterion.

    Args:
        db: The async database session.
        sort_by: One of 'composite', 'mastery', or 'repetition'.
        limit: Maximum entries to return.

    Returns:
        List of dicts with rank, user info, and scores.
    """
    if sort_by == "mastery":
        order_col = LeaderboardSnapshot.mastery_score.desc()
    elif sort_by == "repetition":
        order_col = LeaderboardSnapshot.repetition_count.desc()
    else:
        order_col = LeaderboardSnapshot.composite_rank.desc()

    result = await db.execute(
        select(LeaderboardSnapshot, User)
        .join(User, LeaderboardSnapshot.user_id == User.id)
        .order_by(order_col)
        .limit(limit)
    )
    rows = result.all()

    entries: list[dict[str, object]] = []
    for rank_idx, (snapshot, user) in enumerate(rows, start=1):
        entries.append(
            {
                "rank": rank_idx,
                "user_id": user.id,
                "username": user.username,
                "mastery_score": snapshot.mastery_score,
                "repetition_count": snapshot.repetition_count,
                "xp_total": user.xp_total,
                "composite_score": snapshot.composite_rank,
            }
        )
    return entries


async def get_user_rank(
    db: AsyncSession,
    user_id: int,
) -> dict[str, object] | None:
    """Return the rank info for a specific user.

    Args:
        db: The async database session.
        user_id: The user whose rank to retrieve.

    Returns:
        Dict with rank info, or None if the user has no snapshot.
    """
    # Count total users with snapshots
    total_result = await db.execute(
        select(func.count()).select_from(LeaderboardSnapshot)
    )
    total_users = int(total_result.scalar_one())

    # Get user's snapshot
    snap_result = await db.execute(
        select(LeaderboardSnapshot, User)
        .join(User, LeaderboardSnapshot.user_id == User.id)
        .where(LeaderboardSnapshot.user_id == user_id)
    )
    row = snap_result.first()
    if row is None:
        return None

    snapshot, user = row

    # Count how many users rank above this user (by composite)
    above_result = await db.execute(
        select(func.count())
        .select_from(LeaderboardSnapshot)
        .where(LeaderboardSnapshot.composite_rank > snapshot.composite_rank)
    )
    above_count = int(above_result.scalar_one())
    rank = above_count + 1

    return {
        "user_id": user.id,
        "username": user.username,
        "rank": rank,
        "mastery_score": snapshot.mastery_score,
        "repetition_count": snapshot.repetition_count,
        "xp_total": user.xp_total,
        "composite_score": snapshot.composite_rank,
        "total_users": total_users,
    }

"""Leaderboard ranking logic.

Computes and retrieves leaderboard rankings based on XP,
level, and skill scores.
"""

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User
from src.gamification.xp import calculate_level


class LeaderboardEntry(BaseModel):
    """A single leaderboard entry."""

    user_id: int
    username: str
    xp_total: int
    level: int
    rank: int


async def get_leaderboard(db: AsyncSession, limit: int = 20) -> list[LeaderboardEntry]:
    """Get the top users by XP for the leaderboard.

    Args:
        db: The async database session.
        limit: Maximum number of entries to return.

    Returns:
        List of leaderboard entries sorted by XP descending.
    """
    result = await db.execute(
        select(User).where(User.xp_total > 0).order_by(User.xp_total.desc()).limit(limit)
    )
    users = result.scalars().all()
    return [
        LeaderboardEntry(
            user_id=u.id,
            username=u.username,
            xp_total=u.xp_total,
            level=calculate_level(u.xp_total),
            rank=i + 1,
        )
        for i, u in enumerate(users)
    ]


def update_leaderboard(user_id: int, username: str, xp_total: int) -> None:
    """No-op: leaderboard is now queried directly from the database."""

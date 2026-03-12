"""Leaderboard ranking logic.

Computes and retrieves leaderboard rankings based on XP,
level, and skill scores.
"""

from pydantic import BaseModel

from src.gamification.xp import calculate_level


class LeaderboardEntry(BaseModel):
    """A single leaderboard entry."""

    user_id: int
    username: str
    xp_total: int
    level: int
    rank: int


# In-memory store for demo
_leaderboard_store: list[LeaderboardEntry] = []


def _seed_demo_data() -> None:
    """Seed leaderboard with demo entries."""
    demo_users = [
        (1, "TraderJoe", 8500),
        (2, "OptionQueen", 12500),
        (3, "BullRunner", 3200),
        (4, "BearHunter", 5100),
        (5, "VolSmile", 15000),
        (6, "GammaKing", 2100),
        (7, "ThetaGang", 6800),
        (8, "DeltaNeutral", 950),
        (9, "IronCondor", 4200),
        (10, "VegaTrader", 700),
    ]
    for user_id, username, xp in demo_users:
        _leaderboard_store.append(
            LeaderboardEntry(
                user_id=user_id,
                username=username,
                xp_total=xp,
                level=calculate_level(xp),
                rank=0,  # Will be set by _recalc_ranks
            )
        )
    _recalc_ranks()


def _recalc_ranks() -> None:
    """Recalculate ranks based on XP descending."""
    _leaderboard_store.sort(key=lambda e: e.xp_total, reverse=True)
    for i, entry in enumerate(_leaderboard_store):
        entry.rank = i + 1


def get_leaderboard(limit: int = 20) -> list[LeaderboardEntry]:
    """Get the top users by XP for the leaderboard.

    Args:
        limit: Maximum number of entries to return.

    Returns:
        List of leaderboard entries sorted by XP descending.
    """
    return _leaderboard_store[:limit]


def update_leaderboard(user_id: int, username: str, xp_total: int) -> None:
    """Update or add a user on the leaderboard.

    Args:
        user_id: The user's ID.
        username: The user's display name.
        xp_total: The user's total XP.
    """
    level = calculate_level(xp_total)
    for entry in _leaderboard_store:
        if entry.user_id == user_id:
            entry.username = username
            entry.xp_total = xp_total
            entry.level = level
            _recalc_ranks()
            return

    _leaderboard_store.append(
        LeaderboardEntry(
            user_id=user_id,
            username=username,
            xp_total=xp_total,
            level=level,
            rank=0,
        )
    )
    _recalc_ranks()


# Seed on module load
_seed_demo_data()

"""Leaderboard ranking logic.

Computes and retrieves leaderboard rankings based on XP,
level, and skill scores.
"""


async def get_leaderboard(limit: int = 50) -> list[dict]:
    """Get the top users by XP for the leaderboard.

    Args:
        limit: Maximum number of entries to return.

    Returns:
        List of leaderboard entries with rank, username, xp, and level.
    """
    raise NotImplementedError


async def get_user_rank(user_id: int) -> dict:
    """Get a specific user's rank and surrounding entries.

    Args:
        user_id: The user to look up.

    Returns:
        Dict with user's rank, xp, level, and nearby entries.
    """
    raise NotImplementedError

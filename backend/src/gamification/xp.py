"""XP calculation for gamification.

Computes experience points awarded for scenario completions
based on score, complexity, and streak bonuses.
"""

LEVEL_THRESHOLDS: list[tuple[int, int]] = [
    (10, 16000),
    (9, 12000),
    (8, 9000),
    (7, 6500),
    (6, 4500),
    (5, 3000),
    (4, 2000),
    (3, 1200),
    (2, 500),
    (1, 0),
]


def calculate_xp(
    overall_score: float,
    complexity: int,
    streak: int = 0,
) -> int:
    """Calculate XP awarded for a graded scenario response.

    Args:
        overall_score: The overall grade (1.0 - 5.0).
        complexity: Scenario difficulty level (1-5).
        streak: Number of consecutive completions (for bonus). Unused in MVP.

    Returns:
        XP amount to award (minimum 50).
    """
    base = 100
    quality_bonus = overall_score * 20
    complexity_multiplier = complexity * 0.5
    xp = int((base + quality_bonus) * complexity_multiplier)
    return max(xp, 50)


def calculate_level(total_xp: int) -> int:
    """Determine user level from total accumulated XP.

    Args:
        total_xp: Total XP accumulated by the user.

    Returns:
        Current level number (1-10).
    """
    for level, threshold in LEVEL_THRESHOLDS:
        if total_xp >= threshold:
            return level
    return 1


def xp_to_next_level(total_xp: int, current_level: int) -> dict[str, object]:
    """Calculate progress toward the next level.

    Args:
        total_xp: Total XP accumulated.
        current_level: The user's current level.

    Returns:
        Dict with current_xp, next_level_xp, and progress_pct.
    """
    if current_level >= 10:
        return {
            "current_xp": total_xp,
            "next_level_xp": None,
            "progress_pct": 100.0,
        }

    # Find the threshold for next level
    next_level = current_level + 1
    next_threshold = 0
    current_threshold = 0
    for level, threshold in LEVEL_THRESHOLDS:
        if level == next_level:
            next_threshold = threshold
        if level == current_level:
            current_threshold = threshold

    xp_in_level = total_xp - current_threshold
    xp_needed = next_threshold - current_threshold
    progress = (xp_in_level / xp_needed * 100.0) if xp_needed > 0 else 100.0

    return {
        "current_xp": total_xp,
        "next_level_xp": next_threshold,
        "progress_pct": round(progress, 1),
    }

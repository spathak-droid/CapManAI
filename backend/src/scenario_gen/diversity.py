"""Scenario diversity tracking and regime bias correction.

Queries a user's scenario history (via Response -> Scenario join) and
suggests under-represented market regimes to ensure iterative exposure
to diverse market conditions.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Response, Scenario

ALL_REGIMES: list[str] = ["bull", "bear", "sideways", "volatile"]


async def get_regime_distribution(db: AsyncSession, user_id: int) -> dict[str, int]:
    """Count how many scenarios of each market_regime this user has seen.

    A user "sees" a scenario when they have a Response row for it.
    """
    stmt = (
        select(Scenario.market_regime, func.count())
        .join(Response, Response.scenario_id == Scenario.id)
        .where(Response.user_id == user_id)
        .group_by(Scenario.market_regime)
    )
    result = await db.execute(stmt)
    counts: dict[str, int] = {regime: 0 for regime in ALL_REGIMES}
    for regime, count in result.all():
        counts[regime] = int(count)
    return counts


async def get_skill_distribution(db: AsyncSession, user_id: int) -> dict[str, int]:
    """Count how many scenarios of each skill_target this user has seen."""
    stmt = (
        select(Scenario.skill_target, func.count())
        .join(Response, Response.scenario_id == Scenario.id)
        .where(Response.user_id == user_id)
        .group_by(Scenario.skill_target)
    )
    result = await db.execute(stmt)
    counts: dict[str, int] = {}
    for skill, count in result.all():
        counts[skill] = int(count)
    return counts


async def suggest_regime(db: AsyncSession, user_id: int) -> str:
    """Return the least-seen market regime for this user.

    If the user has no history, returns 'bear' (commonly under-represented
    in default generation which defaults to 'bull').
    """
    dist = await get_regime_distribution(db, user_id)
    # Return the regime with the minimum count
    return min(ALL_REGIMES, key=lambda r: dist.get(r, 0))


def should_override_regime(distribution: dict[str, int]) -> bool:
    """Return True if the most-seen regime is >2x the least-seen.

    Only triggers when the user has at least one scenario in their history.
    """
    counts = [distribution.get(r, 0) for r in ALL_REGIMES]
    if max(counts) == 0:
        return False
    min_count = min(counts)
    max_count = max(counts)
    return max_count > 2 * max(min_count, 1)

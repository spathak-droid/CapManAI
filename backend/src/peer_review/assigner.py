"""Peer review assignment logic."""

import random

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import PeerReviewAssignment, Response, User


async def get_eligible_reviewers(
    db: AsyncSession, reviewee_id: int
) -> list[User]:
    """Find students who can review (exclude self).

    Only users who have submitted at least one response are eligible.
    """
    result = await db.execute(
        select(User)
        .where(
            User.id != reviewee_id,
            User.role == "student",
            User.id.in_(select(Response.user_id).distinct()),
        )
    )
    return list(result.scalars().all())


async def assign_reviewers(
    db: AsyncSession,
    response_id: int,
    reviewee_id: int,
    count: int = 2,
) -> list[PeerReviewAssignment]:
    """Assign 1-2 peers to review a response using random selection.

    Selects from students who have completed at least one scenario,
    excluding the reviewee themselves.
    """
    eligible = await get_eligible_reviewers(db, reviewee_id)
    if not eligible:
        return []

    # Pick up to `count` reviewers randomly
    selected = random.sample(eligible, min(count, len(eligible)))

    assignments: list[PeerReviewAssignment] = []
    for reviewer in selected:
        assignment = PeerReviewAssignment(
            reviewer_id=reviewer.id,
            reviewee_id=reviewee_id,
            response_id=response_id,
            status="assigned",
        )
        db.add(assignment)
        assignments.append(assignment)

    await db.flush()
    return assignments

"""Peer review business logic."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    PeerReview,
    PeerReviewAssignment,
    Response,
    Scenario,
    User,
    XPLog,
)
from src.gamification.xp import calculate_level
from src.realtime.events import EventType, create_event
from src.realtime.manager import manager

REVIEW_XP = 15


async def submit_review(
    db: AsyncSession,
    assignment_id: int,
    reviewer_id: int,
    scores: dict[str, float],
    feedback: str,
) -> PeerReview:
    """Save a PeerReview, award XP to reviewer, send WebSocket event."""
    # Verify assignment exists and belongs to this reviewer
    assignment = await db.get(PeerReviewAssignment, assignment_id)
    if assignment is None:
        raise ValueError("Assignment not found")
    if assignment.reviewer_id != reviewer_id:
        raise ValueError("Not your assignment")
    if assignment.status == "submitted":
        raise ValueError("Review already submitted")

    overall = (
        scores["technical_accuracy"]
        + scores["risk_awareness"]
        + scores["strategy_fit"]
        + scores["reasoning_clarity"]
    ) / 4.0

    review = PeerReview(
        assignment_id=assignment_id,
        technical_accuracy=scores["technical_accuracy"],
        risk_awareness=scores["risk_awareness"],
        strategy_fit=scores["strategy_fit"],
        reasoning_clarity=scores["reasoning_clarity"],
        overall_score=round(overall, 2),
        feedback_text=feedback,
    )
    db.add(review)

    # Mark assignment as submitted
    assignment.status = "submitted"

    # Award XP to reviewer
    reviewer = await db.get(User, reviewer_id)
    if reviewer is not None:
        reviewer.xp_total = (reviewer.xp_total or 0) + REVIEW_XP
        reviewer.level = calculate_level(reviewer.xp_total)
        db.add(XPLog(user_id=reviewer_id, amount=REVIEW_XP, source="peer_review"))

    await db.flush()

    # Send WebSocket event to reviewee
    event = create_event(
        EventType.PEER_REVIEW_ASSIGNED,
        {
            "assignment_id": assignment_id,
            "reviewer_id": reviewer_id,
            "reviewee_id": assignment.reviewee_id,
            "overall_score": overall,
        },
    )
    await manager.send_to_user(assignment.reviewee_id, event)

    return review


async def rate_helpfulness(
    db: AsyncSession,
    review_id: int,
    reviewee_id: int,
    rating: int,
) -> PeerReview:
    """Rate a review's helpfulness (1-5). Only the reviewee can rate."""
    review = await db.get(PeerReview, review_id)
    if review is None:
        raise ValueError("Review not found")

    assignment = await db.get(PeerReviewAssignment, review.assignment_id)
    if assignment is None or assignment.reviewee_id != reviewee_id:
        raise ValueError("Not authorized to rate this review")

    review.helpfulness_rating = rating
    await db.flush()
    return review


async def get_assignments_for_user(
    db: AsyncSession, user_id: int
) -> list[PeerReviewAssignment]:
    """Get pending + completed assignments for a reviewer."""
    result = await db.execute(
        select(PeerReviewAssignment)
        .where(PeerReviewAssignment.reviewer_id == user_id)
        .order_by(PeerReviewAssignment.created_at.desc())
    )
    return list(result.scalars().all())


async def get_reviews_received(
    db: AsyncSession, user_id: int
) -> list[PeerReview]:
    """Get reviews others have written about this user's responses."""
    result = await db.execute(
        select(PeerReview)
        .join(PeerReviewAssignment)
        .where(PeerReviewAssignment.reviewee_id == user_id)
        .order_by(PeerReview.created_at.desc())
    )
    return list(result.scalars().all())


async def get_assignment_detail(
    db: AsyncSession, assignment_id: int
) -> dict[str, object] | None:
    """Get full assignment with response context (scenario + answer)."""
    assignment = await db.get(PeerReviewAssignment, assignment_id)
    if assignment is None:
        return None

    response = await db.get(Response, assignment.response_id)
    scenario: Scenario | None = None
    if response is not None:
        scenario = await db.get(Scenario, response.scenario_id)

    return {
        "assignment": assignment,
        "response": response,
        "scenario": scenario,
    }

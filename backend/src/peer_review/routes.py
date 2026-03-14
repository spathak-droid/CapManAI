"""API routes for peer review system."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import (
    HelpfulnessRatingRequest,
    PeerReviewAssignmentOut,
    PeerReviewOut,
    PeerReviewSubmitRequest,
)
from src.auth.dependencies import get_current_user
from src.db.database import get_db
from src.db.models import User
from src.peer_review.service import (
    get_assignment_detail,
    get_assignments_for_user,
    get_reviews_received,
    rate_helpfulness,
    submit_review,
)

router = APIRouter(prefix="/api/peer-review", tags=["peer-review"])


@router.get("/assignments")
async def list_my_assignments(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PeerReviewAssignmentOut]:
    """List my review assignments (pending + completed)."""
    assignments = await get_assignments_for_user(db, user.id)
    return [
        PeerReviewAssignmentOut(
            id=a.id,
            reviewer_id=a.reviewer_id,
            reviewee_id=a.reviewee_id,
            response_id=a.response_id,
            status=a.status,
            due_at=a.due_at.isoformat() if a.due_at else None,
            created_at=a.created_at.isoformat() if a.created_at else "",
        )
        for a in assignments
    ]


@router.get("/assignments/{assignment_id}")
async def get_assignment(
    assignment_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Get assignment detail with response context."""
    detail = await get_assignment_detail(db, assignment_id)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )

    assignment = detail["assignment"]
    response = detail["response"]
    scenario = detail["scenario"]

    result: dict[str, object] = {
        "id": assignment.id,  # type: ignore[union-attr]
        "reviewer_id": assignment.reviewer_id,  # type: ignore[union-attr]
        "reviewee_id": assignment.reviewee_id,  # type: ignore[union-attr]
        "response_id": assignment.response_id,  # type: ignore[union-attr]
        "status": assignment.status,  # type: ignore[union-attr]
        "due_at": assignment.due_at.isoformat() if assignment.due_at else None,  # type: ignore[union-attr]
        "created_at": assignment.created_at.isoformat() if assignment.created_at else "",  # type: ignore[union-attr]
    }

    if response is not None:
        result["answer_text"] = response.answer_text  # type: ignore[union-attr]
    if scenario is not None:
        result["scenario_situation"] = scenario.situation  # type: ignore[union-attr]
        result["scenario_question"] = scenario.question  # type: ignore[union-attr]
        result["scenario_market_data"] = scenario.market_data  # type: ignore[union-attr]

    return result


@router.post("/assignments/{assignment_id}/submit")
async def submit_peer_review(
    assignment_id: int,
    req: PeerReviewSubmitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PeerReviewOut:
    """Submit a peer review for an assignment."""
    try:
        review = await submit_review(
            db,
            assignment_id=assignment_id,
            reviewer_id=user.id,
            scores={
                "technical_accuracy": req.technical_accuracy,
                "risk_awareness": req.risk_awareness,
                "strategy_fit": req.strategy_fit,
                "reasoning_clarity": req.reasoning_clarity,
            },
            feedback=req.feedback_text,
        )
        await db.commit()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        ) from e

    return PeerReviewOut(
        id=review.id,
        assignment_id=review.assignment_id,
        technical_accuracy=review.technical_accuracy,
        risk_awareness=review.risk_awareness,
        strategy_fit=review.strategy_fit,
        reasoning_clarity=review.reasoning_clarity,
        overall_score=review.overall_score,
        feedback_text=review.feedback_text,
        helpfulness_rating=review.helpfulness_rating,
        created_at=review.created_at.isoformat() if review.created_at else "",
    )


@router.get("/received")
async def list_received_reviews(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PeerReviewOut]:
    """Get reviews received on my responses."""
    reviews = await get_reviews_received(db, user.id)
    return [
        PeerReviewOut(
            id=r.id,
            assignment_id=r.assignment_id,
            technical_accuracy=r.technical_accuracy,
            risk_awareness=r.risk_awareness,
            strategy_fit=r.strategy_fit,
            reasoning_clarity=r.reasoning_clarity,
            overall_score=r.overall_score,
            feedback_text=r.feedback_text,
            helpfulness_rating=r.helpfulness_rating,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in reviews
    ]


@router.post("/reviews/{review_id}/rate")
async def rate_review_helpfulness(
    review_id: int,
    req: HelpfulnessRatingRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Rate a review's helpfulness (1-5)."""
    try:
        review = await rate_helpfulness(db, review_id, user.id, req.rating)
        await db.commit()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        ) from e

    return {"review_id": review.id, "helpfulness_rating": review.helpfulness_rating}

"""API routes for head-to-head challenges."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import (
    ChallengeDetail,
    ChallengeResultDetail,
    ChallengeSubmitRequest,
    QueueJoinRequest,
    QueueStatusResponse,
)
from src.auth.dependencies import get_current_user
from src.challenges.matchmaker import find_match, join_queue, leave_queue
from src.challenges.service import (
    check_and_grade,
    create_challenge,
    get_challenge,
    get_user_challenges,
    submit_response,
)
from src.db.database import get_db
from src.db.models import (
    ChallengeResponse,
    Grade,
    MatchmakingQueue,
    User,
)
from src.realtime.events import EventType, create_event
from src.realtime.manager import manager

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


@router.post("/queue")
async def join_matchmaking_queue(
    req: QueueJoinRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QueueStatusResponse:
    """Join the matchmaking queue."""
    try:
        entry = await join_queue(
            db, user_id=user.id, skill_target=req.skill_target
        )
        await db.commit()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(e)
        ) from e

    # Attempt immediate match
    opponent_id = await find_match(db, user.id)
    if opponent_id is not None:
        challenge = await create_challenge(
            db,
            challenger_id=user.id,
            opponent_id=opponent_id,
            skill_target=req.skill_target,
        )
        # Mark both queue entries
        for uid in (user.id, opponent_id):
            result = await db.execute(
                select(MatchmakingQueue).where(
                    MatchmakingQueue.user_id == uid,
                    MatchmakingQueue.matched_at.is_not(None),
                )
            )
            q_entry = result.scalar_one_or_none()
            if q_entry:
                q_entry.challenge_id = challenge.id

        await db.commit()

        # Notify via websocket
        event = create_event(
            EventType.CHALLENGE_MATCHED,
            {
                "challenge_id": challenge.id,
                "challenger_id": user.id,
                "opponent_id": opponent_id,
            },
        )
        await manager.send_to_user(user.id, event)
        await manager.send_to_user(opponent_id, event)

    return QueueStatusResponse(
        in_queue=True,
        queued_at=entry.queued_at.isoformat() if entry.queued_at else None,
        skill_target=req.skill_target,
    )


@router.delete("/queue")
async def leave_matchmaking_queue(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Leave the matchmaking queue."""
    removed = await leave_queue(db, user.id)
    await db.commit()
    return {"removed": removed}


@router.get("/queue/status")
async def get_queue_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QueueStatusResponse:
    """Check the current user's matchmaking queue status."""
    result = await db.execute(
        select(MatchmakingQueue).where(
            MatchmakingQueue.user_id == user.id,
            MatchmakingQueue.matched_at.is_(None),
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        return QueueStatusResponse(in_queue=False)
    return QueueStatusResponse(
        in_queue=True,
        queued_at=entry.queued_at.isoformat() if entry.queued_at else None,
        skill_target=entry.skill_target,
    )


@router.get("/me")
async def get_my_challenges(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChallengeDetail]:
    """List the current user's challenges."""
    challenges = await get_user_challenges(db, user.id)
    return [
        ChallengeDetail(
            id=c.id,
            challenger_id=c.challenger_id,
            opponent_id=c.opponent_id,
            status=c.status,
            skill_target=c.skill_target,
            complexity=c.complexity,
            winner_id=c.winner_id,
            created_at=c.created_at.isoformat() if c.created_at else "",
        )
        for c in challenges
    ]


@router.post("/{challenge_id}/submit")
async def submit_challenge_response(
    challenge_id: int,
    req: ChallengeSubmitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Submit a response to a challenge."""
    try:
        response = await submit_response(
            db, challenge_id=challenge_id, user_id=user.id, answer_text=req.answer_text
        )
        await db.commit()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        ) from e

    # Check if both have submitted and auto-grade
    challenge = await check_and_grade(db, challenge_id)
    await db.commit()

    return {
        "response_id": response.id,
        "challenge_status": challenge.status,
    }


@router.get("/{challenge_id}")
async def get_challenge_detail(
    challenge_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChallengeDetail:
    """Get challenge details."""
    challenge = await get_challenge(db, challenge_id)
    if challenge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found"
        )
    return ChallengeDetail(
        id=challenge.id,
        challenger_id=challenge.challenger_id,
        opponent_id=challenge.opponent_id,
        status=challenge.status,
        skill_target=challenge.skill_target,
        complexity=challenge.complexity,
        winner_id=challenge.winner_id,
        created_at=challenge.created_at.isoformat() if challenge.created_at else "",
    )


@router.get("/{challenge_id}/result")
async def get_challenge_result(
    challenge_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChallengeResultDetail:
    """Get challenge results after grading."""
    challenge = await get_challenge(db, challenge_id)
    if challenge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found"
        )
    if challenge.status != "complete":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge is not yet complete",
        )

    # Fetch graded responses
    result = await db.execute(
        select(ChallengeResponse).where(
            ChallengeResponse.challenge_id == challenge_id
        )
    )
    responses = list(result.scalars().all())

    challenger_grade: dict[str, object] | None = None
    opponent_grade: dict[str, object] | None = None
    xp_earned = 0

    for resp in responses:
        grade_dict: dict[str, object] | None = None
        if resp.grade_id:
            grade = await db.get(Grade, resp.grade_id)
            if grade:
                grade_dict = {
                    "technical_accuracy": grade.technical_accuracy,
                    "risk_awareness": grade.risk_awareness,
                    "strategy_fit": grade.strategy_fit,
                    "reasoning_clarity": grade.reasoning_clarity,
                    "overall_score": grade.overall_score,
                    "feedback_text": grade.feedback_text,
                }
        if resp.user_id == challenge.challenger_id:
            challenger_grade = grade_dict
        else:
            opponent_grade = grade_dict

        if resp.user_id == user.id:
            from src.challenges.service import LOSER_XP, WINNER_XP

            xp_earned = (
                WINNER_XP if user.id == challenge.winner_id else LOSER_XP
            )

    return ChallengeResultDetail(
        challenge_id=challenge.id,
        winner_id=challenge.winner_id,
        challenger_grade=challenger_grade,
        opponent_grade=opponent_grade,
        xp_earned=xp_earned,
    )

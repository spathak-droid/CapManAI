"""API routes for head-to-head challenges."""

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import (
    ChallengeDetail,
    ChallengeResultDetail,
    ChallengeSubmitRequest,
    OpenChallengeEntry,
    QueueJoinRequest,
)
from src.auth.dependencies import get_current_user
from src.challenges.service import (
    check_and_grade,
    create_challenge,
    get_challenge,
    get_user_challenges,
    submit_response,
)
from src.db.database import get_db
from src.db.models import (
    Challenge,
    ChallengeResponse,
    Grade,
    Scenario,
    User,
)
from src.realtime.events import EventType, create_event
from src.realtime.manager import manager

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


async def _challenge_to_detail(c: Challenge, db: AsyncSession) -> ChallengeDetail:
    # Check who has submitted
    result = await db.execute(
        select(ChallengeResponse.user_id).where(
            ChallengeResponse.challenge_id == c.id
        )
    )
    submitted_user_ids = {row[0] for row in result.all()}

    # Get scenario text and quiz questions (without correct answers/explanations)
    scenario_text: str | None = None
    quiz_questions: list[dict] | None = None
    if c.scenario_id:
        scenario = await db.get(Scenario, c.scenario_id)
        if scenario:
            scenario_text = f"{scenario.situation}\n\n{scenario.question}"
            raw_questions = (scenario.market_data or {}).get("quiz_questions")
            if raw_questions:
                quiz_questions = [
                    {k: v for k, v in q.items() if k not in ("correct_option_id", "explanation")}
                    for q in raw_questions
                ]

    return ChallengeDetail(
        id=c.id,
        challenger_id=c.challenger_id,
        opponent_id=c.opponent_id,
        status=c.status,
        skill_target=c.skill_target,
        complexity=c.complexity,
        winner_id=c.winner_id,
        created_at=c.created_at.isoformat() if c.created_at else "",
        challenger_submitted=c.challenger_id in submitted_user_ids,
        opponent_submitted=(c.opponent_id in submitted_user_ids) if c.opponent_id else False,
        scenario_text=scenario_text,
        quiz_questions=quiz_questions,
    )


def _challenge_to_detail_simple(c: Challenge) -> ChallengeDetail:
    """Quick version without DB lookups (for lists)."""
    return ChallengeDetail(
        id=c.id,
        challenger_id=c.challenger_id,
        opponent_id=c.opponent_id,
        status=c.status,
        skill_target=c.skill_target,
        complexity=c.complexity,
        winner_id=c.winner_id,
        created_at=c.created_at.isoformat() if c.created_at else "",
    )


@router.post("/create")
async def create_open_challenge(
    req: QueueJoinRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChallengeDetail:
    """Create an open challenge that others can see and accept."""
    # Check if user already has a pending challenge
    result = await db.execute(
        select(Challenge).where(
            Challenge.challenger_id == user.id,
            Challenge.status == "pending",
        )
    )
    existing = result.scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an open challenge",
        )

    challenge = Challenge(
        challenger_id=user.id,
        opponent_id=None,
        status="pending",
        skill_target=req.skill_target,
        complexity=3,
    )
    db.add(challenge)
    await db.flush()
    await db.commit()
    await db.refresh(challenge)

    # Broadcast to all users
    open_event = create_event(
        EventType.CHALLENGE_OPEN,
        {
            "challenge_id": challenge.id,
            "user_id": user.id,
            "username": user.username,
            "skill_target": req.skill_target,
            "created_at": challenge.created_at.isoformat() if challenge.created_at else "",
        },
    )
    await manager.broadcast_all(open_event)

    return _challenge_to_detail_simple(challenge)


@router.delete("/cancel/{challenge_id}")
async def cancel_open_challenge(
    challenge_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Cancel your own pending challenge."""
    challenge = await db.get(Challenge, challenge_id)
    if challenge is None or challenge.challenger_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )
    if challenge.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only cancel pending challenges",
        )

    await db.delete(challenge)
    await db.commit()

    cancel_event = create_event(
        EventType.CHALLENGE_CANCELLED,
        {"challenge_id": challenge_id},
    )
    await manager.broadcast_all(cancel_event)

    return {"cancelled": True}


@router.get("/open")
async def list_open_challenges(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[OpenChallengeEntry]:
    """List all pending challenges waiting for an opponent."""
    result = await db.execute(
        select(Challenge, User)
        .join(User, Challenge.challenger_id == User.id)
        .where(
            Challenge.status == "pending",
            Challenge.challenger_id != user.id,
        )
        .order_by(Challenge.created_at.desc())
    )
    rows = result.all()
    return [
        OpenChallengeEntry(
            challenge_id=c.id,
            user_id=c.challenger_id,
            username=u.username,
            skill_target=c.skill_target,
            created_at=c.created_at.isoformat() if c.created_at else "",
        )
        for c, u in rows
    ]


@router.post("/accept/{challenge_id}")
async def accept_open_challenge(
    challenge_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChallengeDetail:
    """Accept a pending challenge — generates scenario and starts the match."""
    challenge = await db.get(Challenge, challenge_id)
    if challenge is None or challenge.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Open challenge not found or already accepted",
        )
    if challenge.challenger_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot accept your own challenge",
        )

    # Set opponent and activate via create_challenge (generates scenario)
    active_challenge = await create_challenge(
        db,
        challenger_id=challenge.challenger_id,
        opponent_id=user.id,
        skill_target=challenge.skill_target,
        complexity=challenge.complexity,
    )

    # Delete the pending placeholder — the real one is active_challenge
    await db.delete(challenge)
    await db.commit()

    # Tell ALL users to remove the open challenge from their list
    cancel_event = create_event(
        EventType.CHALLENGE_CANCELLED,
        {"challenge_id": challenge_id},
    )
    await manager.broadcast_all(cancel_event)

    # Notify both participants that they're matched
    event = create_event(
        EventType.CHALLENGE_MATCHED,
        {
            "challenge_id": active_challenge.id,
            "challenger_id": active_challenge.challenger_id,
            "opponent_id": user.id,
        },
    )
    await manager.send_to_user(active_challenge.challenger_id, event)
    await manager.send_to_user(user.id, event)

    return _challenge_to_detail_simple(active_challenge)


@router.get("/online-count")
async def get_online_count(
    _user: User = Depends(get_current_user),
) -> dict[str, int]:
    """Return the number of currently connected WebSocket users."""
    return {"online_count": len(manager.active_connections)}


@router.get("/me")
async def get_my_challenges(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChallengeDetail]:
    """List the current user's challenges."""
    challenges = await get_user_challenges(db, user.id)
    return [_challenge_to_detail_simple(c) for c in challenges]


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
            db, challenge_id=challenge_id, user_id=user.id, answers=json.dumps(req.answers)
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
    return await _challenge_to_detail(challenge, db)


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
    challenger_answers: list[dict] | None = None
    opponent_answers: list[dict] | None = None
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

        # Parse the stored answers JSON
        try:
            parsed_answers: list[dict] = json.loads(resp.answer_text or "[]")
        except (json.JSONDecodeError, TypeError):
            parsed_answers = []

        if resp.user_id == challenge.challenger_id:
            challenger_grade = grade_dict
            challenger_answers = parsed_answers
        else:
            opponent_grade = grade_dict
            opponent_answers = parsed_answers

        if resp.user_id == user.id:
            from src.challenges.service import LOSER_XP, WINNER_XP

            xp_earned = (
                WINNER_XP if user.id == challenge.winner_id else LOSER_XP
            )

    # Get full quiz questions (with correct answers) from scenario
    quiz_questions: list[dict] | None = None
    if challenge.scenario_id:
        scenario = await db.get(Scenario, challenge.scenario_id)
        if scenario and scenario.market_data:
            raw_questions = scenario.market_data.get("quiz_questions")
            if raw_questions:
                quiz_questions = list(raw_questions)

    return ChallengeResultDetail(
        challenge_id=challenge.id,
        winner_id=challenge.winner_id,
        challenger_grade=challenger_grade,
        opponent_grade=opponent_grade,
        xp_earned=xp_earned,
        quiz_questions=quiz_questions,
        challenger_answers=challenger_answers,
        opponent_answers=opponent_answers,
    )

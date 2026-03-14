"""Challenge lifecycle service for head-to-head challenges."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    Challenge,
    ChallengeResponse,
    Grade,
    Scenario,
    User,
    XPLog,
)
from src.grading.agent import GradingAgent
from src.realtime.events import EventType, create_event
from src.realtime.manager import manager

logger = logging.getLogger(__name__)

_grading_agent = GradingAgent()

# XP awards for challenges
WINNER_XP = 50
LOSER_XP = 20


async def create_challenge(
    db: AsyncSession,
    challenger_id: int,
    opponent_id: int,
    skill_target: str | None = None,
    complexity: int = 3,
) -> Challenge:
    """Create a new challenge between two users and generate a scenario."""
    challenge = Challenge(
        challenger_id=challenger_id,
        opponent_id=opponent_id,
        skill_target=skill_target,
        complexity=complexity,
        status="active",
    )
    db.add(challenge)
    await db.flush()

    # Try to generate a scenario via LLM, fallback to a placeholder
    try:
        from src.scenario_gen.generator import ScenarioGenerator, ScenarioParams

        params = ScenarioParams(
            market_regime="bull",
            instrument_type="equity",
            complexity=complexity,
            skill_target=skill_target or "price_action",
        )
        gen = ScenarioGenerator()
        result = await gen.generate(params)

        scenario = Scenario(
            market_regime=params.market_regime,
            instrument_type=params.instrument_type,
            complexity=complexity,
            skill_target=skill_target or "price_action",
            situation=result.situation,
            market_data=result.market_data,
            question=result.question,
        )
        db.add(scenario)
        await db.flush()
        challenge.scenario_id = scenario.id
    except Exception:
        logger.exception("Failed to generate scenario for challenge")

    await db.flush()

    # Notify both users via WebSocket
    event = create_event(
        EventType.CHALLENGE_STARTED,
        {
            "challenge_id": challenge.id,
            "challenger_id": challenger_id,
            "opponent_id": opponent_id,
            "skill_target": skill_target,
        },
    )
    await manager.send_to_user(challenger_id, event)
    await manager.send_to_user(opponent_id, event)

    return challenge


async def submit_response(
    db: AsyncSession,
    challenge_id: int,
    user_id: int,
    answer_text: str,
) -> ChallengeResponse:
    """Submit a response to a challenge.

    Raises ValueError if the challenge is not active, the user is not
    a participant, or the user has already submitted.
    """
    challenge = await db.get(Challenge, challenge_id)
    if challenge is None:
        raise ValueError("Challenge not found")
    if challenge.status not in ("active",):
        raise ValueError("Challenge is not active")
    if user_id not in (challenge.challenger_id, challenge.opponent_id):
        raise ValueError("User is not a participant in this challenge")

    # Check for duplicate submission
    existing = await db.execute(
        select(ChallengeResponse).where(
            ChallengeResponse.challenge_id == challenge_id,
            ChallengeResponse.user_id == user_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError("User has already submitted a response")

    response = ChallengeResponse(
        challenge_id=challenge_id,
        user_id=user_id,
        answer_text=answer_text,
    )
    db.add(response)
    await db.flush()

    # Notify the opponent that this user submitted
    opponent_id = (
        challenge.opponent_id
        if user_id == challenge.challenger_id
        else challenge.challenger_id
    )
    if opponent_id is not None:
        event = create_event(
            EventType.OPPONENT_SUBMITTED,
            {"challenge_id": challenge_id, "user_id": user_id},
        )
        await manager.send_to_user(opponent_id, event)

    return response


async def check_and_grade(db: AsyncSession, challenge_id: int) -> Challenge:
    """If both users have submitted, grade both responses and determine winner.

    Returns the updated challenge. If not both submitted yet, returns as-is.
    """
    challenge = await db.get(Challenge, challenge_id)
    if challenge is None:
        raise ValueError("Challenge not found")
    if challenge.status == "complete":
        return challenge

    # Get both responses
    result = await db.execute(
        select(ChallengeResponse).where(
            ChallengeResponse.challenge_id == challenge_id
        )
    )
    responses = list(result.scalars().all())
    if len(responses) < 2:
        return challenge  # Not ready to grade yet

    challenge.status = "grading"
    await db.flush()

    # Get the scenario text for grading
    scenario_text = ""
    if challenge.scenario_id:
        scenario = await db.get(Scenario, challenge.scenario_id)
        if scenario:
            scenario_text = f"{scenario.situation}\n\n{scenario.question}"

    # Grade each response
    grades: dict[int, Grade] = {}
    for resp in responses:
        try:
            grade_result = await _grading_agent.grade(
                scenario_text=scenario_text,
                student_response=resp.answer_text,
                probe_exchanges=[],
            )
            grade = Grade(
                response_id=0,  # Not linked to Response table
                technical_accuracy=grade_result.technical_accuracy,
                risk_awareness=grade_result.risk_awareness,
                strategy_fit=grade_result.strategy_fit,
                reasoning_clarity=grade_result.reasoning_clarity,
                overall_score=grade_result.overall_score,
                feedback_text=grade_result.feedback_text,
            )
            db.add(grade)
            await db.flush()
            resp.grade_id = grade.id
            grades[resp.user_id] = grade
        except Exception:
            logger.exception(
                "Failed to grade challenge response for user %d", resp.user_id
            )

    # Determine winner
    if len(grades) == 2:
        user_ids = list(grades.keys())
        score_a = grades[user_ids[0]].overall_score
        score_b = grades[user_ids[1]].overall_score

        if score_a > score_b:
            challenge.winner_id = user_ids[0]
        elif score_b > score_a:
            challenge.winner_id = user_ids[1]
        else:
            # Tie-breaker: faster submission wins
            resp_map = {r.user_id: r for r in responses}
            if resp_map[user_ids[0]].submitted_at <= resp_map[user_ids[1]].submitted_at:
                challenge.winner_id = user_ids[0]
            else:
                challenge.winner_id = user_ids[1]

    challenge.status = "complete"
    challenge.completed_at = datetime.now(timezone.utc)
    await db.flush()

    # Award XP
    for resp in responses:
        xp_amount = WINNER_XP if resp.user_id == challenge.winner_id else LOSER_XP
        user = await db.get(User, resp.user_id)
        if user is not None:
            user.xp_total = (user.xp_total or 0) + xp_amount
            db.add(
                XPLog(
                    user_id=resp.user_id,
                    amount=xp_amount,
                    source="challenge_complete",
                )
            )

    await db.flush()

    # Notify both users
    event = create_event(
        EventType.CHALLENGE_GRADED,
        {
            "challenge_id": challenge_id,
            "winner_id": challenge.winner_id,
        },
    )
    await manager.send_to_user(challenge.challenger_id, event)
    if challenge.opponent_id:
        await manager.send_to_user(challenge.opponent_id, event)

    return challenge


async def get_challenge(db: AsyncSession, challenge_id: int) -> Challenge | None:
    """Get a challenge by ID."""
    return await db.get(Challenge, challenge_id)


async def get_user_challenges(
    db: AsyncSession, user_id: int
) -> list[Challenge]:
    """Get all challenges for a user (as challenger or opponent)."""
    result = await db.execute(
        select(Challenge)
        .where(
            (Challenge.challenger_id == user_id)
            | (Challenge.opponent_id == user_id)
        )
        .order_by(Challenge.created_at.desc())
    )
    return list(result.scalars().all())

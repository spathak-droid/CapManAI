"""Challenge lifecycle service for head-to-head challenges."""

import json
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.db.models import (
    Challenge,
    ChallengeResponse,
    Grade,
    Scenario,
    SkillScore,
    User,
    XPLog,
)
from src.realtime.events import EventType, create_event
from src.realtime.manager import manager

logger = logging.getLogger(__name__)

# XP awards for challenges
WINNER_XP = 50
LOSER_XP = 20

_FALLBACK_QUIZ_QUESTIONS = [
    {
        "id": 1,
        "prompt": "What is the primary risk in a momentum trade?",
        "options": [
            {"id": "a", "text": "Dividend risk"},
            {"id": "b", "text": "Reversal risk when momentum fades"},
            {"id": "c", "text": "Currency exchange risk"},
            {"id": "d", "text": "Inflation risk"},
        ],
        "correct_option_id": "b",
        "explanation": "Momentum trades are vulnerable to sharp reversals once the trend loses strength.",
    },
    {
        "id": 2,
        "prompt": "Which order type best limits downside on an open position?",
        "options": [
            {"id": "a", "text": "Market order"},
            {"id": "b", "text": "Limit order"},
            {"id": "c", "text": "Stop-loss order"},
            {"id": "d", "text": "Day order"},
        ],
        "correct_option_id": "c",
        "explanation": "A stop-loss order automatically closes a position when price hits a specified level, capping losses.",
    },
    {
        "id": 3,
        "prompt": "What does a rising volume accompanying a price breakout typically signal?",
        "options": [
            {"id": "a", "text": "Weak conviction — likely a false breakout"},
            {"id": "b", "text": "Strong conviction — breakout is more reliable"},
            {"id": "c", "text": "Market manipulation"},
            {"id": "d", "text": "Upcoming dividend announcement"},
        ],
        "correct_option_id": "b",
        "explanation": "High volume on a breakout confirms broad participation, making the move more credible.",
    },
]


async def _generate_quiz_questions(
    situation: str,
    question: str,
    skill_target: str,
) -> list[dict]:
    """Generate 3 MCQ quiz questions via LLM, with fallback to hardcoded questions."""
    system_prompt = (
        "You are an expert trading instructor creating quiz questions. "
        "Respond with valid JSON only."
    )
    user_prompt = (
        f"Scenario situation:\n{situation}\n\n"
        f"Scenario question:\n{question}\n\n"
        f"Skill target: {skill_target}\n\n"
        "Generate exactly 3 multiple-choice quiz questions that test understanding of "
        "the specific trading concepts in this scenario. "
        "Return a JSON object with a single key 'questions' containing an array of 3 objects. "
        "Each object must have:\n"
        '  "id": integer (1, 2, or 3)\n'
        '  "prompt": string (the question text)\n'
        '  "options": array of 4 objects, each with "id" (one of "a","b","c","d") and "text"\n'
        '  "correct_option_id": string (the id of the correct option)\n'
        '  "explanation": string (brief explanation of why the answer is correct)\n'
    )
    try:
        client = httpx.AsyncClient(timeout=30.0)
        payload = {
            "model": settings.openrouter_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }
        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
        }
        response = await client.post(
            f"{settings.OPENROUTER_BASE_URL}/chat/completions",
            json=payload,
            headers=headers,
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        questions = parsed.get("questions", [])
        if len(questions) == 3:
            return questions
        logger.warning("LLM returned %d quiz questions, expected 3; using fallback", len(questions))
    except Exception:
        logger.exception("Failed to generate quiz questions via LLM; using fallback")
    return _FALLBACK_QUIZ_QUESTIONS


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

        # Generate quiz questions for this scenario
        quiz_questions = await _generate_quiz_questions(
            situation=result.situation,
            question=result.question,
            skill_target=skill_target or "price_action",
        )
        market_data = dict(result.market_data)
        market_data["quiz_questions"] = quiz_questions

        scenario = Scenario(
            market_regime=params.market_regime,
            instrument_type=params.instrument_type,
            complexity=complexity,
            skill_target=skill_target or "price_action",
            situation=result.situation,
            market_data=market_data,
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
    answers: str,
) -> ChallengeResponse:
    """Submit a response to a challenge.

    ``answers`` is a JSON string of the user's quiz answers
    (list of {question_id, selected}).

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
        answer_text=answers,
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

    # Get quiz questions from the scenario for deterministic grading
    quiz_questions: list[dict] = []
    if challenge.scenario_id:
        scenario = await db.get(Scenario, challenge.scenario_id)
        if scenario and scenario.market_data:
            quiz_questions = scenario.market_data.get("quiz_questions", [])

    correct_map: dict[int, str] = {
        q["id"]: q["correct_option_id"]
        for q in quiz_questions
        if "id" in q and "correct_option_id" in q
    }
    total_questions = len(correct_map) if correct_map else 3

    # Grade each response deterministically
    grades: dict[int, Grade] = {}
    for resp in responses:
        try:
            user_answers: list[dict] = json.loads(resp.answer_text or "[]")
        except (json.JSONDecodeError, TypeError):
            user_answers = []

        correct_count = sum(
            1
            for ans in user_answers
            if isinstance(ans.get("question_id"), int)
            and correct_map.get(int(ans["question_id"])) == ans.get("selected")
        )
        score = (correct_count / total_questions) * 5.0
        # Clamp to 1.0–5.0 range
        score = max(1.0, min(5.0, score)) if total_questions > 0 else 1.0
        feedback_text = f"You got {correct_count}/{total_questions} correct."

        grade = Grade(
            response_id=None,  # Challenge grades aren't linked to Response table
            technical_accuracy=score,
            risk_awareness=score,
            strategy_fit=score,
            reasoning_clarity=score,
            overall_score=score,
            feedback_text=feedback_text,
        )
        db.add(grade)
        await db.flush()
        resp.grade_id = grade.id
        grades[resp.user_id] = grade

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

    # Update SkillScore and LearningObjectiveProgress for both users
    if challenge.skill_target:
        from src.mtss.repository import update_objective_progress

        for uid, grade in grades.items():
            if grade is None:
                continue
            new_score = grade.overall_score * 20
            existing = await db.execute(
                select(SkillScore).where(
                    SkillScore.user_id == uid,
                    SkillScore.skill_id == challenge.skill_target,
                )
            )
            skill_row = existing.scalar_one_or_none()
            if skill_row:
                skill_row.score = (
                    (skill_row.score * skill_row.attempts) + new_score
                ) / (skill_row.attempts + 1)
                skill_row.attempts += 1
            else:
                db.add(
                    SkillScore(
                        user_id=uid,
                        skill_id=challenge.skill_target,
                        score=new_score,
                        attempts=1,
                    )
                )
            try:
                await update_objective_progress(
                    db, user_id=uid,
                    objective_id=challenge.skill_target,
                    score=new_score,
                )
            except Exception:
                pass
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

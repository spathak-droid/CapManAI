"""Scenario generation, response, probing, and grading routes."""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import (
    GenerateScenarioResponse,
    GradeRequest,
    GradeResponse,
    LessonScenarioRequest,
    ProbeExchangeOut,
    ProbeRequest,
    ProbeResponse,
    RespondRequest,
    RespondResponse,
    ScenarioHistoryItem,
    ScenarioHistoryResponse,
    TrainingSessionDetail,
)
from src.auth.dependencies import get_current_user
from src.db.database import get_db
from src.db.models import (
    Grade,
    ProbeQuestion,
    Response,
    Scenario,
    SkillScore,
    User,
    XPLog,
)
from src.gamification.xp import calculate_level, calculate_xp
from src.grading.agent import GradingAgent, ProbingAgent
from src.rag.retriever import get_context
from src.scenario_gen.diversity import (
    get_regime_distribution,
    get_skill_distribution,
    should_override_regime,
    suggest_regime,
)
from src.scenario_gen.generator import (
    LessonContext,
    ScenarioGenerator,
    ScenarioParams,
    ScenarioResult,
)

logger = logging.getLogger(__name__)

router = APIRouter()

_probing_agent = ProbingAgent()
_grading_agent = GradingAgent()
_scenario_generator = ScenarioGenerator()


@router.post("/api/scenarios/generate")
async def generate_scenario(
    params: ScenarioParams,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GenerateScenarioResponse:
    """Generate a new trading scenario using LLM and persist to DB.

    When ``auto_regime`` is True, the endpoint checks the user's past
    regime distribution and overrides ``market_regime`` with the
    least-seen regime if significant imbalance is detected.
    """
    if params.auto_regime:
        dist = await get_regime_distribution(db, _user.id)
        if should_override_regime(dist):
            suggested = await suggest_regime(db, _user.id)
            params = params.model_copy(update={"market_regime": suggested})  # type: ignore[assignment]
    rag_ctx = await get_context(db, query=params.skill_target, top_k=3)
    result = await _scenario_generator.generate(params, rag_context=rag_ctx)

    # Persist the scenario to DB
    scenario = Scenario(
        market_regime=params.market_regime,
        instrument_type=params.instrument_type,
        complexity=params.complexity,
        skill_target=params.skill_target,
        situation=result.situation,
        market_data=result.market_data,
        question=result.question,
    )
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)

    mc_dict = None
    if result.multiple_choice is not None:
        mc_dict = result.multiple_choice.model_dump()

    return GenerateScenarioResponse(
        scenario_id=scenario.id,
        situation=result.situation,
        market_data=result.market_data,
        question=result.question,
        multiple_choice=mc_dict,
    )


@router.post("/api/scenarios/generate-lesson")
async def generate_lesson_scenario(
    req: LessonScenarioRequest,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScenarioResult:
    """Generate a scenario aligned with the lesson chunk (tickers, charts, lesson concepts)."""
    lesson = LessonContext(**req.lesson_context.model_dump())
    rag_ctx = await get_context(db, query=req.lesson_context.learning_goal, top_k=3)
    return await _scenario_generator.generate_lesson(lesson, rag_context=rag_ctx)


@router.get("/api/scenarios/history")
async def get_scenario_history(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScenarioHistoryResponse:
    """Return the user's scenario diversity history."""
    regime_dist = await get_regime_distribution(db, _user.id)
    skill_dist = await get_skill_distribution(db, _user.id)

    stmt = (
        select(Scenario)
        .join(Response, Response.scenario_id == Scenario.id)
        .where(Response.user_id == _user.id)
        .order_by(Scenario.created_at.desc())
        .limit(10)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    recent = [
        ScenarioHistoryItem(
            scenario_id=s.id,
            market_regime=s.market_regime,
            skill_target=s.skill_target,
            complexity=s.complexity,
            situation=s.situation,
            question=s.question,
            created_at=s.created_at.isoformat(),
        )
        for s in rows
    ]

    total = sum(regime_dist.values())
    return ScenarioHistoryResponse(
        total_scenarios=total,
        regime_distribution=regime_dist,
        skill_distribution=skill_dist,
        recent_scenarios=recent,
    )


@router.get("/api/scenarios/review")
async def get_training_review(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TrainingSessionDetail]:
    """Get the current user's training sessions with full detail for review."""
    result = await db.execute(
        select(Response)
        .where(Response.user_id == user.id)
        .order_by(Response.created_at.desc())
        .limit(20)
    )
    responses = result.scalars().all()

    sessions: list[TrainingSessionDetail] = []
    for resp in responses:
        scenario = await db.get(Scenario, resp.scenario_id)
        if not scenario:
            continue

        # Get grade
        grade_result = await db.execute(
            select(Grade).where(Grade.response_id == resp.id)
        )
        grade = grade_result.scalar_one_or_none()

        # Get probe exchanges
        probe_result = await db.execute(
            select(ProbeQuestion)
            .where(ProbeQuestion.response_id == resp.id)
            .order_by(ProbeQuestion.created_at)
        )
        probes = probe_result.scalars().all()

        # Estimate XP from grade
        xp = 0
        if grade:
            xp = calculate_xp(overall_score=grade.overall_score, complexity=scenario.complexity)

        sessions.append(TrainingSessionDetail(
            response_id=resp.id,
            scenario_id=scenario.id,
            scenario_situation=scenario.situation,
            scenario_question=scenario.question,
            scenario_market_data=scenario.market_data,
            skill_target=scenario.skill_target,
            complexity=scenario.complexity,
            answer_text=resp.answer_text,
            probe_exchanges=[
                ProbeExchangeOut(question=p.question_text, answer=p.answer_text)
                for p in probes
            ],
            overall_score=grade.overall_score if grade else None,
            technical_accuracy=grade.technical_accuracy if grade else None,
            risk_awareness=grade.risk_awareness if grade else None,
            strategy_fit=grade.strategy_fit if grade else None,
            reasoning_clarity=grade.reasoning_clarity if grade else None,
            feedback_text=grade.feedback_text if grade else None,
            xp_earned=xp,
            created_at=resp.created_at.isoformat(),
        ))

    return sessions


@router.post("/api/scenarios/respond")
async def respond_to_scenario(
    req: RespondRequest,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RespondResponse:
    """Submit a response to a trading scenario and persist to DB."""
    response = Response(
        user_id=req.user_id,
        scenario_id=req.scenario_id,
        answer_text=req.answer_text,
    )
    db.add(response)
    await db.commit()
    await db.refresh(response)
    return RespondResponse(
        response_id=response.id, status="received"
    )


@router.post("/api/scenarios/probe")
async def probe_response(
    req: ProbeRequest,
    _user: User = Depends(get_current_user),
) -> ProbeResponse:
    """Generate probing follow-up questions for a response."""
    questions = await _probing_agent.generate_probes(
        scenario_text=req.scenario_text,
        student_response=req.student_response,
        num_probes=req.num_probes,
    )
    return ProbeResponse(questions=questions)


@router.post("/api/scenarios/grade")
async def grade_response(
    req: GradeRequest,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GradeResponse:
    """Grade a scenario response with probing answers and persist XP."""
    rag_ctx = await get_context(db, query=req.scenario_text[:200], top_k=3)
    result = await _grading_agent.grade(
        scenario_text=req.scenario_text,
        student_response=req.student_response,
        probe_exchanges=req.probe_exchanges,
        rag_context=rag_ctx if rag_ctx else None,
    )
    xp_earned = calculate_xp(
        overall_score=result.overall_score,
        complexity=req.complexity,
    )

    # Save Grade record linked to the response
    # response_id=0 is a frontend placeholder — treat as null
    linked_response_id = req.response_id if req.response_id else None
    grade_record = Grade(
        response_id=linked_response_id,
        technical_accuracy=result.technical_accuracy,
        risk_awareness=result.risk_awareness,
        strategy_fit=result.strategy_fit,
        reasoning_clarity=result.reasoning_clarity,
        overall_score=result.overall_score,
        feedback_text=result.feedback_text,
    )
    db.add(grade_record)

    # Save ProbeQuestion records for each probe exchange (only if linked to a real response)
    if linked_response_id:
        for exchange in req.probe_exchanges:
            probe = ProbeQuestion(
                response_id=linked_response_id,
                question_text=exchange.question,
                answer_text=exchange.answer,
            )
            db.add(probe)

    await db.commit()

    # Persist XP to the current user and leaderboard when we have a DB user
    try:
        if isinstance(_user, User):
            user = await db.get(User, _user.id)
            if user is not None:
                user.xp_total = (user.xp_total or 0) + xp_earned
                user.level = calculate_level(user.xp_total)
                db.add(XPLog(user_id=user.id, amount=xp_earned, source="scenario_grade"))
                await db.commit()
                await db.refresh(user)
    except Exception:
        logger.exception("XP persistence failed")

    # Upsert SkillScore for the targeted skill
    try:
        if isinstance(_user, User):
            skill_target = req.skill_target
            existing = await db.execute(
                select(SkillScore).where(
                    SkillScore.user_id == _user.id,
                    SkillScore.skill_id == skill_target,
                )
            )
            skill_row = existing.scalar_one_or_none()
            new_score = result.overall_score * 20  # Convert 1-5 scale to 0-100
            if skill_row:
                skill_row.score = (
                    (skill_row.score * skill_row.attempts) + new_score
                ) / (skill_row.attempts + 1)
                skill_row.attempts += 1
            else:
                db.add(
                    SkillScore(
                        user_id=_user.id,
                        skill_id=skill_target,
                        score=new_score,
                        attempts=1,
                    )
                )
            await db.commit()
    except Exception:
        logger.exception("Skill score persistence failed")

    # Auto-assign peer reviews (best-effort, don't block grading)
    try:
        if isinstance(_user, User) and linked_response_id:
            from src.peer_review.service import auto_assign_peer_reviews

            assignments = await auto_assign_peer_reviews(
                db,
                response_id=linked_response_id,
                user_id=_user.id,
                skill_target=req.skill_target,
            )
            await db.commit()
            logger.info(
                "Peer review auto-assign: user=%s response=%s skill=%s assigned=%d",
                _user.id, linked_response_id, req.skill_target, len(assignments),
            )
        else:
            logger.warning(
                "Peer review skipped: user_type=%s linked_response_id=%s",
                type(_user).__name__, linked_response_id,
            )
    except Exception:
        logger.exception("Peer review auto-assign failed")

    return GradeResponse(
        technical_accuracy=result.technical_accuracy,
        risk_awareness=result.risk_awareness,
        strategy_fit=result.strategy_fit,
        reasoning_clarity=result.reasoning_clarity,
        overall_score=result.overall_score,
        feedback_text=result.feedback_text,
        xp_earned=xp_earned,
    )

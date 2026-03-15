"""API route definitions for CapMan AI."""

import csv
import io
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select

from src.api.schemas import (
    BadgeCatalogResponse,
    BadgeInfo,
    ChunkCompleteResponse,
    DynamicLeaderboardEntry,
    EducatorFeedbackOut,
    EducatorFeedbackRequest,
    GenerateScenarioResponse,
    GradeRequest,
    GradeResponse,
    InterventionRecommendation,
    LessonChunkDetail,
    LessonModuleDetail,
    LessonModuleSummary,
    LessonProgressSummary,
    ObjectiveDistribution,
    ProbeRequest,
    ProbeResponse,
    QuizAttemptRequest,
    QuizAttemptResponse,
    RespondRequest,
    RespondResponse,
    StreakInfo,
    StudentResponseEntry,
    StudentRosterEntry,
    StudentSkillBreakdown,
    UserRank,
)
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.dependencies import get_current_user, require_role
from src.db.database import get_db
from src.db.models import (
    Challenge,
    DocumentChunk,
    EducatorFeedback,
    Grade,
    LessonChunk,
    LessonModule,
    LessonQuizItem,
    PeerReviewAssignment,
    ProbeQuestion,
    Response,
    Scenario,
    SkillScore,
    User,
    XPLog,
)
from src.gamification.leaderboard import (
    LeaderboardEntry,
    get_leaderboard,
)
from src.gamification.ranking import (
    get_dynamic_leaderboard,
    get_user_rank,
    recalculate_rankings,
)
from src.gamification.xp import calculate_level, calculate_xp, xp_to_next_level
from src.grading.agent import GradingAgent, ProbingAgent
from src.mtss.classifier import (
    ClassOverview,
    MTSSTier,
    classify_tier,
    get_class_overview_from_db,
    get_student_tiers,
)
from src.mtss.objectives import OBJECTIVE_DESCRIPTIONS, LearningObjective
from src.mtss.repository import (
    get_all_student_scores,
    get_class_objective_distribution,
    get_student_skill_scores,
)
from src.lessons.repository import (
    fetch_chunk_def,
    fetch_chunks_for_module,
    fetch_module_detail,
    fetch_modules,
)
from src.lessons.service import (
    attempt_chunk,
    calculate_new_badges,
    check_prerequisites_met,
    complete_chunk,
    get_chunk,
    get_module,
    get_progress_summary,
    get_streak,
    list_module_chunks,
    list_modules,
)
from src.api.schemas import (
    DocumentIngestRequest,
    DocumentIngestResponse,
    LessonScenarioRequest,
    RAGDocumentSummary,
    RAGSearchResponse,
    RAGSearchResult,
    ScenarioHistoryItem,
    ScenarioHistoryResponse,
)
from src.rag.ingest import _generate_doc_id, ingest_document
from src.rag.retriever import get_context, invalidate_chunk_cache, search as rag_search
from src.rag.seed import seed_rag_documents
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

router = APIRouter()

NOT_IMPLEMENTED = {"status": "not implemented"}

_probing_agent = ProbingAgent()
_grading_agent = GradingAgent()
_scenario_generator = ScenarioGenerator()

# In-memory user XP store for demo
_user_xp_store: dict[int, dict[str, object]] = {
    1: {"user_id": 1, "username": "TraderJoe", "xp_total": 8500},
    2: {"user_id": 2, "username": "OptionQueen", "xp_total": 12500},
    3: {"user_id": 3, "username": "BullRunner", "xp_total": 3200},
    4: {"user_id": 4, "username": "BearHunter", "xp_total": 5100},
    5: {"user_id": 5, "username": "VolSmile", "xp_total": 15000},
    6: {"user_id": 6, "username": "GammaKing", "xp_total": 2100},
    7: {"user_id": 7, "username": "ThetaGang", "xp_total": 6800},
    8: {"user_id": 8, "username": "DeltaNeutral", "xp_total": 950},
    9: {"user_id": 9, "username": "IronCondor", "xp_total": 4200},
    10: {"user_id": 10, "username": "VegaTrader", "xp_total": 700},
}


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
    grade_record = Grade(
        response_id=req.response_id,
        technical_accuracy=result.technical_accuracy,
        risk_awareness=result.risk_awareness,
        strategy_fit=result.strategy_fit,
        reasoning_clarity=result.reasoning_clarity,
        overall_score=result.overall_score,
        feedback_text=result.feedback_text,
    )
    db.add(grade_record)

    # Save ProbeQuestion records for each probe exchange
    for exchange in req.probe_exchanges:
        probe = ProbeQuestion(
            response_id=req.response_id,
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
        pass  # Don't fail the grade response if persistence fails (e.g. test env)

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
        pass  # Don't fail the grade response if skill persistence fails

    # Auto-assign peer reviews (best-effort, don't block grading)
    try:
        if isinstance(_user, User):
            from src.peer_review.service import auto_assign_peer_reviews

            await auto_assign_peer_reviews(
                db,
                response_id=req.response_id,
                user_id=_user.id,
                skill_target=req.skill_target,
            )
            await db.commit()
    except Exception:
        pass  # Don't fail the grade response if peer assignment fails

    return GradeResponse(
        technical_accuracy=result.technical_accuracy,
        risk_awareness=result.risk_awareness,
        strategy_fit=result.strategy_fit,
        reasoning_clarity=result.reasoning_clarity,
        overall_score=result.overall_score,
        feedback_text=result.feedback_text,
        xp_earned=xp_earned,
    )


ALL_SKILL_IDS = [
    "price_action",
    "options_chain",
    "strike_select",
    "risk_mgmt",
    "position_size",
    "regime_id",
    "vol_assess",
    "trade_mgmt",
]


@router.get("/api/skills/me")
async def get_my_skills(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Return the current user's skill scores."""
    result = await db.execute(
        select(SkillScore).where(SkillScore.user_id == _user.id)
    )
    rows = result.scalars().all()
    skills: dict[str, dict[str, object]] = {}
    for row in rows:
        skills[row.skill_id] = {
            "score": round(row.score, 1),
            "attempts": row.attempts,
        }
    # Fill in missing skills with 0
    for skill_id in ALL_SKILL_IDS:
        if skill_id not in skills:
            skills[skill_id] = {"score": 0.0, "attempts": 0}
    return {"skills": skills}


@router.get("/api/gamification/xp/{user_id}")
async def get_user_xp(
    user_id: int,
    _user: User = Depends(get_current_user),
) -> dict[str, object]:
    """Get XP details for a user."""
    user_data = _user_xp_store.get(user_id)
    if user_data is None:
        return {"error": "User not found", "user_id": user_id}

    xp_total = int(user_data["xp_total"])  # type: ignore[arg-type]
    level = calculate_level(xp_total)
    progress = xp_to_next_level(xp_total, level)

    return {
        "user_id": user_id,
        "username": user_data["username"],
        "xp_total": xp_total,
        "level": level,
        "progress": progress,
    }


@router.get("/api/leaderboard")
async def get_leaderboard_route(
    limit: int = 20,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[LeaderboardEntry]:
    """Get the current leaderboard rankings."""
    return await get_leaderboard(db, limit=limit)


@router.get("/api/leaderboard/dynamic")
async def get_dynamic_leaderboard_route(
    sort_by: str = "composite",
    limit: int = 20,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DynamicLeaderboardEntry]:
    """Get the dynamic leaderboard with composite rankings.

    Query params:
        sort_by: 'mastery', 'repetition', or 'composite' (default).
        limit: Max entries to return (default 20).
    """
    await recalculate_rankings(db)
    rows = await get_dynamic_leaderboard(db, sort_by=sort_by, limit=limit)
    return [DynamicLeaderboardEntry.model_validate(r) for r in rows]


@router.get("/api/leaderboard/me")
async def get_my_rank(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserRank:
    """Get the authenticated user's rank info."""
    await recalculate_rankings(db)
    rank_info = await get_user_rank(db, _user.id)
    if rank_info is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No ranking data found for user",
        )
    return UserRank.model_validate(rank_info)


@router.get("/api/mtss/tiers")
async def get_mtss_tiers(
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    """Get MTSS tier classifications for all students using bulk queries."""
    # Two bulk queries instead of 2*N per-student queries
    real_students = await db.execute(
        select(User).where(User.role == "student")
    )
    student_rows = real_students.scalars().all()
    if not student_rows:
        return []

    all_scores = await get_all_student_scores(db)

    results: list[dict[str, object]] = []
    for student in student_rows:
        score_rows = all_scores.get(student.id, [])
        score_map = {row.skill_id: row.score for row in score_rows}
        skill_tiers = get_student_tiers(score_map)
        scores = list(score_map.values())
        avg = sum(scores) / len(scores) if scores else 0.0
        results.append({
            "user_id": student.id,
            "username": student.username,
            "overall_tier": classify_tier(avg).value,
            "avg_score": round(avg, 1),
            "skill_tiers": {k: v.value for k, v in skill_tiers.items()},
        })
    return results


@router.get("/api/dashboard/overview")
async def get_dashboard_overview(
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> ClassOverview:
    """Get dashboard overview data with tier distribution (DB with demo fallback)."""
    return await get_class_overview_from_db(db)


@router.get("/api/mtss/student/{user_id}/skills")
async def get_student_skills(
    user_id: int,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> StudentSkillBreakdown:
    """Return detailed skill breakdown for a student (DB with demo fallback)."""
    skill_rows = await get_student_skill_scores(db, user_id)
    if skill_rows:
        user_obj = await db.get(User, user_id)
        username = user_obj.username if user_obj else f"user_{user_id}"
        skills: dict[str, dict[str, object]] = {}
        for row in skill_rows:
            skills[row.skill_id] = {
                "score": row.score,
                "tier": classify_tier(row.score).value,
                "attempts": row.attempts,
            }
        return StudentSkillBreakdown(
            user_id=user_id, username=username, skills=skills
        )

    user_obj = await db.get(User, user_id)
    return StudentSkillBreakdown(user_id=user_id, username=user_obj.username if user_obj else "unknown", skills={})


@router.get("/api/mtss/objectives")
async def get_objective_distributions(
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> list[ObjectiveDistribution]:
    """Return class-wide tier distribution per learning objective."""
    db_dist = await get_class_objective_distribution(db)

    if db_dist:
        results: list[ObjectiveDistribution] = []
        for obj_id, counts in db_dist.items():
            # Look up human-readable name
            try:
                obj_enum = LearningObjective(obj_id)
                obj_name = OBJECTIVE_DESCRIPTIONS.get(obj_enum, obj_id)
            except ValueError:
                obj_name = obj_id
            results.append(
                ObjectiveDistribution(
                    objective_id=obj_id,
                    objective_name=obj_name,
                    tier_1_count=counts.get("tier_1", 0),
                    tier_2_count=counts.get("tier_2", 0),
                    tier_3_count=counts.get("tier_3", 0),
                    total_students=counts.get("total", 0),
                )
            )
        return results

    return []


def _generate_interventions(
    skill_scores: dict[str, float],
) -> list[InterventionRecommendation]:
    """Generate intervention recommendations based on skill scores and tiers."""
    recommendations: list[InterventionRecommendation] = []
    for skill, score in skill_scores.items():
        tier = classify_tier(score)
        if tier == MTSSTier.TIER_3:
            rec = InterventionRecommendation(
                skill=skill,
                current_tier=tier.value,
                score=score,
                recommendation="Intensive support needed",
                suggested_activities=[
                    f"Guided walkthrough on {skill} fundamentals",
                    f"One-on-one tutoring session for {skill}",
                    f"Scaffolded practice problems for {skill}",
                ],
            )
        elif tier == MTSSTier.TIER_2:
            rec = InterventionRecommendation(
                skill=skill,
                current_tier=tier.value,
                score=score,
                recommendation="Targeted practice recommended",
                suggested_activities=[
                    f"Focused exercises on {skill}",
                    f"Peer study group for {skill}",
                    f"Review {skill} worked examples",
                ],
            )
        else:
            rec = InterventionRecommendation(
                skill=skill,
                current_tier=tier.value,
                score=score,
                recommendation="On track",
                suggested_activities=[
                    f"Advanced {skill} challenge scenarios",
                    f"Mentor others in {skill}",
                ],
            )
        recommendations.append(rec)
    return recommendations


@router.get("/api/mtss/interventions/{user_id}")
async def get_interventions(
    user_id: int,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> list[InterventionRecommendation]:
    """Return tier-specific intervention recommendations for a student."""
    skill_rows = await get_student_skill_scores(db, user_id)
    if skill_rows:
        score_map = {row.skill_id: row.score for row in skill_rows}
        return _generate_interventions(score_map)

    return []


def _to_chunk_response(chunk: Any) -> LessonChunkDetail:
    chunk_data = dict(vars(chunk))
    chunk_data["quiz_items"] = [
        {
            "item_id": item.item_id,
            "item_type": item.item_type,
            "prompt": item.prompt,
            "options": item.options,
            "correct_option_id": getattr(item, "correct_option_id", None),
            "explanation": item.explanation,
            "why_it_matters": item.why_it_matters,
        }
        for item in chunk.quiz_items
    ]
    return LessonChunkDetail.model_validate(chunk_data)


@router.get("/api/lessons/modules")
async def get_lesson_modules(
    _user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> list[LessonModuleSummary]:
    """List all lesson modules in learning order (from DB; fallback to in-memory if DB empty)."""
    modules = await fetch_modules(db)
    if not modules:
        modules = list_modules()
    results: list[LessonModuleSummary] = []
    for module in modules:
        locked = False
        locked_reason: str | None = None
        if module.prerequisite_ids:
            met, reason = await check_prerequisites_met(
                _user.id, module.module_id, db
            )
            if not met:
                locked = True
                locked_reason = reason
        results.append(
            LessonModuleSummary(
                module_id=module.module_id,
                title=module.title,
                track=module.track,
                order=module.order,
                objective=module.objective,
                estimated_minutes=module.estimated_minutes,
                prerequisite_ids=module.prerequisite_ids,
                chunk_ids=module.chunk_ids,
                chunk_count=len(module.chunk_ids),
                locked=locked,
                locked_reason=locked_reason,
            )
        )
    return results


@router.get("/api/lessons/modules/{module_id}")
async def get_lesson_module_detail(
    module_id: str,
    _user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> LessonModuleDetail:
    """Get one lesson module with all chunks (from DB; fallback to in-memory if not in DB)."""
    module = await fetch_module_detail(db, module_id)
    if module is None:
        module = get_module(module_id)
    if module is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson module not found",
        )
    chunks = await fetch_chunks_for_module(db, module_id)
    if not chunks:
        chunks = list_module_chunks(module_id)
    return LessonModuleDetail(
        module_id=module.module_id,
        title=module.title,
        track=module.track,
        order=module.order,
        objective=module.objective,
        estimated_minutes=module.estimated_minutes,
        prerequisite_ids=module.prerequisite_ids,
        chunk_ids=module.chunk_ids,
        chunk_count=len(module.chunk_ids),
        chunks=[_to_chunk_response(chunk) for chunk in chunks],
    )


@router.get("/api/lessons/chunks/{chunk_id}")
async def get_lesson_chunk(
    chunk_id: str,
    _user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> LessonChunkDetail:
    """Get one lesson chunk (from DB; fallback to in-memory if not in DB)."""
    chunk = await fetch_chunk_def(db, chunk_id)
    if chunk is None:
        chunk = get_chunk(chunk_id)
    if chunk is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson chunk not found",
        )
    response = _to_chunk_response(chunk)
    rag_ctx = await get_context(db, query=chunk.learning_goal, top_k=3, for_display=True)
    response.supplementary_context = rag_ctx
    return response


@router.post("/api/lessons/chunks/{chunk_id}/attempt")
async def attempt_lesson_chunk(
    chunk_id: str,
    req: QuizAttemptRequest,
    _user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> QuizAttemptResponse:
    """Submit quiz attempt (chunk from DB; fallback to in-memory if not in DB)."""
    chunk = await fetch_chunk_def(db, chunk_id)
    if chunk is None:
        chunk = get_chunk(chunk_id)
    if chunk is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson chunk not found",
        )
    met, reason = await check_prerequisites_met(_user.id, chunk.module_id, db)
    if not met:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=reason or "Prerequisites not met",
        )

    answers_by_item = {
        answer.item_id: (answer.selected_option_id or answer.response_text or "")
        for answer in req.answers
    }
    result = await attempt_chunk(_user.id, chunk_id, answers_by_item, db, chunk)
    xp_earned = int(result.get("xp_earned", 0))  # type: ignore[arg-type]

    # Log XP event (User row already updated inside service)
    try:
        if isinstance(_user, User) and xp_earned > 0:
            db.add(XPLog(user_id=_user.id, amount=xp_earned, source="lesson_attempt"))
            await db.commit()
    except Exception:
        pass

    return QuizAttemptResponse.model_validate(result)


@router.post("/api/lessons/chunks/{chunk_id}/complete")
async def complete_lesson_chunk(
    chunk_id: str,
    _user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> ChunkCompleteResponse:
    """Mark chunk complete and award chunk XP (chunk from DB or in-memory)."""
    chunk = await fetch_chunk_def(db, chunk_id)
    if chunk is None:
        chunk = get_chunk(chunk_id)
    if chunk is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson chunk not found",
        )
    met, reason = await check_prerequisites_met(_user.id, chunk.module_id, db)
    if not met:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=reason or "Prerequisites not met",
        )

    result = await complete_chunk(_user.id, chunk_id, db)
    xp_earned = int(result.get("xp_earned", 0))  # type: ignore[arg-type]

    # Log XP event (User row already updated inside service)
    try:
        if isinstance(_user, User) and xp_earned > 0:
            db.add(XPLog(user_id=_user.id, amount=xp_earned, source="lesson_complete"))
            await db.commit()
    except Exception:
        pass

    return ChunkCompleteResponse.model_validate(result)


@router.get("/api/lessons/progress/me")
async def get_my_lesson_progress(
    _user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> LessonProgressSummary:
    """Get aggregate lesson progress (modules from DB; fallback to in-memory if DB empty)."""
    modules = await fetch_modules(db)
    if not modules:
        modules = list_modules()
    return LessonProgressSummary.model_validate(
        await get_progress_summary(_user.id, db, modules)
    )


@router.get("/api/lessons/streak/me")
async def get_my_lesson_streak(
    _user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> StreakInfo:
    """Get current lesson streak for the current user."""
    return StreakInfo.model_validate(await get_streak(_user.id, db))


# ---------------------------------------------------------------------------
# Badge catalog
# ---------------------------------------------------------------------------

# Full badge catalog definition
_BADGE_CATALOG: list[dict[str, str]] = [
    # Level badges
    {"key": "level_2", "name": "Rookie Trader", "description": "Reached Level 2", "category": "level"},
    {"key": "level_3", "name": "Market Watcher", "description": "Reached Level 3", "category": "level"},
    {"key": "level_4", "name": "Chart Reader", "description": "Reached Level 4", "category": "level"},
    {"key": "level_5", "name": "Risk Manager", "description": "Reached Level 5", "category": "level"},
    {"key": "level_6", "name": "Options Strategist", "description": "Reached Level 6", "category": "level"},
    {"key": "level_7", "name": "Senior Analyst", "description": "Reached Level 7", "category": "level"},
    {"key": "level_8", "name": "Portfolio Manager", "description": "Reached Level 8", "category": "level"},
    {"key": "level_9", "name": "Managing Director", "description": "Reached Level 9", "category": "level"},
    {"key": "level_10", "name": "Trading Legend", "description": "Reached Level 10", "category": "level"},
    # Streak badges
    {"key": "streak_3", "name": "3-Day Streak", "description": "Trained 3 days in a row", "category": "streak"},
    {"key": "streak_7", "name": "7-Day Streak", "description": "Trained 7 days in a row", "category": "streak"},
    {"key": "streak_30", "name": "30-Day Streak", "description": "Trained 30 days in a row", "category": "streak"},
    # Milestone badges
    {"key": "foundation_finisher", "name": "Foundation Finisher", "description": "Completed all foundation modules", "category": "milestone"},
    {"key": "capstone_complete", "name": "Capstone Complete", "description": "Completed the capstone challenge", "category": "milestone"},
    {"key": "first_scenario", "name": "First Trade", "description": "Completed your first scenario", "category": "milestone"},
    {"key": "first_challenge_win", "name": "Champion", "description": "Won your first head-to-head challenge", "category": "milestone"},
    {"key": "first_review", "name": "Peer Mentor", "description": "Submitted your first peer review", "category": "milestone"},
]

# Map badge name -> key for lookup
_BADGE_NAME_TO_KEY: dict[str, str] = {b["name"]: b["key"] for b in _BADGE_CATALOG}

# Mastery skill names (8 skills)
_MASTERY_SKILLS = [
    "Options Pricing",
    "Greeks",
    "Volatility",
    "Risk Management",
    "Hedging Strategies",
    "Spread Strategies",
    "Market Analysis",
    "Portfolio Construction",
]

# Add mastery badges to catalog
for _skill in _MASTERY_SKILLS:
    _badge_key = _skill.lower().replace(" ", "_") + "_master"
    _BADGE_CATALOG.append({
        "key": _badge_key,
        "name": f"{_skill} Master",
        "description": f"Mastered {_skill} (score >= 80%)",
        "category": "mastery",
    })
    _BADGE_NAME_TO_KEY[f"{_skill} Master"] = _badge_key


@router.get("/api/badges/me")
async def get_my_badges(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BadgeCatalogResponse:
    """Return the full badge catalog with earned/locked state for the current user."""
    user_id = _user.id

    # Gather earned badge names using calculate_new_badges
    modules = await fetch_modules(db)
    if not modules:
        modules = list_modules()
    ordered_module_ids = [m.module_id for m in modules]
    module_chunk_ids = {m.module_id: m.chunk_ids for m in modules}
    module_tracks = {m.module_id: m.track for m in modules}
    module_titles = {m.module_id: m.title for m in modules}

    earned_names: list[str] = await calculate_new_badges(
        user_id, db, ordered_module_ids, module_chunk_ids, module_tracks, module_titles
    )

    # Check milestone badges not covered by calculate_new_badges
    # first_scenario: user has any Response records
    resp_result = await db.execute(
        select(Response.id).where(Response.user_id == user_id).limit(1)
    )
    if resp_result.scalar_one_or_none() is not None:
        earned_names.append("First Trade")

    # first_challenge_win: user has won any Challenge
    win_result = await db.execute(
        select(Challenge.id).where(Challenge.winner_id == user_id).limit(1)
    )
    if win_result.scalar_one_or_none() is not None:
        earned_names.append("Champion")

    # first_review: user has any PeerReviewAssignment where reviewer_id = user_id
    # and associated review exists (status = submitted)
    review_result = await db.execute(
        select(PeerReviewAssignment.id).where(
            PeerReviewAssignment.reviewer_id == user_id,
            PeerReviewAssignment.status == "submitted",
        ).limit(1)
    )
    if review_result.scalar_one_or_none() is not None:
        earned_names.append("Peer Mentor")

    # Build earned keys set
    earned_keys: set[str] = set()
    for name in earned_names:
        key = _BADGE_NAME_TO_KEY.get(name)
        if key:
            earned_keys.add(key)
        else:
            # Mastery badges from module titles (e.g. "Module Title Mastery")
            mastery_key = name.lower().replace(" ", "_")
            earned_keys.add(mastery_key)

    badges = [
        BadgeInfo(
            key=b["key"],
            name=b["name"],
            description=b["description"],
            category=b["category"],  # type: ignore[arg-type]
            earned=b["key"] in earned_keys,
        )
        for b in _BADGE_CATALOG
    ]
    total_earned = sum(1 for b in badges if b.earned)
    return BadgeCatalogResponse(
        badges=badges,
        total_earned=total_earned,
        total_available=len(badges),
    )


@router.get("/api/lessons/catalog/status")
async def get_lessons_catalog_status(
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Educator-facing DB status of lesson catalog for verification."""
    module_count = (
        await db.execute(select(func.count()).select_from(LessonModule))
    ).scalar_one()
    chunk_count = (
        await db.execute(select(func.count()).select_from(LessonChunk))
    ).scalar_one()
    quiz_count = (
        await db.execute(select(func.count()).select_from(LessonQuizItem))
    ).scalar_one()
    first_chunk = (
        await db.execute(
            select(LessonChunk).where(LessonChunk.chunk_id == "f1-ch1")
        )
    ).scalar_one_or_none()

    return {
        "module_count": int(module_count or 0),
        "chunk_count": int(chunk_count or 0),
        "quiz_item_count": int(quiz_count or 0),
        "seeded_first_chunk_title": first_chunk.title if first_chunk else None,
        "seeded_first_chunk_goal": first_chunk.learning_goal if first_chunk else None,
    }


@router.get("/api/lessons/catalog/chunks/{chunk_id}")
async def get_lessons_catalog_chunk(
    chunk_id: str,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Educator-facing DB preview of one seeded lesson chunk."""
    chunk = (
        await db.execute(
            select(LessonChunk).where(LessonChunk.chunk_id == chunk_id)
        )
    ).scalar_one_or_none()
    if chunk is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson chunk not found in DB",
        )

    quiz_items = (
        await db.execute(
            select(LessonQuizItem)
            .where(LessonQuizItem.chunk_id == chunk_id)
            .order_by(LessonQuizItem.order_index)
        )
    ).scalars().all()

    return {
        "chunk_id": chunk.chunk_id,
        "title": chunk.title,
        "learning_goal": chunk.learning_goal,
        "explain_text": chunk.explain_text,
        "example_text": chunk.example_text,
        "key_takeaway": chunk.key_takeaway,
        "common_mistakes": chunk.common_mistakes,
        "quick_check_prompts": chunk.quick_check_prompts,
        "quiz_items": [
            {
                "item_id": item.item_id,
                "item_type": item.item_type,
                "prompt": item.prompt,
                "options": item.options,
                "correct_option_id": item.correct_option_id,
                "explanation": item.explanation,
                "why_it_matters": item.why_it_matters,
            }
            for item in quiz_items
        ],
    }


# ---------------------------------------------------------------------------
# Educator Student Roster & Feedback endpoints
# ---------------------------------------------------------------------------


@router.get("/api/educator/students")
async def get_educator_students(
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> list[StudentRosterEntry]:
    """List all students with aggregated stats for the educator roster."""
    # Get all students
    result = await db.execute(
        select(User).where(User.role == "student")
    )
    students = result.scalars().all()

    roster: list[StudentRosterEntry] = []
    for student in students:
        # Get response count
        resp_count_result = await db.execute(
            select(func.count()).select_from(Response).where(
                Response.user_id == student.id
            )
        )
        response_count = int(resp_count_result.scalar_one() or 0)

        # Get skill scores for tier calculation
        skill_result = await db.execute(
            select(SkillScore).where(SkillScore.user_id == student.id)
        )
        skill_rows = skill_result.scalars().all()
        scores = [row.score for row in skill_rows]
        avg_score = sum(scores) / len(scores) if scores else 0.0
        overall_tier = classify_tier(avg_score).value

        roster.append(
            StudentRosterEntry(
                id=student.id,
                username=student.username,
                name=student.name,
                xp_total=student.xp_total or 0,
                level=student.level or 1,
                overall_tier=overall_tier,
                avg_skill_score=round(avg_score, 1),
                response_count=response_count,
            )
        )
    return roster


@router.get("/api/educator/students/{user_id}/responses")
async def get_student_responses(
    user_id: int,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> list[StudentResponseEntry]:
    """Get a student's recent responses with grades and educator feedback."""
    result = await db.execute(
        select(Response)
        .where(Response.user_id == user_id)
        .order_by(Response.created_at.desc())
        .limit(20)
    )
    responses = result.scalars().all()

    entries: list[StudentResponseEntry] = []
    for resp in responses:
        # Get scenario
        scenario = await db.get(Scenario, resp.scenario_id)
        situation = (scenario.situation[:200] + "...") if scenario and len(scenario.situation) > 200 else (scenario.situation if scenario else "")

        # Get grade
        grade_result = await db.execute(
            select(Grade).where(Grade.response_id == resp.id)
        )
        grade = grade_result.scalar_one_or_none()

        # Get educator feedback
        fb_result = await db.execute(
            select(EducatorFeedback).where(
                EducatorFeedback.response_id == resp.id
            ).order_by(EducatorFeedback.created_at.desc()).limit(1)
        )
        feedback = fb_result.scalar_one_or_none()

        entries.append(
            StudentResponseEntry(
                response_id=resp.id,
                scenario_situation=situation,
                answer_text=resp.answer_text,
                overall_score=grade.overall_score if grade else None,
                technical_accuracy=grade.technical_accuracy if grade else None,
                risk_awareness=grade.risk_awareness if grade else None,
                strategy_fit=grade.strategy_fit if grade else None,
                reasoning_clarity=grade.reasoning_clarity if grade else None,
                grade_feedback=grade.feedback_text if grade else None,
                educator_feedback=feedback.feedback_text if feedback else None,
                educator_feedback_id=feedback.id if feedback else None,
                created_at=resp.created_at.isoformat(),
            )
        )
    return entries


@router.post("/api/educator/feedback")
async def submit_educator_feedback(
    req: EducatorFeedbackRequest,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> EducatorFeedbackOut:
    """Submit educator feedback on a student response."""
    # Verify response exists
    response = await db.get(Response, req.response_id)
    if response is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Response not found",
        )

    feedback = EducatorFeedback(
        educator_id=_user.id,
        response_id=req.response_id,
        feedback_text=req.feedback_text,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    return EducatorFeedbackOut(
        id=feedback.id,
        educator_id=feedback.educator_id,
        response_id=feedback.response_id,
        feedback_text=feedback.feedback_text,
        created_at=feedback.created_at.isoformat(),
    )


@router.get("/api/educator/students/{user_id}/feedback")
async def get_student_feedback(
    user_id: int,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> list[EducatorFeedbackOut]:
    """Get all educator feedback for a student's responses."""
    # Get all response IDs for this student
    resp_result = await db.execute(
        select(Response.id).where(Response.user_id == user_id)
    )
    response_ids = [row[0] for row in resp_result.all()]

    if not response_ids:
        return []

    fb_result = await db.execute(
        select(EducatorFeedback)
        .where(EducatorFeedback.response_id.in_(response_ids))
        .order_by(EducatorFeedback.created_at.desc())
    )
    feedbacks = fb_result.scalars().all()

    return [
        EducatorFeedbackOut(
            id=fb.id,
            educator_id=fb.educator_id,
            response_id=fb.response_id,
            feedback_text=fb.feedback_text,
            created_at=fb.created_at.isoformat(),
        )
        for fb in feedbacks
    ]


@router.get("/api/educator/export/csv")
async def export_educator_csv(
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Export student performance data as CSV for MTSS documentation."""
    # Query all students with their skill scores
    result = await db.execute(
        select(User).where(User.role == "student")
    )
    students = result.scalars().all()

    # Build skill score lookup: {user_id: {skill_id: score}}
    skill_result = await db.execute(select(SkillScore))
    all_skills = skill_result.scalars().all()
    skill_map: dict[int, dict[str, float]] = {}
    for ss in all_skills:
        skill_map.setdefault(ss.user_id, {})[ss.skill_id] = round(ss.score, 1)

    # Count responses per user
    response_counts_result = await db.execute(
        select(Response.user_id, func.count(Response.id))
        .group_by(Response.user_id)
    )
    response_counts: dict[int, int] = {
        row[0]: row[1] for row in response_counts_result.all()
    }

    csv_columns = [
        "name", "username", "level", "xp_total", "overall_tier",
        "avg_score", "price_action", "options_chain", "strike_select",
        "risk_mgmt", "position_size", "regime_id", "vol_assess",
        "trade_mgmt", "response_count",
    ]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(csv_columns)

    for student in students:
        skills = skill_map.get(student.id, {})
        scores = list(skills.values())
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        overall_tier = classify_tier(avg_score).value

        writer.writerow([
            student.name or student.username,
            student.username,
            student.level,
            student.xp_total,
            overall_tier,
            avg_score,
            skills.get("price_action", 0.0),
            skills.get("options_chain", 0.0),
            skills.get("strike_select", 0.0),
            skills.get("risk_mgmt", 0.0),
            skills.get("position_size", 0.0),
            skills.get("regime_id", 0.0),
            skills.get("vol_assess", 0.0),
            skills.get("trade_mgmt", 0.0),
            response_counts.get(student.id, 0),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=student_export.csv"},
    )


# ---------------------------------------------------------------------------
# RAG endpoints
# ---------------------------------------------------------------------------


@router.post("/api/rag/ingest")
async def rag_ingest(
    req: DocumentIngestRequest,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> DocumentIngestResponse:
    """Ingest a document into the RAG pipeline (educator-only)."""
    chunks = await ingest_document(db, source_file=req.source_file, content=req.content)
    await db.commit()
    doc_id = _generate_doc_id(req.source_file)
    return DocumentIngestResponse(doc_id=doc_id, chunks_created=len(chunks))


@router.get("/api/rag/documents")
async def rag_list_documents(
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> list[RAGDocumentSummary]:
    """List all ingested RAG documents grouped by source_file (educator-only)."""
    result = await db.execute(
        select(
            DocumentChunk.source_file,
            func.count().label("chunk_count"),
            func.min(DocumentChunk.created_at).label("created_at"),
        )
        .group_by(DocumentChunk.source_file)
        .order_by(func.min(DocumentChunk.created_at).desc())
    )
    rows = result.all()
    return [
        RAGDocumentSummary(
            source_file=row.source_file,
            chunk_count=row.chunk_count,
            created_at=row.created_at.isoformat() if row.created_at else "",
        )
        for row in rows
    ]


@router.delete("/api/rag/documents/{source_file:path}")
async def rag_delete_document(
    source_file: str,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Delete all chunks for a given source_file (educator-only)."""
    from sqlalchemy import delete as sa_delete

    result = await db.execute(
        sa_delete(DocumentChunk).where(DocumentChunk.source_file == source_file)
    )
    await db.commit()
    invalidate_chunk_cache()
    deleted = result.rowcount  # type: ignore[union-attr]
    return {"status": "ok", "message": f"Deleted {deleted} chunks for '{source_file}'"}


@router.post("/api/rag/reseed")
async def rag_reseed(
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Force re-ingest all RAG documents with the latest chunking algorithm."""
    await seed_rag_documents(db, force=True)
    invalidate_chunk_cache()
    return {"status": "ok", "message": "RAG documents re-seeded with new chunking"}


@router.get("/api/rag/search")
async def rag_search_endpoint(
    q: str,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RAGSearchResponse:
    """Search document chunks by semantic similarity."""
    results = await rag_search(db, query=q, top_k=5)
    return RAGSearchResponse(
        query=q,
        results=[
            RAGSearchResult(
                chunk_id=int(r["chunk_id"]),  # type: ignore[arg-type]
                source_file=str(r["source_file"]),
                content=str(r["content"]),
                score=float(r["score"]),  # type: ignore[arg-type]
            )
            for r in results
        ],
    )

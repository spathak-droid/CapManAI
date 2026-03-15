"""API route definitions for CapMan AI."""

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from src.api.schemas import (
    BadgeCatalogResponse,
    BadgeInfo,
    ChunkCompleteResponse,
    DynamicLeaderboardEntry,
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
    StudentSkillBreakdown,
    UserRank,
)
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.dependencies import get_current_user, require_role
from src.db.database import get_db
from src.db.models import (
    Challenge,
    LessonChunk,
    LessonModule,
    LessonQuizItem,
    PeerReviewAssignment,
    Response,
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
from src.gamification.xp import calculate_level, xp_to_next_level
from src.grading.agent import GradingAgent, ProbingAgent
from src.mtss.classifier import (
    DEMO_STUDENTS,
    ClassOverview,
    MTSSTier,
    classify_tier,
    get_class_overview,
    get_demo_students,
    get_student_tiers,
)
from src.mtss.objectives import OBJECTIVE_DESCRIPTIONS, LearningObjective
from src.mtss.repository import (
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
    RAGSearchResponse,
    RAGSearchResult,
)
from src.rag.ingest import _generate_doc_id, ingest_document
from src.rag.retriever import get_context, invalidate_chunk_cache, search as rag_search
from src.rag.seed import seed_rag_documents
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
) -> ScenarioResult:
    """Generate a new trading scenario using LLM."""
    rag_ctx = await get_context(db, query=params.skill_target, top_k=3)
    return await _scenario_generator.generate(params, rag_context=rag_ctx)


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


@router.post("/api/scenarios/respond")
async def respond_to_scenario(
    req: RespondRequest,
    _user: User = Depends(get_current_user),
) -> RespondResponse:
    """Submit a response to a trading scenario."""
    mock_response_id = (req.scenario_id * 1000) + req.user_id
    return RespondResponse(
        response_id=mock_response_id, status="received"
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
    xp_earned = int(result.overall_score * 10)

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
) -> list[dict[str, object]]:
    """Get MTSS tier classifications for all demo students."""
    results: list[dict[str, object]] = []
    for student in DEMO_STUDENTS:
        skill_tiers = get_student_tiers(student.skill_scores)
        scores = list(student.skill_scores.values())
        avg_score = (
            sum(scores) / len(scores) if scores else 0.0
        )
        overall_tier = classify_tier(avg_score)
        results.append(
            {
                "user_id": student.user_id,
                "username": student.username,
                "overall_tier": overall_tier.value,
                "avg_score": round(avg_score, 1),
                "skill_tiers": {
                    k: v.value
                    for k, v in skill_tiers.items()
                },
            }
        )
    return results


@router.get("/api/dashboard/overview")
async def get_dashboard_overview(
    _user: User = Depends(require_role("educator")),
) -> ClassOverview:
    """Get dashboard overview data with tier distribution."""
    return get_class_overview(DEMO_STUDENTS)


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

    # Fallback to demo data
    for student in get_demo_students():
        if student.user_id == user_id:
            skills = {}
            for skill_id, score in student.skill_scores.items():
                skills[skill_id] = {
                    "score": score,
                    "tier": classify_tier(score).value,
                    "attempts": 0,
                }
            return StudentSkillBreakdown(
                user_id=student.user_id,
                username=student.username,
                skills=skills,
            )

    return StudentSkillBreakdown(user_id=user_id, username="unknown", skills={})


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

    # Fallback: compute from demo students
    demo = get_demo_students()
    skill_dist: dict[str, dict[str, int]] = {}
    for student in demo:
        for skill_id, score in student.skill_scores.items():
            if skill_id not in skill_dist:
                skill_dist[skill_id] = {
                    "tier_1": 0,
                    "tier_2": 0,
                    "tier_3": 0,
                    "total": 0,
                }
            tier = classify_tier(score)
            skill_dist[skill_id][tier.value] += 1
            skill_dist[skill_id]["total"] += 1

    results = []
    for skill_id, counts in skill_dist.items():
        try:
            obj_enum = LearningObjective(skill_id)
            obj_name = OBJECTIVE_DESCRIPTIONS.get(obj_enum, skill_id)
        except ValueError:
            obj_name = skill_id
        results.append(
            ObjectiveDistribution(
                objective_id=skill_id,
                objective_name=obj_name,
                tier_1_count=counts["tier_1"],
                tier_2_count=counts["tier_2"],
                tier_3_count=counts["tier_3"],
                total_students=counts["total"],
            )
        )
    return results


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

    # Fallback to demo
    for student in get_demo_students():
        if student.user_id == user_id:
            return _generate_interventions(student.skill_scores)

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
    return [
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
        )
        for module in modules
    ]


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

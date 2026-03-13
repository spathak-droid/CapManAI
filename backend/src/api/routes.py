"""API route definitions for CapMan AI."""

from fastapi import APIRouter, Depends

from src.api.schemas import (
    GradeRequest,
    GradeResponse,
    ProbeRequest,
    ProbeResponse,
    RespondRequest,
    RespondResponse,
)
from src.auth.dependencies import get_current_user, require_role
from src.db.models import User
from src.gamification.leaderboard import LeaderboardEntry, get_leaderboard
from src.gamification.xp import calculate_level, xp_to_next_level
from src.grading.agent import GradingAgent, ProbingAgent
from src.mtss.classifier import (
    DEMO_STUDENTS,
    ClassOverview,
    classify_tier,
    get_class_overview,
    get_student_tiers,
)
from src.scenario_gen.generator import ScenarioGenerator, ScenarioParams, ScenarioResult

router = APIRouter()

NOT_IMPLEMENTED = {"status": "not implemented"}

_probing_agent = ProbingAgent()
_grading_agent = GradingAgent()

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
    user: User = Depends(get_current_user),
) -> ScenarioResult:
    """Generate a new trading scenario using LLM."""
    generator = ScenarioGenerator()
    return await generator.generate(params)


@router.post("/api/scenarios/respond")
async def respond_to_scenario(
    req: RespondRequest,
    user: User = Depends(get_current_user),
) -> RespondResponse:
    """Submit a response to a trading scenario."""
    # Mock response_id until DB integration is wired up
    mock_response_id = (req.scenario_id * 1000) + req.user_id
    return RespondResponse(response_id=mock_response_id, status="received")


@router.post("/api/scenarios/probe")
async def probe_response(
    req: ProbeRequest,
    user: User = Depends(get_current_user),
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
    user: User = Depends(get_current_user),
) -> GradeResponse:
    """Grade a scenario response with probing answers."""
    result = await _grading_agent.grade(
        scenario_text=req.scenario_text,
        student_response=req.student_response,
        probe_exchanges=req.probe_exchanges,
    )
    # XP earned: scale overall score (1-5) to 10-50 XP range
    xp_earned = int(result.overall_score * 10)
    return GradeResponse(
        technical_accuracy=result.technical_accuracy,
        risk_awareness=result.risk_awareness,
        strategy_fit=result.strategy_fit,
        reasoning_clarity=result.reasoning_clarity,
        overall_score=result.overall_score,
        feedback_text=result.feedback_text,
        xp_earned=xp_earned,
    )


@router.get("/api/gamification/xp/{user_id}")
async def get_user_xp(
    user_id: int,
    user: User = Depends(get_current_user),
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
    user: User = Depends(get_current_user),
) -> list[LeaderboardEntry]:
    """Get the current leaderboard rankings."""
    return get_leaderboard(limit=limit)


@router.get("/api/mtss/tiers")
async def get_mtss_tiers(
    user: User = Depends(require_role("educator")),
) -> list[dict[str, object]]:
    """Get MTSS tier classifications for all demo students."""
    results: list[dict[str, object]] = []
    for student in DEMO_STUDENTS:
        skill_tiers = get_student_tiers(student.skill_scores)
        scores = list(student.skill_scores.values())
        avg_score = sum(scores) / len(scores) if scores else 0.0
        overall_tier = classify_tier(avg_score)
        results.append(
            {
                "user_id": student.user_id,
                "username": student.username,
                "overall_tier": overall_tier.value,
                "avg_score": round(avg_score, 1),
                "skill_tiers": {k: v.value for k, v in skill_tiers.items()},
            }
        )
    return results


@router.get("/api/dashboard/overview")
async def get_dashboard_overview(
    user: User = Depends(require_role("educator")),
) -> ClassOverview:
    """Get dashboard overview data with tier distribution."""
    return get_class_overview(DEMO_STUDENTS)

"""Gamification routes: skills, XP, leaderboard, MTSS, badges."""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import (
    BadgeCatalogResponse,
    BadgeInfo,
    DynamicLeaderboardEntry,
    InterventionRecommendation,
    ObjectiveDistribution,
    StudentSkillBreakdown,
    UserRank,
)
from src.auth.dependencies import get_current_user, require_role
from src.db.database import get_db
from src.db.models import (
    Challenge,
    PeerReviewAssignment,
    Response,
    SkillScore,
    User,
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
from src.lessons.repository import fetch_modules
from src.lessons.service import (
    calculate_new_badges,
    list_modules,
)
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

logger = logging.getLogger(__name__)

router = APIRouter()

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
            "name": student.name,
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
            user_id=user_id, username=username, name=user_obj.name if user_obj else None, skills=skills
        )

    user_obj = await db.get(User, user_id)
    return StudentSkillBreakdown(user_id=user_id, username=user_obj.username if user_obj else "unknown", name=user_obj.name if user_obj else None, skills={})


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

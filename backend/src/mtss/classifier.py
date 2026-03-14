"""MTSS tier classification.

Multi-Tiered System of Supports (MTSS) classifier that assigns
students to intervention tiers based on skill scores and performance.
"""

from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING

from pydantic import BaseModel

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class MTSSTier(str, Enum):
    """MTSS support tiers."""

    TIER_1 = "tier_1"  # >=70% - on track
    TIER_2 = "tier_2"  # 40-69% - needs support
    TIER_3 = "tier_3"  # <40% - intensive intervention


class StudentProfile(BaseModel):
    """A student with skill scores for MTSS classification."""

    user_id: int
    username: str
    skill_scores: dict[str, float]


class ClassOverview(BaseModel):
    """Overview of a class with tier distribution and breakdowns."""

    tier_counts: dict[str, int]
    students_by_tier: dict[str, list[str]]
    skill_breakdown: dict[str, dict[str, int]]


def classify_tier(score: float) -> MTSSTier:
    """Classify a single score into an MTSS tier.

    Args:
        score: Score as a percentage (0-100).

    Returns:
        The appropriate MTSS tier.
    """
    if score >= 70:
        return MTSSTier.TIER_1
    if score >= 40:
        return MTSSTier.TIER_2
    return MTSSTier.TIER_3


def get_student_tiers(skill_scores: dict[str, float]) -> dict[str, MTSSTier]:
    """Classify each skill score into a tier.

    Args:
        skill_scores: Dict mapping skill_id to score (0-100).

    Returns:
        Dict mapping skill_id to MTSSTier.
    """
    return {skill: classify_tier(score) for skill, score in skill_scores.items()}


def get_class_overview(students: list[StudentProfile]) -> ClassOverview:
    """Generate a class-level overview of MTSS tier distribution.

    Args:
        students: List of student profiles with skill scores.

    Returns:
        ClassOverview with tier counts, students by tier, and skill breakdown.
    """
    tier_counts: dict[str, int] = {
        MTSSTier.TIER_1.value: 0,
        MTSSTier.TIER_2.value: 0,
        MTSSTier.TIER_3.value: 0,
    }
    students_by_tier: dict[str, list[str]] = {
        MTSSTier.TIER_1.value: [],
        MTSSTier.TIER_2.value: [],
        MTSSTier.TIER_3.value: [],
    }
    skill_breakdown: dict[str, dict[str, int]] = {}

    for student in students:
        # Overall tier based on average score
        scores = list(student.skill_scores.values())
        avg_score = sum(scores) / len(scores) if scores else 0.0
        overall_tier = classify_tier(avg_score)
        tier_counts[overall_tier.value] += 1
        students_by_tier[overall_tier.value].append(student.username)

        # Per-skill breakdown
        for skill_id, score in student.skill_scores.items():
            if skill_id not in skill_breakdown:
                skill_breakdown[skill_id] = {
                    MTSSTier.TIER_1.value: 0,
                    MTSSTier.TIER_2.value: 0,
                    MTSSTier.TIER_3.value: 0,
                }
            tier = classify_tier(score)
            skill_breakdown[skill_id][tier.value] += 1

    return ClassOverview(
        tier_counts=tier_counts,
        students_by_tier=students_by_tier,
        skill_breakdown=skill_breakdown,
    )


def get_demo_students() -> list[StudentProfile]:
    """Return demo student data as a fallback when DB is empty."""
    return [
        StudentProfile(
            user_id=1,
            username="TraderJoe",
            skill_scores={
                "price_action": 85,
                "options_chain": 78,
                "strike_select": 72,
                "risk_mgmt": 90,
                "position_size": 80,
                "regime_id": 75,
                "vol_assess": 82,
                "trade_mgmt": 88,
            },
        ),
        StudentProfile(
            user_id=2,
            username="OptionQueen",
            skill_scores={
                "price_action": 92,
                "options_chain": 95,
                "strike_select": 88,
                "risk_mgmt": 85,
                "position_size": 90,
                "regime_id": 80,
                "vol_assess": 91,
                "trade_mgmt": 87,
            },
        ),
        StudentProfile(
            user_id=3,
            username="BullRunner",
            skill_scores={
                "price_action": 65,
                "options_chain": 55,
                "strike_select": 50,
                "risk_mgmt": 60,
                "position_size": 45,
                "regime_id": 58,
                "vol_assess": 52,
                "trade_mgmt": 48,
            },
        ),
        StudentProfile(
            user_id=4,
            username="BearHunter",
            skill_scores={
                "price_action": 70,
                "options_chain": 68,
                "strike_select": 72,
                "risk_mgmt": 75,
                "position_size": 65,
                "regime_id": 71,
                "vol_assess": 60,
                "trade_mgmt": 74,
            },
        ),
        StudentProfile(
            user_id=5,
            username="VolSmile",
            skill_scores={
                "price_action": 88,
                "options_chain": 92,
                "strike_select": 85,
                "risk_mgmt": 95,
                "position_size": 90,
                "regime_id": 88,
                "vol_assess": 96,
                "trade_mgmt": 91,
            },
        ),
        StudentProfile(
            user_id=6,
            username="GammaKing",
            skill_scores={
                "price_action": 42,
                "options_chain": 38,
                "strike_select": 35,
                "risk_mgmt": 45,
                "position_size": 40,
                "regime_id": 32,
                "vol_assess": 28,
                "trade_mgmt": 44,
            },
        ),
        StudentProfile(
            user_id=7,
            username="ThetaGang",
            skill_scores={
                "price_action": 75,
                "options_chain": 80,
                "strike_select": 70,
                "risk_mgmt": 72,
                "position_size": 68,
                "regime_id": 74,
                "vol_assess": 77,
                "trade_mgmt": 71,
            },
        ),
        StudentProfile(
            user_id=8,
            username="DeltaNeutral",
            skill_scores={
                "price_action": 30,
                "options_chain": 25,
                "strike_select": 20,
                "risk_mgmt": 35,
                "position_size": 28,
                "regime_id": 22,
                "vol_assess": 18,
                "trade_mgmt": 32,
            },
        ),
        StudentProfile(
            user_id=9,
            username="IronCondor",
            skill_scores={
                "price_action": 60,
                "options_chain": 55,
                "strike_select": 62,
                "risk_mgmt": 58,
                "position_size": 50,
                "regime_id": 65,
                "vol_assess": 48,
                "trade_mgmt": 56,
            },
        ),
        StudentProfile(
            user_id=10,
            username="VegaTrader",
            skill_scores={
                "price_action": 35,
                "options_chain": 40,
                "strike_select": 30,
                "risk_mgmt": 42,
                "position_size": 38,
                "regime_id": 25,
                "vol_assess": 33,
                "trade_mgmt": 36,
            },
        ),
    ]


# Keep backward-compatible module-level reference
DEMO_STUDENTS: list[StudentProfile] = get_demo_students()


async def classify_from_db(
    db: "AsyncSession", user_id: int
) -> dict[str, object]:
    """Classify a student from real DB data.

    Args:
        db: Async database session.
        user_id: The user to classify.

    Returns:
        Dict with user_id, username, overall_tier, avg_score, skill_tiers.
    """
    from src.mtss.repository import get_student_skill_scores, get_user_by_id

    user = await get_user_by_id(db, user_id)
    if user is None:
        # Fallback to demo data
        for student in DEMO_STUDENTS:
            if student.user_id == user_id:
                skill_tiers = get_student_tiers(student.skill_scores)
                scores = list(student.skill_scores.values())
                avg = sum(scores) / len(scores) if scores else 0.0
                return {
                    "user_id": student.user_id,
                    "username": student.username,
                    "overall_tier": classify_tier(avg).value,
                    "avg_score": round(avg, 1),
                    "skill_tiers": {k: v.value for k, v in skill_tiers.items()},
                }
        return {
            "user_id": user_id,
            "username": "unknown",
            "overall_tier": MTSSTier.TIER_3.value,
            "avg_score": 0.0,
            "skill_tiers": {},
        }

    skill_scores_rows = await get_student_skill_scores(db, user_id)
    if not skill_scores_rows:
        # Fallback to demo
        for student in DEMO_STUDENTS:
            if student.user_id == user_id:
                skill_tiers = get_student_tiers(student.skill_scores)
                scores = list(student.skill_scores.values())
                avg = sum(scores) / len(scores) if scores else 0.0
                return {
                    "user_id": student.user_id,
                    "username": student.username,
                    "overall_tier": classify_tier(avg).value,
                    "avg_score": round(avg, 1),
                    "skill_tiers": {k: v.value for k, v in skill_tiers.items()},
                }

    score_map = {row.skill_id: row.score for row in skill_scores_rows}
    skill_tiers = get_student_tiers(score_map)
    scores = list(score_map.values())
    avg = sum(scores) / len(scores) if scores else 0.0

    return {
        "user_id": user_id,
        "username": user.username,
        "overall_tier": classify_tier(avg).value,
        "avg_score": round(avg, 1),
        "skill_tiers": {k: v.value for k, v in skill_tiers.items()},
    }


async def get_class_overview_from_db(db: "AsyncSession") -> ClassOverview:
    """Generate class overview from real DB data, falling back to demo.

    Args:
        db: Async database session.

    Returns:
        ClassOverview with tier counts, students by tier, and skill breakdown.
    """
    from src.mtss.repository import get_all_student_scores, get_user_by_id

    all_scores = await get_all_student_scores(db)
    if not all_scores:
        return get_class_overview(DEMO_STUDENTS)

    students: list[StudentProfile] = []
    for uid, score_rows in all_scores.items():
        user = await get_user_by_id(db, uid)
        username = user.username if user else f"user_{uid}"
        score_map = {row.skill_id: row.score for row in score_rows}
        students.append(
            StudentProfile(user_id=uid, username=username, skill_scores=score_map)
        )

    return get_class_overview(students)


def get_tier_recommendations(tier: MTSSTier, weak_skills: list[str]) -> dict[str, object]:
    """Get intervention recommendations for a student's tier.

    Args:
        tier: The student's current MTSS tier.
        weak_skills: List of skill IDs needing improvement.

    Returns:
        Dict with recommended scenario parameters and support strategies.
    """
    recommendations: dict[str, dict[str, object]] = {
        MTSSTier.TIER_1.value: {
            "complexity_range": [3, 5],
            "strategy": "Challenge with advanced scenarios",
            "support_level": "minimal",
        },
        MTSSTier.TIER_2.value: {
            "complexity_range": [2, 3],
            "strategy": "Targeted practice on weak skills",
            "support_level": "moderate",
        },
        MTSSTier.TIER_3.value: {
            "complexity_range": [1, 2],
            "strategy": "Guided walkthroughs with scaffolding",
            "support_level": "intensive",
        },
    }
    result = dict(recommendations[tier.value])
    result["focus_skills"] = weak_skills
    return result

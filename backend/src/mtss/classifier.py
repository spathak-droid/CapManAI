"""MTSS tier classification.

Multi-Tiered System of Supports (MTSS) classifier that assigns
students to intervention tiers based on skill scores and performance.
"""

from enum import Enum


class MTSSTier(Enum):
    """MTSS support tiers."""

    TIER_1 = "tier_1"  # Universal: on track, standard scenarios
    TIER_2 = "tier_2"  # Targeted: struggling in specific skills
    TIER_3 = "tier_3"  # Intensive: significant gaps, guided support


def classify_tier(skill_scores: dict[str, float]) -> MTSSTier:
    """Classify a student into an MTSS tier based on skill scores.

    Args:
        skill_scores: Dict mapping skill_id to score (0.0 - 1.0).

    Returns:
        The appropriate MTSS tier for the student.
    """
    raise NotImplementedError


def get_tier_recommendations(tier: MTSSTier, weak_skills: list[str]) -> dict:
    """Get intervention recommendations for a student's tier.

    Args:
        tier: The student's current MTSS tier.
        weak_skills: List of skill IDs needing improvement.

    Returns:
        Dict with recommended scenario parameters and support strategies.
    """
    raise NotImplementedError

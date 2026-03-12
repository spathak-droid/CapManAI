"""Tests for MTSS tier classification."""

from src.mtss.classifier import (
    ClassOverview,
    MTSSTier,
    StudentProfile,
    classify_tier,
    get_class_overview,
    get_student_tiers,
)


class TestClassifyTier:
    """Tests for classify_tier function."""

    def test_tier_1_at_70(self) -> None:
        assert classify_tier(70) == MTSSTier.TIER_1

    def test_tier_1_above_70(self) -> None:
        assert classify_tier(95) == MTSSTier.TIER_1

    def test_tier_2_at_40(self) -> None:
        assert classify_tier(40) == MTSSTier.TIER_2

    def test_tier_2_at_69(self) -> None:
        assert classify_tier(69) == MTSSTier.TIER_2

    def test_tier_3_below_40(self) -> None:
        assert classify_tier(39) == MTSSTier.TIER_3

    def test_tier_3_at_zero(self) -> None:
        assert classify_tier(0) == MTSSTier.TIER_3

    def test_tier_1_at_100(self) -> None:
        assert classify_tier(100) == MTSSTier.TIER_1


class TestGetStudentTiers:
    """Tests for get_student_tiers function."""

    def test_mixed_tiers(self) -> None:
        scores: dict[str, float] = {
            "skill_a": 80.0,  # Tier 1
            "skill_b": 50.0,  # Tier 2
            "skill_c": 30.0,  # Tier 3
        }
        result = get_student_tiers(scores)
        assert result["skill_a"] == MTSSTier.TIER_1
        assert result["skill_b"] == MTSSTier.TIER_2
        assert result["skill_c"] == MTSSTier.TIER_3

    def test_empty_scores(self) -> None:
        result = get_student_tiers({})
        assert result == {}


class TestGetClassOverview:
    """Tests for get_class_overview function."""

    def test_class_overview_generation(self) -> None:
        students = [
            StudentProfile(
                user_id=1,
                username="HighScorer",
                skill_scores={"s1": 90, "s2": 85},
            ),
            StudentProfile(
                user_id=2,
                username="MidScorer",
                skill_scores={"s1": 55, "s2": 60},
            ),
            StudentProfile(
                user_id=3,
                username="LowScorer",
                skill_scores={"s1": 20, "s2": 30},
            ),
        ]
        overview = get_class_overview(students)
        assert isinstance(overview, ClassOverview)
        assert overview.tier_counts["tier_1"] == 1
        assert overview.tier_counts["tier_2"] == 1
        assert overview.tier_counts["tier_3"] == 1
        assert "HighScorer" in overview.students_by_tier["tier_1"]
        assert "MidScorer" in overview.students_by_tier["tier_2"]
        assert "LowScorer" in overview.students_by_tier["tier_3"]

    def test_skill_breakdown(self) -> None:
        students = [
            StudentProfile(
                user_id=1,
                username="A",
                skill_scores={"s1": 80},
            ),
            StudentProfile(
                user_id=2,
                username="B",
                skill_scores={"s1": 50},
            ),
        ]
        overview = get_class_overview(students)
        assert overview.skill_breakdown["s1"]["tier_1"] == 1
        assert overview.skill_breakdown["s1"]["tier_2"] == 1
        assert overview.skill_breakdown["s1"]["tier_3"] == 0

    def test_empty_class(self) -> None:
        overview = get_class_overview([])
        assert overview.tier_counts["tier_1"] == 0
        assert overview.tier_counts["tier_2"] == 0
        assert overview.tier_counts["tier_3"] == 0

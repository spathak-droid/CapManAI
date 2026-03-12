"""Tests for XP calculation and leveling logic."""

from src.gamification.xp import calculate_level, calculate_xp, xp_to_next_level


class TestCalculateXP:
    """Tests for calculate_xp function."""

    def test_basic_calculation(self) -> None:
        """Test XP with known inputs: score=3, complexity=2."""
        # base=100, quality=3*20=60, multiplier=2*0.5=1.0
        # (100+60)*1.0 = 160
        assert calculate_xp(overall_score=3.0, complexity=2) == 160

    def test_max_score_max_complexity(self) -> None:
        """Test XP with maximum values: score=5, complexity=5."""
        # base=100, quality=5*20=100, multiplier=5*0.5=2.5
        # (100+100)*2.5 = 500
        assert calculate_xp(overall_score=5.0, complexity=5) == 500

    def test_min_score_min_complexity(self) -> None:
        """Test XP with minimum values: score=1, complexity=1."""
        # base=100, quality=1*20=20, multiplier=1*0.5=0.5
        # (100+20)*0.5 = 60
        assert calculate_xp(overall_score=1.0, complexity=1) == 60

    def test_min_xp_floor(self) -> None:
        """Test that XP never goes below 50."""
        # Even with score=0, complexity=0 the floor applies
        result = calculate_xp(overall_score=0.0, complexity=0)
        assert result == 50

    def test_mid_range_values(self) -> None:
        """Test with mid-range score=2.5, complexity=3."""
        # base=100, quality=2.5*20=50, multiplier=3*0.5=1.5
        # (100+50)*1.5 = 225
        assert calculate_xp(overall_score=2.5, complexity=3) == 225


class TestCalculateLevel:
    """Tests for calculate_level function."""

    def test_level_1_at_zero(self) -> None:
        assert calculate_level(0) == 1

    def test_level_1_below_threshold(self) -> None:
        assert calculate_level(499) == 1

    def test_level_2_at_threshold(self) -> None:
        assert calculate_level(500) == 2

    def test_level_5_at_threshold(self) -> None:
        assert calculate_level(3000) == 5

    def test_level_10_at_threshold(self) -> None:
        assert calculate_level(16000) == 10

    def test_level_10_above_threshold(self) -> None:
        assert calculate_level(99999) == 10

    def test_level_3_mid_range(self) -> None:
        assert calculate_level(1500) == 3


class TestXPToNextLevel:
    """Tests for xp_to_next_level function."""

    def test_level_1_progress(self) -> None:
        result = xp_to_next_level(250, 1)
        assert result["current_xp"] == 250
        assert result["next_level_xp"] == 500
        assert result["progress_pct"] == 50.0

    def test_max_level(self) -> None:
        result = xp_to_next_level(20000, 10)
        assert result["current_xp"] == 20000
        assert result["next_level_xp"] is None
        assert result["progress_pct"] == 100.0

    def test_level_boundary(self) -> None:
        result = xp_to_next_level(500, 2)
        assert result["current_xp"] == 500
        assert result["next_level_xp"] == 1200
        assert result["progress_pct"] == 0.0

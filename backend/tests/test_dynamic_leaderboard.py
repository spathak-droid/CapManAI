"""Tests for dynamic leaderboard ranking logic."""

import pytest

from src.gamification.ranking import compute_composite


class TestComputeComposite:
    """Tests for compute_composite function."""

    def test_basic_normalization(self) -> None:
        """All values at max should produce 1.0."""
        result = compute_composite(
            mastery=100.0,
            repetition=50,
            xp=1000,
            max_mastery=100.0,
            max_repetition=50,
            max_xp=1000,
        )
        assert result == pytest.approx(1.0)

    def test_all_zeros(self) -> None:
        """All zero values and max values should produce 0.0."""
        result = compute_composite(
            mastery=0.0,
            repetition=0,
            xp=0,
            max_mastery=0.0,
            max_repetition=0,
            max_xp=0,
        )
        assert result == pytest.approx(0.0)

    def test_zero_max_mastery(self) -> None:
        """Zero max_mastery should not cause division by zero."""
        result = compute_composite(
            mastery=50.0,
            repetition=10,
            xp=500,
            max_mastery=0.0,
            max_repetition=10,
            max_xp=500,
        )
        # mastery contributes 0, repetition = 0.25 * 1.0, xp = 0.15 * 1.0
        assert result == pytest.approx(0.40)

    def test_zero_max_repetition(self) -> None:
        """Zero max_repetition should not cause division by zero."""
        result = compute_composite(
            mastery=80.0,
            repetition=5,
            xp=200,
            max_mastery=80.0,
            max_repetition=0,
            max_xp=200,
        )
        # mastery = 0.6 * 1.0, repetition = 0, xp = 0.15 * 1.0
        assert result == pytest.approx(0.75)

    def test_zero_max_xp(self) -> None:
        """Zero max_xp should not cause division by zero."""
        result = compute_composite(
            mastery=50.0,
            repetition=20,
            xp=0,
            max_mastery=100.0,
            max_repetition=20,
            max_xp=0,
        )
        # mastery = 0.6 * 0.5, repetition = 0.25 * 1.0, xp = 0
        assert result == pytest.approx(0.55)

    def test_weights_sum_to_one(self) -> None:
        """When all components are at max, result should be exactly 1.0."""
        result = compute_composite(
            mastery=1.0,
            repetition=1,
            xp=1,
            max_mastery=1.0,
            max_repetition=1,
            max_xp=1,
        )
        assert result == pytest.approx(1.0)

    def test_half_values(self) -> None:
        """Half values should produce 0.5."""
        result = compute_composite(
            mastery=50.0,
            repetition=10,
            xp=500,
            max_mastery=100.0,
            max_repetition=20,
            max_xp=1000,
        )
        assert result == pytest.approx(0.5)

    def test_mastery_dominant(self) -> None:
        """High mastery but zero others should reflect 60% weight."""
        result = compute_composite(
            mastery=100.0,
            repetition=0,
            xp=0,
            max_mastery=100.0,
            max_repetition=10,
            max_xp=1000,
        )
        assert result == pytest.approx(0.6)

    def test_repetition_dominant(self) -> None:
        """High repetition but zero others should reflect 25% weight."""
        result = compute_composite(
            mastery=0.0,
            repetition=50,
            xp=0,
            max_mastery=100.0,
            max_repetition=50,
            max_xp=1000,
        )
        assert result == pytest.approx(0.25)

    def test_xp_dominant(self) -> None:
        """High XP but zero others should reflect 15% weight."""
        result = compute_composite(
            mastery=0.0,
            repetition=0,
            xp=1000,
            max_mastery=100.0,
            max_repetition=50,
            max_xp=1000,
        )
        assert result == pytest.approx(0.15)

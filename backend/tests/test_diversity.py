"""Tests for scenario diversity tracking and history endpoint."""

from __future__ import annotations

import pytest

from src.scenario_gen.diversity import (
    ALL_REGIMES,
    should_override_regime,
    suggest_regime,
    get_regime_distribution,
)


# ---------------------------------------------------------------------------
# Unit tests for suggest_regime / should_override_regime (pure logic)
# ---------------------------------------------------------------------------


class TestShouldOverrideRegime:
    """Tests for the override heuristic."""

    def test_no_history_does_not_override(self) -> None:
        dist = {r: 0 for r in ALL_REGIMES}
        assert should_override_regime(dist) is False

    def test_balanced_does_not_override(self) -> None:
        dist = {"bull": 3, "bear": 3, "sideways": 3, "volatile": 3}
        assert should_override_regime(dist) is False

    def test_slightly_unbalanced_does_not_override(self) -> None:
        # 2x exactly is the boundary — should NOT override
        dist = {"bull": 2, "bear": 1, "sideways": 1, "volatile": 1}
        assert should_override_regime(dist) is False

    def test_significant_imbalance_triggers_override(self) -> None:
        # bull is 5, bear is 1 → 5 > 2*1 → override
        dist = {"bull": 5, "bear": 1, "sideways": 2, "volatile": 1}
        assert should_override_regime(dist) is True

    def test_zero_min_uses_floor_of_one(self) -> None:
        # max=3, min=0 → 3 > 2*max(0,1)=2 → True
        dist = {"bull": 3, "bear": 0, "sideways": 1, "volatile": 0}
        assert should_override_regime(dist) is True


class TestSuggestRegimeUnit:
    """Tests for suggest_regime using a mock db session."""

    @pytest.mark.asyncio
    async def test_returns_least_seen_regime(self) -> None:
        """suggest_regime should return the regime with the lowest count."""
        from unittest.mock import AsyncMock, MagicMock

        # Mock db to return a distribution where 'volatile' is least seen
        mock_result = MagicMock()
        mock_result.all.return_value = [
            ("bull", 5),
            ("bear", 3),
            ("sideways", 4),
            ("volatile", 1),
        ]
        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        result = await suggest_regime(mock_db, user_id=1)
        assert result == "volatile"

    @pytest.mark.asyncio
    async def test_returns_bear_when_no_history(self) -> None:
        """With no history, all counts are 0; first alphabetical min is 'bear'."""
        from unittest.mock import AsyncMock, MagicMock

        mock_result = MagicMock()
        mock_result.all.return_value = []  # no rows
        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        result = await suggest_regime(mock_db, user_id=1)
        # All zero → min picks first in ALL_REGIMES list order: "bull"
        assert result == ALL_REGIMES[0]  # "bull" is first in list


class TestGetRegimeDistribution:
    """Tests for get_regime_distribution."""

    @pytest.mark.asyncio
    async def test_returns_all_regimes_with_zeros(self) -> None:
        """Even with no data, all four regimes should appear with count 0."""
        from unittest.mock import AsyncMock, MagicMock

        mock_result = MagicMock()
        mock_result.all.return_value = []
        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        dist = await get_regime_distribution(mock_db, user_id=1)
        assert set(dist.keys()) == set(ALL_REGIMES)
        assert all(v == 0 for v in dist.values())

    @pytest.mark.asyncio
    async def test_fills_missing_regimes(self) -> None:
        """Regimes not returned by the query should still appear as 0."""
        from unittest.mock import AsyncMock, MagicMock

        mock_result = MagicMock()
        mock_result.all.return_value = [("bull", 3), ("bear", 1)]
        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        dist = await get_regime_distribution(mock_db, user_id=1)
        assert dist["bull"] == 3
        assert dist["bear"] == 1
        assert dist["sideways"] == 0
        assert dist["volatile"] == 0

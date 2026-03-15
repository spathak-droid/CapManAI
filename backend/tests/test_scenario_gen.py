"""Tests for the scenario generation module."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.scenario_gen.generator import (
    FALLBACK_SCENARIOS,
    ScenarioGenerator,
    ScenarioParams,
    ScenarioResult,
)


# ---------------------------------------------------------------------------
# ScenarioParams validation
# ---------------------------------------------------------------------------


class TestScenarioParams:
    """Tests for ScenarioParams validation."""

    def test_valid_defaults(self) -> None:
        params = ScenarioParams()
        assert params.market_regime == "bull"
        assert params.instrument_type == "equity"
        assert params.complexity == 3
        assert params.skill_target == "price_action"

    def test_valid_custom(self) -> None:
        params = ScenarioParams(
            market_regime="bear",
            instrument_type="option",
            complexity=5,
            skill_target="risk_mgmt",
        )
        assert params.market_regime == "bear"
        assert params.instrument_type == "option"
        assert params.complexity == 5
        assert params.skill_target == "risk_mgmt"

    def test_invalid_complexity_too_low(self) -> None:
        with pytest.raises(ValueError, match="complexity must be between 1 and 5"):
            ScenarioParams(complexity=0)

    def test_invalid_complexity_too_high(self) -> None:
        with pytest.raises(ValueError, match="complexity must be between 1 and 5"):
            ScenarioParams(complexity=6)

    def test_invalid_skill_target(self) -> None:
        with pytest.raises(ValueError, match="skill_target must be one of"):
            ScenarioParams(skill_target="invalid_skill")

    def test_invalid_market_regime(self) -> None:
        with pytest.raises(ValueError):
            ScenarioParams(market_regime="crash")  # type: ignore[arg-type]

    def test_invalid_instrument_type(self) -> None:
        with pytest.raises(ValueError):
            ScenarioParams(instrument_type="future")  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Fallback scenarios
# ---------------------------------------------------------------------------


class TestFallbackScenarios:
    """Tests for hardcoded fallback scenarios."""

    def test_fallback_count(self) -> None:
        assert len(FALLBACK_SCENARIOS) == 3

    @pytest.mark.parametrize("idx", range(3))
    def test_fallback_well_formed(self, idx: int) -> None:
        s = FALLBACK_SCENARIOS[idx]
        assert isinstance(s, ScenarioResult)
        assert len(s.situation) > 0
        assert len(s.question) > 0
        assert "symbol" in s.market_data
        assert "current_price" in s.market_data
        assert "price_history" in s.market_data
        assert isinstance(s.market_data["price_history"], list)


# ---------------------------------------------------------------------------
# ScenarioGenerator
# ---------------------------------------------------------------------------


def _make_llm_response(scenario: dict[str, Any]) -> dict[str, Any]:
    """Build a mock OpenRouter API response envelope."""
    import json

    return {
        "choices": [
            {
                "message": {
                    "content": json.dumps(scenario),
                }
            }
        ]
    }


class TestScenarioGenerator:
    """Tests for ScenarioGenerator."""

    @pytest.mark.asyncio
    async def test_generate_calls_llm(self) -> None:
        fake_scenario = {
            "situation": "Test situation",
            "market_data": {
                "symbol": "TEST",
                "current_price": 100.0,
                "price_history": [98, 99, 100, 101, 100],
                "volume": 1_000_000,
                "avg_volume": 800_000,
                "sector": "Technology",
                "rsi_14": 55.0,
                "macd": 0.5,
                "macd_signal": 0.3,
            },
            "question": "What would you do?",
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = _make_llm_response(fake_scenario)
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.scenario_gen.generator._get_http_client", return_value=mock_client):
            gen = ScenarioGenerator()
            result = await gen.generate(ScenarioParams())

        assert result.situation == "Test situation"
        assert result.market_data["symbol"] == "TEST"
        assert result.question == "What would you do?"

    @pytest.mark.asyncio
    async def test_generate_falls_back_on_error(self) -> None:
        mock_client = AsyncMock()
        mock_client.post.side_effect = Exception("API down")

        with patch("src.scenario_gen.generator._get_http_client", return_value=mock_client):
            gen = ScenarioGenerator()
            result = await gen.generate(ScenarioParams(complexity=1))

        # Should return the first fallback (complexity=1 -> idx 0)
        assert result.situation == FALLBACK_SCENARIOS[0].situation


# ---------------------------------------------------------------------------
# API endpoint
# ---------------------------------------------------------------------------


class TestGenerateEndpoint:
    """Tests for POST /api/scenarios/generate."""

    def test_generate_returns_200(self, client: TestClient) -> None:
        fallback = FALLBACK_SCENARIOS[0]

        with patch.object(
            ScenarioGenerator,
            "generate",
            new_callable=AsyncMock,
            return_value=fallback,
        ):
            response = client.post(
                "/api/scenarios/generate",
                json={
                    "market_regime": "bull",
                    "instrument_type": "equity",
                    "complexity": 1,
                    "skill_target": "price_action",
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert "situation" in data
        assert "market_data" in data
        assert "question" in data

    def test_generate_rejects_invalid_params(self, client: TestClient) -> None:
        response = client.post(
            "/api/scenarios/generate",
            json={
                "market_regime": "bull",
                "instrument_type": "equity",
                "complexity": 10,
                "skill_target": "price_action",
            },
        )
        assert response.status_code == 422

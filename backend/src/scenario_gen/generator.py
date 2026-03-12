"""LLM-based trading scenario generation.

Uses OpenRouter to generate realistic trading scenarios
with market data, situational context, and assessment questions.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Literal

import httpx
from pydantic import BaseModel, field_validator

from src.core.config import settings
from src.mtss.objectives import OBJECTIVE_DESCRIPTIONS, LearningObjective
from src.scenario_gen.prompts import SCENARIO_TEMPLATE, SYSTEM_PROMPT

logger = logging.getLogger(__name__)

MarketRegime = Literal["bull", "bear", "sideways", "volatile"]
InstrumentType = Literal["equity", "option", "both"]


class ScenarioParams(BaseModel):
    """Parameters for generating a trading scenario."""

    market_regime: MarketRegime = "bull"
    instrument_type: InstrumentType = "equity"
    complexity: int = 3
    skill_target: str = "price_action"

    @field_validator("complexity")
    @classmethod
    def validate_complexity(cls, v: int) -> int:
        if v < 1 or v > 5:
            msg = "complexity must be between 1 and 5"
            raise ValueError(msg)
        return v

    @field_validator("skill_target")
    @classmethod
    def validate_skill_target(cls, v: str) -> str:
        valid = {obj.value for obj in LearningObjective}
        if v not in valid:
            msg = f"skill_target must be one of {sorted(valid)}"
            raise ValueError(msg)
        return v


class ScenarioResult(BaseModel):
    """Result from scenario generation."""

    situation: str
    market_data: dict[str, Any]
    question: str


FALLBACK_SCENARIOS: list[ScenarioResult] = [
    ScenarioResult(
        situation=(
            "AAPL is trading at $185.40 after reporting Q3 earnings that beat "
            "estimates by 8%. The stock gapped up 3% at open but has since "
            "pulled back to fill the gap. Volume is 1.5x the 20-day average. "
            "The broader market (SPY) is flat on the day."
        ),
        market_data={
            "symbol": "AAPL",
            "current_price": 185.40,
            "price_history": [178.20, 179.80, 180.50, 179.90, 185.40],
            "volume": 82_000_000,
            "avg_volume": 55_000_000,
            "sector": "Technology",
            "rsi_14": 62.5,
            "macd": 1.85,
            "macd_signal": 1.20,
        },
        question=(
            "Given the post-earnings gap-fill pattern on AAPL, would you "
            "initiate a long position here? Specify your entry, stop-loss, "
            "and initial profit target with rationale."
        ),
    ),
    ScenarioResult(
        situation=(
            "TSLA is at $242.10 after a 12% decline over two weeks driven by "
            "delivery miss reports. IV rank is at 78th percentile. The stock "
            "is approaching a well-known support zone at $235-$238. Put "
            "open interest is elevated at the $240 and $235 strikes expiring "
            "this Friday."
        ),
        market_data={
            "symbol": "TSLA",
            "current_price": 242.10,
            "price_history": [268.50, 260.30, 255.80, 248.90, 242.10],
            "volume": 95_000_000,
            "avg_volume": 72_000_000,
            "sector": "Consumer Discretionary",
            "rsi_14": 31.2,
            "macd": -3.45,
            "macd_signal": -2.10,
            "iv": 0.58,
            "iv_rank": 78,
            "iv_percentile": 82,
            "options_chain": [
                {
                    "strike": 240,
                    "type": "put",
                    "bid": 5.20,
                    "ask": 5.50,
                    "delta": -0.45,
                    "gamma": 0.03,
                    "open_interest": 12500,
                },
                {
                    "strike": 235,
                    "type": "put",
                    "bid": 3.80,
                    "ask": 4.10,
                    "delta": -0.35,
                    "gamma": 0.025,
                    "open_interest": 18200,
                },
                {
                    "strike": 250,
                    "type": "call",
                    "bid": 4.60,
                    "ask": 4.90,
                    "delta": 0.40,
                    "gamma": 0.028,
                    "open_interest": 9800,
                },
            ],
        },
        question=(
            "With TSLA approaching support and elevated IV, would you sell a "
            "put spread or buy puts outright? Justify your strike selection "
            "and explain how IV rank influences your decision."
        ),
    ),
    ScenarioResult(
        situation=(
            "AMD is at $148.60 in a sideways consolidation between $144 and "
            "$152 for the past three weeks. An AI-related catalyst "
            "(new chip announcement) is expected next Tuesday. Volume has "
            "been declining during the consolidation. RSI is neutral at 51."
        ),
        market_data={
            "symbol": "AMD",
            "current_price": 148.60,
            "price_history": [147.20, 149.80, 146.90, 150.10, 148.60],
            "volume": 38_000_000,
            "avg_volume": 52_000_000,
            "sector": "Technology",
            "rsi_14": 51.0,
            "macd": 0.15,
            "macd_signal": 0.10,
        },
        question=(
            "AMD is consolidating ahead of a catalyst with declining volume. "
            "Describe how you would size a position for a breakout trade, "
            "including your risk per trade as a percentage of account equity "
            "and how you arrive at the share count."
        ),
    ),
]


class ScenarioGenerator:
    """Generates trading scenarios via LLM calls through OpenRouter."""

    async def generate(self, params: ScenarioParams) -> ScenarioResult:
        """Generate a trading scenario from the given parameters.

        Calls the OpenRouter API. Falls back to a hardcoded scenario
        if the API call fails for any reason.
        """
        try:
            return await self._call_llm(params)
        except Exception:
            logger.exception("LLM call failed, returning fallback scenario")
            return self._get_fallback(params)

    async def _call_llm(self, params: ScenarioParams) -> ScenarioResult:
        """Call OpenRouter chat completions API."""
        objective = LearningObjective(params.skill_target)
        skill_description = OBJECTIVE_DESCRIPTIONS[objective]

        user_prompt = SCENARIO_TEMPLATE.format(
            skill_target=params.skill_target,
            skill_description=skill_description,
            complexity=params.complexity,
            market_regime=params.market_regime,
            instrument_type=params.instrument_type,
        )

        payload: dict[str, Any] = {
            "model": settings.OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }

        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()

        data = response.json()
        content: str = data["choices"][0]["message"]["content"]
        parsed: dict[str, Any] = json.loads(content)

        return ScenarioResult(
            situation=parsed["situation"],
            market_data=parsed["market_data"],
            question=parsed["question"],
        )

    def _get_fallback(self, params: ScenarioParams) -> ScenarioResult:
        """Return a hardcoded fallback scenario based on complexity."""
        idx = (params.complexity - 1) % len(FALLBACK_SCENARIOS)
        return FALLBACK_SCENARIOS[idx]

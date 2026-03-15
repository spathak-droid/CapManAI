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
from src.scenario_gen.prompts import (
    LESSON_SCENARIO_SYSTEM_PROMPT,
    LESSON_SCENARIO_TEMPLATE,
    SCENARIO_TEMPLATE,
    SKILL_ADDENDA,
    SYSTEM_PROMPT,
)

logger = logging.getLogger(__name__)

_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    """Return a shared httpx.AsyncClient, creating it on first use."""
    global _http_client  # noqa: PLW0603
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=30.0)
    return _http_client


MarketRegime = Literal["bull", "bear", "sideways", "volatile"]
InstrumentType = Literal["equity", "option", "both"]


class ScenarioParams(BaseModel):
    """Parameters for generating a trading scenario."""

    market_regime: MarketRegime = "bull"
    instrument_type: InstrumentType = "equity"
    complexity: int = 3
    skill_target: str = "price_action"
    auto_regime: bool = False

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


class LessonMultipleChoice(BaseModel):
    """Multiple choice options for lesson scenario; no LLM grading."""

    options: list[str]
    correct_index: int


class ScenarioResult(BaseModel):
    """Result from scenario generation."""

    situation: str
    market_data: dict[str, Any]
    question: str
    multiple_choice: LessonMultipleChoice | None = None


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
        multiple_choice=LessonMultipleChoice(
            options=[
                "Buyers are in control; price is likely to continue higher.",
                "Sellers are in control; avoid new longs.",
                "No clear control; wait for a breakout.",
                "The ticker symbol alone tells you who is in control.",
            ],
            correct_index=0,
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
    # --- New fallback scenarios for expanded skill targets ---
    ScenarioResult(
        situation=(
            "SPY is trading at $445.20 after a period of suppressed realized "
            "volatility. The 20-day historical vol (close-to-close) reads 18.5%, "
            "but the 60-day HV is 22.3%. The Parkinson estimator, which captures "
            "intraday range, shows only 16.8%. IV is at 20.1%, suggesting the "
            "market prices in more vol than recently realized. A Fed meeting is "
            "scheduled in 5 days."
        ),
        market_data={
            "symbol": "SPY",
            "current_price": 445.20,
            "price_history": [442.80, 443.60, 444.90, 445.50, 445.20],
            "volume": 68_000_000,
            "avg_volume": 72_000_000,
            "sector": "Index",
            "rsi_14": 54.2,
            "macd": 0.35,
            "macd_signal": 0.28,
            "hv_20": 18.5,
            "hv_60": 22.3,
            "parkinson_vol": 16.8,
            "iv": 0.201,
            "iv_rank": 45,
            "iv_percentile": 50,
            "iv_skew_25d": -3.2,
            "term_structure_slope": 1.8,
            "vvix": 88.5,
        },
        question=(
            "The Parkinson estimator (16.8%) is significantly lower than the "
            "close-to-close HV20 (18.5%). Explain what this divergence tells you "
            "about recent price behavior, which estimator is more appropriate "
            "here, and how you would position given the upcoming Fed meeting."
        ),
    ),
    ScenarioResult(
        situation=(
            "NVDA is at $875.30 after a 6% rally this week driven by AI demand "
            "reports. Dealer gamma exposure is estimated at -$2.1B (short gamma), "
            "meaning dealers must buy into rallies and sell into dips, amplifying "
            "moves. Vanna is strongly positive at 0.12, suggesting that rising "
            "spot will push dealers to buy more delta. Charm shows accelerating "
            "delta decay on near-term puts as Friday expiration approaches."
        ),
        market_data={
            "symbol": "NVDA",
            "current_price": 875.30,
            "price_history": [825.60, 840.20, 855.90, 868.10, 875.30],
            "volume": 52_000_000,
            "avg_volume": 45_000_000,
            "sector": "Technology",
            "rsi_14": 71.8,
            "macd": 8.45,
            "macd_signal": 5.20,
            "iv": 0.55,
            "iv_rank": 62,
            "iv_percentile": 68,
            "net_gamma_exposure": -2_100_000_000,
            "vanna": 0.12,
            "charm": -0.035,
            "options_chain": [
                {
                    "strike": 880,
                    "type": "call",
                    "bid": 22.50,
                    "ask": 23.10,
                    "delta": 0.48,
                    "gamma": 0.004,
                    "open_interest": 25600,
                },
                {
                    "strike": 860,
                    "type": "put",
                    "bid": 15.80,
                    "ask": 16.40,
                    "delta": -0.32,
                    "gamma": 0.003,
                    "open_interest": 31200,
                },
                {
                    "strike": 900,
                    "type": "call",
                    "bid": 12.30,
                    "ask": 12.90,
                    "delta": 0.35,
                    "gamma": 0.0035,
                    "open_interest": 42100,
                },
            ],
        },
        question=(
            "Given that dealer GEX is -$2.1B (short gamma) and Vanna is "
            "strongly positive, explain how these flows will affect NVDA's "
            "price dynamics into Friday expiration. Where is the GEX flip "
            "level likely located and what happens if price crosses it?"
        ),
    ),
    ScenarioResult(
        situation=(
            "META is at $485.60 after a 15% decline from all-time highs over "
            "three weeks. The CNN Fear & Greed index is at 25 (Extreme Fear). "
            "AAII bull sentiment has dropped to 22.5%, well below the historical "
            "average of 37.5%. Margin debt has declined 8% year-over-year. "
            "However, insider buying has picked up with three C-suite executives "
            "making open-market purchases in the past 10 days."
        ),
        market_data={
            "symbol": "META",
            "current_price": 485.60,
            "price_history": [545.20, 530.80, 510.40, 495.70, 485.60],
            "volume": 28_000_000,
            "avg_volume": 22_000_000,
            "sector": "Communication Services",
            "rsi_14": 28.5,
            "macd": -6.20,
            "macd_signal": -3.80,
            "fear_greed_index": 25,
            "aaii_bull_pct": 22.5,
            "margin_debt_yoy_chg": -8.0,
            "insider_buys_30d": 3,
            "put_call_ratio": 1.35,
        },
        question=(
            "With Fear & Greed at 25 and AAII bulls at 22.5%, is this a "
            "contrarian buy signal for META? Evaluate the confluence of "
            "sentiment indicators, explain which ones you weight most heavily, "
            "and describe how insider buying activity factors into your thesis."
        ),
    ),
    ScenarioResult(
        situation=(
            "XLE (Energy ETF) is at $92.40 while SPY is at $445.20. Over the "
            "past 60 days, the XLE-SPY correlation has dropped from 0.72 to "
            "0.38, suggesting a sector decoupling. Implied correlation across "
            "S&P 500 components sits at 0.28 vs realized correlation of 0.19, "
            "indicating potential dispersion trade opportunities. Oil (WTI) is "
            "at $78.50 and the energy sector is showing relative strength "
            "vs the broader market."
        ),
        market_data={
            "symbol": "XLE",
            "current_price": 92.40,
            "price_history": [88.90, 90.10, 91.50, 91.80, 92.40],
            "volume": 18_000_000,
            "avg_volume": 15_000_000,
            "sector": "Energy",
            "rsi_14": 61.3,
            "macd": 0.95,
            "macd_signal": 0.60,
            "spy_price": 445.20,
            "xle_spy_corr_60d": 0.38,
            "xle_spy_corr_60d_prior": 0.72,
            "implied_correlation": 0.28,
            "realized_correlation": 0.19,
            "wti_crude": 78.50,
            "iv": 0.26,
            "iv_rank": 35,
        },
        question=(
            "The XLE-SPY 60-day correlation has dropped from 0.72 to 0.38. "
            "Explain what this decoupling means for portfolio construction, "
            "how you would structure a dispersion trade using options on XLE "
            "vs SPX, and what risks arise if correlation snaps back."
        ),
    ),
    ScenarioResult(
        situation=(
            "GME is at $28.50 after a 40% surge in two days on renewed retail "
            "interest. Short interest is at 24% of float. Dealer gamma exposure "
            "is estimated at -$450M, deeply short gamma. Dark pool activity has "
            "dropped to 28% of volume (normally 40%), suggesting more orders "
            "are hitting lit exchanges. 0DTE call volume is 5x the 20-day "
            "average, concentrated at the $30 and $35 strikes."
        ),
        market_data={
            "symbol": "GME",
            "current_price": 28.50,
            "price_history": [18.20, 19.80, 20.40, 24.60, 28.50],
            "volume": 120_000_000,
            "avg_volume": 25_000_000,
            "sector": "Consumer Discretionary",
            "rsi_14": 82.5,
            "macd": 2.85,
            "macd_signal": 1.10,
            "short_interest_pct": 24.0,
            "net_gamma_exposure": -450_000_000,
            "dark_pool_pct": 28.0,
            "normal_dark_pool_pct": 40.0,
            "zero_dte_call_volume_ratio": 5.0,
            "iv": 1.85,
            "iv_rank": 95,
            "iv_percentile": 98,
            "options_chain": [
                {
                    "strike": 30,
                    "type": "call",
                    "bid": 2.10,
                    "ask": 2.40,
                    "delta": 0.42,
                    "gamma": 0.08,
                    "open_interest": 85000,
                },
                {
                    "strike": 35,
                    "type": "call",
                    "bid": 0.95,
                    "ask": 1.15,
                    "delta": 0.25,
                    "gamma": 0.06,
                    "open_interest": 62000,
                },
                {
                    "strike": 25,
                    "type": "put",
                    "bid": 1.80,
                    "ask": 2.05,
                    "delta": -0.38,
                    "gamma": 0.07,
                    "open_interest": 15000,
                },
            ],
        },
        question=(
            "GME shows classic gamma squeeze indicators: short gamma dealers, "
            "declining dark pool %, and surging 0DTE call volume. Explain the "
            "feedback loop between dealer hedging and price, identify the key "
            "strike levels where gamma is concentrated, and describe how "
            "this setup could unwind."
        ),
    ),
    ScenarioResult(
        situation=(
            "TLT (20+ Year Treasury ETF) is at $92.80 amid rising rate "
            "volatility. The MOVE index (bond vol) is at 125, elevated vs its "
            "1-year average of 95. The 2s10s yield curve spread is -0.45% "
            "(inverted). Fed funds futures imply a 68% probability of a 25bp "
            "cut at the next meeting. TIPS 10-year breakeven inflation is "
            "at 2.35%. Credit spreads (HY OAS) have widened to 420bp from "
            "350bp a month ago."
        ),
        market_data={
            "symbol": "TLT",
            "current_price": 92.80,
            "price_history": [95.40, 94.60, 93.80, 93.10, 92.80],
            "volume": 32_000_000,
            "avg_volume": 25_000_000,
            "sector": "Fixed Income",
            "rsi_14": 35.8,
            "macd": -0.65,
            "macd_signal": -0.40,
            "move_index": 125,
            "move_index_avg_1y": 95,
            "yield_curve_2s10s": -0.45,
            "fed_funds_implied_cut_prob": 0.68,
            "tips_10y_breakeven": 2.35,
            "credit_spread_hy": 420,
            "credit_spread_hy_prior": 350,
            "dxy_level": 104.2,
        },
        question=(
            "The MOVE index at 125 is well above its 1-year average. Given "
            "the inverted yield curve (-45bp) and 68% implied probability of "
            "a rate cut, explain how you would use these fixed income signals "
            "to inform an equity volatility position. What does the widening "
            "HY credit spread tell you about risk appetite?"
        ),
    ),
    ScenarioResult(
        situation=(
            "SPY is at $441.30 on September 14th, five days before September "
            "monthly options expiration (OpEx). Historically, September is the "
            "weakest month for equities with an average return of -1.0%. The "
            "week following September OpEx has seen negative returns in 7 of "
            "the last 10 years. VIX is at 18.5 with the September VIX futures "
            "at 19.2 (contango). Quad witching is next Friday."
        ),
        market_data={
            "symbol": "SPY",
            "current_price": 441.30,
            "price_history": [448.20, 446.50, 444.80, 442.60, 441.30],
            "volume": 75_000_000,
            "avg_volume": 70_000_000,
            "sector": "Index",
            "rsi_14": 42.1,
            "macd": -1.15,
            "macd_signal": -0.70,
            "vix": 18.5,
            "vix_futures_front": 19.2,
            "september_avg_return": -1.0,
            "opex_week_negative_pct": 70.0,
            "days_to_opex": 5,
            "quad_witching": True,
            "iv": 0.185,
            "iv_rank": 40,
        },
        question=(
            "Given that September is historically the weakest month and quad "
            "witching OpEx is 5 days away, how would you position for the "
            "expected seasonal weakness? Consider the VIX term structure, "
            "the historical OpEx week pattern, and how dealer positioning "
            "typically shifts around quad witching."
        ),
    ),
    ScenarioResult(
        situation=(
            "AAPL is at $192.40 with a P/E of 31.2 and FCF yield of 3.4%. "
            "The gold/copper ratio has risen 8% in the past month, signaling "
            "risk-off sentiment. Bitcoin correlation with AAPL has shifted from "
            "0.15 to 0.52 over 30 days, suggesting a risk-on/risk-off regime "
            "shift. Satellite data shows iPhone production activity up 12% "
            "QoQ. Short interest is at 0.8% of float, near all-time lows."
        ),
        market_data={
            "symbol": "AAPL",
            "current_price": 192.40,
            "price_history": [188.50, 190.20, 191.80, 193.10, 192.40],
            "volume": 55_000_000,
            "avg_volume": 58_000_000,
            "sector": "Technology",
            "rsi_14": 55.8,
            "macd": 0.72,
            "macd_signal": 0.55,
            "p_e_ratio": 31.2,
            "fcf_yield": 3.4,
            "gold_copper_ratio": 5.8,
            "gold_copper_ratio_chg_30d": 8.0,
            "btc_correlation_30d": 0.52,
            "btc_correlation_30d_prior": 0.15,
            "satellite_production_qoq": 12.0,
            "short_interest_pct": 0.8,
            "iv": 0.24,
            "iv_rank": 30,
        },
        question=(
            "The gold/copper ratio is rising (risk-off) but satellite data "
            "shows strong iPhone production (bullish fundamental). BTC-AAPL "
            "correlation has spiked to 0.52. How do you synthesize these "
            "conflicting cross-asset signals to form a view on AAPL? Which "
            "signal do you weight most heavily and why?"
        ),
    ),
]


class LessonContext(BaseModel):
    """Context from the lesson chunk the student just completed."""

    chunk_title: str
    learning_goal: str
    key_takeaway: str


class ScenarioGenerator:
    """Generates trading scenarios via LLM calls through OpenRouter."""

    async def generate(
        self, params: ScenarioParams, rag_context: str | None = None
    ) -> ScenarioResult:
        """Generate a trading scenario from the given parameters.

        Calls the OpenRouter API. Falls back to a hardcoded scenario
        if the API call fails for any reason.

        Args:
            params: Scenario generation parameters.
            rag_context: Optional RAG context for grounding in CapMan concepts.
        """
        try:
            return await self._call_llm(params, rag_context=rag_context)
        except Exception:
            logger.exception("LLM call failed, returning fallback scenario")
            return self._get_fallback(params)

    async def generate_lesson(
        self, lesson: LessonContext, rag_context: str | None = None
    ) -> ScenarioResult:
        """Generate a scenario aligned with the lesson the student just completed.

        Ensures ticker, price_history, and market_data so the UI can show charts.

        Args:
            lesson: Context from the lesson chunk.
            rag_context: Optional RAG context for grounding in CapMan concepts.
        """
        try:
            return await self._call_llm_lesson(lesson, rag_context=rag_context)
        except Exception:
            logger.exception("Lesson scenario LLM failed, returning fallback")
            return FALLBACK_SCENARIOS[0]  # AAPL with chart-ready data

    async def _call_llm(
        self, params: ScenarioParams, rag_context: str | None = None
    ) -> ScenarioResult:
        """Call OpenRouter chat completions API."""
        objective = LearningObjective(params.skill_target)
        skill_description = OBJECTIVE_DESCRIPTIONS[objective]
        skill_addendum = SKILL_ADDENDA.get(params.skill_target, "")

        user_prompt = SCENARIO_TEMPLATE.format(
            skill_target=params.skill_target,
            skill_description=skill_description,
            complexity=params.complexity,
            market_regime=params.market_regime,
            instrument_type=params.instrument_type,
            skill_addendum=skill_addendum,
        )

        system_content = SYSTEM_PROMPT
        if rag_context:
            system_content = (
                f"Use the following reference material:\n{rag_context}\n\n"
                + system_content
            )

        payload: dict[str, Any] = {
            "model": settings.openrouter_model,
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }

        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
        }

        client = _get_http_client()
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

    async def _call_llm_lesson(
        self, lesson: LessonContext, rag_context: str | None = None
    ) -> ScenarioResult:
        """Call OpenRouter with lesson-aligned prompt; response must have ticker and chart data."""
        user_prompt = LESSON_SCENARIO_TEMPLATE.format(
            chunk_title=lesson.chunk_title,
            learning_goal=lesson.learning_goal,
            key_takeaway=lesson.key_takeaway,
        )
        system_content = LESSON_SCENARIO_SYSTEM_PROMPT
        if rag_context:
            system_content = (
                f"Use the following reference material:\n{rag_context}\n\n"
                + system_content
            )
        payload: dict[str, Any] = {
            "model": settings.openrouter_model,
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }
        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
        }
        client = _get_http_client()
        response = await client.post(
            f"{settings.OPENROUTER_BASE_URL}/chat/completions",
            json=payload,
            headers=headers,
        )
        response.raise_for_status()
        data = response.json()
        content: str = data["choices"][0]["message"]["content"]
        parsed: dict[str, Any] = json.loads(content)
        mc: LessonMultipleChoice | None = None
        if "multiple_choice" in parsed:
            raw = parsed["multiple_choice"]
            if isinstance(raw, dict) and "options" in raw and "correct_index" in raw:
                opts = raw["options"] if isinstance(raw["options"], list) else []
                idx = int(raw["correct_index"]) if isinstance(raw["correct_index"], (int, float)) else 0
                if opts and 0 <= idx < len(opts):
                    mc = LessonMultipleChoice(options=opts, correct_index=idx)
        return ScenarioResult(
            situation=parsed["situation"],
            market_data=parsed["market_data"],
            question=parsed["question"],
            multiple_choice=mc,
        )

    def _get_fallback(self, params: ScenarioParams) -> ScenarioResult:
        """Return a hardcoded fallback scenario based on complexity."""
        idx = (params.complexity - 1) % len(FALLBACK_SCENARIOS)
        return FALLBACK_SCENARIOS[idx]

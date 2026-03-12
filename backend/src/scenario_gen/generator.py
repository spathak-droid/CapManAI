"""LLM-based trading scenario generation.

Uses OpenRouter to generate realistic trading scenarios
with market data, situational context, and assessment questions.
"""


class ScenarioGenerator:
    """Generates trading scenarios via LLM calls through OpenRouter."""

    async def generate(
        self,
        skill_target: str,
        complexity: int,
        market_regime: str | None = None,
        instrument_type: str | None = None,
    ) -> dict:
        """Generate a trading scenario targeting a specific skill.

        Args:
            skill_target: The learning objective to assess.
            complexity: Difficulty level (1-5).
            market_regime: Optional market condition (bull/bear/sideways/volatile).
            instrument_type: Optional instrument (equity/option/future).

        Returns:
            Generated scenario data including situation, market_data, and question.
        """
        raise NotImplementedError

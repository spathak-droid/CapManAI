"""Prompt templates for LLM scenario generation.

Contains system prompts, scenario generation templates,
and output format specifications for OpenRouter calls.
"""

SYSTEM_PROMPT = """You are an expert trading instructor and market analyst \
creating realistic trading scenarios for educational assessment. You produce \
scenarios with specific, concrete numbers (prices, volumes, dates, indicators) \
that test specific trading skills. You always respond with valid JSON only — \
no markdown, no code fences, no commentary outside the JSON object."""

SCENARIO_TEMPLATE = """Generate a trading scenario with the following parameters:
- Skill Target: {skill_target}
- Skill Description: {skill_description}
- Complexity Level: {complexity}/5 (1=beginner, 5=expert)
- Market Regime: {market_regime}
- Instrument Type: {instrument_type}

Requirements:
- The situation must describe a realistic, specific market moment with concrete \
details (company/ticker, recent news or catalysts, timeframe).
- market_data must include: symbol, current_price, price_history (list of last 5 \
daily closes), volume, avg_volume, sector, and relevant technical indicators \
(at minimum rsi_14, macd, macd_signal).
- If instrument_type is "option" or "both", also include in market_data: iv, \
iv_rank, iv_percentile, and options_chain (a list of 3-5 representative \
contracts with strike, type, bid, ask, delta, gamma, open_interest).
- The question must directly test the skill_target and be specific enough that \
a concrete, actionable answer is expected.
- Complexity 1-2: straightforward setup, clear signals. \
Complexity 3: mixed signals requiring judgment. \
Complexity 4-5: ambiguous data, multiple factors, edge cases.

Respond with ONLY a JSON object in this exact structure:
{{"situation": "<detailed scenario text>", \
"market_data": {{"symbol": "...", "current_price": ..., \
"price_history": [...], "volume": ..., "avg_volume": ..., \
"sector": "...", "rsi_14": ..., "macd": ..., "macd_signal": ..., \
...additional fields as appropriate...}}, \
"question": "<specific assessment question>"}}"""

PROBE_TEMPLATE = """Given the following trading scenario and student response,
generate {num_probes} follow-up probing questions to assess depth of understanding.

Scenario: {scenario}
Student Response: {response}

Generate questions that:
1. Test understanding beyond surface-level answers
2. Explore edge cases and risk considerations
3. Assess ability to adapt to changing conditions

Respond with ONLY a JSON object: {{"probes": ["question1", "question2", ...]}}"""

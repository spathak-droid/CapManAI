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

# Lesson-aligned scenario: reinforces what the student just learned; must show tickers and charts
LESSON_SCENARIO_SYSTEM_PROMPT = """You are an expert trading instructor creating a short scenario that reinforces a specific lesson the student just completed. You always respond with valid JSON only — no markdown, no code fences, no commentary outside the JSON object. The scenario must include real ticker symbol(s) and full market_data so the learning app can display a price chart and stat pills."""

LESSON_SCENARIO_TEMPLATE = """The student just completed this lesson:

Lesson title: {chunk_title}
What they learned: {learning_goal}
Key takeaway: {key_takeaway}

Generate a single scenario that asks the student to APPLY these exact concepts. Requirements:
- Use one real ticker symbol (e.g. AAPL, MSFT, SPY). Name it in the situation and in market_data.
- situation: 2–4 sentences describing a concrete moment (e.g. "AAPL is at $185 after earnings; buyers have been lifting offers.") so the student can relate price movement to the lesson (tickers, who is in control, etc.).
- market_data MUST include: symbol (string), current_price (number), price_history (list of 5–10 daily close prices, numbers only), volume, avg_volume, sector. Include at least rsi_14 so the UI can show stats. This data will be shown as a chart and stat pills.
- question: One clear multiple-choice question that directly tests the lesson (e.g. "Who is in control in this scenario?" or "What does the ticker symbol tell you?").
- multiple_choice: Provide exactly 4 options (short phrases), one correct. Use "correct_index": 0 for the first option, 1 for the second, etc.

Respond with ONLY a JSON object in this exact structure:
{{"situation": "<2-4 sentence scenario with ticker and context>", "market_data": {{"symbol": "<ticker>", "current_price": <number>, "price_history": [<5-10 numbers>], "volume": <number>, "avg_volume": <number>, "sector": "<string>", "rsi_14": <number>}}, "question": "<one MC question>", "multiple_choice": {{"options": ["<option A>", "<option B>", "<option C>", "<option D>"], "correct_index": <0-3>}}}}"""

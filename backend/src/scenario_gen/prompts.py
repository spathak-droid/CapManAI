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
- For volatility-focused skills, also include: hv_20, hv_60, parkinson_vol, iv_skew_25d, \
term_structure_slope (front_month_iv minus back_month_iv), vvix.
- For Greeks-focused skills, also include: net_gamma_exposure (aggregate dealer GEX in shares), \
vanna, charm.
- For flow-focused skills, also include: put_call_ratio, dark_pool_pct, sweep_volume_ratio.
- For macro-focused skills, also include: yield_curve_2s10s, dxy_level, credit_spread_hy.
- For sentiment-focused skills, also include: fear_greed_index, aaii_bull_pct, margin_debt_yoy_chg.
- The question must directly test the skill_target and be specific enough that \
a concrete, actionable answer is expected.
- Complexity 1-2: straightforward setup, clear signals. \
Complexity 3: mixed signals requiring judgment. \
Complexity 4-5: ambiguous data, multiple factors, edge cases.
{skill_addendum}

Respond with ONLY a JSON object in this exact structure:
{{"situation": "<detailed scenario text>", \
"market_data": {{"symbol": "...", "current_price": ..., \
"price_history": [...], "volume": ..., "avg_volume": ..., \
"sector": "...", "rsi_14": ..., "macd": ..., "macd_signal": ..., \
...additional fields as appropriate...}}, \
"question": "<specific assessment question>"}}"""

SKILL_ADDENDA: dict[str, str] = {
    "price_action": "Focus on RSI divergences, MACD crossovers, Bollinger Band squeezes, ATR-based stops, volume profile, Fibonacci retracements, gap analysis, and pivot point levels.",
    "options_chain": "Emphasize bid-ask spread analysis, open interest changes, volume-to-OI ratio, dark pool prints, put/call skew, unusual sweep activity, and market maker hedging implications.",
    "strike_select": "Test delta-based strike selection, gamma scalping considerations, probability of profit calculations, and the relationship between strike distance and risk/reward.",
    "risk_mgmt": "Include tail risk metrics: skew index interpretation, portfolio kurtosis, Value at Risk (VaR), Conditional VaR (CVaR), OTM put premium as insurance cost, stress test scenarios, and max drawdown analysis.",
    "position_size": "Test Kelly Criterion application, Sharpe and Sortino ratio awareness, max drawdown constraints, portfolio concentration limits, margin utilization, and volatility-scaled sizing.",
    "regime_id": "Include yield curve (2s10s) interpretation, CPI/PCE impact on vol, DXY correlation, credit spread widening signals, real rate shifts, and PMI regime classification.",
    "vol_assess": "Test IV rank vs IV percentile distinction, 25-delta skew interpretation, term structure (contango vs backwardation), IV-HV gap trading, straddle pricing, VVIX as vol-of-vol, and smile dynamics.",
    "trade_mgmt": "Include earnings IV crush quantification, economic calendar event sizing, ex-dividend risk for options, FDA binary events, index rebalancing flows, and corporate buyback blackout windows.",
    "realized_vol": "Test close-to-close vs Parkinson vs Garman-Klass vs Yang-Zhang estimator selection, volatility clustering identification, intraday volatility profiles, and HV cone interpretation.",
    "adv_greeks": "Focus on GEX flip level calculation, Vanna impact on skew, Charm (delta decay), Vomma convexity, Color (gamma decay), Speed (gamma-of-gamma), and Zomma (gamma sensitivity to vol).",
    "sentiment": "Test AAII bull/bear ratio interpretation, CNN Fear & Greed decomposition, social media sentiment divergence, margin debt as contrarian signal, ETF fund flow analysis, and insider buying clusters.",
    "correlation": "Include implied vs realized correlation, sector rotation signals, dispersion trade construction, vol surface arbitrage, pairs trading z-score, safe-haven correlation breakdown, and equity risk premium shifts.",
    "structural": "Test gamma squeeze identification (short gamma + rising delta), 0DTE gamma amplification, max-pain pinning mechanics, variance swap fair value, dark pool ratio signals, flash crash liquidity, and auction imbalance reading.",
    "rates_fi": "Include MOVE index interpretation, Fed funds futures implied rate path, TIPS breakeven inflation, CDS spread widening, MBS prepayment impact on vol, and reverse repo facility as liquidity gauge.",
    "seasonality": "Test monthly return patterns (January effect, September weakness), OpEx/quad witching volatility, tax-loss harvesting flows, VIX futures expiration mechanics, holiday vol compression, and intraday mean reversion windows.",
    "cross_asset": "Include P/E and FCF yield for equity vol context, gold/copper ratio as risk gauge, BTC correlation regime shifts, sanctions and geopolitical event vol, satellite/alt-data signals, and ESG-driven flow changes.",
}

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

"""Learning objectives taxonomy.

Defines the 16 core learning objectives that CapMan AI
assesses through trading scenarios.
"""

from enum import Enum


class LearningObjective(Enum):
    """The 16 core learning objectives for trading skill assessment."""

    PRICE_ACTION = "price_action"
    OPTIONS_CHAIN = "options_chain"
    STRIKE_SELECT = "strike_select"
    RISK_MGMT = "risk_mgmt"
    POSITION_SIZE = "position_size"
    REGIME_ID = "regime_id"
    VOL_ASSESS = "vol_assess"
    TRADE_MGMT = "trade_mgmt"
    REALIZED_VOL = "realized_vol"
    ADV_GREEKS = "adv_greeks"
    SENTIMENT = "sentiment"
    CORRELATION = "correlation"
    STRUCTURAL = "structural"
    RATES_FI = "rates_fi"
    SEASONALITY = "seasonality"
    CROSS_ASSET = "cross_asset"


OBJECTIVE_DESCRIPTIONS: dict[LearningObjective, str] = {
    LearningObjective.PRICE_ACTION: (
        "Reading and interpreting price action patterns, "
        "candlestick formations, and support/resistance levels."
    ),
    LearningObjective.OPTIONS_CHAIN: (
        "Analyzing options chains including open interest, "
        "bid-ask spreads, and implied volatility across strikes."
    ),
    LearningObjective.STRIKE_SELECT: (
        "Selecting appropriate strike prices based on market outlook, "
        "risk tolerance, and probability of profit."
    ),
    LearningObjective.RISK_MGMT: (
        "Implementing risk management through stop-losses, "
        "hedging strategies, and maximum loss limits."
    ),
    LearningObjective.POSITION_SIZE: (
        "Calculating appropriate position sizes based on account size, "
        "risk per trade, and volatility."
    ),
    LearningObjective.REGIME_ID: (
        "Identifying current market regime (trending, ranging, volatile) "
        "and adapting strategy accordingly."
    ),
    LearningObjective.VOL_ASSESS: (
        "Assessing implied and historical volatility to inform "
        "strategy selection and position management."
    ),
    LearningObjective.TRADE_MGMT: (
        "Managing open positions including scaling, adjustments, "
        "profit targets, and exit timing."
    ),
    LearningObjective.REALIZED_VOL: (
        "Measuring and interpreting realized volatility using estimators like "
        "Parkinson, Garman-Klass, and Yang-Zhang, identifying volatility clusters "
        "and comparing historical volatility across timeframes."
    ),
    LearningObjective.ADV_GREEKS: (
        "Analyzing second and third-order Greeks including Vanna, Charm, Voma, "
        "Speed, and Color, and understanding gamma exposure (GEX) impact on "
        "market microstructure and dealer hedging flows."
    ),
    LearningObjective.SENTIMENT: (
        "Interpreting sentiment indicators like AAII survey, Fear & Greed index, "
        "margin debt levels, fund flows, and insider activity to gauge crowd "
        "psychology and identify contrarian opportunities."
    ),
    LearningObjective.CORRELATION: (
        "Analyzing cross-asset correlations, sector rotation patterns, implied "
        "correlation, dispersion trading opportunities, and relative value "
        "between correlated instruments."
    ),
    LearningObjective.STRUCTURAL: (
        "Understanding exotic market structures including gamma squeezes, 0DTE "
        "mechanics, options pinning, variance swaps, and market microstructure "
        "dynamics like dark pool activity and auction processes."
    ),
    LearningObjective.RATES_FI: (
        "Reading fixed income and rates signals including the MOVE index, Fed "
        "funds futures, TIPS breakevens, credit default swaps, and yield curve "
        "dynamics to inform equity volatility positioning."
    ),
    LearningObjective.SEASONALITY: (
        "Identifying seasonal and calendar-driven patterns including monthly "
        "return tendencies, options expiration effects, quad witching, tax-loss "
        "selling, VIX settlement mechanics, and holiday volatility compression."
    ),
    LearningObjective.CROSS_ASSET: (
        "Synthesizing cross-asset signals from fundamentals (P/E, FCF yield), "
        "commodities (gold/copper ratio), crypto correlations, geopolitical risk, "
        "alternative data (satellite, ESG), and short interest dynamics."
    ),
}

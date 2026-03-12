"""Learning objectives taxonomy.

Defines the 8 core learning objectives that CapMan AI
assesses through trading scenarios.
"""

from enum import Enum


class LearningObjective(Enum):
    """The 8 core learning objectives for trading skill assessment."""

    PRICE_ACTION = "price_action"
    OPTIONS_CHAIN = "options_chain"
    STRIKE_SELECT = "strike_select"
    RISK_MGMT = "risk_mgmt"
    POSITION_SIZE = "position_size"
    REGIME_ID = "regime_id"
    VOL_ASSESS = "vol_assess"
    TRADE_MGMT = "trade_mgmt"


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
}

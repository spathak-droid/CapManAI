"""Grading dimensions and scoring rubric.

Defines the four dimensions used to evaluate student trading responses,
each with a description and weight contributing to the overall score.
"""

from dataclasses import dataclass
from enum import Enum


@dataclass(frozen=True)
class DimensionSpec:
    """Specification for a grading dimension."""

    name: str
    description: str
    weight: float


class GradingDimension(Enum):
    """The four grading dimensions for trading scenario responses."""

    TECHNICAL_ACCURACY = DimensionSpec(
        name="Technical Accuracy",
        description=(
            "Correctness of market analysis, indicator interpretation, "
            "and technical concepts applied to the scenario."
        ),
        weight=0.30,
    )
    RISK_AWARENESS = DimensionSpec(
        name="Risk Awareness",
        description=(
            "Identification and mitigation of risks including position sizing, "
            "stop-loss placement, and worst-case scenario consideration."
        ),
        weight=0.25,
    )
    STRATEGY_FIT = DimensionSpec(
        name="Strategy Fit",
        description=(
            "Appropriateness of the chosen strategy for the given market regime, "
            "instrument type, and situational context."
        ),
        weight=0.25,
    )
    REASONING_CLARITY = DimensionSpec(
        name="Reasoning Clarity",
        description=(
            "Quality of explanation, logical flow of argument, "
            "and ability to articulate the decision-making process."
        ),
        weight=0.20,
    )

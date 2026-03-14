"""Probing and grading logic for student responses.

Implements the two-phase assessment:
1. Probing: Generate follow-up questions to test depth of understanding
2. Grading: Score responses across multiple dimensions using rubric
"""

import json
import logging

import httpx

from src.api.schemas import GradeResult, ProbeExchange
from src.core.config import settings
from src.grading.rubric import GradingDimension

logger = logging.getLogger(__name__)

PROBE_SYSTEM_PROMPT = (
    "You are an expert trading instructor assessing a student's understanding "
    "of financial markets and trading strategies. Your role is to generate "
    "targeted follow-up questions that probe the depth of the student's "
    "knowledge and reasoning."
)

PROBE_USER_TEMPLATE = """Given the following trading scenario and student response, \
generate exactly {num_probes} follow-up probing questions.

## Scenario
{scenario_text}

## Student Response
{student_response}

## Instructions
Generate questions that:
1. Test understanding beyond surface-level answers
2. Explore edge cases and risk considerations
3. Assess ability to adapt to changing market conditions
4. Challenge assumptions made in the response

Return ONLY a JSON array of strings, each being one question. Example:
["Question 1?", "Question 2?"]"""

GRADING_SYSTEM_PROMPT = (
    "You are an expert trading instructor grading a student's response to a "
    "trading scenario. You evaluate responses across four dimensions, each "
    "scored from 1 (poor) to 5 (excellent). Be fair, constructive, and specific."
)

GRADING_USER_TEMPLATE = """Grade the following student exchange on a trading scenario.

## Scenario
{scenario_text}

## Student's Initial Response
{student_response}

## Probe Question & Answer Exchanges
{probe_section}

## Grading Rubric
Score each dimension from 1.0 to 5.0 (can use decimals like 3.5):

1. **Technical Accuracy** (weight {w_ta}): {d_ta}
2. **Risk Awareness** (weight {w_ra}): {d_ra}
3. **Strategy Fit** (weight {w_sf}): {d_sf}
4. **Reasoning Clarity** (weight {w_rc}): {d_rc}

## Instructions
Return ONLY a JSON object with these exact keys:
{{
  "technical_accuracy": <float 1-5>,
  "risk_awareness": <float 1-5>,
  "strategy_fit": <float 1-5>,
  "reasoning_clarity": <float 1-5>,
  "feedback_text": "<constructive feedback mentioning strengths and areas for improvement>"
}}"""


def _build_probe_section(exchanges: list[ProbeExchange]) -> str:
    """Format probe exchanges for the grading prompt."""
    if not exchanges:
        return "No probe exchanges available."
    parts: list[str] = []
    for i, ex in enumerate(exchanges, 1):
        parts.append(f"Q{i}: {ex.question}\nA{i}: {ex.answer}")
    return "\n\n".join(parts)


def _compute_overall(
    ta: float, ra: float, sf: float, rc: float
) -> float:
    """Compute the weighted overall score from dimension scores."""
    w_ta = GradingDimension.TECHNICAL_ACCURACY.value.weight
    w_ra = GradingDimension.RISK_AWARENESS.value.weight
    w_sf = GradingDimension.STRATEGY_FIT.value.weight
    w_rc = GradingDimension.REASONING_CLARITY.value.weight
    return round(ta * w_ta + ra * w_ra + sf * w_sf + rc * w_rc, 2)


def _fallback_grade() -> GradeResult:
    """Return a neutral fallback grade when the LLM is unavailable."""
    return GradeResult(
        technical_accuracy=3.0,
        risk_awareness=3.0,
        strategy_fit=3.0,
        reasoning_clarity=3.0,
        overall_score=3.0,
        feedback_text=(
            "Grading is temporarily unavailable. A default score has been "
            "assigned. Please try again later for a detailed evaluation."
        ),
    )


async def _call_openrouter(
    system_prompt: str, user_prompt: str
) -> str:
    """Make a chat completion call to OpenRouter and return the content."""
    api_key = settings.openrouter_api_key
    if not api_key:
        logger.error(
            "OPENROUTER_API_KEY (or OPEN_ROUTER_API_KEY) is not set in backend .env"
        )
        raise ValueError(
            "OpenRouter API key not set. Add OPENROUTER_API_KEY to backend/.env and restart."
        )
    url = f"{settings.OPENROUTER_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.openrouter_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.4,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]  # type: ignore[no-any-return]


class ProbingAgent:
    """Generates probing follow-up questions for student responses."""

    async def generate_probes(
        self,
        scenario_text: str,
        student_response: str,
        num_probes: int = 2,
    ) -> list[str]:
        """Generate probing questions based on the student's response.

        Args:
            scenario_text: The original scenario description.
            student_response: The student's initial answer.
            num_probes: Number of follow-up questions to generate.

        Returns:
            List of probing question strings.
        """
        user_prompt = PROBE_USER_TEMPLATE.format(
            num_probes=num_probes,
            scenario_text=scenario_text,
            student_response=student_response,
        )
        try:
            content = await _call_openrouter(PROBE_SYSTEM_PROMPT, user_prompt)
            questions: list[str] = json.loads(content)
            # Ensure we return the requested number of probes
            return questions[:num_probes]
        except Exception:
            logger.exception("Failed to generate probes from LLM")
            return [
                "Can you elaborate on the risk factors you considered?",
                "How would your approach change if market conditions shifted?",
            ][:num_probes]


class GradingAgent:
    """Grades student responses across rubric dimensions."""

    async def grade(
        self,
        scenario_text: str,
        student_response: str,
        probe_exchanges: list[ProbeExchange],
        rag_context: str | None = None,
    ) -> GradeResult:
        """Grade a student's complete response including probe answers.

        Args:
            scenario_text: The original scenario description.
            student_response: The student's initial answer.
            probe_exchanges: List of ProbeExchange from probing phase.
            rag_context: Optional RAG context for domain-specific accuracy.

        Returns:
            GradeResult with dimension scores, overall score, and feedback.
        """
        ta_dim = GradingDimension.TECHNICAL_ACCURACY.value
        ra_dim = GradingDimension.RISK_AWARENESS.value
        sf_dim = GradingDimension.STRATEGY_FIT.value
        rc_dim = GradingDimension.REASONING_CLARITY.value

        user_prompt = GRADING_USER_TEMPLATE.format(
            scenario_text=scenario_text,
            student_response=student_response,
            probe_section=_build_probe_section(probe_exchanges),
            w_ta=ta_dim.weight,
            d_ta=ta_dim.description,
            w_ra=ra_dim.weight,
            d_ra=ra_dim.description,
            w_sf=sf_dim.weight,
            d_sf=sf_dim.description,
            w_rc=rc_dim.weight,
            d_rc=rc_dim.description,
        )
        try:
            system_prompt = GRADING_SYSTEM_PROMPT
            if rag_context:
                system_prompt = (
                    f"Use the following reference material:\n{rag_context}\n\n"
                    + system_prompt
                )
            content = await _call_openrouter(system_prompt, user_prompt)
            raw = json.loads(content)
            ta = float(raw["technical_accuracy"])
            ra = float(raw["risk_awareness"])
            sf = float(raw["strategy_fit"])
            rc = float(raw["reasoning_clarity"])
            overall = _compute_overall(ta, ra, sf, rc)
            return GradeResult(
                technical_accuracy=ta,
                risk_awareness=ra,
                strategy_fit=sf,
                reasoning_clarity=rc,
                overall_score=overall,
                feedback_text=str(raw["feedback_text"]),
            )
        except ValueError as e:
            if "API key" in str(e):
                logger.error("Grading unavailable: %s", e)
                return GradeResult(
                    technical_accuracy=3.0,
                    risk_awareness=3.0,
                    strategy_fit=3.0,
                    reasoning_clarity=3.0,
                    overall_score=3.0,
                    feedback_text=(
                        "Grading is unavailable: OpenRouter API key is not set. "
                        "Add OPENROUTER_API_KEY (or OPEN_ROUTER_API_KEY) to backend/.env and restart the backend."
                    ),
                )
            raise
        except Exception as e:
            logger.exception("Failed to grade via LLM: %s", e)
            return _fallback_grade()

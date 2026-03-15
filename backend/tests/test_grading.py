"""Tests for the grading agent, probing agent, and grade endpoints."""

import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.api.schemas import GradeResult, ProbeExchange
from src.grading.agent import (
    GradingAgent,
    ProbingAgent,
    _compute_overall,
    _fallback_grade,
)


# ---------------------------------------------------------------------------
# Unit tests for GradeResult / weighted score calculation
# ---------------------------------------------------------------------------


class TestWeightedScore:
    """Test the weighted overall score computation."""

    def test_compute_overall_all_fives(self) -> None:
        overall = _compute_overall(5.0, 5.0, 5.0, 5.0)
        assert overall == 5.0

    def test_compute_overall_all_ones(self) -> None:
        overall = _compute_overall(1.0, 1.0, 1.0, 1.0)
        assert overall == 1.0

    def test_compute_overall_mixed(self) -> None:
        # 4*0.30 + 3*0.25 + 2*0.25 + 5*0.20 = 1.2+0.75+0.5+1.0 = 3.45
        overall = _compute_overall(4.0, 3.0, 2.0, 5.0)
        assert overall == 3.45

    def test_compute_overall_weights_sum_to_one(self) -> None:
        from src.grading.rubric import GradingDimension

        total = sum(d.value.weight for d in GradingDimension)
        assert abs(total - 1.0) < 1e-9


class TestGradeResultModel:
    """Test the GradeResult Pydantic model."""

    def test_valid_grade_result(self) -> None:
        result = GradeResult(
            technical_accuracy=4.0,
            risk_awareness=3.5,
            strategy_fit=4.5,
            reasoning_clarity=3.0,
            overall_score=3.85,
            feedback_text="Good work.",
        )
        assert result.technical_accuracy == 4.0
        assert result.feedback_text == "Good work."

    def test_grade_result_rejects_out_of_range(self) -> None:
        with pytest.raises(Exception):
            GradeResult(
                technical_accuracy=6.0,
                risk_awareness=3.0,
                strategy_fit=3.0,
                reasoning_clarity=3.0,
                overall_score=3.0,
                feedback_text="Bad",
            )


# ---------------------------------------------------------------------------
# Test fallback grade
# ---------------------------------------------------------------------------


class TestFallbackGrade:
    def test_fallback_returns_neutral_scores(self) -> None:
        fb = _fallback_grade()
        assert fb.technical_accuracy == 3.0
        assert fb.risk_awareness == 3.0
        assert fb.strategy_fit == 3.0
        assert fb.reasoning_clarity == 3.0
        assert fb.overall_score == 3.0
        assert "temporarily unavailable" in fb.feedback_text.lower()


# ---------------------------------------------------------------------------
# ProbingAgent tests (mock LLM)
# ---------------------------------------------------------------------------


class TestProbingAgent:
    @pytest.mark.asyncio
    async def test_generate_probes_returns_correct_count(self) -> None:
        mock_response = json.dumps([
            "What risk factors did you consider?",
            "How would volatility affect your position?",
            "What is your exit strategy?",
        ])
        agent = ProbingAgent()
        with patch(
            "src.grading.agent._call_openrouter",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            probes = await agent.generate_probes(
                scenario_text="Bull market scenario",
                student_response="I would buy calls",
                num_probes=2,
            )
            assert len(probes) == 2
            assert all(isinstance(q, str) for q in probes)

    @pytest.mark.asyncio
    async def test_generate_probes_fallback_on_error(self) -> None:
        agent = ProbingAgent()
        with patch(
            "src.grading.agent._call_openrouter",
            new_callable=AsyncMock,
            side_effect=Exception("API down"),
        ):
            probes = await agent.generate_probes(
                scenario_text="Scenario",
                student_response="Response",
                num_probes=2,
            )
            assert len(probes) == 2
            assert all(isinstance(q, str) for q in probes)


# ---------------------------------------------------------------------------
# GradingAgent tests (mock LLM)
# ---------------------------------------------------------------------------


class TestGradingAgent:
    @pytest.mark.asyncio
    async def test_grade_returns_grade_result(self) -> None:
        mock_response = json.dumps({
            "technical_accuracy": 4.0,
            "risk_awareness": 3.5,
            "strategy_fit": 4.0,
            "reasoning_clarity": 3.0,
            "feedback_text": "Solid analysis with room for improvement on risk.",
        })
        agent = GradingAgent()
        with patch(
            "src.grading.agent._call_openrouter",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await agent.grade(
                scenario_text="Bear market scenario",
                student_response="I would hedge with puts",
                probe_exchanges=[
                    ProbeExchange(
                        question="What strike price?",
                        answer="ATM puts",
                    ),
                ],
            )
            assert isinstance(result, GradeResult)
            assert result.technical_accuracy == 4.0
            expected_overall = _compute_overall(4.0, 3.5, 4.0, 3.0)
            assert result.overall_score == expected_overall

    @pytest.mark.asyncio
    async def test_grade_fallback_on_api_error(self) -> None:
        agent = GradingAgent()
        with patch(
            "src.grading.agent._call_openrouter",
            new_callable=AsyncMock,
            side_effect=Exception("API unavailable"),
        ):
            result = await agent.grade(
                scenario_text="Scenario",
                student_response="Response",
                probe_exchanges=[],
            )
            assert result.overall_score == 3.0
            assert "temporarily unavailable" in result.feedback_text.lower()


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------


class TestRespondEndpoint:
    def test_respond_returns_response_id(self, client: TestClient) -> None:
        resp = client.post(
            "/api/scenarios/respond",
            json={
                "scenario_id": 5,
                "user_id": 42,
                "answer_text": "Buy calls on SPY",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "response_id" in data
        assert isinstance(data["response_id"], int)
        assert data["status"] == "received"


class TestProbeEndpoint:
    def test_probe_returns_questions(self, client: TestClient) -> None:
        mock_response = json.dumps([
            "What about downside risk?",
            "How would you size this position?",
        ])
        with patch(
            "src.grading.agent._call_openrouter",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            resp = client.post(
                "/api/scenarios/probe",
                json={
                    "scenario_text": "Bull market with high volatility",
                    "student_response": "I would buy calls",
                    "num_probes": 2,
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "questions" in data
            assert len(data["questions"]) == 2


class TestGradeEndpoint:
    def test_grade_returns_proper_structure(self, client: TestClient) -> None:
        mock_response = json.dumps({
            "technical_accuracy": 4.5,
            "risk_awareness": 3.0,
            "strategy_fit": 4.0,
            "reasoning_clarity": 3.5,
            "feedback_text": "Well-reasoned approach.",
        })
        with patch(
            "src.grading.agent._call_openrouter",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            resp = client.post(
                "/api/scenarios/grade",
                json={
                    "response_id": 1,
                    "scenario_text": "Market scenario",
                    "student_response": "My analysis",
                    "probe_exchanges": [
                        {
                            "question": "What about risk?",
                            "answer": "I considered stop losses",
                        }
                    ],
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "technical_accuracy" in data
            assert "risk_awareness" in data
            assert "strategy_fit" in data
            assert "reasoning_clarity" in data
            assert "overall_score" in data
            assert "feedback_text" in data
            assert "xp_earned" in data
            assert isinstance(data["xp_earned"], int)
            assert data["xp_earned"] > 0

    def test_grade_fallback_on_error(self, client: TestClient) -> None:
        with patch(
            "src.grading.agent._call_openrouter",
            new_callable=AsyncMock,
            side_effect=Exception("API down"),
        ):
            resp = client.post(
                "/api/scenarios/grade",
                json={
                    "response_id": 1,
                    "scenario_text": "Scenario",
                    "student_response": "Response",
                    "probe_exchanges": [],
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["overall_score"] == 3.0
            assert "temporarily unavailable" in data["feedback_text"].lower()

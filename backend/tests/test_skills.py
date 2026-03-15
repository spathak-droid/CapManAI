"""Tests for skill score endpoints."""

import json
from collections.abc import Generator
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from src.api.routes import ALL_SKILL_IDS
from src.auth.dependencies import get_current_user
from src.db.database import get_db


@dataclass
class _MockUser:
    id: int = 1
    username: str = "testuser"
    email: str = "test@example.com"
    role: str = "student"
    xp_total: int = 0
    level: int = 1
    firebase_uid: str = "mock_uid"


def _mock_db_no_skills() -> AsyncMock:
    """Return a mock AsyncSession whose execute returns no SkillScore rows."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = []
    mock_result.scalars.return_value = mock_scalars
    mock_session.execute.return_value = mock_result
    return mock_session


@pytest.fixture
def skills_client() -> Generator[TestClient, None, None]:
    """Test client with mocked auth and mocked DB for skills tests."""
    mock_db = _mock_db_no_skills()

    async def override_db():  # type: ignore[no-untyped-def]
        yield mock_db

    app.dependency_overrides[get_current_user] = lambda: _MockUser()
    app.dependency_overrides[get_db] = override_db
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


class TestGetMySkills:
    """Tests for GET /api/skills/me."""

    def test_returns_all_8_skills_when_no_data(
        self, skills_client: TestClient
    ) -> None:
        resp = skills_client.get("/api/skills/me")
        assert resp.status_code == 200
        data = resp.json()
        assert "skills" in data
        skills = data["skills"]
        assert len(skills) == 8
        for skill_id in ALL_SKILL_IDS:
            assert skill_id in skills, f"Missing skill: {skill_id}"
            assert skills[skill_id]["score"] == 0.0
            assert skills[skill_id]["attempts"] == 0

    def test_skill_ids_constant_has_8_entries(self) -> None:
        """Verify the ALL_SKILL_IDS constant has the expected 8 skills."""
        assert len(ALL_SKILL_IDS) == 8
        assert "price_action" in ALL_SKILL_IDS
        assert "risk_mgmt" in ALL_SKILL_IDS
        assert "trade_mgmt" in ALL_SKILL_IDS


class TestGradeAcceptsSkillTarget:
    """Tests that the grade endpoint accepts skill_target in the request body."""

    def test_grade_with_skill_target_field(self, client: TestClient) -> None:
        mock_response = json.dumps({
            "technical_accuracy": 4.0,
            "risk_awareness": 3.5,
            "strategy_fit": 4.0,
            "reasoning_clarity": 3.0,
            "feedback_text": "Good analysis.",
        })
        with (
            patch(
                "src.grading.agent._call_openrouter",
                new_callable=AsyncMock,
                return_value=mock_response,
            ),
            patch(
                "src.api.routes.get_context",
                new_callable=AsyncMock,
                return_value="",
            ),
        ):
            resp = client.post(
                "/api/scenarios/grade",
                json={
                    "response_id": 1,
                    "scenario_text": "Market scenario",
                    "student_response": "My analysis",
                    "probe_exchanges": [],
                    "skill_target": "risk_mgmt",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "xp_earned" in data
            assert data["xp_earned"] > 0

    def test_grade_defaults_skill_target(self, client: TestClient) -> None:
        """skill_target defaults to price_action when not provided."""
        mock_response = json.dumps({
            "technical_accuracy": 3.0,
            "risk_awareness": 3.0,
            "strategy_fit": 3.0,
            "reasoning_clarity": 3.0,
            "feedback_text": "Adequate.",
        })
        with (
            patch(
                "src.grading.agent._call_openrouter",
                new_callable=AsyncMock,
                return_value=mock_response,
            ),
            patch(
                "src.api.routes.get_context",
                new_callable=AsyncMock,
                return_value="",
            ),
        ):
            resp = client.post(
                "/api/scenarios/grade",
                json={
                    "response_id": 1,
                    "scenario_text": "Market scenario",
                    "student_response": "My analysis",
                    "probe_exchanges": [],
                },
            )
            assert resp.status_code == 200

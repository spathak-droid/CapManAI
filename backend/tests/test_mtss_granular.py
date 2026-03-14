"""Tests for granular MTSS features: repository, interventions, and endpoints."""

from collections.abc import AsyncGenerator, Generator
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app
from src.api.schemas import (
    InterventionRecommendation,
    ObjectiveDistribution,
    StudentSkillBreakdown,
)
from src.auth.dependencies import get_current_user
from src.db.database import get_db
from src.mtss.classifier import get_demo_students


@dataclass
class _MockUser:
    id: int = 1
    username: str = "testuser"
    email: str = "test@example.com"
    role: str = "educator"
    xp_total: int = 0
    level: int = 1
    firebase_uid: str = "mock_uid"


def _make_execute_result(rows: list[object] | None = None) -> MagicMock:
    """Build a mock result whose scalars().all() returns rows."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    result.scalars.return_value.all.return_value = rows or []
    return result


async def _mock_get_db() -> AsyncGenerator[AsyncMock, None]:
    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.get = AsyncMock(return_value=None)
    mock_session.add = MagicMock()
    mock_session.execute = AsyncMock(
        side_effect=lambda _query: _make_execute_result()
    )
    mock_session.flush = AsyncMock()
    yield mock_session


@pytest.fixture
def db_client() -> Generator[TestClient, None, None]:
    """Create a test client with mocked auth and DB."""
    app.dependency_overrides[get_current_user] = lambda: _MockUser()
    app.dependency_overrides[get_db] = _mock_get_db
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


class TestGetDemoStudents:
    """Test that demo student fallback data is returned correctly."""

    def test_returns_list(self) -> None:
        students = get_demo_students()
        assert isinstance(students, list)
        assert len(students) == 10

    def test_demo_student_has_skills(self) -> None:
        students = get_demo_students()
        for student in students:
            assert len(student.skill_scores) == 8
            assert all(
                isinstance(v, (int, float))
                for v in student.skill_scores.values()
            )


class TestInterventionLogic:
    """Test the intervention recommendation generation logic."""

    def test_tier_3_intensive_support(self) -> None:
        from src.api.routes import _generate_interventions

        result = _generate_interventions({"risk_mgmt": 25.0})
        assert len(result) == 1
        assert result[0].current_tier == "tier_3"
        assert "Intensive support needed" in result[0].recommendation
        assert len(result[0].suggested_activities) >= 2

    def test_tier_2_targeted_practice(self) -> None:
        from src.api.routes import _generate_interventions

        result = _generate_interventions({"price_action": 55.0})
        assert len(result) == 1
        assert result[0].current_tier == "tier_2"
        assert "Targeted practice recommended" in result[0].recommendation

    def test_tier_1_on_track(self) -> None:
        from src.api.routes import _generate_interventions

        result = _generate_interventions({"vol_assess": 85.0})
        assert len(result) == 1
        assert result[0].current_tier == "tier_1"
        assert "On track" in result[0].recommendation

    def test_mixed_tiers_multiple_skills(self) -> None:
        from src.api.routes import _generate_interventions

        result = _generate_interventions({
            "price_action": 90.0,
            "risk_mgmt": 50.0,
            "vol_assess": 20.0,
        })
        assert len(result) == 3
        tiers = {r.skill: r.current_tier for r in result}
        assert tiers["price_action"] == "tier_1"
        assert tiers["risk_mgmt"] == "tier_2"
        assert tiers["vol_assess"] == "tier_3"


class TestStudentSkillsEndpoint:
    """Test GET /api/mtss/student/{user_id}/skills returns correct shape."""

    def test_demo_fallback(self, db_client: TestClient) -> None:
        resp = db_client.get("/api/mtss/student/1/skills")
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_id"] == 1
        assert data["username"] == "TraderJoe"
        assert "price_action" in data["skills"]
        skill = data["skills"]["price_action"]
        assert "score" in skill
        assert "tier" in skill

    def test_unknown_user_returns_empty(self, db_client: TestClient) -> None:
        resp = db_client.get("/api/mtss/student/9999/skills")
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_id"] == 9999
        assert data["skills"] == {}


class TestObjectivesEndpoint:
    """Test GET /api/mtss/objectives returns correct shape."""

    def test_returns_list(self, db_client: TestClient) -> None:
        resp = db_client.get("/api/mtss/objectives")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0
        first = data[0]
        assert "objective_id" in first
        assert "tier_1_count" in first
        assert "tier_2_count" in first
        assert "tier_3_count" in first
        assert "total_students" in first


class TestInterventionsEndpoint:
    """Test GET /api/mtss/interventions/{user_id} returns correct shape."""

    def test_returns_recommendations(self, db_client: TestClient) -> None:
        resp = db_client.get("/api/mtss/interventions/1")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0
        first = data[0]
        assert "skill" in first
        assert "current_tier" in first
        assert "score" in first
        assert "recommendation" in first
        assert "suggested_activities" in first

    def test_unknown_user_returns_empty(self, db_client: TestClient) -> None:
        resp = db_client.get("/api/mtss/interventions/9999")
        assert resp.status_code == 200
        assert resp.json() == []


class TestSchemaValidation:
    """Test that Pydantic schemas validate correctly."""

    def test_student_skill_breakdown_schema(self) -> None:
        breakdown = StudentSkillBreakdown(
            user_id=1,
            username="test",
            skills={
                "s1": {"score": 80.0, "tier": "tier_1", "attempts": 5},
            },
        )
        assert breakdown.user_id == 1
        assert breakdown.skills["s1"]["score"] == 80.0

    def test_objective_distribution_schema(self) -> None:
        dist = ObjectiveDistribution(
            objective_id="price_action",
            objective_name="Price Action",
            tier_1_count=5,
            tier_2_count=3,
            tier_3_count=2,
            total_students=10,
        )
        assert dist.total_students == 10

    def test_intervention_recommendation_schema(self) -> None:
        rec = InterventionRecommendation(
            skill="risk_mgmt",
            current_tier="tier_3",
            score=25.0,
            recommendation="Intensive support needed",
            suggested_activities=["Activity 1", "Activity 2"],
        )
        assert rec.current_tier == "tier_3"
        assert len(rec.suggested_activities) == 2

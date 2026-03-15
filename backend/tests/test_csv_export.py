"""Tests for the educator CSV export endpoint."""

import csv
import io
from collections.abc import Generator
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app
from src.auth.dependencies import get_current_user
from src.db.database import get_db


@dataclass
class _MockUser:
    id: int = 1
    username: str = "testuser"
    email: str = "test@example.com"
    role: str = "educator"
    xp_total: int = 0
    level: int = 1
    firebase_uid: str = "mock_uid"


@dataclass
class _MockStudent:
    id: int = 10
    username: str = "student1"
    name: str = "Test Student"
    email: str = "student@example.com"
    role: str = "student"
    xp_total: int = 500
    level: int = 3


def _build_mock_db(students: list[object] | None = None) -> AsyncMock:
    """Build a mock AsyncSession that returns students and empty skill/response data."""
    mock_session = AsyncMock()

    call_count = 0

    def _mock_execute(stmt: object) -> MagicMock:
        nonlocal call_count
        call_count += 1
        result = MagicMock()
        if call_count == 1:
            # First call: select(User).where(role == "student")
            scalars_mock = MagicMock()
            scalars_mock.all.return_value = students or []
            result.scalars.return_value = scalars_mock
        elif call_count == 2:
            # Second call: select(SkillScore)
            scalars_mock = MagicMock()
            scalars_mock.all.return_value = []
            result.scalars.return_value = scalars_mock
        else:
            # Third call: response counts (group_by)
            result.all.return_value = []
        return result

    mock_session.execute = AsyncMock(side_effect=_mock_execute)
    return mock_session


@pytest.fixture
def csv_client() -> Generator[TestClient, None, None]:
    """Test client with mocked auth and DB for CSV export."""
    mock_db = _build_mock_db(students=[_MockStudent()])

    async def override_db():  # type: ignore[no-untyped-def]
        yield mock_db

    app.dependency_overrides[get_current_user] = lambda: _MockUser()
    app.dependency_overrides[get_db] = override_db
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


@pytest.fixture
def csv_client_empty() -> Generator[TestClient, None, None]:
    """Test client with mocked auth and DB with no students."""
    mock_db = _build_mock_db(students=[])

    async def override_db():  # type: ignore[no-untyped-def]
        yield mock_db

    app.dependency_overrides[get_current_user] = lambda: _MockUser()
    app.dependency_overrides[get_db] = override_db
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


class TestCSVExport:
    """Tests for GET /api/educator/export/csv."""

    def test_returns_csv_content_type(self, csv_client: TestClient) -> None:
        resp = csv_client.get("/api/educator/export/csv")
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/csv")

    def test_returns_attachment_header(self, csv_client: TestClient) -> None:
        resp = csv_client.get("/api/educator/export/csv")
        assert "attachment" in resp.headers.get("content-disposition", "")
        assert "student_export.csv" in resp.headers.get("content-disposition", "")

    def test_csv_has_correct_headers(self, csv_client: TestClient) -> None:
        resp = csv_client.get("/api/educator/export/csv")
        reader = csv.reader(io.StringIO(resp.text))
        headers = next(reader)
        expected = [
            "name", "username", "level", "xp_total", "overall_tier",
            "avg_score", "price_action", "options_chain", "strike_select",
            "risk_mgmt", "position_size", "regime_id", "vol_assess",
            "trade_mgmt", "response_count",
        ]
        assert headers == expected

    def test_csv_includes_student_row(self, csv_client: TestClient) -> None:
        resp = csv_client.get("/api/educator/export/csv")
        reader = csv.reader(io.StringIO(resp.text))
        _headers = next(reader)
        rows = list(reader)
        assert len(rows) == 1
        row = rows[0]
        assert row[0] == "Test Student"  # name
        assert row[1] == "student1"  # username
        assert row[2] == "3"  # level
        assert row[3] == "500"  # xp_total

    def test_csv_empty_when_no_students(
        self, csv_client_empty: TestClient
    ) -> None:
        resp = csv_client_empty.get("/api/educator/export/csv")
        assert resp.status_code == 200
        reader = csv.reader(io.StringIO(resp.text))
        _headers = next(reader)
        rows = list(reader)
        assert len(rows) == 0

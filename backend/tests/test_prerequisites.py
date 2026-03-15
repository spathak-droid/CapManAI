"""Tests for prerequisite mastery enforcement on lesson modules."""

from collections.abc import AsyncGenerator
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from main import app
from src.auth.dependencies import get_current_user
from src.db.database import get_db


@dataclass
class _MockUser:
    id: int = 42
    username: str = "learner"
    email: str = "learner@example.com"
    role: str = "student"
    xp_total: int = 0
    level: int = 1


_current_user: _MockUser | None = None


def _override_user() -> _MockUser:
    if _current_user is None:
        msg = "missing mock user"
        raise RuntimeError(msg)
    return _current_user


def _auth_header() -> dict[str, str]:
    return {"Authorization": "Bearer fake-firebase-token"}


def _make_execute_result(row: object) -> MagicMock:
    """Build a mock result whose scalar_one_or_none() returns row."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = row
    result.scalars.return_value.all.return_value = []
    result.all.return_value = []
    return result


async def _mock_get_db() -> AsyncGenerator[AsyncMock, None]:
    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.get = AsyncMock(return_value=None)
    mock_session.add = MagicMock()
    # Default: execute returns None for scalar_one_or_none (no DB rows).
    # This makes check_prerequisites_met fall back to in-memory definitions.
    mock_session.execute = AsyncMock(
        side_effect=lambda _query: _make_execute_result(None)
    )
    yield mock_session


def _make_client(role: str = "student") -> TestClient:
    global _current_user  # noqa: PLW0603
    _current_user = _MockUser(role=role)
    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[get_db] = _mock_get_db
    return TestClient(app)


# --------------------------------------------------------------------------
# Tests
# --------------------------------------------------------------------------


def test_modules_listing_includes_locked_fields() -> None:
    """GET /api/lessons/modules should include locked/locked_reason for each module."""
    client = _make_client("student")
    resp = client.get("/api/lessons/modules", headers=_auth_header())
    assert resp.status_code == 200
    data = resp.json()
    # f1 has no prerequisites, should be unlocked
    f1 = next(m for m in data if m["module_id"] == "f1")
    assert f1["locked"] is False
    assert f1["locked_reason"] is None

    # f2 requires f1. With no progress, f2 should be locked
    f2 = next(m for m in data if m["module_id"] == "f2")
    assert f2["locked"] is True
    assert f2["locked_reason"] is not None
    assert "f1" in f2["locked_reason"]
    app.dependency_overrides.clear()


def test_module_detail_viewable_even_when_prereqs_not_met() -> None:
    """GET /api/lessons/modules/{id} returns 200 even when prereqs unmet (read-only access)."""
    client = _make_client("student")
    # f2 requires f1 mastery, but viewing is allowed
    resp = client.get("/api/lessons/modules/f2", headers=_auth_header())
    assert resp.status_code == 200
    assert resp.json()["module_id"] == "f2"
    app.dependency_overrides.clear()


def test_module_detail_ok_when_no_prereqs() -> None:
    """GET /api/lessons/modules/f1 should be accessible (no prerequisites)."""
    client = _make_client("student")
    resp = client.get("/api/lessons/modules/f1", headers=_auth_header())
    assert resp.status_code == 200
    assert resp.json()["module_id"] == "f1"
    app.dependency_overrides.clear()


def test_chunk_viewable_even_when_prereqs_not_met() -> None:
    """GET /api/lessons/chunks/{id} returns 200 even when parent module prereqs unmet (read-only)."""
    client = _make_client("student")
    # f2-ch1 belongs to module f2 which requires f1, but viewing is allowed
    resp = client.get("/api/lessons/chunks/f2-ch1", headers=_auth_header())
    assert resp.status_code == 200
    assert resp.json()["chunk_id"] == "f2-ch1"
    app.dependency_overrides.clear()


def test_chunk_access_ok_for_first_module() -> None:
    """GET /api/lessons/chunks/f1-ch1 should be accessible (f1 has no prerequisites)."""
    client = _make_client("student")
    resp = client.get("/api/lessons/chunks/f1-ch1", headers=_auth_header())
    assert resp.status_code == 200
    assert resp.json()["chunk_id"] == "f1-ch1"
    app.dependency_overrides.clear()


def test_attempt_403_when_prereqs_not_met() -> None:
    """POST /api/lessons/chunks/{id}/attempt returns 403 for locked module."""
    client = _make_client("student")
    resp = client.post(
        "/api/lessons/chunks/f2-ch1/attempt",
        headers=_auth_header(),
        json={"answers": [{"item_id": "f2-ch1-q1", "selected_option_id": "a"}]},
    )
    assert resp.status_code == 403
    app.dependency_overrides.clear()


def test_complete_403_when_prereqs_not_met() -> None:
    """POST /api/lessons/chunks/{id}/complete returns 403 for locked module."""
    client = _make_client("student")
    resp = client.post(
        "/api/lessons/chunks/f2-ch1/complete",
        headers=_auth_header(),
    )
    assert resp.status_code == 403
    app.dependency_overrides.clear()


def test_first_module_attempt_and_complete_ok() -> None:
    """Attempt and complete should work for chunks in the first module (f1)."""
    client = _make_client("student")

    # Get chunk to know quiz items
    chunk_resp = client.get("/api/lessons/chunks/f1-ch1", headers=_auth_header())
    assert chunk_resp.status_code == 200
    chunk = chunk_resp.json()

    answers = []
    for item in chunk["quiz_items"]:
        if item["item_type"] == "reflection":
            answers.append({"item_id": item["item_id"], "response_text": "test"})
        else:
            answers.append({"item_id": item["item_id"], "selected_option_id": "a"})

    attempt_resp = client.post(
        "/api/lessons/chunks/f1-ch1/attempt",
        headers=_auth_header(),
        json={"answers": answers},
    )
    assert attempt_resp.status_code == 200

    complete_resp = client.post(
        "/api/lessons/chunks/f1-ch1/complete",
        headers=_auth_header(),
    )
    assert complete_resp.status_code == 200
    app.dependency_overrides.clear()

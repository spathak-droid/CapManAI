"""Tests for lessons APIs and progression."""

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


def _make_execute_result(row: object) -> MagicMock:
    """Build a mock result whose scalar_one_or_none() returns row."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = row
    result.scalars.return_value.all.return_value = []
    return result


async def _mock_get_db() -> AsyncGenerator[AsyncMock, None]:
    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.get = AsyncMock(return_value=None)
    # db.add() is synchronous in SQLAlchemy — use MagicMock to avoid coroutine warnings
    mock_session.add = MagicMock()

    # execute() returns a mock result with scalar_one_or_none() -> None
    # This causes get_user_state and _ensure_chunk_progress to create new rows.
    mock_session.execute = AsyncMock(
        side_effect=lambda _query: _make_execute_result(None)
    )
    yield mock_session


def _auth_header() -> dict[str, str]:
    return {"Authorization": "Bearer fake-firebase-token"}


def _make_client(role: str = "student") -> TestClient:
    global _current_user  # noqa: PLW0603
    _current_user = _MockUser(role=role)
    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[get_db] = _mock_get_db
    return TestClient(app)


def test_lessons_modules_student_access() -> None:
    client = _make_client("student")
    resp = client.get("/api/lessons/modules", headers=_auth_header())
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 20
    assert data[0]["module_id"] == "f1"
    assert data[-1]["module_id"] == "c1"
    app.dependency_overrides.clear()


def test_lessons_modules_educator_denied() -> None:
    client = _make_client("educator")
    resp = client.get("/api/lessons/modules", headers=_auth_header())
    assert resp.status_code == 403
    app.dependency_overrides.clear()


def test_attempt_complete_and_progress_flow() -> None:
    client = _make_client("student")

    chunk_resp = client.get("/api/lessons/chunks/f1-ch1", headers=_auth_header())
    assert chunk_resp.status_code == 200
    chunk = chunk_resp.json()

    answers = []
    for item in chunk["quiz_items"]:
        if item["item_type"] == "reflection":
            answers.append({"item_id": item["item_id"], "response_text": "Skip if risk/reward is weak"})
        else:
            # wrong on purpose to verify retry suggestion
            answers.append({"item_id": item["item_id"], "selected_option_id": "b"})

    attempt_1 = client.post(
        "/api/lessons/chunks/f1-ch1/attempt",
        headers=_auth_header(),
        json={"answers": answers},
    )
    assert attempt_1.status_code == 200
    data_1 = attempt_1.json()
    assert data_1["recommended_retry"] is True
    assert data_1["score_percent"] < 80

    # second attempt all-correct for mastery
    answers_2 = []
    for item in chunk["quiz_items"]:
        if item["item_type"] == "reflection":
            answers_2.append({"item_id": item["item_id"], "response_text": "Skip if setup has no invalidation"})
        else:
            answers_2.append({"item_id": item["item_id"], "selected_option_id": "a"})

    attempt_2 = client.post(
        "/api/lessons/chunks/f1-ch1/attempt",
        headers=_auth_header(),
        json={"answers": answers_2},
    )
    assert attempt_2.status_code == 200
    data_2 = attempt_2.json()
    assert data_2["mastered"] is True
    assert data_2["score_percent"] >= 80

    complete = client.post("/api/lessons/chunks/f1-ch1/complete", headers=_auth_header())
    assert complete.status_code == 200
    assert complete.json()["completed"] is True

    progress = client.get("/api/lessons/progress/me", headers=_auth_header())
    assert progress.status_code == 200
    progress_data = progress.json()
    # With a fresh mock DB, the progress rows are transient ORM objects not
    # persisted between requests, so we only validate the response shape.
    assert "chunk_progress" in progress_data
    assert "f1-ch1" in progress_data["chunk_progress"]
    assert "next_chunk_id" in progress_data

    streak = client.get("/api/lessons/streak/me", headers=_auth_header())
    assert streak.status_code == 200
    assert "current_streak" in streak.json()

    app.dependency_overrides.clear()

"""Tests for badge system: level badges, streak badges, mastery bug fix, and /api/badges/me."""

from collections.abc import AsyncGenerator
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app
from src.auth.dependencies import get_current_user
from src.db.database import get_db
from src.lessons.service import calculate_new_badges


@dataclass
class _MockUser:
    id: int = 42
    username: str = "badge_tester"
    email: str = "badge@example.com"
    role: str = "student"
    xp_total: int = 0
    level: int = 1
    firebase_uid: str = "mock_uid"


@dataclass
class _MockUserRow:
    """Simulates a User ORM row returned from DB."""

    id: int = 42
    level: int = 1


@dataclass
class _MockStreak:
    """Simulates a UserStreak ORM row."""

    user_id: int = 42
    current_streak: int = 0
    last_activity_date: None = None
    lesson_xp_total: int = 0


@dataclass
class _MockChunkProgress:
    """Simulates a UserChunkProgress row."""

    user_id: int = 42
    chunk_id: str = ""
    completed: bool = False
    mastered: bool = False
    attempts: int = 0
    latest_score: float = 0.0
    best_score: float = 0.0
    completion_xp_awarded: bool = False
    mastery_bonus_awarded: bool = False


_current_user: _MockUser | None = None


def _override_user() -> _MockUser:
    if _current_user is None:
        msg = "missing mock user"
        raise RuntimeError(msg)
    return _current_user


def _auth_header() -> dict[str, str]:
    return {"Authorization": "Bearer fake-firebase-token"}


def _make_mock_session(
    streak: _MockStreak | None = None,
    user_row: _MockUserRow | None = None,
    chunk_progress_map: dict[str, _MockChunkProgress] | None = None,
) -> AsyncMock:
    """Build a mock async session with configurable return values."""
    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.get = AsyncMock(return_value=None)
    mock_session.add = MagicMock()

    streak_obj = streak or _MockStreak()
    user_obj = user_row or _MockUserRow()
    progress_map = chunk_progress_map or {}

    def _execute_side_effect(query: object) -> MagicMock:
        result = MagicMock()
        # Check column entities to determine query type
        query_str = str(query)

        if "user_streaks" in query_str:
            result.scalar_one_or_none.return_value = streak_obj
            result.scalars.return_value.all.return_value = [streak_obj]
        elif "user_chunk_progress" in query_str:
            # Match by checking bind parameters in the query's whereclause
            matched = None
            try:
                params = query.compile().params  # type: ignore[union-attr]
                for param_val in params.values():
                    if isinstance(param_val, str) and param_val in progress_map:
                        matched = progress_map[param_val]
                        break
            except Exception:
                pass
            result.scalar_one_or_none.return_value = matched
            result.scalars.return_value.all.return_value = (
                list(progress_map.values()) if progress_map else []
            )
        elif "\nFROM users" in query_str or "FROM users " in query_str:
            result.scalar_one_or_none.return_value = user_obj
            result.scalars.return_value.all.return_value = [user_obj]
        elif "responses" in query_str:
            result.scalar_one_or_none.return_value = None
        elif "challenges" in query_str:
            result.scalar_one_or_none.return_value = None
        elif "peer_review_assignments" in query_str:
            result.scalar_one_or_none.return_value = None
        else:
            result.scalar_one_or_none.return_value = None
            result.scalars.return_value.all.return_value = []
        return result

    mock_session.execute = AsyncMock(side_effect=_execute_side_effect)
    return mock_session


# ---------------------------------------------------------------------------
# Unit tests for calculate_new_badges
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_level_badges_awarded_correctly() -> None:
    """Level badges should be awarded for all levels up to user's current level."""
    user_row = _MockUserRow(level=5)
    mock_db = _make_mock_session(user_row=user_row)

    badges = await calculate_new_badges(
        user_id=42,
        db=mock_db,
        ordered_module_ids=[],
        module_chunk_ids={},
        module_tracks={},
        module_titles={},
    )

    assert "Rookie Trader" in badges  # level 2
    assert "Market Watcher" in badges  # level 3
    assert "Chart Reader" in badges  # level 4
    assert "Risk Manager" in badges  # level 5
    assert "Options Strategist" not in badges  # level 6 — not reached
    assert "Trading Legend" not in badges  # level 10


@pytest.mark.anyio
async def test_level_badges_level_1_gets_none() -> None:
    """A level 1 user should earn no level badges."""
    user_row = _MockUserRow(level=1)
    mock_db = _make_mock_session(user_row=user_row)

    badges = await calculate_new_badges(
        user_id=42,
        db=mock_db,
        ordered_module_ids=[],
        module_chunk_ids={},
        module_tracks={},
        module_titles={},
    )

    level_badge_names = {
        "Rookie Trader",
        "Market Watcher",
        "Chart Reader",
        "Risk Manager",
        "Options Strategist",
        "Senior Analyst",
        "Portfolio Manager",
        "Managing Director",
        "Trading Legend",
    }
    assert not level_badge_names.intersection(set(badges))


@pytest.mark.anyio
async def test_level_10_gets_all_level_badges() -> None:
    """A level 10 user should earn all 9 level badges."""
    user_row = _MockUserRow(level=10)
    mock_db = _make_mock_session(user_row=user_row)

    badges = await calculate_new_badges(
        user_id=42,
        db=mock_db,
        ordered_module_ids=[],
        module_chunk_ids={},
        module_tracks={},
        module_titles={},
    )

    assert "Rookie Trader" in badges
    assert "Trading Legend" in badges
    level_badges = [
        b
        for b in badges
        if b
        in {
            "Rookie Trader",
            "Market Watcher",
            "Chart Reader",
            "Risk Manager",
            "Options Strategist",
            "Senior Analyst",
            "Portfolio Manager",
            "Managing Director",
            "Trading Legend",
        }
    ]
    assert len(level_badges) == 9


@pytest.mark.anyio
async def test_streak_badges() -> None:
    """Streak badges awarded at 3, 7, and 30 days."""
    streak = _MockStreak(current_streak=8)
    mock_db = _make_mock_session(streak=streak)

    badges = await calculate_new_badges(
        user_id=42,
        db=mock_db,
        ordered_module_ids=[],
        module_chunk_ids={},
        module_tracks={},
        module_titles={},
    )

    assert "3-Day Streak" in badges
    assert "7-Day Streak" in badges
    assert "30-Day Streak" not in badges

    # Now test 30-day streak
    streak30 = _MockStreak(current_streak=30)
    mock_db30 = _make_mock_session(streak=streak30)
    badges30 = await calculate_new_badges(
        user_id=42,
        db=mock_db30,
        ordered_module_ids=[],
        module_chunk_ids={},
        module_tracks={},
        module_titles={},
    )
    assert "30-Day Streak" in badges30


@pytest.mark.anyio
async def test_mastery_badge_bug_fixed() -> None:
    """Core module mastery badges should be awarded when all chunks are mastered.

    This was broken by an erroneous `continue` that made lines unreachable.
    """
    chunk_progress = {
        "core1-ch1": _MockChunkProgress(chunk_id="core1-ch1", mastered=True, completed=True),
        "core1-ch2": _MockChunkProgress(chunk_id="core1-ch2", mastered=True, completed=True),
    }
    mock_db = _make_mock_session(chunk_progress_map=chunk_progress)

    badges = await calculate_new_badges(
        user_id=42,
        db=mock_db,
        ordered_module_ids=["core1"],
        module_chunk_ids={"core1": ["core1-ch1", "core1-ch2"]},
        module_tracks={"core1": "core"},
        module_titles={"core1": "Options Pricing"},
    )

    assert "Options Pricing Mastery" in badges


@pytest.mark.anyio
async def test_mastery_badge_not_awarded_when_not_all_mastered() -> None:
    """If any chunk in a core module is not mastered, no mastery badge."""
    chunk_progress = {
        "core1-ch1": _MockChunkProgress(chunk_id="core1-ch1", mastered=True, completed=True),
        "core1-ch2": _MockChunkProgress(chunk_id="core1-ch2", mastered=False, completed=True),
    }
    mock_db = _make_mock_session(chunk_progress_map=chunk_progress)

    badges = await calculate_new_badges(
        user_id=42,
        db=mock_db,
        ordered_module_ids=["core1"],
        module_chunk_ids={"core1": ["core1-ch1", "core1-ch2"]},
        module_tracks={"core1": "core"},
        module_titles={"core1": "Options Pricing"},
    )

    assert "Options Pricing Mastery" not in badges


# ---------------------------------------------------------------------------
# Integration test for /api/badges/me endpoint
# ---------------------------------------------------------------------------


def _make_badge_client(user: _MockUser | None = None) -> TestClient:
    global _current_user  # noqa: PLW0603
    _current_user = user or _MockUser()
    mock_db = _make_mock_session()

    async def _mock_get_db() -> AsyncGenerator[AsyncMock, None]:
        yield mock_db

    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[get_db] = _mock_get_db
    return TestClient(app)


def test_badges_me_endpoint_returns_correct_structure() -> None:
    """GET /api/badges/me should return full catalog with earned/locked state."""
    client = _make_badge_client()
    resp = client.get("/api/badges/me", headers=_auth_header())
    assert resp.status_code == 200
    data = resp.json()

    assert "badges" in data
    assert "total_earned" in data
    assert "total_available" in data
    assert isinstance(data["badges"], list)
    assert data["total_available"] > 0

    # Every badge should have the required keys
    for badge in data["badges"]:
        assert "key" in badge
        assert "name" in badge
        assert "description" in badge
        assert "category" in badge
        assert "earned" in badge
        assert badge["category"] in ("level", "streak", "mastery", "milestone")

    # Check specific badge keys exist
    keys = {b["key"] for b in data["badges"]}
    assert "level_2" in keys
    assert "level_10" in keys
    assert "streak_3" in keys
    assert "streak_7" in keys
    assert "streak_30" in keys
    assert "foundation_finisher" in keys
    assert "capstone_complete" in keys
    assert "first_scenario" in keys
    assert "first_challenge_win" in keys
    assert "first_review" in keys

    # Level 1 user should have no level badges earned
    level_badges = [b for b in data["badges"] if b["category"] == "level"]
    assert all(not b["earned"] for b in level_badges)

    app.dependency_overrides.clear()


def test_badges_me_has_mastery_badges() -> None:
    """The badge catalog should include mastery badges."""
    client = _make_badge_client()
    resp = client.get("/api/badges/me", headers=_auth_header())
    data = resp.json()

    mastery_badges = [b for b in data["badges"] if b["category"] == "mastery"]
    assert len(mastery_badges) == 8  # 8 skill mastery badges

    app.dependency_overrides.clear()

"""Tests for head-to-head challenges system."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.challenges.matchmaker import find_match, join_queue, leave_queue, process_queue
from src.challenges.service import LOSER_XP, WINNER_XP
from src.db.models import Challenge, ChallengeResponse, MatchmakingQueue


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_queue_entry(
    user_id: int = 1,
    skill_target: str | None = None,
    elo_rating: float = 1000.0,
    matched_at: datetime | None = None,
    challenge_id: int | None = None,
) -> MatchmakingQueue:
    """Create a MatchmakingQueue-like object for testing."""
    entry = MagicMock(spec=MatchmakingQueue)
    entry.id = user_id  # simplify
    entry.user_id = user_id
    entry.skill_target = skill_target
    entry.elo_rating = elo_rating
    entry.queued_at = datetime.now(timezone.utc)
    entry.matched_at = matched_at
    entry.challenge_id = challenge_id
    return entry


def _mock_db_session() -> MagicMock:
    """Create a mock async DB session."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.delete = AsyncMock()
    db.get = AsyncMock(return_value=None)
    return db


def _make_scalar_result(value: object) -> MagicMock:
    """Create a mock that returns value from .scalar_one_or_none()."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


def _make_scalars_result(values: list[object]) -> MagicMock:
    """Create a mock that returns values from .scalars().all()."""
    result = MagicMock()
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = values
    result.scalars.return_value = scalars_mock
    return result


# ---------------------------------------------------------------------------
# Matchmaker Tests
# ---------------------------------------------------------------------------


class TestJoinQueue:
    """Tests for joining the matchmaking queue."""

    @pytest.mark.asyncio
    async def test_join_queue_success(self) -> None:
        """User can join the queue when not already in it."""
        db = _mock_db_session()
        db.execute = AsyncMock(return_value=_make_scalar_result(None))

        entry = await join_queue(db, user_id=1, skill_target="price_action")

        assert isinstance(entry, MatchmakingQueue)
        assert entry.user_id == 1
        assert entry.skill_target == "price_action"
        db.add.assert_called_once()
        db.flush.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_join_queue_already_in_queue(self) -> None:
        """User cannot join if already in the queue."""
        db = _mock_db_session()
        existing = _make_queue_entry(user_id=1)
        db.execute = AsyncMock(return_value=_make_scalar_result(existing))

        with pytest.raises(ValueError, match="already in the matchmaking queue"):
            await join_queue(db, user_id=1)


class TestLeaveQueue:
    """Tests for leaving the matchmaking queue."""

    @pytest.mark.asyncio
    async def test_leave_queue_success(self) -> None:
        """User can leave the queue when in it."""
        db = _mock_db_session()
        entry = _make_queue_entry(user_id=1)
        db.execute = AsyncMock(return_value=_make_scalar_result(entry))

        removed = await leave_queue(db, user_id=1)

        assert removed is True
        db.delete.assert_awaited_once_with(entry)

    @pytest.mark.asyncio
    async def test_leave_queue_not_in_queue(self) -> None:
        """Returns False when user is not in the queue."""
        db = _mock_db_session()
        db.execute = AsyncMock(return_value=_make_scalar_result(None))

        removed = await leave_queue(db, user_id=1)

        assert removed is False


class TestFindMatch:
    """Tests for finding a match within elo range."""

    @pytest.mark.asyncio
    async def test_find_match_found(self) -> None:
        """Finds an opponent within elo range."""
        db = _mock_db_session()
        user_entry = _make_queue_entry(user_id=1, elo_rating=1000.0)
        opponent_entry = _make_queue_entry(user_id=2, elo_rating=1100.0)

        # First call returns user entry, second returns opponent
        db.execute = AsyncMock(
            side_effect=[
                _make_scalar_result(user_entry),
                _make_scalar_result(opponent_entry),
            ]
        )

        result = await find_match(db, user_id=1)

        assert result == 2

    @pytest.mark.asyncio
    async def test_find_match_no_match(self) -> None:
        """Returns None when no compatible opponent is found."""
        db = _mock_db_session()
        user_entry = _make_queue_entry(user_id=1, elo_rating=1000.0)

        db.execute = AsyncMock(
            side_effect=[
                _make_scalar_result(user_entry),
                _make_scalar_result(None),
            ]
        )

        result = await find_match(db, user_id=1)

        assert result is None

    @pytest.mark.asyncio
    async def test_find_match_user_not_in_queue(self) -> None:
        """Returns None when user is not in the queue."""
        db = _mock_db_session()
        db.execute = AsyncMock(return_value=_make_scalar_result(None))

        result = await find_match(db, user_id=1)

        assert result is None


class TestProcessQueue:
    """Tests for processing the matchmaking queue."""

    @pytest.mark.asyncio
    async def test_process_queue_matches_compatible(self) -> None:
        """Matches two compatible users from the queue."""
        db = _mock_db_session()
        entry1 = _make_queue_entry(user_id=1, elo_rating=1000.0)
        entry2 = _make_queue_entry(user_id=2, elo_rating=1100.0)

        db.execute = AsyncMock(
            return_value=_make_scalars_result([entry1, entry2])
        )

        pairs = await process_queue(db)

        assert len(pairs) == 1
        assert pairs[0] == (1, 2)
        assert entry1.matched_at is not None
        assert entry2.matched_at is not None

    @pytest.mark.asyncio
    async def test_process_queue_no_match_elo_too_far(self) -> None:
        """Does not match users with elo difference > 200."""
        db = _mock_db_session()
        entry1 = _make_queue_entry(user_id=1, elo_rating=1000.0)
        entry2 = _make_queue_entry(user_id=2, elo_rating=1300.0)

        db.execute = AsyncMock(
            return_value=_make_scalars_result([entry1, entry2])
        )

        pairs = await process_queue(db)

        assert len(pairs) == 0

    @pytest.mark.asyncio
    async def test_process_queue_skill_mismatch(self) -> None:
        """Does not match users targeting different skills."""
        db = _mock_db_session()
        entry1 = _make_queue_entry(
            user_id=1, elo_rating=1000.0, skill_target="price_action"
        )
        entry2 = _make_queue_entry(
            user_id=2, elo_rating=1000.0, skill_target="risk_management"
        )

        db.execute = AsyncMock(
            return_value=_make_scalars_result([entry1, entry2])
        )

        pairs = await process_queue(db)

        assert len(pairs) == 0


# ---------------------------------------------------------------------------
# Service Tests
# ---------------------------------------------------------------------------


class TestChallengeXPConstants:
    """Tests for XP award constants."""

    def test_winner_xp_is_50(self) -> None:
        assert WINNER_XP == 50

    def test_loser_xp_is_20(self) -> None:
        assert LOSER_XP == 20


class TestChallengeModel:
    """Tests for the Challenge model structure."""

    def test_challenge_default_status(self) -> None:
        """Challenge defaults to pending status."""
        col = Challenge.__table__.columns["status"]
        assert col.default is not None
        assert col.default.arg == "pending"  # type: ignore[union-attr]

    def test_challenge_response_model(self) -> None:
        """ChallengeResponse has required fields."""
        table = ChallengeResponse.__table__
        assert "challenge_id" in table.columns
        assert "user_id" in table.columns
        assert "answer_text" in table.columns
        assert "grade_id" in table.columns

    def test_matchmaking_queue_model(self) -> None:
        """MatchmakingQueue has required fields."""
        table = MatchmakingQueue.__table__
        assert "user_id" in table.columns
        assert "skill_target" in table.columns
        assert "elo_rating" in table.columns
        assert "queued_at" in table.columns
        assert "matched_at" in table.columns
        assert "challenge_id" in table.columns
        # user_id should be unique
        user_col = table.columns["user_id"]
        assert user_col.unique is True

"""Tests for leaderboard logic."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.gamification.leaderboard import LeaderboardEntry, get_leaderboard


def _make_user(user_id: int, username: str, xp_total: int) -> MagicMock:
    user = MagicMock()
    user.id = user_id
    user.username = username
    user.xp_total = xp_total
    return user


class TestGetLeaderboard:
    """Tests for get_leaderboard function."""

    @pytest.mark.asyncio
    async def test_returns_sorted_by_xp_desc(self) -> None:
        users = [_make_user(3, "C", 2000), _make_user(1, "A", 1000), _make_user(2, "B", 500)]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = users
        db = AsyncMock()
        db.execute.return_value = mock_result

        entries = await get_leaderboard(db)
        assert len(entries) == 3
        for i in range(len(entries) - 1):
            assert entries[i].xp_total >= entries[i + 1].xp_total

    @pytest.mark.asyncio
    async def test_ranks_are_sequential(self) -> None:
        users = [_make_user(2, "B", 200), _make_user(1, "A", 100)]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = users
        db = AsyncMock()
        db.execute.return_value = mock_result

        entries = await get_leaderboard(db)
        for i, entry in enumerate(entries):
            assert entry.rank == i + 1

    @pytest.mark.asyncio
    async def test_limit_parameter(self) -> None:
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        db.execute.return_value = mock_result

        await get_leaderboard(db, limit=3)
        db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_leaderboard_entries(self) -> None:
        users = [_make_user(1, "Trader", 500)]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = users
        db = AsyncMock()
        db.execute.return_value = mock_result

        entries = await get_leaderboard(db, limit=1)
        assert len(entries) == 1
        entry = entries[0]
        assert isinstance(entry, LeaderboardEntry)
        assert entry.user_id == 1
        assert entry.username == "Trader"
        assert entry.xp_total == 500
        assert entry.level >= 1
        assert entry.rank == 1

    @pytest.mark.asyncio
    async def test_empty_returns_empty_list(self) -> None:
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        db = AsyncMock()
        db.execute.return_value = mock_result

        entries = await get_leaderboard(db)
        assert entries == []

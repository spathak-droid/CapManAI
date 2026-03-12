"""Tests for leaderboard logic."""

from src.gamification.leaderboard import (
    LeaderboardEntry,
    _leaderboard_store,
    _recalc_ranks,
    get_leaderboard,
    update_leaderboard,
)


class TestGetLeaderboard:
    """Tests for get_leaderboard function."""

    def test_returns_sorted_by_xp_desc(self) -> None:
        entries = get_leaderboard()
        for i in range(len(entries) - 1):
            assert entries[i].xp_total >= entries[i + 1].xp_total

    def test_ranks_are_sequential(self) -> None:
        entries = get_leaderboard()
        for i, entry in enumerate(entries):
            assert entry.rank == i + 1

    def test_limit_parameter(self) -> None:
        entries = get_leaderboard(limit=3)
        assert len(entries) == 3

    def test_returns_leaderboard_entries(self) -> None:
        entries = get_leaderboard(limit=1)
        assert len(entries) == 1
        entry = entries[0]
        assert isinstance(entry, LeaderboardEntry)
        assert entry.user_id > 0
        assert entry.xp_total > 0
        assert entry.level >= 1

    def test_demo_data_seeded(self) -> None:
        """Verify demo data was seeded on module load."""
        entries = get_leaderboard(limit=50)
        assert len(entries) >= 5


class TestUpdateLeaderboard:
    """Tests for update_leaderboard function."""

    def test_update_existing_user(self) -> None:
        # Get current top user
        before = get_leaderboard(limit=1)[0]
        original_xp = before.xp_total

        # Update their XP
        update_leaderboard(before.user_id, before.username, original_xp + 1000)

        # Find them again
        entries = get_leaderboard(limit=50)
        updated = next(e for e in entries if e.user_id == before.user_id)
        assert updated.xp_total == original_xp + 1000

        # Restore original value
        update_leaderboard(before.user_id, before.username, original_xp)

    def test_add_new_user(self) -> None:
        initial_count = len(get_leaderboard(limit=100))
        update_leaderboard(user_id=999, username="NewTrader", xp_total=5000)

        entries = get_leaderboard(limit=100)
        assert len(entries) == initial_count + 1

        new_entry = next(e for e in entries if e.user_id == 999)
        assert new_entry.username == "NewTrader"
        assert new_entry.xp_total == 5000

        # Clean up: remove from store
        _leaderboard_store[:] = [e for e in _leaderboard_store if e.user_id != 999]
        _recalc_ranks()

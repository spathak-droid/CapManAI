"""Tests for WebSocket connection manager and events."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.realtime.events import EventType, create_event
from src.realtime.manager import ConnectionManager


def _make_mock_ws() -> MagicMock:
    """Create a mock WebSocket with async send_json."""
    ws = MagicMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    return ws


@pytest.fixture
def mgr() -> ConnectionManager:
    """Fresh ConnectionManager for each test."""
    return ConnectionManager()


class TestConnectionManager:
    """Tests for ConnectionManager connect/disconnect."""

    @pytest.mark.asyncio
    async def test_connect_registers_user(self, mgr: ConnectionManager) -> None:
        ws = _make_mock_ws()
        await mgr.connect(ws, 1)

        assert 1 in mgr.active_connections
        assert ws in mgr.active_connections[1]
        ws.accept.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_connect_multiple_sockets(self, mgr: ConnectionManager) -> None:
        ws1 = _make_mock_ws()
        ws2 = _make_mock_ws()
        await mgr.connect(ws1, 1)
        await mgr.connect(ws2, 1)

        assert len(mgr.active_connections[1]) == 2

    def test_disconnect_removes_socket(self, mgr: ConnectionManager) -> None:
        ws = _make_mock_ws()
        mgr.active_connections[1] = [ws]

        mgr.disconnect(ws, 1)

        assert 1 not in mgr.active_connections

    def test_disconnect_keeps_other_sockets(self, mgr: ConnectionManager) -> None:
        ws1 = _make_mock_ws()
        ws2 = _make_mock_ws()
        mgr.active_connections[1] = [ws1, ws2]

        mgr.disconnect(ws1, 1)

        assert mgr.active_connections[1] == [ws2]

    def test_disconnect_nonexistent_user(self, mgr: ConnectionManager) -> None:
        ws = _make_mock_ws()
        # Should not raise
        mgr.disconnect(ws, 999)


class TestSendToUser:
    """Tests for send_to_user."""

    @pytest.mark.asyncio
    async def test_send_to_user(self, mgr: ConnectionManager) -> None:
        ws = _make_mock_ws()
        mgr.active_connections[1] = [ws]
        msg = {"type": "test", "data": {}}

        await mgr.send_to_user(1, msg)

        ws.send_json.assert_awaited_once_with(msg)

    @pytest.mark.asyncio
    async def test_send_to_user_no_connections(self, mgr: ConnectionManager) -> None:
        # Should not raise when user has no connections
        await mgr.send_to_user(999, {"type": "test", "data": {}})

    @pytest.mark.asyncio
    async def test_send_to_user_removes_stale(self, mgr: ConnectionManager) -> None:
        ws_good = _make_mock_ws()
        ws_bad = _make_mock_ws()
        ws_bad.send_json = AsyncMock(side_effect=RuntimeError("connection closed"))
        mgr.active_connections[1] = [ws_bad, ws_good]

        await mgr.send_to_user(1, {"type": "test", "data": {}})

        # Stale socket should be removed, good one stays
        assert ws_bad not in mgr.active_connections.get(1, [])
        assert ws_good in mgr.active_connections[1]
        ws_good.send_json.assert_awaited_once()


class TestRooms:
    """Tests for room join/leave/broadcast."""

    def test_join_room(self, mgr: ConnectionManager) -> None:
        mgr.join_room(1, "leaderboard")

        assert "leaderboard" in mgr.rooms
        assert 1 in mgr.rooms["leaderboard"]

    def test_join_room_multiple_users(self, mgr: ConnectionManager) -> None:
        mgr.join_room(1, "leaderboard")
        mgr.join_room(2, "leaderboard")

        assert mgr.rooms["leaderboard"] == {1, 2}

    def test_leave_room(self, mgr: ConnectionManager) -> None:
        mgr.join_room(1, "leaderboard")
        mgr.leave_room(1, "leaderboard")

        # Room should be cleaned up when empty
        assert "leaderboard" not in mgr.rooms

    def test_leave_room_nonexistent(self, mgr: ConnectionManager) -> None:
        # Should not raise
        mgr.leave_room(1, "nonexistent")

    @pytest.mark.asyncio
    async def test_broadcast_to_room(self, mgr: ConnectionManager) -> None:
        ws1 = _make_mock_ws()
        ws2 = _make_mock_ws()
        mgr.active_connections[1] = [ws1]
        mgr.active_connections[2] = [ws2]
        mgr.join_room(1, "leaderboard")
        mgr.join_room(2, "leaderboard")
        msg = {"type": "update", "data": {"rank": 1}}

        await mgr.broadcast_to_room("leaderboard", msg)

        ws1.send_json.assert_awaited_once_with(msg)
        ws2.send_json.assert_awaited_once_with(msg)

    @pytest.mark.asyncio
    async def test_broadcast_to_empty_room(self, mgr: ConnectionManager) -> None:
        # Should not raise
        await mgr.broadcast_to_room("nonexistent", {"type": "test", "data": {}})


class TestBroadcastAll:
    """Tests for broadcast_all."""

    @pytest.mark.asyncio
    async def test_broadcast_all(self, mgr: ConnectionManager) -> None:
        ws1 = _make_mock_ws()
        ws2 = _make_mock_ws()
        mgr.active_connections[1] = [ws1]
        mgr.active_connections[2] = [ws2]
        msg = {"type": "announcement", "data": {}}

        await mgr.broadcast_all(msg)

        ws1.send_json.assert_awaited_once_with(msg)
        ws2.send_json.assert_awaited_once_with(msg)


class TestEvents:
    """Tests for event creation."""

    def test_create_event(self) -> None:
        event = create_event(
            EventType.XP_EARNED, {"amount": 100, "source": "quiz"}
        )

        assert event == {
            "type": "xp_earned",
            "data": {"amount": 100, "source": "quiz"},
        }

    def test_event_type_values(self) -> None:
        assert EventType.LEADERBOARD_UPDATE.value == "leaderboard_update"
        assert EventType.LEVEL_UP.value == "level_up"
        assert EventType.CHALLENGE_MATCHED.value == "challenge_matched"

    def test_create_event_all_types(self) -> None:
        for event_type in EventType:
            event = create_event(event_type, {"test": True})
            assert event["type"] == event_type.value
            assert event["data"] == {"test": True}

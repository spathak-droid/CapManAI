"""Tests for announcements, direct messages, and activity feed endpoints."""

from collections.abc import Generator
from dataclasses import dataclass, field
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app
from src.auth.dependencies import get_current_user
from src.db.database import get_db


@dataclass
class _MockUser:
    id: int = 1
    username: str = "educator1"
    email: str = "educator@example.com"
    name: str | None = "Prof Smith"
    role: str = "educator"
    xp_total: int = 0
    level: int = 1
    firebase_uid: str = "mock_uid"
    created_at: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))


@dataclass
class _MockStudent:
    id: int = 10
    username: str = "student1"
    email: str = "student@example.com"
    name: str | None = "Test Student"
    role: str = "student"
    xp_total: int = 500
    level: int = 3
    firebase_uid: str = "mock_student_uid"
    created_at: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))


@dataclass
class _MockAnnouncement:
    id: int = 1
    educator_id: int = 1
    title: str = "Test Announcement"
    content: str = "This is a test announcement"
    priority: str = "normal"
    created_at: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))


@dataclass
class _MockDirectMessage:
    id: int = 1
    sender_id: int = 1
    recipient_id: int = 10
    content: str = "Hello student"
    is_read: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))


def _build_announcement_mock_db() -> AsyncMock:
    """Mock DB for announcement tests."""
    mock_session = AsyncMock()
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.delete = AsyncMock()

    async def _mock_refresh(obj: object) -> None:
        if hasattr(obj, "id") and getattr(obj, "id") is None:
            obj.id = 1  # type: ignore[attr-defined]
        if hasattr(obj, "created_at") and getattr(obj, "created_at") is None:
            obj.created_at = datetime.now(tz=timezone.utc)  # type: ignore[attr-defined]

    mock_session.refresh = AsyncMock(side_effect=_mock_refresh)

    # Default: return empty results
    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = []
    mock_result.scalars.return_value = mock_scalars
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.get = AsyncMock(return_value=None)

    return mock_session


@pytest.fixture
def educator_client() -> Generator[TestClient, None, None]:
    """Test client with educator auth and mock DB."""
    mock_db = _build_announcement_mock_db()

    async def override_db():  # type: ignore[no-untyped-def]
        yield mock_db

    app.dependency_overrides[get_current_user] = lambda: _MockUser()
    app.dependency_overrides[get_db] = override_db
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


@pytest.fixture
def student_client() -> Generator[TestClient, None, None]:
    """Test client with student auth and mock DB."""
    mock_db = _build_announcement_mock_db()

    async def override_db():  # type: ignore[no-untyped-def]
        yield mock_db

    app.dependency_overrides[get_current_user] = lambda: _MockStudent()
    app.dependency_overrides[get_db] = override_db
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


class TestAnnouncements:
    """Tests for announcement endpoints."""

    def test_create_announcement(self, educator_client: TestClient) -> None:
        resp = educator_client.post(
            "/api/educator/announcements",
            json={"title": "Test", "content": "Hello class", "priority": "normal"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Test"
        assert data["content"] == "Hello class"
        assert data["priority"] == "normal"
        assert data["educator_name"] == "Prof Smith"

    def test_create_announcement_invalid_priority(
        self, educator_client: TestClient
    ) -> None:
        resp = educator_client.post(
            "/api/educator/announcements",
            json={"title": "Test", "content": "Hello", "priority": "invalid"},
        )
        assert resp.status_code == 400

    def test_list_announcements(self, educator_client: TestClient) -> None:
        resp = educator_client.get("/api/educator/announcements")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_announcements_student_allowed(
        self, student_client: TestClient
    ) -> None:
        """Students can also view announcements."""
        resp = student_client.get("/api/educator/announcements")
        assert resp.status_code == 200

    def test_delete_announcement_not_found(
        self, educator_client: TestClient
    ) -> None:
        resp = educator_client.delete("/api/educator/announcements/999")
        assert resp.status_code == 404

    def test_create_announcement_student_forbidden(
        self, student_client: TestClient
    ) -> None:
        """Students cannot create announcements."""
        resp = student_client.post(
            "/api/educator/announcements",
            json={"title": "Test", "content": "Hello"},
        )
        assert resp.status_code == 403


class TestDirectMessages:
    """Tests for direct message endpoints."""

    def test_send_educator_message_recipient_not_found(
        self, educator_client: TestClient
    ) -> None:
        resp = educator_client.post(
            "/api/educator/messages",
            json={"recipient_id": 999, "content": "Hello"},
        )
        assert resp.status_code == 404

    def test_educator_threads(self, educator_client: TestClient) -> None:
        resp = educator_client.get("/api/educator/messages/threads")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_educator_thread_with_user(
        self, educator_client: TestClient
    ) -> None:
        resp = educator_client.get("/api/educator/messages/10")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_student_reply_recipient_not_found(
        self, student_client: TestClient
    ) -> None:
        resp = student_client.post(
            "/api/messages/reply",
            json={"recipient_id": 999, "content": "Thanks!"},
        )
        assert resp.status_code == 404

    def test_student_inbox(self, student_client: TestClient) -> None:
        resp = student_client.get("/api/messages/inbox")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_student_thread(self, student_client: TestClient) -> None:
        resp = student_client.get("/api/messages/thread/1")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_mark_message_read_not_found(
        self, student_client: TestClient
    ) -> None:
        resp = student_client.put("/api/messages/999/read")
        assert resp.status_code == 404

    def test_send_message_student_forbidden(
        self, student_client: TestClient
    ) -> None:
        """Students cannot use the educator send endpoint."""
        resp = student_client.post(
            "/api/educator/messages",
            json={"recipient_id": 1, "content": "Hi"},
        )
        assert resp.status_code == 403


class TestActivityFeed:
    """Tests for the activity feed endpoint."""

    def test_activity_feed(self, educator_client: TestClient) -> None:
        resp = educator_client.get("/api/educator/activity-feed")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_activity_feed_student_forbidden(
        self, student_client: TestClient
    ) -> None:
        """Students cannot access the activity feed."""
        resp = student_client.get("/api/educator/activity-feed")
        assert resp.status_code == 403

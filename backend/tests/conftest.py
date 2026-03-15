"""Shared test fixtures for CapMan AI backend tests."""

from collections.abc import AsyncGenerator, Generator
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app
from src.auth.dependencies import get_current_user
from src.db.database import get_db


@dataclass
class MockUser:
    """Mock user for tests that need authenticated access."""

    id: int = 1
    username: str = "testuser"
    email: str = "test@example.com"
    role: str = "educator"  # educator so dashboard tests pass
    xp_total: int = 0
    level: int = 1
    firebase_uid: str = "mock_uid"


def _make_mock_db() -> AsyncMock:
    """Create a mock AsyncSession for tests that don't need a real DB."""
    _id_counter = [0]

    mock_session = AsyncMock()
    # Make add() a no-op (synchronous)
    mock_session.add = MagicMock()
    # commit is an async no-op
    mock_session.commit = AsyncMock()

    # refresh sets an auto-incrementing id on objects that don't have one yet
    async def _mock_refresh(obj: object) -> None:
        if hasattr(obj, "id") and getattr(obj, "id") is None:
            _id_counter[0] += 1
            obj.id = _id_counter[0]  # type: ignore[attr-defined]

    mock_session.refresh = AsyncMock(side_effect=_mock_refresh)
    mock_session.get = AsyncMock(return_value=None)
    # Default execute returns empty result set
    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = []
    mock_result.scalars.return_value = mock_scalars
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute = AsyncMock(return_value=mock_result)
    return mock_session


async def _override_get_db() -> AsyncGenerator[AsyncMock, None]:
    """Override get_db to yield a mock session."""
    yield _make_mock_db()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create a FastAPI test client with mocked auth and mock DB."""
    app.dependency_overrides[get_current_user] = lambda: MockUser()
    app.dependency_overrides[get_db] = _override_get_db
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()

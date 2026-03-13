"""Shared test fixtures for CapMan AI backend tests."""

from collections.abc import Generator
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient

from main import app
from src.auth.dependencies import get_current_user


@dataclass
class MockUser:
    """Mock user that mimics the User model for dependency injection."""

    id: int = 1
    username: str = "testuser"
    email: str = "test@example.com"
    role: str = "educator"
    password_hash: str = "hashed"
    xp_total: int = 0
    level: int = 1


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create a FastAPI test client with auth bypassed."""

    async def override_get_current_user() -> MockUser:  # type: ignore[override]
        return MockUser()

    app.dependency_overrides[get_current_user] = override_get_current_user
    yield TestClient(app)
    app.dependency_overrides.pop(get_current_user, None)

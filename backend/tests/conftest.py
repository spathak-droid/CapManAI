"""Shared test fixtures for CapMan AI backend tests."""

from collections.abc import Generator
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient

from main import app
from src.auth.dependencies import get_current_user


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


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create a FastAPI test client with mocked auth."""
    app.dependency_overrides[get_current_user] = lambda: MockUser()
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()

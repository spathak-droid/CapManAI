"""Tests for Firebase authentication."""

from collections.abc import AsyncGenerator, Generator
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from src.auth.dependencies import get_current_user
from src.db.database import get_db

MOCK_FIREBASE_PAYLOAD = {
    "sub": "firebase_uid_123",
    "email": "test@example.com",
    "email_verified": True,
}

_PATCH_TARGET = "src.auth.dependencies.verify_firebase_token"


@dataclass
class _MockUser:
    """Mutable mock user for auth tests."""

    id: int = 1
    firebase_uid: str = "firebase_uid_123"
    username: str = "test"
    email: str = "test@example.com"
    name: str | None = None
    role: str = "student"
    xp_total: int = 0
    level: int = 1


# ----------------------------------------------------------------
# Fixtures
# ----------------------------------------------------------------

_current_mock_user: _MockUser | None = None


def _override_get_current_user() -> _MockUser:
    """Override that returns the module-level mock user."""
    if _current_mock_user is None:
        msg = "Mock user not set"
        raise RuntimeError(msg)
    return _current_mock_user


def _make_empty_result() -> MagicMock:
    """Build a mock result whose scalars().all() returns an empty list."""
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    result.scalar_one_or_none.return_value = None
    return result


async def _mock_get_db() -> AsyncGenerator[
    AsyncMock, None
]:
    """Yield a mock async session."""
    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.execute = AsyncMock(return_value=_make_empty_result())
    mock_session.get = AsyncMock(return_value=None)
    yield mock_session


@pytest.fixture
def auth_client() -> Generator[TestClient, None, None]:
    """Test client with mocked auth returning a student user."""
    global _current_mock_user  # noqa: PLW0603
    _current_mock_user = _MockUser()
    app.dependency_overrides[get_current_user] = (
        _override_get_current_user
    )
    app.dependency_overrides[get_db] = _mock_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
    _current_mock_user = None


@pytest.fixture
def no_auth_client() -> Generator[TestClient, None, None]:
    """Test client with NO auth override (real auth flow)."""
    app.dependency_overrides.clear()
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def _auth_header(
    token: str = "fake-firebase-token",
) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ----------------------------------------------------------------
# Tests: /api/auth/me
# ----------------------------------------------------------------


def test_me_returns_user(auth_client: TestClient) -> None:
    """Authenticated request should return user data."""
    resp = auth_client.get(
        "/api/auth/me", headers=_auth_header()
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "test@example.com"
    assert data["role"] == "student"
    assert data["username"] == "test"


def test_me_unauthenticated(
    no_auth_client: TestClient,
) -> None:
    """Should return 401 without token."""
    resp = no_auth_client.get("/api/auth/me")
    assert resp.status_code == 401


@patch(
    _PATCH_TARGET,
    side_effect=ValueError("bad token"),
)
def test_me_invalid_token(
    mock_verify: object,
    no_auth_client: TestClient,
) -> None:
    """Should return 401 with invalid token."""
    resp = no_auth_client.get(
        "/api/auth/me", headers=_auth_header()
    )
    assert resp.status_code == 401


# ----------------------------------------------------------------
# Tests: /api/auth/me/role
# ----------------------------------------------------------------


def test_update_role_to_educator(
    auth_client: TestClient,
) -> None:
    """Should update role to educator."""
    resp = auth_client.patch(
        "/api/auth/me/role",
        json={"role": "educator"},
        headers=_auth_header(),
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "educator"


def test_update_role_invalid(
    auth_client: TestClient,
) -> None:
    """Should reject invalid role."""
    resp = auth_client.patch(
        "/api/auth/me/role",
        json={"role": "admin"},
        headers=_auth_header(),
    )
    assert resp.status_code == 400


# ----------------------------------------------------------------
# Tests: Protected routes
# ----------------------------------------------------------------


def test_protected_scenario_route_unauthenticated(
    no_auth_client: TestClient,
) -> None:
    """Scenario routes should require auth."""
    resp = no_auth_client.post(
        "/api/scenarios/generate",
        json={
            "market_regime": "bull",
            "instrument_type": "equity",
            "complexity": 2,
            "skill_target": "price_action",
        },
    )
    assert resp.status_code == 401


def test_educator_only_dashboard_denied_for_student(
    auth_client: TestClient,
) -> None:
    """Dashboard should require educator role (student denied)."""
    # Default mock user is a student
    resp = auth_client.get(
        "/api/dashboard/overview", headers=_auth_header()
    )
    assert resp.status_code == 403


def test_educator_can_access_dashboard(
    auth_client: TestClient,
) -> None:
    """Educators should access dashboard."""
    global _current_mock_user  # noqa: PLW0603
    assert _current_mock_user is not None
    _current_mock_user.role = "educator"
    resp = auth_client.get(
        "/api/dashboard/overview", headers=_auth_header()
    )
    assert resp.status_code == 200


def test_educator_can_access_mtss_tiers(
    auth_client: TestClient,
) -> None:
    """Educators should access MTSS tiers."""
    global _current_mock_user  # noqa: PLW0603
    assert _current_mock_user is not None
    _current_mock_user.role = "educator"
    resp = auth_client.get(
        "/api/mtss/tiers", headers=_auth_header()
    )
    assert resp.status_code == 200


def test_student_cannot_access_mtss_tiers(
    auth_client: TestClient,
) -> None:
    """Students should not access MTSS tiers."""
    resp = auth_client.get(
        "/api/mtss/tiers", headers=_auth_header()
    )
    assert resp.status_code == 403


# ----------------------------------------------------------------
# Tests: Firebase token verification unit tests
# ----------------------------------------------------------------


def test_verify_firebase_token_no_kid() -> None:
    """Token without kid header should be rejected."""
    import jwt as pyjwt

    from src.auth.firebase import verify_firebase_token

    # Create a token without kid
    token = pyjwt.encode(
        {"sub": "test"}, "secret", algorithm="HS256"
    )
    with pytest.raises(pyjwt.InvalidTokenError, match="kid"):
        verify_firebase_token(token)

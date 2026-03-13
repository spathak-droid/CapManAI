"""Tests for authentication endpoints."""

import asyncio
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from main import app
from src.db.database import get_db
from src.db.models import Base

_test_engine = create_async_engine(
    "sqlite+aiosqlite://",
    connect_args={"check_same_thread": False},
)
_test_session_factory = async_sessionmaker(
    _test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


def _run_async(coro):  # type: ignore[no-untyped-def]
    """Run an async coroutine synchronously."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@pytest.fixture(autouse=True)
def _setup_db() -> Generator[None, None, None]:
    """Create and drop tables for each test."""

    async def _create() -> None:
        async with _test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def _drop() -> None:
        async with _test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    _run_async(_create())

    async def override_get_db():  # type: ignore[no-untyped-def]
        async with _test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()
    _run_async(_drop())


@pytest.fixture
def auth_client() -> TestClient:
    """Create test client with overridden DB."""
    return TestClient(app)


def _register(
    client: TestClient,
    email: str = "test@example.com",
    username: str = "testuser",
    password: str = "securepassword123",
    role: str = "student",
):  # type: ignore[no-untyped-def]
    return client.post(
        "/api/auth/register",
        json={
            "email": email,
            "username": username,
            "password": password,
            "role": role,
        },
    )


def test_register_success(auth_client: TestClient) -> None:
    resp = _register(auth_client)
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "test@example.com"
    assert data["username"] == "testuser"
    assert data["role"] == "student"
    assert "access_token" in resp.cookies


def test_register_duplicate_email(auth_client: TestClient) -> None:
    _register(auth_client)
    resp = _register(auth_client, username="other")
    assert resp.status_code == 409


def test_login_success(auth_client: TestClient) -> None:
    _register(auth_client)
    resp = auth_client.post(
        "/api/auth/login",
        json={"email": "test@example.com", "password": "securepassword123"},
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "test@example.com"
    assert "access_token" in resp.cookies


def test_login_wrong_password(auth_client: TestClient) -> None:
    _register(auth_client)
    resp = auth_client.post(
        "/api/auth/login",
        json={"email": "test@example.com", "password": "wrong"},
    )
    assert resp.status_code == 401


def test_me_authenticated(auth_client: TestClient) -> None:
    _register(auth_client)
    me_resp = auth_client.get("/api/auth/me")
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == "testuser"


def test_me_unauthenticated(auth_client: TestClient) -> None:
    resp = auth_client.get("/api/auth/me")
    assert resp.status_code == 401


def test_logout(auth_client: TestClient) -> None:
    _register(auth_client)
    resp = auth_client.post("/api/auth/logout")
    assert resp.status_code == 200
    # After logout, cookies cleared -- me should fail
    auth_client.cookies.clear()
    me_resp = auth_client.get("/api/auth/me")
    assert me_resp.status_code == 401


def test_protected_scenario_route(auth_client: TestClient) -> None:
    """Scenario routes should require auth."""
    resp = auth_client.post(
        "/api/scenarios/generate",
        json={
            "market_regime": "bull",
            "instrument_type": "equity",
            "complexity": 2,
            "skill_target": "price_action",
        },
    )
    assert resp.status_code == 401


def test_educator_only_dashboard(auth_client: TestClient) -> None:
    """Dashboard should require educator role."""
    _register(auth_client, role="student")
    resp = auth_client.get("/api/dashboard/overview")
    assert resp.status_code == 403


def test_educator_can_access_dashboard(auth_client: TestClient) -> None:
    """Educators should access dashboard."""
    _register(auth_client, role="educator")
    resp = auth_client.get("/api/dashboard/overview")
    # Should not be 401 or 403
    assert resp.status_code == 200

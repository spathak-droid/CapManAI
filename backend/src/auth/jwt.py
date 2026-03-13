"""JWT token creation and verification."""

from datetime import datetime, timedelta, timezone

from jose import jwt

from src.core.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7


def create_access_token(data: dict[str, object]) -> str:
    """Create a short-lived access token."""
    to_encode: dict[str, object] = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=ALGORITHM)


def create_refresh_token(data: dict[str, object]) -> str:
    """Create a long-lived refresh token."""
    to_encode: dict[str, object] = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, object]:
    """Decode and return payload. Raises JWTError on failure."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])  # type: ignore[no-any-return]

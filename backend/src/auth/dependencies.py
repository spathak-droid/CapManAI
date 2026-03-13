"""FastAPI dependencies for authentication and authorization."""

from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Cookie, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.jwt import decode_token
from src.db.database import get_db
from src.db.models import User


async def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from the access_token cookie."""
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    try:
        payload = decode_token(access_token)
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type"
            )
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    result = await db.execute(select(User).where(User.id == int(user_id)))  # type: ignore[arg-type]
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    return user


def require_role(
    role: str,
) -> Callable[..., Coroutine[Any, Any, User]]:
    """Return a dependency that enforces a specific user role."""

    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {role} role",
            )
        return user

    return role_checker

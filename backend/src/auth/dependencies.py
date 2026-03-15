"""FastAPI dependencies for Firebase authentication."""

from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.firebase import verify_firebase_token
from src.db.database import get_db
from src.db.models import User

_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        _bearer_scheme
    ),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and verify Firebase token, return DB user."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        payload = verify_firebase_token(credentials.credentials)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        ) from exc

    firebase_uid: str = payload["sub"]
    email: str = payload.get("email", "")

    # Find by firebase_uid first
    result = await db.execute(
        select(User).where(User.firebase_uid == firebase_uid)
    )
    user = result.scalar_one_or_none()

    if user is None and email:
        # Check if a user with this email exists (e.g. re-registered in Firebase)
        result = await db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()
        if user is not None:
            # Update the firebase_uid to the new one
            user.firebase_uid = firebase_uid
            await db.commit()
            await db.refresh(user)

    if user is None:
        # Auto-create user on first login
        username = email.split("@")[0] if email else firebase_uid[:20]
        # Ensure unique username
        existing = await db.execute(
            select(User).where(User.username == username)
        )
        if existing.scalar_one_or_none():
            username = f"{username}_{firebase_uid[:6]}"

        user = User(
            firebase_uid=firebase_uid,
            email=email,
            username=username,
            role="student",
        )
        db.add(user)
        try:
            await db.commit()
        except IntegrityError:
            # Race condition: another request already created this user
            await db.rollback()
            result = await db.execute(
                select(User).where(User.firebase_uid == firebase_uid)
            )
            user = result.scalar_one_or_none()
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create or find user",
                )
            return user
        await db.refresh(user)

    return user


def require_role(
    role: str,
) -> Callable[..., Coroutine[Any, Any, User]]:
    """Dependency that checks the user has a specific role."""

    async def role_checker(
        user: User = Depends(get_current_user),
    ) -> User:
        if user.role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {role} role",
            )
        return user

    return role_checker

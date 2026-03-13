"""Authentication API routes."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.dependencies import get_current_user
from src.auth.jwt import create_access_token, create_refresh_token
from src.auth.passwords import hash_password, verify_password
from src.auth.schemas import LoginRequest, RegisterRequest, UserResponse
from src.db.database import get_db
from src.db.models import User

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_auth_cookies(response: Response, user_id: int) -> None:
    access = create_access_token({"sub": str(user_id)})
    refresh = create_refresh_token({"sub": str(user_id)})
    response.set_cookie(
        "access_token",
        access,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=1800,
    )
    response.set_cookie(
        "refresh_token",
        refresh,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=604800,
    )


@auth_router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    req: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Register a new user."""
    existing = await db.execute(
        select(User).where((User.email == req.email) | (User.username == req.username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or username already taken",
        )

    user = User(
        email=req.email,
        username=req.username,
        password_hash=hash_password(req.password),
        role=req.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    _set_auth_cookies(response, user.id)
    return user


@auth_router.post("/login", response_model=UserResponse)
async def login(
    req: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authenticate and log in a user."""
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if (
        not user
        or not user.password_hash
        or not verify_password(req.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    _set_auth_cookies(response, user.id)
    return user


@auth_router.post("/logout")
async def logout(response: Response) -> dict[str, str]:
    """Log out by clearing auth cookies."""
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "logged out"}


@auth_router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)) -> User:
    """Get the currently authenticated user."""
    return user

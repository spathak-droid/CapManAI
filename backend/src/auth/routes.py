"""Auth routes for Firebase-authenticated users."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.dependencies import get_current_user
from src.auth.schemas import UpdateRoleRequest, UserResponse
from src.db.database import get_db
from src.db.models import User

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


@auth_router.get("/me", response_model=UserResponse)
async def get_me(
    user: User = Depends(get_current_user),
) -> User:
    """Return the current authenticated user."""
    return user


@auth_router.patch("/me/role", response_model=UserResponse)
async def update_role(
    req: UpdateRoleRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Update current user's role."""
    if req.role not in ("student", "educator"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'student' or 'educator'",
        )
    user.role = req.role
    await db.commit()
    await db.refresh(user)
    return user

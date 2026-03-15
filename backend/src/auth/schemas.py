"""Auth-related Pydantic schemas."""

from pydantic import BaseModel


class UserResponse(BaseModel):
    """Public user data returned by auth endpoints."""

    id: int
    username: str
    email: str
    name: str | None
    role: str
    xp_total: int
    level: int

    model_config = {"from_attributes": True}


class UpdateRoleRequest(BaseModel):
    """Request to update a user's role."""

    role: str  # "student" or "educator"


class UpdateProfileRequest(BaseModel):
    """Request to update a user's profile."""

    name: str | None = None
    role: str | None = None

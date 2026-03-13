"""Pydantic schemas for authentication."""

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    """Registration request body."""

    email: str
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8)
    role: str = Field(pattern="^(student|educator)$")


class LoginRequest(BaseModel):
    """Login request body."""

    email: str
    password: str


class UserResponse(BaseModel):
    """Public user data returned from auth endpoints."""

    id: int
    username: str
    email: str
    role: str
    xp_total: int
    level: int

    model_config = {"from_attributes": True}

"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """CapMan AI backend configuration."""

    DATABASE_URL: str = "postgresql+asyncpg://localhost/capman"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL: str = "anthropic/claude-sonnet-4-20250514"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

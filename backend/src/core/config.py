"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """CapMan AI backend configuration."""

    DATABASE_URL: str = "postgresql+asyncpg://localhost/capman"
    OPEN_ROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPEN_ROUTER_MODEL: str = "anthropic/claude-sonnet-4-20250514"
    JWT_SECRET: str = "change-me-in-production"
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def openrouter_api_key(self) -> str:
        return self.OPEN_ROUTER_API_KEY

    @property
    def openrouter_model(self) -> str:
        return self.OPEN_ROUTER_MODEL


settings = Settings()

"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """CapMan AI backend configuration."""

    DATABASE_URL: str = "postgresql+asyncpg://localhost/capman"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL: str = "anthropic/claude-sonnet-4-20250514"
    FIREBASE_PROJECT_ID: str = "capmanai"
    FRONTEND_URL: str = "http://localhost:3000"
    PORT: int = 8000

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def openrouter_api_key(self) -> str:
        """Alias for OPENROUTER_API_KEY."""
        return self.OPENROUTER_API_KEY

    @property
    def openrouter_model(self) -> str:
        """Alias for OPENROUTER_MODEL."""
        return self.OPENROUTER_MODEL


settings = Settings()

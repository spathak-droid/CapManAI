"""FastAPI application entry point for CapMan AI."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.assistant_routes import router as assistant_router
from src.api.routes import router
from src.auth.routes import auth_router
from src.challenges.routes import router as challenges_router
from src.realtime.routes import router as realtime_router
from src.core.config import settings
from src.db.database import async_session_factory
from src.lessons.persistence import seed_lessons_to_db


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Seed lesson data on startup. Schema managed by Alembic."""
    async with async_session_factory() as session:
        await seed_lessons_to_db(session)
    yield


app = FastAPI(
    title="CapMan AI",
    description="Gamified trading scenario training platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(assistant_router)
app.include_router(auth_router)
app.include_router(challenges_router)
app.include_router(realtime_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
    )

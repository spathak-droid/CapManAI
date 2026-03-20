"""FastAPI application entry point for CapMan AI."""

import logging
import traceback
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sqlalchemy import text

from src.api.assistant_routes import router as assistant_router
from src.api.routes import router
from src.auth.routes import auth_router
from src.challenges.routes import router as challenges_router
from src.core.config import settings
from src.db.database import engine
from src.peer_review.routes import router as peer_review_router
from src.realtime.routes import router as realtime_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Warm up the DB connection pool, then serve."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("DB connection pool warmed up.")
    except Exception:
        logger.warning("DB warmup failed — first requests may be slow.")
    yield


app = FastAPI(
    title="CapMan AI",
    description="Gamified trading scenario training platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3005",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(assistant_router)
app.include_router(auth_router)
app.include_router(challenges_router)
app.include_router(peer_review_router)
app.include_router(realtime_router)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch unhandled exceptions and ensure CORS headers are present."""
    tb = traceback.format_exc()
    print(f"\n{'='*60}\n500 ERROR: {type(exc).__name__} on {request.method} {request.url.path}\n{exc}\n{tb}\n{'='*60}\n", flush=True)
    logger.error("Unhandled %s on %s %s: %s\n%s", type(exc).__name__, request.method, request.url.path, exc, tb)
    origin = request.headers.get("origin", "")
    headers: dict[str, str] = {}
    allowed = [settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:3001", "http://localhost:3005"]
    if origin in allowed:
        headers["access-control-allow-origin"] = origin
        headers["access-control-allow-credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=headers,
    )


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

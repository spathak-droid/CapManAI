"""FastAPI application entry point for CapMan AI."""

import asyncio
import logging
import traceback
from collections.abc import AsyncIterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
logger = logging.getLogger(__name__)

from src.api.assistant_routes import router as assistant_router
from src.api.routes import router
from src.auth.routes import auth_router
from src.challenges.routes import router as challenges_router
from src.peer_review.routes import router as peer_review_router
from src.realtime.routes import router as realtime_router
from src.core.config import settings
from src.db.database import async_session_factory
from src.lessons.persistence import seed_lessons_to_db
from src.rag.seed import seed_rag_documents


def _warm_embedding_model() -> None:
    """Pre-warm the sentence-transformers model so the first request isn't blocked."""
    from src.rag.embeddings import compute_embedding

    compute_embedding("warmup")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Seed lesson data on startup. Schema managed by Alembic."""
    async with async_session_factory() as session:
        await seed_lessons_to_db(session)
        await seed_rag_documents(session)
    loop = asyncio.get_running_loop()
    loop.run_in_executor(ThreadPoolExecutor(max_workers=1), _warm_embedding_model)
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
app.include_router(peer_review_router)
app.include_router(realtime_router)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch unhandled exceptions so CORS headers are still added."""
    logger.error("Unhandled exception on %s %s:\n%s", request.method, request.url.path, traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
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

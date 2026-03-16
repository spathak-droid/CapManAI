"""API route definitions for CapMan AI.

This module aggregates all feature-specific route modules into a single
router that is mounted by the FastAPI application.
"""

from fastapi import APIRouter

from src.api.routes_content import router as content_router
from src.api.routes_gamification import router as gamification_router
from src.api.routes_lessons import router as lessons_router
from src.api.routes_messaging import router as messaging_router
from src.api.routes_scenarios import router as scenarios_router
from src.api.routes_users import router as users_router

router = APIRouter()

router.include_router(scenarios_router)
router.include_router(gamification_router)
router.include_router(lessons_router)
router.include_router(users_router)
router.include_router(messaging_router)
router.include_router(content_router)

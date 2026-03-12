"""API route definitions for CapMan AI."""

from fastapi import APIRouter

router = APIRouter()

NOT_IMPLEMENTED = {"status": "not implemented"}


@router.post("/api/scenarios/generate")
async def generate_scenario() -> dict[str, str]:
    """Generate a new trading scenario using LLM."""
    return NOT_IMPLEMENTED


@router.post("/api/scenarios/respond")
async def respond_to_scenario() -> dict[str, str]:
    """Submit a response to a trading scenario."""
    return NOT_IMPLEMENTED


@router.post("/api/scenarios/probe")
async def probe_response() -> dict[str, str]:
    """Generate probing follow-up questions for a response."""
    return NOT_IMPLEMENTED


@router.post("/api/scenarios/grade")
async def grade_response() -> dict[str, str]:
    """Grade a scenario response with probing answers."""
    return NOT_IMPLEMENTED


@router.get("/api/gamification/xp/{user_id}")
async def get_user_xp(user_id: int) -> dict[str, str]:
    """Get XP details for a user."""
    return NOT_IMPLEMENTED


@router.get("/api/leaderboard")
async def get_leaderboard() -> dict[str, str]:
    """Get the current leaderboard rankings."""
    return NOT_IMPLEMENTED


@router.get("/api/mtss/tiers")
async def get_mtss_tiers() -> dict[str, str]:
    """Get MTSS tier classifications."""
    return NOT_IMPLEMENTED


@router.get("/api/dashboard/overview")
async def get_dashboard_overview() -> dict[str, str]:
    """Get dashboard overview data."""
    return NOT_IMPLEMENTED

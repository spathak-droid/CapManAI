# CapMan AI — 2-Day Sprint Plan

## Deadline: 2026-03-14

## Task Dependency Graph
```
Task 1 (Backend Init) ──┬──→ Task 3 (Scenario Gen) ──┐
                        ├──→ Task 4 (Grading Agent) ──┼──→ Task 6 (Student UI) ──┐
                        ├──→ Task 5 (Gamification+MTSS)┤                         ├──→ Task 8 (Integration+Deploy)
Task 2 (Frontend Init) ─┴──────────────────────────────┴──→ Task 7 (Dashboard) ──┘
```

## Build Order
- Phase 1 (parallel): Tasks 1+2 — project scaffolds
- Phase 2 (parallel): Tasks 3+4+5 — backend features
- Phase 3 (parallel): Tasks 6+7 — frontend features
- Phase 4: Task 8 — integration + deploy

## Architecture
- Backend: Python + FastAPI (Railway)
- Frontend: Next.js / React (Vercel)
- LLM: OpenRouter (anthropic/claude-sonnet-4-20250514)
- Database: PostgreSQL

## Key Endpoints
- POST /api/scenarios/generate, /respond, /probe, /grade
- GET /api/gamification/xp/{user_id}, /api/leaderboard
- GET /api/mtss/tiers, /api/dashboard/overview

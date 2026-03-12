# CapMan AI — 2-Day Sprint Plan

## Deadline: 2026-03-14

## Task Dependency Graph
```
Task 1 (Backend Init) ✅ ─┬──→ Task 3 (Scenario Gen) 🔄 ──┐
                          ├──→ Task 4 (Grading Agent) 🔄 ──┼──→ Task 6 (Student UI) ⏳
                          ├──→ Task 5 (Gamification+MTSS) 🔄┤
Task 2 (Frontend Init) 🔄┴──────────────────────────────────┴──→ Task 7 (Dashboard) ⏳ ──→ Task 8 (Deploy) ⏳
```

## Status
- Phase 1: ✅ Backend init complete, 🔄 Frontend init running
- Phase 2: 🔄 Scenario Gen, Grading Agent, Gamification+MTSS all running in parallel
- Phase 3: ⏳ Waiting (Student UI, Dashboard)
- Phase 4: ⏳ Waiting (Integration + Deploy)

## Architecture
- Backend: Python + FastAPI (Railway) — uv managed
- Frontend: Next.js / React (Vercel) — pnpm managed
- LLM: OpenRouter (anthropic/claude-sonnet-4-20250514)
- Database: PostgreSQL (in-memory stores for MVP)
- MVP approach: in-memory data stores, no DB migration needed for demo

## Key Endpoints
- POST /api/scenarios/generate, /respond, /probe, /grade
- GET /api/gamification/xp/{user_id}, /api/leaderboard
- GET /api/mtss/tiers, /api/dashboard/overview

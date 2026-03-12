# System Patterns: CapMan AI

## Architecture Overview
Monorepo with Python backend (FastAPI) and Next.js frontend. LLM calls routed through OpenRouter. PostgreSQL for persistence. RAG pipeline for proprietary CapMan documents.

## Key Components
- **Scenario Generator**: LLM-powered engine producing varied trading scenarios across market regimes
- **Grading Agent**: LLM-powered probing and evaluation of student reasoning
- **Gamification Engine**: XP calculation, leaderboard ranking, challenge matchmaking
- **Peer Review System**: Structured peer evaluation workflows
- **MTSS Engine**: Performance analysis, tier classification, intervention triggers
- **RAG Pipeline**: Document ingestion and retrieval for CapMan-specific context
- **Atlas Integration**: Python tooling bridge for CapMan-specific instruments
- **API Layer**: FastAPI REST/WebSocket endpoints
- **Frontend**: Next.js app with dashboards, scenario UI, leaderboards

## Design Decisions
See `.claude/decisions/` directory for detailed ADRs.

## Patterns in Use
To be updated as patterns are established.

# Tech Context: CapMan AI

## Stack
- **Backend Language**: Python 3.12+
- **Backend Framework**: FastAPI
- **Backend Package Manager**: uv
- **Frontend Framework**: Next.js (React)
- **Frontend Package Manager**: pnpm
- **LLM Provider**: OpenRouter (multi-model access)
- **Database**: PostgreSQL
- **Linter (Python)**: Ruff (`uv run ruff check .`)
- **Type Checker (Python)**: Pyright (`uv run pyright`)
- **Test Runner (Python)**: pytest (`uv run pytest`)
- **Linter (Frontend)**: ESLint (`pnpm lint`)
- **Type Checker (Frontend)**: TypeScript (`pnpm tsc --noEmit`)
- **Test Runner (Frontend)**: Vitest (`pnpm test`)

## External Services
- OpenRouter API — LLM inference for scenario generation and grading
- PostgreSQL — User data, scores, scenarios, MTSS tracking
- Atlas — CapMan proprietary tooling (Python)

## Deployment
- **Frontend**: Vercel
- **Backend**: Railway
- **Database**: Railway (managed PostgreSQL) or external provider

## Project Structure
```
capman-ai/
├── backend/           # Python FastAPI application
│   ├── src/
│   │   ├── scenario_gen/
│   │   ├── grading/
│   │   ├── gamification/
│   │   ├── peer_review/
│   │   ├── mtss/
│   │   ├── atlas/
│   │   ├── rag/
│   │   ├── api/
│   │   ├── db/
│   │   └── core/
│   ├── tests/
│   └── pyproject.toml
├── frontend/          # Next.js application
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── types/
│   ├── package.json
│   └── tsconfig.json
└── .claude/
    ├── memory-bank/
    ├── decisions/
    └── skills/
```

## Constraints
- Must integrate with Atlas Python tooling
- Must enforce proprietary CapMan lexicon (not generic financial theory)
- System latency must support real-time competitive scenarios
- AI grading must correlate with human-educator benchmarks

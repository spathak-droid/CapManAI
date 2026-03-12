---
name: code-quality
description: Code quality standards for CapMan AI. Use when writing code, reviewing code, running quality checks, or when asked about linting, type checking, testing conventions, or code style.
---

# Code Quality Standards

## Quality Gate Commands

```bash
# Backend (Python)
uv run ruff check .        # Lint check
uv run pyright             # Type check
uv run pytest              # Run tests

# Frontend (Next.js)
pnpm lint                  # Lint check
pnpm tsc --noEmit          # Type check
pnpm test                  # Run tests
```

All must pass before committing, creating PRs, or merging.

## Backend — Python

### Linter/Formatter
- **Ruff** for linting and formatting (configured in `pyproject.toml`)
- Line length: 88
- Target: Python 3.12+

### Type Checking
- **Pyright** in strict mode (configured in `pyproject.toml`)
- All public functions must have type annotations

### Testing
- **pytest** with pytest-asyncio for async tests
- Test directory mirrors source: `tests/` parallels `src/`
- Fixtures in `conftest.py`

## Frontend — Next.js

### Linter/Formatter
- **ESLint** with Next.js config
- **Prettier** for formatting

### Type Checking
- **TypeScript** strict mode (`tsconfig.json`)

### Testing
- **Vitest** or **Jest** for unit/integration tests
- **React Testing Library** for component tests

## Module Structure

```
capman-ai/
├── backend/
│   ├── src/
│   │   ├── scenario_gen/      # Dynamic scenario generation
│   │   ├── grading/           # Probing & grading agent
│   │   ├── gamification/      # XP, leaderboards, challenges
│   │   ├── peer_review/       # Peer review module
│   │   ├── mtss/              # MTSS reporting & tiers
│   │   ├── atlas/             # Atlas tooling integration
│   │   ├── rag/               # RAG pipeline for CapMan docs
│   │   ├── api/               # FastAPI routes
│   │   ├── db/                # Database models & migrations
│   │   └── core/              # Shared config, utils
│   ├── tests/
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js app router
│   │   ├── components/        # React components
│   │   ├── lib/               # Client utilities
│   │   └── types/             # TypeScript types
│   ├── package.json
│   └── tsconfig.json
└── .claude/
    ├── memory-bank/
    ├── decisions/
    └── skills/
```

## Quality Checklist

Before considering code complete:
1. Lint check passes -- zero violations
2. Type check passes -- zero errors
3. All tests pass
4. New code has tests
5. No secrets or credentials in code

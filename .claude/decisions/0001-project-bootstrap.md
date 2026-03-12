# 0001: Project Bootstrap

**Date:** 2026-03-12
**Status:** accepted

## Context
Setting up the development workflow for CapMan AI — a gamified scenario training and MTSS agent for trading education. Need to establish tooling, workflow patterns, and team conventions.

## Decision
Adopted an agentic development workflow with:
- **Orchestrator pattern**: Main agent decomposes and delegates; spawned agents implement in isolated worktrees
- **Backend**: Python 3.12+, FastAPI, uv package manager
- **Frontend**: Next.js (React), pnpm package manager
- **LLM**: OpenRouter (multi-model access for scenario generation and grading)
- **Database**: PostgreSQL
- **Deployment**: Vercel (frontend) + Railway (backend)
- **Quality gates (Python)**: `uv run ruff check .`, `uv run pyright`, `uv run pytest`
- **Quality gates (Frontend)**: `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test`
- **Memory bank**: Six-file cross-session knowledge persistence
- **Decision log**: Lightweight ADRs in .claude/decisions/
- **TDD**: Yes — red-green-refactor workflow
- **Conventional commits**: type(scope): description

## Consequences
- Consistent workflow across all development sessions
- Knowledge persists across sessions via memory bank
- Architectural decisions are traceable via decision log
- Agents work in isolation, reducing conflicts
- Quality gates enforce standards automatically
- Dual-stack (Python + Node) adds complexity but separates concerns cleanly

## Alternatives Considered
- **FastAPI + HTMX** (all Python) — rejected because Next.js provides better real-time UI, gamification, and dashboard capabilities
- **Streamlit** — rejected as too limited for gamification and multi-user real-time features
- **Single LLM provider** — rejected in favor of OpenRouter for model flexibility
- **Manual workflow without orchestration** — rejected for inconsistency across sessions

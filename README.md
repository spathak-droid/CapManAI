# CapMan AI

**Gamified Capital Markets Training Platform**

An AI-powered educational platform that teaches capital markets concepts through interactive lessons, trading scenario simulations, peer review, and gamification. Built for the EdTeam AI Gauntlet. Features MTSS (Multi-Tiered System of Support) analytics for educators.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [CI/CD](#cicd)
- [License](#license)

## Features

- Interactive Lessons with micro-quizzes and mastery tracking
- AI-Generated Trading Scenarios (multi-model via OpenRouter)
- Peer Review system for collaborative learning
- Real-time Challenges with matchmaking
- Gamification (XP, levels, badges, leaderboard, streaks)
- MTSS Analytics Dashboard for educators
- RAG-enhanced learning with proprietary trading documents
- Real-time messaging and announcements (WebSocket)
- AI Teaching Assistant (context-aware chat)

## Tech Stack

| Layer | Technology |
|------------|--------------------------------------------------|
| Frontend   | Next.js, React, TypeScript, Tailwind CSS, GSAP   |
| Backend    | Python, FastAPI, SQLAlchemy, Alembic              |
| Database   | PostgreSQL                                        |
| Auth       | Firebase Authentication                           |
| LLM        | OpenRouter (multi-model)                          |
| Deployment | Railway (backend), Vercel (frontend)              |

## Project Structure

```
CapManAI/
├── backend/
│   ├── src/
│   │   ├── api/          # FastAPI route handlers
│   │   ├── auth/         # Firebase auth dependencies
│   │   ├── db/           # SQLAlchemy models & database
│   │   ├── gamification/ # XP, badges, leaderboard, mastery
│   │   ├── grading/      # AI-powered response grading
│   │   ├── lessons/      # Lesson content, quizzes, progress
│   │   ├── peer_review/  # Peer review system
│   │   ├── rag/          # RAG pipeline & document store
│   │   └── scenario_gen/ # AI scenario generation
│   ├── tests/
│   ├── alembic/          # Database migrations
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js App Router pages
│   │   ├── components/   # React components
│   │   ├── contexts/     # React contexts (Auth, Realtime)
│   │   └── lib/          # API client, hooks, types, utils
│   ├── public/
│   └── package.json
└── .github/workflows/    # CI pipelines
```

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.12+
- PostgreSQL
- Firebase project
- OpenRouter API key

### Backend Setup

```bash
cd backend
cp .env.example .env  # Configure environment variables
uv sync
uv run alembic upgrade head
uv run uvicorn src.main:app --reload
```

### Frontend Setup

```bash
cd frontend
cp .env.example .env.local  # Configure environment variables
pnpm install
pnpm dev
```

## Environment Variables

### Backend

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM access |
| `FIREBASE_CREDENTIALS` | Firebase service account credentials (JSON) |

### Frontend

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |

## Scripts

### Backend

| Command | Description |
|---|---|
| `uv run ruff check .` | Lint |
| `uv run pyright` | Type check |
| `uv run pytest` | Test |

### Frontend

| Command | Description |
|---|---|
| `pnpm dev` | Development server |
| `pnpm lint` | Lint |
| `pnpm tsc --noEmit` | Type check |
| `pnpm test` | Test |
| `pnpm build` | Production build |

## CI/CD

GitHub Actions workflows run lint, type check, and test on every push and pull request for both the backend and frontend.

## License

MIT

# CapMan AI -- Backend

Python FastAPI backend for the CapMan AI gamified trading education platform.

## Tech Stack

- **Framework**: FastAPI
- **Language**: Python 3.12+
- **ORM**: SQLAlchemy (async)
- **Migrations**: Alembic
- **Database**: PostgreSQL
- **Auth**: Firebase Admin SDK
- **LLM**: OpenRouter (multi-model)
- **Package Manager**: uv
- **Testing**: pytest

## Directory Structure

```
src/
├── api/                    # FastAPI route handlers
│   ├── routes.py           # Router aggregator
│   ├── routes_lessons.py   # /api/lessons/* endpoints
│   ├── routes_scenarios.py # /api/scenarios/* endpoints
│   ├── routes_challenges.py        # (in routes_gamification)
│   ├── routes_gamification.py      # /api/skills/*, /api/leaderboard/*, /api/badges/*, /api/mtss/*
│   ├── routes_messaging.py # /api/messages/*, /api/announcements/*
│   ├── routes_users.py     # /api/educator/students/*, /api/educator/export/*
│   ├── routes_content.py   # /api/rag/* endpoints
│   └── schemas.py          # Pydantic request/response models
├── auth/                   # Firebase authentication
│   ├── firebase.py         # Token verification
│   └── dependencies.py     # FastAPI auth dependencies
├── db/                     # Database layer
│   ├── models.py           # SQLAlchemy models (26 tables)
│   └── database.py         # Engine and session config
├── gamification/           # Gamification engine
│   ├── mastery.py          # Mastery scoring
│   ├── leaderboard.py      # Leaderboard logic
│   └── badges.py           # Badge calculation
├── grading/                # AI-powered grading
│   └── grader.py           # LLM-based response grading
├── lessons/                # Lesson system
│   ├── service.py          # Quiz scoring, progress, streaks
│   ├── repository.py       # DB queries for lessons
│   ├── persistence.py      # Lesson content seeding
│   ├── _types.py           # Shared dataclasses
│   └── seeds/              # Seed data (catalog.json)
├── peer_review/            # Peer review system
│   ├── routes.py           # Peer review endpoints
│   └── service.py          # Assignment and scoring
├── rag/                    # Retrieval-Augmented Generation
│   ├── service.py          # RAG pipeline
│   ├── embeddings.py       # OpenRouter embeddings
│   └── documents/          # Source trading education docs
└── scenario_gen/           # AI scenario generation
    └── generator.py        # Multi-model scenario builder
alembic/                    # Database migrations
tests/                      # Test suite (pytest)
```

## Setup

```bash
uv sync
cp .env.example .env  # Configure environment variables
uv run alembic upgrade head
uv run uvicorn src.main:app --reload
```

## Scripts

| Command | Description |
|---|---|
| `uv run uvicorn src.main:app --reload` | Start dev server |
| `uv run ruff check .` | Lint |
| `uv run pyright` | Type check |
| `uv run pytest` | Run tests |
| `uv run alembic upgrade head` | Run migrations |
| `uv run alembic revision --autogenerate -m "desc"` | Create migration |

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM access |
| `FIREBASE_CREDENTIALS` | Firebase service account JSON |

## API Route Modules

| Module | Prefix | Description |
|---|---|---|
| `routes_lessons` | `/api/lessons/` | Modules, chunks, quizzes, progress, streaks |
| `routes_scenarios` | `/api/scenarios/` | AI scenario generation, grading, history |
| `routes_gamification` | `/api/skills/`, `/api/leaderboard/`, `/api/badges/` | XP, mastery, badges, MTSS analytics |
| `routes_messaging` | `/api/messages/`, `/api/announcements/` | Direct messaging, announcements |
| `routes_users` | `/api/educator/` | Student management, feedback, CSV export |
| `routes_content` | `/api/rag/` | RAG document management |
| `peer_review/routes` | `/api/peer-review/` | Peer review submissions and assignments |

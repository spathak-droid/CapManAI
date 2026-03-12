---
name: commit
description: Conventional commit format and pre-commit workflow for CapMan AI. Use when committing code, preparing changes for commit, or when asked about commit message format.
---

# Commit Standards

## Conventional Commit Format

```
type(scope): short description

Optional body explaining the "why" not the "what".

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Types

| Type       | When to use                                    |
|------------|------------------------------------------------|
| `feat`     | New feature or capability                      |
| `fix`      | Bug fix                                        |
| `refactor` | Code change that neither fixes nor adds        |
| `docs`     | Documentation only                             |
| `test`     | Adding or updating tests                       |
| `chore`    | Build process, dependencies, tooling, config   |

## Scopes

| Scope         | Area                                         |
|---------------|----------------------------------------------|
| scenario-gen  | Dynamic scenario generation engine           |
| grading       | Probing & grading agent                      |
| gamification  | XP, leaderboards, challenges                 |
| peer-review   | Peer review module                           |
| mtss          | MTSS reporting and tier classification       |
| api           | Backend API (FastAPI)                        |
| ui            | Frontend (Next.js)                           |
| atlas         | Atlas tooling integration                    |
| db            | Database models and migrations               |
| rag           | RAG pipeline for proprietary docs            |
| config        | Settings, environment, project config        |
| ci            | CI/CD pipelines                              |
| deps          | Dependency changes                           |
| decisions     | Architecture decision records                |

## Pre-Commit Checklist

ALL must pass before committing:

```bash
# Backend
uv run ruff check .
uv run pyright
uv run pytest

# Frontend
pnpm lint
pnpm tsc --noEmit
pnpm test
```

Do not use `--no-verify` or skip checks.

## Atomic Commit Rules

- One logical change per commit
- Do not mix features with formatting
- Do not mix refactoring with new features
- Tests go in the same commit as the feature
- Dependency additions go with the code using them

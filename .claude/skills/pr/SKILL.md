---
name: pr
description: Pull request workflow for CapMan AI. Use when creating PRs, preparing branches for review, or when asked about PR format, branch naming, or review checklists.
---

# Pull Request Workflow

## Branch Naming

Format: `type/short-description`

Examples: `feat/scenario-generator`, `fix/grading-null-response`, `refactor/extract-llm-service`

## PR Creation

```bash
gh pr create --title "type(scope): description" --body "$(cat <<'EOF'
## Summary
- Bullet points describing the change

## Changes
- `path/to/file.ext` -- what changed

## Test Plan
- [ ] `uv run ruff check .` passes
- [ ] `uv run pyright` passes
- [ ] `uv run pytest` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test` passes
- [ ] Manual verification: [describe]

Generated with Claude Code
EOF
)"
```

## Review Checklist

### Code Quality
- [ ] No hardcoded secrets or API keys
- [ ] No commented-out code blocks
- [ ] Follows project conventions

### Testing
- [ ] New code has corresponding tests
- [ ] All tests pass
- [ ] Edge cases covered

### Tooling
- [ ] Lint check passes
- [ ] Type check passes

### Architecture
- [ ] No circular imports/dependencies
- [ ] Config in config files, not hardcoded

### Git Hygiene
- [ ] Conventional commit format
- [ ] Atomic commits
- [ ] Branch name follows type/description convention

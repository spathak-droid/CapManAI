---
name: tdd-workflow
description: Test-Driven Development workflow for CapMan AI. Use when writing tests, implementing features with TDD, or when asked about test-first development, red-green-refactor, or testing patterns.
---

# TDD Workflow

## Red-Green-Refactor Cycle

### 1. RED -- Write a Failing Test
- Understand the requirement
- Write a test that describes the expected behavior
- Run tests -- confirm it FAILS
- Commit: `test(scope): add failing test for [feature]`

### 2. GREEN -- Make It Pass
- Write the MINIMUM code to make the test pass
- No extra features, no "while I'm here" changes
- Run tests -- confirm it PASSES
- Commit: `feat(scope): implement [feature]`

### 3. REFACTOR -- Improve the Code
- Clean up the implementation
- Remove duplication, improve naming
- Run tests -- confirm tests still PASS
- Commit: `refactor(scope): clean up [feature]`

## Test Quality Rules

**Good tests:**
- Test behavior, not implementation
- One assertion per test (when practical)
- Descriptive names: `test_should_[behavior]_when_[condition]`
- Independent -- no shared mutable state between tests
- Fast -- mock external dependencies (LLM calls, DB where appropriate)

## Test Structure (Arrange-Act-Assert)

### Python (pytest)
```python
def test_should_generate_scenario_when_given_market_regime():
    # Arrange
    generator = ScenarioGenerator(regime="bull_market")

    # Act
    scenario = generator.generate()

    # Assert
    assert scenario.regime == "bull_market"
    assert scenario.prompt is not None
```

### TypeScript (Jest/Vitest)
```typescript
it('should render leaderboard with ranked users', () => {
  // Arrange
  const users = [{ name: 'Alice', xp: 500 }, { name: 'Bob', xp: 300 }];

  // Act
  render(<Leaderboard users={users} />);

  // Assert
  expect(screen.getByText('Alice')).toBeInTheDocument();
});
```

## When to Mock

**DO mock:** OpenRouter API calls, database queries (in unit tests), external services, Atlas tooling
**DON'T mock:** The code you're testing, simple utility functions, data models

## TDD Checklist

Before implementing any feature:
1. Ask: "What test would prove this works?"
2. Write that test
3. Run it -- watch it fail (RED)
4. Implement the minimum to pass
5. Run it -- watch it pass (GREEN)
6. Clean up if needed (REFACTOR)
7. Repeat for the next behavior

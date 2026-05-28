---
name: testing
description: Use this skill when writing tests, improving coverage, debugging test failures, creating regression tests, or setting up quality checks.
---

# Testing Skill

## Purpose

Add reliable tests and prevent regressions.

## Test Priority

Prefer the smallest useful test first:

1. Unit tests for pure logic
2. Integration tests for API/database behaviour
3. End-to-end tests for critical user journeys
4. Manual smoke tests if automated tests are not available

## Test Design

Good tests should be:

- deterministic
- readable
- isolated
- fast
- behaviour-focused
- not overly coupled to implementation details

## Given / When / Then Template

Use:

```text
Given:
When:
Then:
Edge cases:
```

## Regression Testing

For bug fixes:

1. Reproduce the bug with a failing test if practical.
2. Fix the bug.
3. Confirm the test passes.
4. Check nearby edge cases.

## Common Commands

Use commands that match the project.

Examples:

```powershell
pnpm test
pnpm vitest
pnpm playwright test
npm test
python -m pytest
```

## Final Output

```text
Test Summary:
- Tests added:
- Behaviour covered:
- Edge cases:
- Command run:
- Result:
- Remaining gaps:
```

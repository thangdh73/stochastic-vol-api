---
name: code-review
description: Use this skill when reviewing code quality, architecture, security, performance, maintainability, pull-request readiness, or generated code.
---

# Code Review Skill

## Review Priority

Review in this order:

1. Correctness
2. Security
3. Data integrity
4. Error handling
5. Performance
6. Maintainability
7. Test coverage
8. Documentation
9. Style

## Severity Levels

Use:

```text
Critical - must fix before merge
High - should fix before release
Medium - should fix soon
Low - improvement or nit
```

## What To Check

Check for:

- hidden breaking changes
- missing validation
- auth bypass risk
- hard-coded secrets
- insecure data handling
- duplicated logic
- poor error handling
- race conditions
- memory leaks
- missing tests
- unclear naming
- over-engineering
- stale documentation

## Output Format

```text
Code Review Summary:

Overall assessment:
- Ready / Not ready / Ready with minor changes

Findings:
1. [Severity] Issue title
   - Location:
   - Problem:
   - Why it matters:
   - Suggested fix:

Positive notes:
- ...

Recommended next actions:
1. ...
2. ...
```

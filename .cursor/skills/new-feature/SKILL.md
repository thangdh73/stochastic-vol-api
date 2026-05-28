---
name: new-feature
description: Use this skill when building a new feature, adding a module, creating a workflow, adding API endpoints, adding UI, or extending app functionality.
---

# New Feature Skill

## Purpose

Build new features using a controlled Research → Plan → Build → Verify workflow.

## When To Use

Use this skill when the user asks to:

- add a new feature
- build a new module
- create frontend and backend functionality
- add API endpoints
- add database-backed behaviour
- add authentication-related flows
- add new user workflows

## Phase 1: Research

Before coding, check:

- existing project architecture
- current tech stack
- similar existing features
- dependencies already used
- whether a new library is actually needed
- security and maintenance risks

If the feature depends on a library or current external best practice, create or update:

```text
docs/RESEARCH_LOG.md
```

Include:

```md
# Research Log

## Question

## Options Considered

## Recommendation

## Trade-offs

## Risks
```

## Phase 2: Planning

Create or update:

```text
docs/PLAN.md
```

The plan must include:

```md
# Plan: <Feature Name>

## Objective

## Assumptions

## Affected Files

## Data Flow

## API Impact

## UI Impact

## Database Impact

## Security Risks

## Performance Risks

## Implementation Steps

## Test Strategy

## Rollback Plan
```

Wait for the user to confirm with:

```text
Proceed
```

## Phase 3: Implementation

After approval:

- implement in small steps
- follow existing project conventions
- keep code modular
- validate inputs with Zod where applicable
- avoid `any`
- avoid hard-coded secrets
- update related types
- update API response handling
- add loading/error/empty states for UI features

## Phase 4: Verification

Run the smallest useful checks.

Examples:

```powershell
pnpm lint
pnpm test
pnpm build
npm run typecheck
python -m pytest
```

If tests do not exist, provide manual test steps.

## Phase 5: Memory and Docs

Update if relevant:

```text
docs/MEMORY.md
docs/CHANGELOG.md
README.md
docs/DECISIONS.md
```

## Final Output

```text
Feature Summary:
- Feature:
- Files changed:
- Tests run:
- Result:
- Risks:
- Next recommended step:
```

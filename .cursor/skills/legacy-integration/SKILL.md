---
name: legacy-integration
description: Use this skill when modifying an existing project, integrating new features into old code, refactoring legacy code, or analysing an unfamiliar codebase.
---

# Legacy Project Integration Skill

## Purpose

Safely understand and modify an existing project without breaking old behaviour.

## When To Use

Use this skill when:

- opening an existing project
- adding a feature to an old codebase
- refactoring old code
- fixing bugs in unfamiliar code
- replacing or upgrading libraries
- integrating new architecture into legacy structure

## Phase 1: Exploration and Mapping

Inspect:

- folder structure
- `package.json`
- `tsconfig.json`
- environment/config files
- route structure
- state management
- database schema
- authentication flow
- API flow
- test setup

Document findings in:

```text
docs/MEMORY.md
```

Add:

```md
## Current Project State

### Tech Stack

### Main Data Flow

### Auth Flow

### Important Folders

### Known Risks
```

## Phase 2: Rule Alignment

Compare current code style with project rules.

Decide:

- follow existing legacy style for consistency
- or refactor to the new standard if safe and approved

Do not force a full rewrite unless the user explicitly approves.

## Phase 3: Impact Assessment

Before changing code, create or update:

```text
docs/PLAN.md
```

Include:

```md
## Affected Files

## Dependencies

## Breaking Change Risk

## Regression Areas

## Test Strategy

## Rollback Plan
```

## Phase 4: Implementation

Rules:

- make small, safe changes
- avoid large rewrites
- preserve public API contracts
- avoid changing data shape unless planned
- add compatibility wrappers if needed
- update types and tests together

## Phase 5: Regression Testing

Check:

- old feature still works
- new feature works
- related flows still work
- error cases are handled
- build still passes

## Final Output

```text
Legacy Integration Summary:
- Existing architecture found:
- Changes made:
- Regression areas checked:
- Tests:
- Risks:
- Follow-up:
```

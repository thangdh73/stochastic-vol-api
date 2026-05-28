# Cursor Agent Setup Guide

## 1. Copy folders

Copy these folders into your project root:

```text
.cursor/
docs/
```

## 2. Open project in Cursor

Open the project folder in Cursor.

## 3. Index codebase

Allow Cursor to index the codebase.

## 4. Start in Composer / Agent Chat

Use this starter prompt:

```text
Use the Orchestrator role.

Read:
- @Codebase
- @docs/MEMORY.md
- @.cursor/rules
- @.cursor/skills

Task:
[Describe the feature or problem]

Before editing code:
1. Analyse the current project.
2. Identify affected files.
3. Create or update docs/PLAN.md.
4. Include implementation steps, risks, test strategy, and rollback plan.
5. Wait for my confirmation: Proceed.

Do not write code yet.
```

## 5. Approve the plan

After reviewing `docs/PLAN.md`, type:

```text
Proceed
```

## 6. After implementation

Ask Cursor:

```text
Use the code-review and testing skills. Review the changes, run or recommend tests, and update docs/MEMORY.md and docs/CHANGELOG.md.
```

---
description: Summarize recent changes and work done in the mobile app
---

Provide a recap of recent work in the mobile app.

## Scope (optional)

$ARGUMENTS

## What to Include

### 1. Git History
- Check recent commits with `git log --oneline -20` (or scoped to mobile/)
- Group changes by feature/fix/refactor

### 2. Changes Summary
For each significant change:
- **What** changed (brief description)
- **Where** (files/features affected)
- **Why** (commit message context)

### 3. Current State
- Any uncommitted changes (`git status`)
- Any in-progress work visible in the code
- Open task files in `docs/tasks/` (not in `completed/`)

### 4. Format

```
## Recent Changes

### Features
- [commit] Description

### Bug Fixes
- [commit] Description

### Refactors
- [commit] Description

## In Progress
- Any uncommitted or pending work

## Open Tasks
- Tasks from docs/tasks/bugs/ and docs/tasks/enhancements/
```

Keep it concise and scannable.

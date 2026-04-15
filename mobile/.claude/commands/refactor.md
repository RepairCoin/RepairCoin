---
description: Refactor mobile app code for better quality and maintainability
---

Refactor the following code in the mobile app.

## Target

$ARGUMENTS

## Refactoring Approach

### 1. Understand First
- Read the existing code thoroughly
- Understand the current behavior and why it was written this way
- Identify what's actually wrong (not just what looks unfamiliar)

### 2. Common Refactors

**Extract Component** — Break large screens into smaller components
**Extract Hook** — Move logic out of components into custom hooks
**Extract Utility** — Move reusable logic to `shared/utilities/` or `feature/{name}/utils/`
**Consolidate Types** — Deduplicate interfaces, use shared types
**Simplify Conditionals** — Early returns, guard clauses, lookup objects
**Remove Dead Code** — Unused imports, unreachable branches, commented code

### 3. Rules

- Don't change behavior — refactoring preserves functionality
- Make small, incremental changes
- Follow existing patterns in the codebase
- Don't over-abstract — three similar lines > premature abstraction
- Don't add features or "improvements" beyond the refactor scope
- Keep NativeWind styling conventions

### 4. Verify

- Explain what changed and why
- Confirm no behavior changes
- Note any areas that should be tested

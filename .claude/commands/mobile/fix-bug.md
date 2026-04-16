---
description: Diagnose and fix a bug in the mobile app
---

Fix the following bug in the mobile app.

## Bug Description

$ARGUMENTS

## Process

### 1. Reproduce Understanding
- Understand the expected vs actual behavior
- Identify which screen/feature is affected
- Determine if it's a UI, data, navigation, or platform issue

### 2. Investigation
- Find the relevant files in `mobile/`
- Trace the data flow: screen → hook → service → API
- Check recent git changes that may have introduced the bug
- Look for related issues in similar code

### 3. Root Cause Analysis
- Identify the exact cause (not just symptoms)
- Check if the issue affects other parts of the app

### 4. Fix
- Apply the minimal fix needed
- Don't refactor unrelated code
- Preserve existing patterns and style
- Handle edge cases the bug reveals

### 5. Verify
- Explain how to test the fix
- Note any related areas that should be regression tested

## Create Task File

After fixing, create a task file in `docs/tasks/completed/` following the format in `docs/tasks/RULES.md`.

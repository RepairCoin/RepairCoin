# Task Documentation Rules

## Directory Structure

```
mobile/docs/tasks/
├── RULES.md                    # This file
├── week-YYYY-MM-DD.md          # Weekly task summaries
├── bugs/                       # Bug reports and fixes
├── enhancements/               # Features, improvements, refactors, and new functionality
└── completed/                  # All completed tasks (from any category)
```

## Task File Format

Every task file must include this exact header format:

```markdown
# [Type]: [Short descriptive title]

**Status:** [Open | In Progress | Pending | Blocked | Completed]
**Priority:** [Critical | High | Medium | Low]
**Est. Effort:** [e.g., 1 hour, 2-3 hrs]
**Created:** YYYY-MM-DD
**Updated:** YYYY-MM-DD
**Completed:** YYYY-MM-DD (only when done)
```

### Type Values

Use one of: `Bug`, `Feature`, `Enhancement`, `Refactor`

### Status Definitions

| Status | Meaning |
|--------|---------|
| **Open** | Not started, ready to pick up |
| **In Progress** | Currently being worked on |
| **Pending** | Waiting on dependency (backend API, design, etc.) |
| **Blocked** | Cannot proceed due to external blocker |
| **Completed** | Fully implemented and verified |

**Do NOT use:** `DONE`, `FIXED`, `COMPLETED`, `N/A`, emojis (✅), or any custom status values.

### Priority Levels

Use title case only: `Critical`, `High`, `Medium`, `Low`

| Priority | When to use |
|----------|-------------|
| **Critical** | Production breaking, must fix immediately |
| **High** | Important for current sprint/release |
| **Medium** | Should be done soon, not urgent |
| **Low** | Nice to have, stretch goal |

**Do NOT use:** `HIGH`, `LOW`, `MEDIUM`, or add extras like `LOW (this week)`.

### Header Field Order

Fields must appear in this exact order:
1. `**Status:**`
2. `**Priority:**`
3. `**Est. Effort:**`
4. `**Created:**`
5. `**Updated:**`
6. `**Completed:**` (only for completed tasks)

**Do NOT add non-standard fields** like `Branch`, `Blocker`, `Type`, `Reported`, `Fixed`, `Closed`, `Affected Customer`, `For`, `Date`, etc. Move that info to the **Notes** section at the bottom of the file.

## Task File Sections

Each task file should contain:

1. **Problem / Goal** - What needs to be done and why
2. **Analysis** - Investigation findings, root cause (for bugs)
3. **Implementation** - Steps, files to modify, approach
4. **Verification Checklist** - Checkbox list to confirm completion
5. **Notes** - Any blockers, dependencies, or extra context

## File Naming

- Use kebab-case: `feature-name-description.md`
- Be descriptive but concise
- Prefix bugs with context: `bug-redemption-not-deducting.md`
- Prefix features with area: `messaging-search.md`, `booking-reminders-sms.md`

## Where to Put Tasks

| Type | Folder | Examples |
|------|--------|----------|
| Broken functionality, errors, regressions | `bugs/` | API returning wrong data, crash on screen |
| New features, improvements, refactors, integrations | `enhancements/` | New screen, API integration, UX improvement, code cleanup |

## Creating a Task

- **Every new task must have a task file** in `enhancements/` or `bugs/` — not only in the weekly summary
- The weekly summary references the task file, it does not replace it
- If a task is small (inline fix, no file needed), note it directly in the weekly summary without a file

## Completing a Task

1. Update the task file status to `Completed`
2. Add `**Completed:** YYYY-MM-DD` to the header
3. Check off all items in the verification checklist
4. Move the file from `enhancements/` or `bugs/` to the `completed/` folder
5. Update the weekly summary to reflect the new path in `completed/` and mark as **DONE**

## Weekly Summary Format

- File: `week-YYYY-MM-DD.md` (use Monday's date)
- Update throughout the week as tasks are completed
- **When a task is marked DONE, its task file must also be moved to `completed/`**
- File paths in the weekly summary must always match the actual file location

Every weekly summary must follow this structure:

```markdown
# Week of [Month Day, Year] - Task Summary

## Focus: [One-line description of the week's theme]

---

## Completed

### 1. Task Name
**Priority:** High | **Status:** DONE | **File:** `completed/task-file.md`

**How to test:**
- Step-by-step instructions to verify the task works
- Include: where to navigate, what to interact with, what to verify
- Cover happy path and edge cases where relevant

---

### 2. Inline Task (no file)
**Priority:** Medium | **Status:** DONE (inline fix)

**How to test:**
- Steps to verify

---

## Pending

| Priority | Task | Effort | Status |
|----------|------|--------|--------|
| High | Task name | 2-3 hrs | **PENDING** |

---

## Skipped / Removed (if any)

| Task | Reason |
|------|--------|
| Task name | Reason it was skipped |

---

## Carried Over → Week of [Next Monday]

| Priority | Task | File |
|----------|------|------|
| High | Task name | `enhancements/task-file.md` |

---

## Daily Breakdown

**Monday (Month Day):**
- ~~Task name~~ — DONE
- Task name — PENDING

---

## Notes

- Relevant context, blockers, decisions
```

## General Rules

- One task per file — don't combine unrelated work
- Keep tasks up to date — update status as work progresses
- Don't delete task files — move completed ones to `completed/`
- Link related tasks if they depend on each other
- Use absolute dates (not "next week" or "tomorrow")
- Weekly summary paths should reflect current folder structure
- **New tasks go in `enhancements/` or `bugs/` first**, then get referenced in the weekly summary — never only in the weekly summary

# Task Documentation Rules

## Directory Structure

```
mobile/docs/tasks/
├── RULES.md                    # This file
├── week-YYYY-MM-DD.md          # Weekly task summaries
├── bugs/                       # Bug reports and fixes
├── enhancements/               # Feature specs, improvements, and new functionality
├── refactor/                   # Code refactoring and UI/UX improvements
└── completed/                  # All completed tasks (from any category)
```

## Task File Format

Every task file must include this header:

```markdown
# [Type]: [Short descriptive title]

**Status:** [Open | In Progress | Pending | Blocked | Done | Completed]
**Priority:** [Critical | High | Medium | Low]
**Est. Effort:** [e.g., 1 hour, 2-3 hrs]
**Created:** YYYY-MM-DD
**Updated:** YYYY-MM-DD
**Completed:** YYYY-MM-DD (only when done)
```

### Status Definitions

| Status | Meaning |
|--------|---------|
| **Open** | Not started, ready to pick up |
| **In Progress** | Currently being worked on |
| **Pending** | Waiting on dependency (backend API, design, etc.) |
| **Blocked** | Cannot proceed due to external blocker |
| **Done / Completed** | Fully implemented and verified |

### Priority Levels

| Priority | When to use |
|----------|-------------|
| **Critical** | Production breaking, must fix immediately |
| **High** | Important for current sprint/release |
| **Medium** | Should be done soon, not urgent |
| **Low** | Nice to have, stretch goal |

## Task File Sections

Each task file should contain:

1. **Problem / Goal** - What needs to be done and why
2. **Analysis** - Investigation findings, root cause (for bugs)
3. **Implementation** - Steps, files to modify, approach
4. **Verification Checklist** - Checkbox list to confirm completion
5. **Notes** - Any blockers, dependencies, or context

## File Naming

- Use kebab-case: `feature-name-description.md`
- Be descriptive but concise
- Prefix bugs with context: `bug-redemption-not-deducting.md`
- Prefix features with area: `messaging-search.md`, `booking-reminders-sms.md`

## Where to Put Tasks

| Type | Folder | Examples |
|------|--------|----------|
| Broken functionality, errors, regressions | `bugs/` | API returning wrong data, crash on screen |
| New features, improvements, integrations | `enhancements/` | New screen, API integration, UX improvement |
| Code cleanup, renaming, restructuring | `refactor/` | Extract hook, rename component, improve styling |

## Completing a Task

1. Update the task file status to `Done` or `✅ Completed`
2. Add `**Completed:** YYYY-MM-DD` to the header
3. Check off all items in the verification checklist
4. Move the file to the top-level `completed/` folder (all categories share one folder)

## Weekly Summaries

- File: `week-YYYY-MM-DD.md` (use Monday's date)
- Tracks what was planned, completed, and carried over
- References task files by relative path
- Includes daily breakdown and accomplishments
- Update throughout the week as tasks are completed

## General Rules

- One task per file — don't combine unrelated work
- Keep tasks up to date — update status as work progresses
- Don't delete task files — move completed ones to `completed/`
- Link related tasks if they depend on each other
- Use absolute dates (not "next week" or "tomorrow")
- Weekly summary paths should reflect current folder structure

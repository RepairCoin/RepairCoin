---
description: Stage and commit changes with a descriptive message
---

Commit the current changes to git.

## Context (optional)

$ARGUMENTS

## Process

1. Run `git status` to see all changed and untracked files
2. Run `git diff` to review staged and unstaged changes
3. Run `git log --oneline -5` to match commit message style
4. Analyze the changes and determine:
   - Type: fix, feat, refactor, chore, docs, style, perf
   - Scope: mobile, backend, frontend
   - Summary of what changed and why
5. Stage the relevant files (use specific file paths, not `git add -A`)
6. Create the commit with format: `type(scope): description`

## Rules

- Do NOT push to remote
- Do NOT use `--no-verify`
- Do NOT amend existing commits unless explicitly asked
- Do NOT stage `.env`, credentials, or sensitive files
- Use a HEREDOC for the commit message
- Add `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` at the end

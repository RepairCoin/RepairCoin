# Frontend Dev Server — Troubleshooting

Quick fixes for common `frontend/` (Next.js 15) dev/build gotchas.

---

## `os error 3` / "Failed to read source code" / "cannot find the path" after switching branches

### Symptom
`yarn dev` throws an error like:

```
× ./src/components/shop/unified/OrchestrateToolCallCard.tsx
Caused by:
  0: Failed to read source code from C:\dev\RepairCoin\frontend\src\components\shop\unified\OrchestrateToolCallCard.tsx
  1: The system cannot find the path specified. (os error 3)
Import trace for requested module:
  ./src/components/shop/unified/OrchestrateToolCallCard.tsx
  ./src/components/shop/unified/UnifiedAssistantPanel.tsx
  ...
```

…and the named file genuinely **doesn't exist on your current branch**.

### Cause — stale `.next` cache, NOT a code bug
Next.js's dev server caches the compiled webpack module graph in `frontend/.next`.
If you started `yarn dev` on one branch and then `git checkout` a branch that
**adds or removes whole component trees**, the running dev server keeps the old
module graph and tries to read files that no longer exist on disk → `os error 3`.

This is common between feature branches that diverge structurally — e.g. a branch
that has the `src/components/shop/unified/` tree wired into `DashboardLayout` vs.
one that doesn't. Switching between them without restarting the dev server leaves
the cache pointing at the other branch's files.

### Fix
1. Stop the dev server (Ctrl+C in its terminal).
2. Delete the cache:
   - PowerShell: `Remove-Item -Recurse -Force C:\dev\RepairCoin\frontend\.next`
   - bash/macOS/Linux: `rm -rf frontend/.next`
3. Restart: `cd frontend && yarn dev` (first compile is slower — it rebuilds the cache).

### How to confirm it's this and not a real regression
Before assuming a code regression, check the named file actually exists **on the
current branch**:
```bash
git branch --show-current
ls frontend/src/components/shop/unified/OrchestrateToolCallCard.tsx
```
If the file isn't there and nothing on the branch imports it (`grep -r unified
frontend/src/components/ui/DashboardLayout.tsx`), it's a stale cache — clear
`.next` and move on.

---

## Don't run `yarn build` while `yarn dev` is up (or vice-versa)

`next build` and `next dev` both read/write the **same** `frontend/.next`
directory. Running them at the same time corrupts each other's cache and produces
confusing phantom errors. Run a production `yarn build` only when no dev server is
running for that workspace.

---

## Browserslist "caniuse-lite is N months old" warning

Harmless and cosmetic — it doesn't affect the build. To silence it, refresh the
dataset (updates the lockfile's `caniuse-lite` entry, so commit that change):
```
cd frontend && npx update-browserslist-db@latest
```

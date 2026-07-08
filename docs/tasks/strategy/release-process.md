# Release Process — staging gate before production

**Owner:** engineering · **Status:** active (adopted 2026-07-07)

The rule: **nothing reaches production until it has been verified working on staging.**
Staging is our test site. Production only ever receives code that already deployed to
staging, passed CI, and was signed off against the staging environment.

---

## Environments

| | Staging | Production |
|---|---|---|
| Branch | `main` | `prod` |
| Deploys on | push to `main` (DO auto-deploy) | push to `prod` (DO auto-deploy) |
| Host | DigitalOcean App Platform (NYC) | DigitalOcean App Platform (SGP) |
| Frontend | Vercel — `repaircoin-staging.vercel.app` | Vercel — `repaircoin.ai` |
| `NODE_ENV` | `staging` | `production` |
| Database | staging cluster | production cluster (separate) |

Both environments migrate their **own** database on deploy (via the `prestart` hook —
see "Migrations" below). Promoting to prod does not touch the staging DB and vice-versa.

---

## Deployment model — auto-deploy on merge

**Chosen model (2026-07-07):** production auto-deploys when the `main → prod` promotion
PR merges. There is no separate manual deploy step — **the gated merge *is* the deploy
action.** Safety comes entirely from the promotion gate (CI green + one review + the
signed sign-off checklist against staging); DO simply builds whatever lands on `prod`.

Required DO setting: the production app's backend component has **`deploy_on_push: true`**
on branch **`prod`** (confirm in the console: Settings → Components → Source, Autodeploy
on). Nothing else triggers a prod deploy.

Upgrade paths if we later want more control (no change to the branching model):
- **Deploy windows / decouple merge from deploy:** flip the prod app to
  `deploy_on_push: false` and deploy on demand with `doctl apps create-deployment <prod-app-id>`.
- **Formal approval button + audit trail:** move the deploy into a GitHub Actions
  workflow gated by a `production` Environment with required reviewers.

---

## The flow

```
feature branch ──PR──▶ main ──auto──▶ STAGING ──verify+sign-off──▶ PR ──▶ prod ──auto──▶ PRODUCTION
     (CI must pass to merge)                    (QA checklist)     (CI + review + checklist)
```

1. **Develop** on a feature branch (`feat/…`, `fix/…`). Open a PR into `main`.
2. **CI must pass** (see below) before the PR can merge. Merge → staging auto-deploys.
3. **Verify on staging.** Run the release sign-off checklist against the staging URL.
   Do not skip — this is the gate.
4. **Promote:** open a PR from `main` → `prod`. Paste the completed sign-off checklist
   into the PR description. Requires CI green + one review.
5. Merge → production auto-deploys. Watch logs and `/api/health` until green.

Never push directly to `prod`. Never hotfix on `prod` — fix on a branch → `main` →
verify on staging → promote, same as everything else. (A true emergency uses the
documented break-glass step at the bottom.)

---

## CI checks (the machine gate)

`.github/workflows/ci.yml` runs on every PR to `main` and `prod`:

- **`backend`** — `npm ci`, `typecheck` (`tsc --noEmit`), migration-number check,
  **unit tests** (`npm run test:unit`), `build`. Backend typecheck is clean and the
  unit suite is green, so this is a hard required gate.
- **`frontend`** — `npm ci`, `next build`. Note `next.config.js` currently sets
  `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`, so this catches
  build-breaking errors (bad imports, syntax) but **not** type errors. Frontend has a
  ~215-error `tsc --noEmit` backlog; do not make raw frontend typecheck a required
  gate until that debt is burned down.

### Tests: unit in CI, DB suites pre-release

The PR check runs **only the database-free unit suites** (`npm run test:unit`, via
`jest.unit.config.js` — ~91 suites / 2,200+ tests, no Postgres needed). This keeps the
gate fast and reliable.

The **database-dependent suites are NOT in the PR check.** They boot the app against a
real DB and today have cross-suite isolation flakiness (they pass individually but
pollute shared DB/fixture state in a full run). Run them locally / pre-release:
- `npm run test:ci` — the full suite, sequentially, against a database.
- `npm run test:integration` — the seeded-DB integration suites (`full-flow`,
  `wallet-detection`, `subscription.edge-cases`).

**Follow-up (tracked):** harden DB test isolation (per-suite unique fixtures or
transactional rollback) so the DB suites can join the CI gate.

> The old `.github/workflows/migrations-check.yml` is now redundant (the migration
> check is folded into `ci.yml`, and it runs on every PR rather than only when
> `backend/migrations/**` changes). Delete it once `ci.yml` is live.

---

## Branch protection (run once, by a repo admin)

Requires the `gh` CLI authenticated with admin rights on `RepairCoin/RepairCoin`.

**Order matters:** merge `ci.yml` to `main` first and let it run once, so the
`backend` / `frontend` status checks exist and can be selected as required.

### 1. Protect `prod` (strict — this is the launch gate)

Save as `prod-protection.json`:

```json
{
  "required_status_checks": { "strict": true, "contexts": ["backend", "frontend"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

Apply:

```bash
gh api -X PUT repos/RepairCoin/RepairCoin/branches/prod/protection \
  -H "Accept: application/vnd.github+json" --input prod-protection.json
```

- `strict: true` — a promotion PR must be up to date with `prod` before merging.
- `enforce_admins: true` — even admins go through the gate (recommended for prod;
  set to `false` if you need an admin escape hatch, but then it is not a hard gate).
- `contexts` — the two CI job names. Start with `["backend"]` only if the frontend
  build isn't reliably green in CI yet (e.g. needs `NEXT_PUBLIC_*` repo secrets), then
  add `"frontend"` once it is.

### 2. Protect `main` (lighter — keep staging buildable)

Save as `main-protection.json`:

```json
{
  "required_status_checks": { "strict": false, "contexts": ["backend", "frontend"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

```bash
gh api -X PUT repos/RepairCoin/RepairCoin/branches/main/protection \
  -H "Accept: application/vnd.github+json" --input main-protection.json
```

This requires CI to pass to merge into `main` (so staging never gets a non-building
commit) without demanding a review — staging is where we iterate.

Verify:

```bash
gh api repos/RepairCoin/RepairCoin/branches/prod/protection | jq '.required_status_checks, .required_pull_request_reviews'
```

---

## Release sign-off checklist (the human gate)

Copy this into the `main` → `prod` promotion PR and check every box **against the
staging environment** before merging. If a box can't be checked, it doesn't go to prod.

```markdown
### Promotion sign-off — <release name / date>

**Staging verified at:** https://repaircoin-staging.vercel.app  (commit: <sha>)

- [ ] CI is green on this PR (backend + frontend).
- [ ] Staging deploy for this commit succeeded (DO shows Active, `/api/health` OK).
- [ ] Migrations that ship in this release **actually applied on the staging DB**
      (see "Verify migrations" — confirm `schema_migrations` has the new versions).
- [ ] Core smoke paths exercised on staging: log in (customer / shop / admin),
      the changed feature(s), and one blockchain-touching action if relevant.
- [ ] Any new env vars are set in the **production** DO app + Vercel project
      (they are NOT copied automatically from staging).
- [ ] Rollback plan understood (revert this merge on `prod`).
- [ ] Signed off by: __________________   Date: __________
```

For feature-specific verification, attach or link the feature's own QA checklist
(e.g. a slice checklist) in addition to the boxes above.

---

## Verify migrations applied on staging

Because a migration failure is non-fatal (the app boots anyway) and one DO service
spec starts the container via the Dockerfile `CMD` — which **bypasses** the `prestart`
migration hook — never assume a migration ran. Confirm it before promoting:

```sql
-- against the STAGING database
SELECT version, name, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;
```

The versions shipping in this release must be present. If they are not, the staging
service is likely starting via the Dockerfile path (no auto-migrate) — run the
migration manually against staging and, before launch, reconcile the DO app spec so
production starts via `npm start` (which runs `prestart` → `db:migrate`). Do the same
confirmation against the production DB right after the prod deploy.

---

## Rollback

Production is a branch, so rollback is a git revert:

```bash
git checkout prod && git pull
git revert -m 1 <merge-commit-sha>   # -m 1 = keep prod's prior state
git push origin prod                  # auto-deploys the reverted state
```

- A schema migration is **not** undone by a code revert. If a bad migration shipped,
  write a forward migration that corrects it — do not hand-edit applied migrations.
- DO does rolling deploys, so a revert is a fresh deploy, not an instant switch; watch
  `/api/health`.

---

## Break-glass (emergencies only)

If prod is down and the normal flow is too slow: a repo admin (with
`enforce_admins:false`, or by temporarily lifting protection) may push a fix branch
straight to `prod`. **Immediately after:** open the matching PR into `main` so staging
and `prod` don't diverge, and note the incident. This is the exception, not a shortcut.

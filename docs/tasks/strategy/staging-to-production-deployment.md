# Strategy: Staging to Production Deployment

## Date: 2026-04-03
## Category: DevOps / Deployment Strategy

---

## Current Infrastructure

| Component | Staging | Production |
|---|---|---|
| **Git Branch** | `main` | `prod` |
| **Backend Host** | Digital Ocean App Platform (NYC) | Digital Ocean App Platform (SGP) |
| **Frontend Host** | Vercel (`repaircoin-staging.vercel.app`) | Vercel (`repaircoin.vercel.app` / `repaircoin.ai`) |
| **Database** | DO Managed PostgreSQL (staging cluster) | DO Managed PostgreSQL (production cluster) |
| **Auto Deploy** | Yes — push to `main` triggers deploy | Yes — push to `prod` triggers deploy |
| **NODE_ENV** | `staging` | `production` |
| **Region** | NYC | SGP (Singapore) |

---

## How Auto Deploy Works

Digital Ocean App Platform uses `deploy_on_push: true` in the app spec. When code is pushed to the configured branch, DO automatically:

1. Pulls the latest code from GitHub
2. Runs the **build command** (`npm run build` — compiles TypeScript)
3. Runs the **start command** (`npm start`)
4. `npm start` triggers `prestart` hook which runs **database migrations automatically**
5. App starts serving traffic after health check passes (`/api/health`)

### Staging (Confirmed)
- Config: `.do/app.yaml` — branch `main`, `deploy_on_push: true`
- Push to `main` → auto deploys to staging

### Production (Confirmed Working)
- Push to `prod` → auto deploys backend (DO) and frontend (Vercel)
- Config in repo: `backend/.do/app.yaml` shows `branch: main` but DO dashboard overrides to `prod`
- Successfully deployed on 2026-04-03 via `git merge main && git push origin prod`

---

## Database Migration Process

Migrations run **automatically** on every deploy via the `prestart` hook:

```
npm start
  → prestart: npm run db:migrate
    → node dist/scripts/run-migrations.js (compiled) OR npx ts-node scripts/run-migrations.ts (fallback)
      → Connects to database (auto-detects SSL for DO hosts)
      → Creates schema_migrations table if missing
      → Compares migration files against applied records
      → Runs pending migrations in sequential order (001, 002, ...)
      → Each migration runs in a transaction (BEGIN/COMMIT/ROLLBACK)
      → Non-fatal: if a migration fails, app continues starting
```

### Key Points
- Migrations are **idempotent** — most use `IF NOT EXISTS` / `IF EXISTS` guards
- Migration state tracked in `schema_migrations` table
- Failed migrations don't block app startup (logged as warnings)
- `app.ts` has a safety net (`ensureCriticalSchema`) that backfills missing migration records

### Staging vs Production Databases
- Staging and production use **separate database clusters**
- Migrations run independently on each — staging may be ahead of production
- New migrations included in a deploy will auto-apply to that environment's database

---

## Deployment Steps: Staging to Production

### Pre-Deployment Checklist

1. **Verify staging is stable**
   - All features tested on staging
   - No console errors or broken flows
   - API health check passing: `curl https://<staging-url>/api/health`

2. **Review what's being deployed**
   ```bash
   # See all commits on main that aren't on prod yet
   git log prod..main --oneline
   ```

3. **Check for pending migrations**
   ```bash
   # List migration files that may be new
   ls backend/migrations/*.sql | tail -10
   ```

4. **Review migration safety**
   - New migrations should be backward-compatible (additive only)
   - Avoid DROP TABLE, DROP COLUMN, or destructive changes
   - If destructive migration needed, coordinate with downtime window

### Deploy Backend (Digital Ocean)

```bash
# 1. Ensure local branches are up to date
git fetch origin

# 2. Checkout prod branch
git checkout prod

# 3. Merge main into prod
git merge main

# 4. Push to trigger auto deploy (if deploy_on_push is enabled for prod)
git push origin prod

# 5. Switch back to dev branch
git checkout deo/dev
```

### Deploy Frontend (Vercel)

Vercel auto-deploys when `prod` branch is pushed. No separate step needed — the `git push origin prod` above triggers both backend (DO) and frontend (Vercel) deployments simultaneously.

### Post-Deployment Verification

1. **Check backend health**
   ```bash
   curl https://api.repaircoin.ai/api/health
   ```

2. **Check migration ran**
   - View deploy logs in DO dashboard (Apps → repaircoin-backend → Runtime Logs)
   - Look for: `Migration summary: X applied, Y skipped, Z failed`

3. **Smoke test critical flows**
   - Login with wallet
   - Customer marketplace loads
   - Shop dashboard loads
   - Booking flow works

---

## Quick Reference Commands

```bash
# View what will be deployed
git log prod..main --oneline

# Deploy to production
git checkout prod && git merge main && git push origin prod && git checkout deo/dev

# Check DO app status
doctl apps list
doctl apps logs <app-id> --tail --follow

# Manual deploy trigger
doctl apps create-deployment <app-id>

# Check migration status on production DB
# (from backend directory with production DB credentials)
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query('SELECT version, applied_at FROM schema_migrations ORDER BY version DESC LIMIT 10')
  .then(r => { console.table(r.rows); pool.end(); });
"
```

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Bad migration breaks production DB | Migrations are transactional (ROLLBACK on error) and non-fatal |
| Feature breaks in production | Test on staging first; staging uses same codebase |
| Need to rollback | `git revert` the merge commit on `prod` and push — triggers redeploy |
| Database out of sync | Each environment tracks migrations independently via `schema_migrations` |
| Downtime during deploy | DO App Platform does rolling deploys — zero downtime |

---

## Full Deployment Workflow (Tested & Confirmed)

This is the exact process used on 2026-04-03 to deploy from dev to production:

```bash
# ── Step 1: Commit changes on deo/dev ──
git add <files>
git commit -m "description"
git push origin deo/dev

# ── Step 2: Merge deo/dev → main (triggers staging deploy) ──
git stash                          # stash any uncommitted files (e.g. .claude/settings.local.json)
git checkout main
git pull origin main
git merge deo/dev
git push origin main               # → Staging auto-deploys (DO + Vercel)

# ── Step 3: Merge main → prod (triggers production deploy) ──
git checkout prod
git pull origin prod
git merge main
git push origin prod               # → Production auto-deploys (DO + Vercel)

# ── Step 4: Return to dev branch ──
git checkout deo/dev
git stash pop                      # restore stashed files
```

### What Happens Automatically After Push

| Step | Trigger | What Runs |
|---|---|---|
| 1. GitHub receives push | `git push origin prod` | Notifies DO App Platform + Vercel |
| 2. DO builds backend | `deploy_on_push: true` | `npm run build` (TypeScript compile) |
| 3. DO starts backend | `npm start` | `prestart` hook runs `db:migrate` first |
| 4. Migrations apply | `db:migrate` script | Pending SQL files run in transaction |
| 5. App serves traffic | Health check passes | `/api/health` returns 200 |
| 6. Vercel builds frontend | Push detected on `prod` | `next build` (standalone output) |
| 7. Frontend live | Build succeeds | Vercel CDN serves new version |

### Common Issues During Deploy

| Issue | Solution |
|---|---|
| `.claude/settings.local.json` blocks checkout | `git stash` before switching branches, `git stash pop` after |
| Push rejected (secrets detected) | Remove `.claude/settings.local.json` from staging, it contains DB passwords |
| Merge conflicts | Resolve on `main` first, then merge clean `main` into `prod` |
| Migration fails on deploy | Non-fatal — app starts anyway. Check DO logs for details |

---

## Deployment Log

### 2026-04-28 — Gmail/Calendar OAuth + shop registration hotfix

**Why this deploy is non-routine:** unlike a code-only push, it bundles a production-blocking bugfix, env-var rotation (Cloud Console project change), and Cloud Console test-user adds. Skipping any of those leaves prod broken in a subtler way than before.

#### What's being deployed

| Commit (on `main`, pending merge to `prod`) | Scope | Effect |
|---|---|---|
| `87ac3345` | `frontend/src/services/api/gmail.ts` | Removes a double `.data` unwrap that broke Gmail Connect on staging |
| `2d584b07` | `backend gmail.routes.ts` + `GmailController.ts` | Adds GET handler on `/api/shops/gmail/callback` so Google's OAuth redirect succeeds (was POST-only and 404'd) |
| `1024f6fe` | `frontend/.../shop/gmail/callback/page.tsx` | Redirects to `/shop` (correct) instead of nonexistent `/shop/settings?tab=social` |
| `34eb3b92` | `backend/src/repositories/ShopRepository.ts` | **Production-blocking** — drops `cross_shop_enabled` from `createShop` INSERT. Migration 006 dropped that column from prod, but the code kept writing to it, 500'ing every prod registration |

#### Manual prerequisite #1 — Cloud Console test users (do FIRST)

Before flipping prod env vars, add prod ops/test emails to the `fixflow-project` test-user list. Without this, OAuth blocks with "FixFlow has not completed the Google verification process".

- URL: https://console.cloud.google.com/auth/audience
- Confirm project picker reads `fixflow-project` (not `Zeff Cloud Console`)
- Test users → + ADD USERS → save

#### Manual prerequisite #2 — Update DigitalOcean prod env vars

Source values come from staging (already verified end-to-end this session).

| Variable | Current prod value | New prod value | Why |
|---|---|---|---|
| `GOOGLE_CALENDAR_CLIENT_ID` | `854830853827-1ub6cg2tticq8vpatg4af4e6svqcfr43...` (Zeff project) | `948748310237-8vd3ock6e2scaack7tks84ii1645ms4r.apps.googleusercontent.com` | Switch to `fixflow-project` Cloud project |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | (Zeff project secret) | New secret from `fixflow-project` Calendar OAuth client | Pair with new Client ID |
| `GOOGLE_CALENDAR_REDIRECT_URI` | **`http://localhost:4000/api/shops/calendar/callback/google`** ← bug | `https://api.repaircoin.ai/api/shops/calendar/callback/google` | Localhost on prod is broken; prod URI is registered with Google |
| `GOOGLE_CALENDAR_ENCRYPTION_KEY` | (current value) | Same as staging (or fresh 32-byte hex) | Required to decrypt stored tokens |
| `GMAIL_CLIENT_ID` | **missing** | `948748310237-nr8frccg4la5k17mn7ejnt0mt4urkkit.apps.googleusercontent.com` | Gmail uses a separate OAuth client |
| `GMAIL_CLIENT_SECRET` | **missing** | New secret from `fixflow-project` Gmail OAuth client | Pair with Gmail Client ID |
| `GMAIL_REDIRECT_URI` | **missing** | `https://api.repaircoin.ai/api/shops/gmail/callback` | Backend GET handler reads tokens here |
| `GMAIL_ENCRYPTION_KEY` | **missing** | Same as staging (or fresh 32-byte hex) | Required to decrypt Gmail tokens |

> Generate a fresh 32-byte hex key if needed: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

> Mark `*_SECRET` and `*_ENCRYPTION_KEY` rows as **encrypted (SECRET)** in DO.

#### Code deploy (after manual prerequisites)

```bash
git fetch origin
git checkout prod
git pull origin prod
git merge --ff-only origin/main
git push origin prod
```

DO + Vercel auto-deploy on push to `prod`.

#### Smoke tests after deploy

| # | Test | Expected |
|---|---|---|
| A | Register a fresh shop on `repaircoin.ai/register/shop` (Incognito, fresh wallet) | 201 + "Shop registered successfully", redirect to verification screen |
| B | Connect Google Calendar from a logged-in shop on prod | Redirect through `api.repaircoin.ai/.../calendar/callback/google?...`, success toast, settings card shows connected |
| C | Connect Gmail from same shop | Redirect through `api.repaircoin.ai/.../gmail/callback?...`, success toast, settings card shows connected |
| D | Eyeball: customer earn/redeem, shop dashboard loads, admin login | Same as before, no regressions |

If A fails: there's a *second* schema drift we haven't caught — pull DO logs for the actual SQL error.
If B/C fails: re-check Cloud Console test-user list and DO env-var values; OAuth issues almost always trace to one of those two.

#### Database

**No migrations to run.** Production already has the post-006 schema we want; staging has the pre-006 schema (still has `cross_shop_enabled`). Reconciling staging is a follow-up, not a blocker.

#### Rollback

| If this breaks | Do this |
|---|---|
| Env var swap (Step 2) | DO → edit the bad var back to its old value → DO redeploys → reverts |
| Code push (Step 3) | `git revert <bad-sha>` on `main`, fast-forward `prod` again. Force-push to `prod` only as last resort. |
| Smoke test fails | Pull DO logs first — don't roll back without seeing the actual error |

#### Open follow-ups (not blocking this deploy)

1. Apply migration 006 on **staging** so it matches prod (schema drift cleanup)
2. Wider `crossShopEnabled` cleanup in `ShopRepository.ts` (3 explicit references still reference the dropped column)
3. Google verification path: hosted privacy/terms/homepage, demo video, domain verification — required before non-test-list users can connect Gmail. 4-8 week review window once submitted.

---

### 2026-04-03 — Major rebrand + Calendar/moderation features
- **Deployed by**: deo/dev → main → prod
- **Commits**: ~110 commits (notification preferences fix, group rewards dropdown fix, mobile features, map overhaul, Google Calendar, moderation system, privacy policy page, FixFlow rebrand)
- **Migrations**: None new — all existing migrations already applied
- **Issues**: None — clean deploy

---

## Action Items

- [x] **Verify production auto-deploy**: Confirmed working — push to `prod` triggers both DO and Vercel deploys
- [x] **Verify Vercel production branch**: Confirmed — Vercel watches `prod` branch
- [ ] **Update `backend/.do/app.yaml`**: Change `branch: main` to `branch: prod` to match actual production config
- [ ] **Consider branch protection**: Add GitHub branch protection rules on `prod` to require PR reviews before merge

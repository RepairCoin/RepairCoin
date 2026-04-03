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
| **Auto Deploy** | Yes — push to `main` triggers backend deploy | Needs verification — merge to `prod` may trigger deploy |
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

### Production (Needs Verification)
- Config: `backend/.do/app.yaml` — currently shows branch `main` in the yaml file
- The actual DO dashboard may override this to `prod` branch
- **Action Required**: Verify in DO dashboard (Apps → repaircoin-backend → Settings → App Spec) which branch triggers production deploy

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

**If auto deploy is NOT enabled for prod branch:**
- Option A: Enable it in DO dashboard (Apps → Settings → App Spec → change branch to `prod`, enable `deploy_on_push`)
- Option B: Manual deploy via DO dashboard (Apps → repaircoin-backend → Actions → Deploy)
- Option C: Deploy via CLI: `doctl apps create-deployment <app-id>`

### Deploy Frontend (Vercel)

Vercel deployment depends on how it's configured:
- If Vercel watches `main` branch → production frontend may already be deploying from main
- If Vercel watches `prod` branch → the merge above will trigger it
- Check Vercel dashboard (Settings → Git → Production Branch) to confirm

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

## Action Items

- [ ] **Verify production auto-deploy**: Check DO dashboard → Apps → repaircoin-backend → Settings → App Spec → confirm branch is `prod` and `deploy_on_push: true`
- [ ] **Verify Vercel production branch**: Check Vercel dashboard → Settings → Git → confirm which branch triggers production frontend deploy
- [ ] **Update `backend/.do/app.yaml`**: Change `branch: main` to `branch: prod` to match actual production config
- [ ] **Consider branch protection**: Add GitHub branch protection rules on `prod` to require PR reviews before merge

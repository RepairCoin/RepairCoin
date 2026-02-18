# Staging & Production Environment Setup Guide

## Overview

Complete 3-tier environment with **separate backend instances** for staging and production running in parallel.

**Last Updated**: February 4, 2026

---

## ⚡ Zero-Downtime Guarantee

### Why This Won't Cause Downtime

| Phase | What Happens                  | Live Site Impact                                  |
| ----- | ----------------------------- | ------------------------------------------------- |
| 1-2   | Create new infrastructure     | ✅ NONE - New resources, nothing touched          |
| 3-6   | Configure DNS, Vercel, Stripe | ✅ NONE - Adding new records, not modifying       |
| 7     | Full testing                  | ✅ NONE - Testing on new infrastructure           |
| 8     | DNS Switch                    | ⚠️ 0-5 min propagation (backend already running!) |
| 9     | Cleanup                       | ✅ NONE - Post-migration tasks                    |

### Why Other Devs Won't Be Affected

| Their Action    | During Migration                         | After Migration      |
| --------------- | ---------------------------------------- | -------------------- |
| Merge to `main` | → Deploys to current backend (unchanged) | → Deploys to STAGING |
| Create PRs      | → Works normally                         | → Works normally     |
| Test locally    | → Works normally                         | → Works normally     |

**Key Protection**: Production deploys from `prod` branch, not `main`. Other devs can merge to `main` anytime without affecting production.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           PRODUCTION (NEW)                                │
│  Frontend: repaircoin.ai (Vercel, prod branch)                           │
│  Backend:  api.repaircoin.ai (DigitalOcean App - repaircoin-prod)        │
│  Database: db-postgresql-repaircoin-prod (NEW)                           │
│  Stripe:   LIVE keys                                                     │
│  Branch:   prod (controlled releases via main → prod merge)              │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                    ─ ─ ─ ─ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ─ ─ ─ ─  (Completely Isolated)
                                    │
┌──────────────────────────────────────────────────────────────────────────┐
│                           STAGING (EXISTING - NO CHANGE)                  │
│  Frontend: staging.repaircoin.ai (Vercel, main branch)                   │
│  Backend:  api-staging.repaircoin.ai (repaircoin-staging-s7743)          │
│  Database: db-postgresql-repaircoin-staging-sg (EXISTING)                   │
│  Stripe:   TEST keys                                                     │
│  Branch:   main (devs continue merging here as usual)                    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                    ─ ─ ─ ─ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ─ ─ ─ ─
                                    │
┌──────────────────────────────────────────────────────────────────────────┐
│                           LOCAL DEV                                       │
│  Frontend: localhost:3001                                                │
│  Backend:  localhost:4000                                                │
│  Database: db-postgresql-repaircoin-staging-sg (or local Docker)            │
│  Stripe:   TEST keys                                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### Branch Strategy (Zero Disruption to Other Devs)

```
Other devs keep working normally:
  feature/* ──► main (PR) ──► auto-deploy to STAGING
                  │
                  │  (When ready for production release)
                  ▼
                 prod ──► auto-deploy to PRODUCTION

Key Points:
• Devs continue merging to main - NO workflow change
• main branch = staging environment (current behavior)
• prod branch = production environment (controlled releases)
• You control when production updates via main → prod merge
```

---

## Current State vs Target State

### Current State

| Component       | URL/Name          | Branch | Points To                             |
| --------------- | ----------------- | ------ | ------------------------------------- |
| Frontend (prod) | repaircoin.ai     | main   | Vercel                                |
| Backend         | api.repaircoin.ai | main   | `repaircoin-staging-s7743` (staging!) |
| Database        | -                 | -      | `db-postgresql-repaircoin-staging-sg` |

### Target State (After Migration)

| Environment    | Frontend              | Backend                                                | Database                | Branch |
| -------------- | --------------------- | ------------------------------------------------------ | ----------------------- | ------ |
| **Production** | repaircoin.ai         | api.repaircoin.ai → `repaircoin-prod`                  | `db-repaircoin-prod`    | `prod` |
| **Staging**    | staging.repaircoin.ai | api-staging.repaircoin.ai → `repaircoin-staging-s7743` | `db-repaircoin-staging` | `main` |

---

## Zero-Downtime Migration Strategy

### Why This Order Matters

The key to zero downtime is: **Never break existing connections**

```
SAFE ORDER:
1. Prepare codebase (CORS, prod branch) - deploy to existing backend
2. Create NEW infrastructure (doesn't affect existing)
3. Add NEW DNS records (doesn't affect existing)
4. Configure frontends and webhooks
5. Test everything independently
6. Switch production DNS (quick, backend already running)

RISKY (DON'T DO):
❌ Delete/modify existing backend before new one is ready
❌ Change DNS before new backend is tested
❌ Switch production without testing staging first
❌ Forget to update CORS before DNS switch
```

### Phase Overview & Dependencies

```
Phase 1: Prepare Codebase ──────────────────────────┐
   └─► prod branch, CORS update                     │
                                                    ▼
Phase 2: Create Production Infrastructure ◄─────────┤
   └─► DB, Backend (deploys from prod branch)       │
                                                    │
Phase 3: Add DNS Records (parallel) ◄───────────────┤
   └─► api-staging, staging                         │
                                                    ▼
Phase 4: Configure Vercel ◄─────────────────────────┤
   └─► Staging (main) & Production (prod) env vars  │
                                                    │
Phase 5: Configure Stripe Webhooks ◄────────────────┤
   └─► Staging (TEST) & Production (LIVE)           │
                                                    │
Phase 6: Update Staging Backend ◄───────────────────┤
   └─► FRONTEND_URL only (keeps main branch)        │
                                                    ▼
Phase 7: Full Testing ◄─────────────────────────────┤
   └─► Staging E2E, Prod backend via DO URL         │
                                                    │
Phase 8: DNS Switch ◄───────────────────────────────┘
   └─► The big moment (0-5 min)

Phase 9: Verify & Cleanup
   └─► Final checks, increase TTL
```

### Why main → staging, prod → production?

**Other devs won't be affected because:**

1. They keep merging PRs to `main` as usual
2. `main` branch auto-deploys to staging (current behavior, unchanged!)
3. Production only updates when YOU merge `main → prod`
4. No workflow change required for the team

---

## Implementation Steps (Zero-Downtime)

### Phase 1: Prepare Codebase (No Impact to Live Site)

> **Risk Level: NONE** - Code changes deploy to existing backend, no behavior change
> **Priority: CRITICAL** - Must be done FIRST before any infrastructure changes

#### Step 1.1: Update CORS Configuration ✅ Done

Edit `backend/src/app.ts` to include all future domains:

```typescript
const allowedOrigins = [
  // Local development
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",

  // Production
  "https://repaircoin.ai",
  "https://www.repaircoin.ai",
  "https://api.repaircoin.ai",

  // Staging
  "https://staging.repaircoin.ai",
  "https://api-staging.repaircoin.ai",

  // Vercel previews
  /\.vercel\.app$/,
];
```

#### Step 1.2: Commit and Deploy CORS Update ✅ Done

```bash
# Commit to main (deploys to current backend, other devs unaffected)
git checkout main
git pull origin main
git add backend/src/app.ts
git commit -m "feat: add staging and production domains to CORS"
git push origin main
```

#### Step 1.3: Create Production Branch ✅ Done

```bash
# Create prod branch from main (after CORS is merged)
git checkout main
git pull origin main
git checkout -b prod
git push -u origin prod
```

**Why CORS first?** The new production backend will use this code. If CORS isn't updated, API requests from the frontend will be blocked.

**Why prod branch?** Other devs continue merging to `main` (staging). You control production releases via `main → prod` merges.

**✅ Checkpoint**: CORS deployed, `prod` branch created. Other devs unaffected.

---

### Phase 2: Create Production Infrastructure (No Impact to Live Site)

> **Risk Level: NONE** - Creating new resources, nothing existing is touched

#### Step 2.1: Create Production Database ✅ Done

1. Go to [DigitalOcean Databases](https://cloud.digitalocean.com/databases)
2. Click **Create Database Cluster**
3. Configure:
   - **Engine**: PostgreSQL 15
   - **Name**: `db-postgresql-repaircoin-prod`
   - **Region**: NYC1 (New York) - US region for production
   - **Plan**: Basic ($15/mo)
   - **Autoscale storage**: ✅ Enable (prevents read-only mode if storage fills up)
4. Click **Create Database Cluster**
5. Wait for provisioning (~5-10 min)
6. Copy connection string for later

#### Step 2.2: Create Production Backend App ✅ Done

1. Go to [DigitalOcean Apps](https://cloud.digitalocean.com/apps)
2. Click **Create App**
3. Configure:
   - **Source**: GitHub → RepairCoin/RepairCoin
   - **Branch**: `prod` ← **IMPORTANT: Use prod branch, not main!**
   - **Source Directory**: `/backend`
   - **Name**: `repaircoin-prod`
   - **Region**: NYC (nyc1) - US region for production
   - **Plan**: Basic ($12/mo)

#### Step 2.3: Set Production Backend Environment Variables ⚠️ Partial (waiting for owner)

In DigitalOcean → `repaircoin-prod` app → **Settings** → **Environment Variables**:

**Core Settings:**
| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `JWT_SECRET` | `<generate-NEW-64-char-secret>` | Must be unique, not same as staging |
| `CORS_ORIGIN` | `https://repaircoin.ai,https://www.repaircoin.ai` | Production domains only |
| `FRONTEND_URL` | `https://repaircoin.ai` | |
| `COOKIE_DOMAIN` | `.repaircoin.ai` | |
| `ADMIN_ADDRESSES` | (same as staging) | |
| `ADMIN_NAME` | `Jeff,Khalid,Ian,deo` | |
| `ENABLE_SWAGGER` | `false` | Disabled in production |
| `LOG_LEVEL` | `info` | Not debug |

**Database (from new prod database connection):**
| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://doadmin:PASSWORD@db-postgresql-repaircoin-prod-xxx:25060/defaultdb?sslmode=require` | Full connection string |
| `DB_HOST` | (from prod database) | |
| `DB_PORT` | `25060` | |
| `DB_USER` | `doadmin` | |
| `DB_PASSWORD` | (from prod database) | |
| `DB_NAME` | `defaultdb` | |
| `DB_POOL_MAX` | `1` | |
| `DB_IDLE_TIMEOUT_MS` | `10000` | |
| `DB_CONNECTION_TIMEOUT_MS` | `5000` | |
| `NODE_TLS_REJECT_UNAUTHORIZED` | `0` | |

**Blockchain/Thirdweb (same as staging):**
| Variable | Value | Notes |
|----------|-------|-------|
| `RCN_CONTRACT_ADDRESS` | `0xBFE793d78B6B83859b528F191bd6F2b8555D951C` | Same contract |
| `RCN_THIRDWEB_CLIENT_ID` | (same as staging) | |
| `RCN_THIRDWEB_SECRET_KEY` | (same as staging) | |
| `RCG_CONTRACT_ADDRESS` | `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D` | Same contract |
| `RCG_THIRDWEB_CLIENT_ID` | (same as staging) | |
| `RCG_THIRDWEB_SECRET_KEY` | (same as staging) | |
| `PRIVATE_KEY` | (same as staging or new prod wallet) | Wallet for token minting |
| `CHAIN_ID` | `84532` | Base Sepolia |
| `NETWORK` | `base-sepolia` | |
| `BLOCKCHAIN_NETWORK` | `base-sepolia` | |
| `ENABLE_BLOCKCHAIN_MINTING` | `false` | |

**Token Settings (same as staging):**
| Variable | Value | Notes |
|----------|-------|-------|
| `RCN_PRICE_USD` | `0.10` | |
| `RCN_PURCHASE_PRICE` | `0.10` | |
| `ENABLE_PUBLIC_TRADING` | `false` | |
| `ENABLE_TRANSFERS` | `true` | |
| `MAX_SUPPLY` | `unlimited` | |

**Stripe (⚠️ USE LIVE KEYS):**
| Variable | Value | Notes |
|----------|-------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | **LIVE key from Stripe Dashboard** |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Will create in Phase 5 |
| `STRIPE_MONTHLY_PRICE_ID` | `price_...` | **Create new LIVE price in Stripe** |
| `STRIPE_MODE` | `live` | **Not test** |

**DigitalOcean Spaces (same as staging):**
| Variable | Value | Notes |
|----------|-------|-------|
| `DO_SPACES_KEY` | (same as staging) | |
| `DO_SPACES_SECRET` | (same as staging) | |
| `DO_SPACES_BUCKET` | `repaircoinstorage` | |
| `DO_SPACES_REGION` | `sfo3` | |
| `DO_SPACES_CDN_ENDPOINT` | `https://repaircoinstorage.sfo3.cdn.digitaloceanspaces.com` | |

**Email (same as staging):**
| Variable | Value | Notes |
|----------|-------|-------|
| `EMAIL_HOST` | `smtp.gmail.com` | |
| `EMAIL_PORT` | `587` | |
| `EMAIL_USER` | `itpahilgadev@gmail.com` | |
| `EMAIL_PASS` | (same as staging) | |
| `EMAIL_FROM` | `RepairCoin (noreply@repaircoin.com)` | |

**⚠️ Key Differences from Staging:**

1. `STRIPE_SECRET_KEY` → Use `sk_live_...` (LIVE key, not test)
2. `STRIPE_MODE` → `live` (not test)
3. `STRIPE_MONTHLY_PRICE_ID` → Create new price in Stripe LIVE mode
4. `LOG_LEVEL` → `info` (not debug)
5. `ENABLE_SWAGGER` → `false`
6. `JWT_SECRET` → Generate new unique secret
7. `DATABASE_URL` / `DB_*` → New production database credentials
8. `CORS_ORIGIN` → Production domains only

#### Step 2.4: Add Production Backend to Database Trusted Sources ✅ Done

> ⚠️ **IMPORTANT**: Do this BEFORE running migrations!

1. Go to **DigitalOcean** → **Databases** → `db-postgresql-repaircoin-prod`
2. Click **Settings** tab
3. Scroll to **Trusted Sources**
4. Click **Add Trusted Source**
5. Add: `repaircoin-prod` (your backend app) - select from dropdown

**For running migrations locally**, also add your IP address:

1. Click **Add Trusted Source** again
2. Select **IP Address**
3. Enter your current public IP (or "Allow all" temporarily, then remove after)

#### Step 2.5: Run Migrations on Production Database ✅ Done

> ⚠️ **NOTE**: Your local `.env` points to staging (correct for development). Use the DigitalOcean Console to run migrations on production.

**Using DigitalOcean Console (Recommended):**

1. Go to [DigitalOcean Apps](https://cloud.digitalocean.com/apps)
2. Click on `repaircoin-prod` app
3. Click the **Console** tab
4. Wait for the console to connect to your running app
5. Run the migration command:
   ```bash
   npm run db:migrate
   ```
6. Verify migrations completed successfully (should see ✅ for each migration)

**Why this works**: The production app already has `DATABASE_URL` pointing to the production database, so migrations run against the correct database.

**Alternative (if Console doesn't work):**

Temporarily swap your local `.env`:

```bash
# Backup local .env
cp .env .env.backup

# Edit .env - change DB_HOST to production database host
# Run migrations
npm run db:migrate

# Restore local .env
cp .env.backup .env
```

#### Step 2.6: Migrate Data from Staging to Production Database ✅ Skipped (Fresh Start)

> **Decision**: Staging has mostly test data, so we're starting fresh with an empty production database. No data migration needed.

**Option A: Full Data Migration (Recommended for live sites with real users)**

```bash
# Export from staging database
pg_dump -h staging-db-host -U doadmin -d defaultdb --data-only > staging_data.sql

# Import to production database
psql -h prod-db-host -U doadmin -d defaultdb < staging_data.sql
```

**Option B: Selective Migration (If you want fresh start with some data)**

- Export only essential tables: users, shops, admins
- Skip transaction history, logs, etc.

**Option C: Fresh Start (Only if no real user data exists)**

- Skip data migration
- Production starts with empty database
- Only use if staging has only test data

**✅ Verify**: After migration, check row counts match between staging and production for critical tables.

#### Step 2.7: Deploy and Test Production Backend ✅ Done

1. Deploy the `repaircoin-prod` app
2. Get the DigitalOcean app URL (e.g., `repaircoin-prod-xxxxx.ondigitalocean.app`)
3. Test directly:

   ```bash
   # Test health endpoint
   curl https://repaircoin-prod-xxxxx.ondigitalocean.app/api/health

   # Should return: {"success":true,"data":{"status":"healthy"...}}
   ```

**✅ Checkpoint**: Production backend is running and healthy on its DO URL. Live site is unaffected.

---

### Phase 3: Add DNS Records (No Impact to Live Site)

> **Risk Level: NONE** - Adding a new DNS record, existing `api.repaircoin.ai` unchanged

#### Step 3.1: Add api-staging DNS Record ✅ Done

1. Go to GoDaddy → **DNS Management** for repaircoin.ai
2. **Add** new CNAME record:

| Type  | Name          | Value                                         | TTL |
| ----- | ------------- | --------------------------------------------- | --- |
| CNAME | `api-staging` | `repaircoin-staging-s7743.ondigitalocean.app` | 600 |

3. **DO NOT** modify the existing `api` record yet!

#### Step 3.2: Add staging Frontend DNS Record ✅ Done

| Type  | Name      | Value                  | TTL |
| ----- | --------- | ---------------------- | --- |
| CNAME | `staging` | `cname.vercel-dns.com` | 600 |

#### Step 3.3: Add Custom Domain in DigitalOcean ✅ Done

> **IMPORTANT**: After adding DNS records, you must also add the domain in DigitalOcean App Platform.

1. Go to **DigitalOcean** → **Apps** → `repaircoin-staging`
2. Click **Networking** tab (not Settings!)
3. Scroll to **Domains** section
4. Click **Add domain**
5. Enter: `api-staging.repaircoin.ai`
6. Select **"You manage your domain"** (keep GoDaddy as DNS provider)
7. Wait for status to change from "Pending" to "Active"

#### Step 3.4: Wait for DNS Propagation ✅ Done

```bash
# Check DNS (wait until it resolves)
nslookup api-staging.repaircoin.ai
nslookup staging.repaircoin.ai

# Test staging backend via new URL
curl https://api-staging.repaircoin.ai/api/health
```

**✅ Checkpoint**: `api-staging.repaircoin.ai` works. Live site still uses `api.repaircoin.ai` (unchanged).

---

### Phase 4: Configure Vercel (No Impact to Live Site)

> **Risk Level: NONE** - Only affects staging deployment, not production
>
> **IMPORTANT**: Do NOT change the Production branch from `main` to `prod` yet! That happens in Phase 8.
> Both `api.repaircoin.ai` and `api-staging.repaircoin.ai` currently point to the same staging backend,
> so both frontends will work correctly until we do the DNS switch.

#### Step 4.1: Add Staging Domain in Vercel ✅ Done

1. Go to [Vercel Dashboard](https://vercel.com) → repair-coin project
2. **Settings** → **Domains** → **Add Domain**
3. Enter: `staging.repaircoin.ai`
4. Select environment: **Production** ← (Yes, Production for now - see note above)
5. Click **Save**

**Why Production environment?**

- Vercel's Preview environment only works with non-production branches
- Since `main` is currently the Production branch, we can't use Preview for `main`
- Changing the Production branch to `prod` NOW would affect your team's workflow
- This is safe because both backends (`api.repaircoin.ai` and `api-staging.repaircoin.ai`) point to the same staging backend anyway
- We'll do the proper branch separation in Phase 8 (DNS switch)

#### Step 4.2: Verify Staging Frontend Works ✅ Done

After adding the domain, test:

```bash
# Wait for Vercel to provision SSL (1-2 min)
curl -I https://staging.repaircoin.ai
```

#### Step 4.3: Configure Vercel Environment Variables (Phase 8)

> **Skip this step for now** - Environment variables will be configured in Phase 8 when we do the branch separation.
> Currently both domains use the same Production environment with the same env vars, which is fine
> because both backends point to the same place.

**In Phase 8, we will:**

1. Change Production branch from `main` to `prod`
2. Set Production env vars to point to `api.repaircoin.ai` (prod backend)
3. Set Preview env vars to point to `api-staging.repaircoin.ai` (staging backend)
4. Move `staging.repaircoin.ai` from Production to Preview environment

**Environment Variables (for reference - configure in Phase 8):**

| Environment | Variable              | Value                                   |
| ----------- | --------------------- | --------------------------------------- |
| Preview     | `NEXT_PUBLIC_API_URL` | `https://api-staging.repaircoin.ai/api` |
| Preview     | `NEXT_PUBLIC_APP_URL` | `https://staging.repaircoin.ai`         |
| Production  | `NEXT_PUBLIC_API_URL` | `https://api.repaircoin.ai/api`         |
| Production  | `NEXT_PUBLIC_APP_URL` | `https://repaircoin.ai`                 |

**✅ Checkpoint**: Vercel staging domain added. Team workflow unaffected. Full separation happens in Phase 8.

---

### Phase 5: Configure Stripe Webhooks (No Impact to Live Site) ⏸️ DEFERRED

> **Risk Level: NONE** - Adding new webhooks
>
> **STATUS: DEFERRED** - Stripe account requires business verification before LIVE mode access.
> The account owner must complete "Verify your business" in Stripe Dashboard.
> Staging TEST webhook already exists and works. LIVE webhook will be created before Phase 8.

#### Step 5.1: Create Production Webhook ⏸️ Deferred

> **BLOCKED**: Stripe account not verified for LIVE mode yet.
> Complete this step before Phase 8 (DNS switch) once account is verified.

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **LIVE Mode**
2. **Developers** → **Webhooks** → **Add endpoint**
3. Configure:
   - **URL**: `https://repaircoin-prod-xxxxx.ondigitalocean.app/api/shops/webhooks/stripe`
   - (Use DO URL for now, will update after DNS switch)
   - **Events**: Select all `customer.subscription.*`, `invoice.*`, `checkout.session.completed`
4. Copy signing secret → Update `repaircoin-prod` env: `STRIPE_WEBHOOK_SECRET`

#### Step 5.2: Staging Webhook ✅ Already Exists

Existing TEST webhook is working:

- **URL**: `https://repaircoin-staging-s7743.ondigitalocean.app/api/shops/webhooks/stripe`
- **Status**: Active, 0% error rate
- **Events**: 4 events configured

No changes needed for staging webhook.

**⏸️ Checkpoint**: Staging webhook working. LIVE webhook deferred until account verification.

---

### Phase 6: Update Staging Backend ✅ Done

> **Risk Level: LOW** - Affects email links and redirects
>
> **Note**: Team was notified before making this change. Email links will now point to `staging.repaircoin.ai`.
> **Note**: Staging backend KEEPS main branch - no branch change needed!

#### Step 6.1: Update Staging Backend Environment

In DigitalOcean → `repaircoin-staging-s7743` → **Settings** → **Environment Variables**:

| Variable       | Change To                       |
| -------------- | ------------------------------- |
| `FRONTEND_URL` | `https://staging.repaircoin.ai` |

#### Step 6.2: Redeploy Staging Backend

Click **Deploy** to apply changes.

**Note**: No branch change needed! Staging backend stays on `main` branch. Other devs continue merging to main as usual.

**✅ Checkpoint**: Staging FRONTEND_URL updated. Other devs completely unaffected.

---

### Phase 7: Full Testing (Before DNS Switch)

#### Step 7.1: Test Staging Environment

1. Push to `main` branch to trigger staging deployment
2. Visit `https://staging.repaircoin.ai`
3. Verify it connects to `api-staging.repaircoin.ai`
4. Test login, basic functionality

**✅ Checkpoint**: Staging environment fully working. Live site completely unaffected.

#### Step 7.2: Test Production Backend Directly

```bash
# Test production backend via DO URL (not DNS yet)
curl https://repaircoin-prod-xxxxx.ondigitalocean.app/api/health

# Should return healthy status
```

**✅ Checkpoint**: Both staging and production backends are healthy and tested.

---

### Phase 8: The DNS Switch (Brief Propagation Period) ✅ Complete

> **Risk Level: LOW-MEDIUM** - This is the only step that affects the live site
> **Downtime**: Usually 0-5 minutes during DNS propagation
>
> **Production Backend URL**: `https://urchin-app-dy2ak.ondigitalocean.app`

#### Pre-Switch Checklist ✅ Complete

Before proceeding, verify:

- [x] `repaircoin-prod` backend is healthy ✅ (verified: 79 tables, healthy)
- [x] Production database has all migrations ✅
- [ ] Production Stripe webhook is configured - **SKIPPED** (using TEST keys for now, will update later)
- [x] Staging environment is fully working on `api-staging.repaircoin.ai` ✅

#### Step 8.1: Update Production FRONTEND_URL ✅ Already Done

`FRONTEND_URL` was already set to `https://repaircoin.ai` when creating the environment variables.

#### Step 8.2: Sync prod Branch with Latest main ✅ Already Done

Both `main` and `prod` branches are at the same commit (`fa3058fd`). Already in sync.

#### Step 8.3: Switch Frontend to prod Branch ⏸️ Skipped for Now

> **Note**: We decided to keep both frontends on Production environment (main branch) for now.
> This will be done later when we do the full environment separation.

#### Step 8.4: Switch Production DNS ✅ Done

**Changed in GoDaddy:**
| Name | Old Value | New Value |
|------|-----------|-----------|
| `api` | `repaircoin-staging-s7743.ondigitalocean.app` | `urchin-app-dy2ak.ondigitalocean.app` |

#### Step 8.5: Configure Domain in DigitalOcean ✅ Done

**Important discovery**: Just changing DNS wasn't enough. We also needed to:
1. Remove `api.repaircoin.ai` from staging backend (it was set as PRIMARY there)
2. Add `api.repaircoin.ai` to production backend
3. Make `api-staging.repaircoin.ai` the PRIMARY for staging

**Final domain configuration:**
| Backend | Domain | Status |
|---------|--------|--------|
| Production (urchin-app-dy2ak) | `api.repaircoin.ai` | ✅ Active (PRIMARY) |
| Staging (repaircoin-staging-s7743) | `api-staging.repaircoin.ai` | ✅ Active (PRIMARY) |

#### Step 8.6: Verification ✅ Done

**Confirmed working:**
- Production: 79 tables, 11 MB (fresh database)
- Staging: 85 tables, 17 MB (test data)
- Login on production creates new account ✅

```bash
# Get latest changes from other devs
git checkout main
git pull origin main

# Merge into prod branch
git checkout prod
git merge main
git push origin prod

# Wait for DigitalOcean to auto-deploy (check app dashboard)
```

**Why now?** Other devs may have merged to main since you created the prod branch. This ensures production gets all their changes.

#### Step 8.2: Switch Frontend to prod Branch

1. In Vercel, go to **Settings** → **Domains**
2. Find `repaircoin.ai` domain
3. Change branch from `main` to `prod`
4. Wait for Vercel to redeploy (~2 min)

**Why now?** Doing this right before DNS switch minimizes the window where production frontend is "frozen" and not getting main updates.

#### Step 8.3: Lower DNS TTL (Do 1 Hour Before Steps 8.1-8.2)

1. Go to GoDaddy → DNS Management
2. Find the `api` CNAME record
3. Change TTL to `300` (5 minutes)
4. Wait 1 hour for old TTL to expire

> **Note**: Do this step 1 hour BEFORE steps 8.1 and 8.2. The sequence is: 8.3 (wait 1hr) → 8.1 → 8.2 → 8.4

#### Step 8.4: Switch Production DNS

1. In GoDaddy DNS Management
2. **Edit** the existing `api` CNAME record:

| Type  | Name  | Old Value                                     | New Value                                  |
| ----- | ----- | --------------------------------------------- | ------------------------------------------ |
| CNAME | `api` | `repaircoin-staging-s7743.ondigitalocean.app` | `repaircoin-prod-xxxxx.ondigitalocean.app` |

3. Save changes

#### Step 8.5: Monitor DNS Propagation

```bash
# Check DNS propagation (run every minute)
nslookup api.repaircoin.ai

# Test production API
curl https://api.repaircoin.ai/api/health

# Should show new backend (check uptime will be low since it's new)
```

#### Step 8.6: Update Stripe Production Webhook URL

1. Go to Stripe → **LIVE Mode** → **Webhooks**
2. Edit the production webhook
3. Update URL: `https://api.repaircoin.ai/api/shops/webhooks/stripe`

#### Step 8.7: Verify Production

1. Visit `https://repaircoin.ai`
2. Test login with wallet
3. Test basic functionality
4. Check Stripe webhook events are received

**✅ Checkpoint**: Production is now on new infrastructure!

---

### Phase 9: Cleanup and Final Configuration

#### Step 9.1: Increase DNS TTL

After confirming everything works (wait 24 hours):

1. Go to GoDaddy → DNS Management
2. Change `api` TTL back to `3600` (1 hour)

#### Step 9.2: Update CORS in Backend Code

Ensure `backend/src/app.ts` includes all domains:

```typescript
const allowedOrigins = [
  // Local development
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",

  // Production
  "https://repaircoin.ai",
  "https://www.repaircoin.ai",
  "https://api.repaircoin.ai",

  // Staging
  "https://staging.repaircoin.ai",
  "https://api-staging.repaircoin.ai",

  // Vercel previews
  /\.vercel\.app$/,
];
```

---

## Rollback Plan (If Something Goes Wrong)

If issues occur after DNS switch:

### Quick Rollback (< 5 min)

1. Go to GoDaddy → DNS Management
2. Change `api` CNAME back to:
   - **Value**: `repaircoin-staging-s7743.ondigitalocean.app`
3. Wait 5 minutes for propagation
4. Site is back to original state

### Why Rollback is Safe

- Staging backend is still running (we didn't delete it)
- Staging database still has all data
- DNS switch is reversible

---

## Environment Summary (Final State)

| Environment    | Frontend URL          | Backend URL               | Backend App                | Database                | Branch | Stripe |
| -------------- | --------------------- | ------------------------- | -------------------------- | ----------------------- | ------ | ------ |
| **Production** | repaircoin.ai         | api.repaircoin.ai         | `repaircoin-prod`          | `db-repaircoin-prod`    | `prod` | LIVE   |
| **Staging**    | staging.repaircoin.ai | api-staging.repaircoin.ai | `repaircoin-staging-s7743` | `db-repaircoin-staging` | `main` | TEST   |
| **Local**      | localhost:3001        | localhost:4000            | -                          | staging DB              | any    | TEST   |

---

## Development Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. Create feature branch from main (same as before!)                   │
│     git checkout main && git pull                                       │
│     git checkout -b feature/my-feature                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  2. Develop & test locally                                              │
│     - Frontend: localhost:3001                                          │
│     - Backend: localhost:4000                                           │
│     - Database: staging DB                                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  3. Push and create PR to main (same as before!)                        │
│     git push -u origin feature/my-feature                               │
│     Create PR: feature/my-feature → main                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  4. PR merged → Auto-deploys to STAGING                                 │
│     - Frontend: staging.repaircoin.ai (Vercel, main branch)             │
│     - Backend: api-staging.repaircoin.ai (DigitalOcean, main branch)    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  5. Test on staging environment                                         │
│     - Full end-to-end testing                                           │
│     - Stripe TEST payments                                              │
│     - QA verification                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  6. Create PR from main to prod (RELEASE)                               │
│     Create PR: main → prod                                              │
│     This is a controlled production release!                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  7. PR merged → Auto-deploys to PRODUCTION                              │
│     - Frontend: repaircoin.ai (Vercel, prod branch)                     │
│     - Backend: api.repaircoin.ai (DigitalOcean, prod branch)            │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Benefit**: Steps 1-5 are IDENTICAL to current workflow. Other devs don't need to change anything!

---

## Database Migration Workflow

### For Staging

```bash
# Migrations auto-run on staging deploy if configured
# Or manually:
export DATABASE_URL="postgresql://...staging..."
cd backend && npm run db:migrate
```

### For Production

```bash
# IMPORTANT: Test migrations on staging FIRST
# Then run on production:
export DATABASE_URL="postgresql://...prod..."
cd backend && npm run db:migrate
```

---

## Implementation Checklist

### Phase 1: Prepare Codebase ✅ Complete

- [x] Update CORS configuration to include staging/production domains
- [x] Commit and push CORS update to main
- [x] Create `prod` branch from main
- [x] Verify deploy to existing backend succeeds

### Phase 2: Create Production Infrastructure ✅ Complete (env vars pending owner)

- [x] Create `db-postgresql-repaircoin-prod` database
- [x] Create `repaircoin-prod` backend app (using `prod` branch!)
- [ ] Set production environment variables ⚠️ (waiting for owner - using staging values)
- [x] **Add backend to database trusted sources**
- [x] Run migrations on production database
- [x] **Migrate data from staging to production database** ✅ Skipped (Fresh Start - staging has test data only)
- [x] Deploy and test via DO URL directly
- [x] Verify health endpoint returns healthy

### Phase 3: Add DNS Records ✅ Complete

- [x] Add CNAME: `api-staging` → `repaircoin-staging-s7743.ondigitalocean.app` ✅
- [x] Add CNAME: `staging` → `cname.vercel-dns.com` ✅
- [x] Add `api-staging.repaircoin.ai` domain in DigitalOcean App Platform ✅
- [x] Wait for DNS propagation ✅
- [x] Test: `curl https://api-staging.repaircoin.ai/api/health` ✅

### Phase 4: Configure Vercel ✅ Complete

- [x] Add `staging.repaircoin.ai` domain ✅
- [x] Verify staging frontend loads ✅
- [x] Set Preview environment variables ✅
- [x] Set Production environment variables ✅
- [x] Change Production branch from `main` to `prod` ✅
- [x] Move `staging.repaircoin.ai` domain from Production to Preview (main branch) ✅
- [x] Disable Vercel Deployment Protection for Preview ✅
- [x] Promote `prod` branch deployment to Production ✅

### Phase 5: Configure Stripe Webhooks ⏸️ Deferred

> **Note**: LIVE mode requires Stripe account verification (owner must complete).
> Staging TEST webhook already exists and works. LIVE webhook will be created before Phase 8 (DNS switch).

- [ ] Create production webhook (LIVE mode) - **DEFERRED** (account not verified yet)
- [x] Staging webhook (TEST mode) - Already exists and working ✅
- [ ] Update backend env variables with webhook secrets (will do with LIVE webhook)

### Phase 6: Update Staging Backend ✅ Complete

- [x] Update `FRONTEND_URL` to `https://staging.repaircoin.ai` ✅
- [x] Redeploy staging backend ✅ (auto-deployed after env var change)

### Phase 7: Full Testing ✅ Complete

- [x] Test staging frontend connects to api-staging backend ✅ (200 OK)
- [x] Test staging backend health ✅ (Healthy, 85 tables, uptime confirmed)
- [ ] Test login and basic functionality on staging (manual)
- [ ] Test production backend health via DO URL directly (deferred - using staging values)

### Phase 8: DNS Switch & Full Environment Separation ✅ Complete

- [x] Pre-switch checklist verified ✅
- [x] Production FRONTEND_URL already set to `https://repaircoin.ai` ✅
- [x] Sync prod branch with latest main ✅
- [x] Verify production backend is healthy ✅ (`urchin-app-dy2ak.ondigitalocean.app`)
- [x] **Switch `api` CNAME to production backend** ✅ Done (`urchin-app-dy2ak.ondigitalocean.app`)
- [x] DNS propagation verified ✅ (Google DNS confirms new value)
- [ ] ~~Update Stripe webhook URL~~ (deferred - using TEST keys for now)
- [x] Verify production site works ✅ (backends have different uptimes)

**Vercel Environment Separation (Feb 4, 2026):**
- [x] Changed Production branch from `main` to `prod` ✅
- [x] Configured environment-specific variables:
  - Production: `NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api`
  - Preview: `NEXT_PUBLIC_API_URL=https://api-staging.repaircoin.ai/api`
- [x] Moved `staging.repaircoin.ai` from Production to Preview environment (main branch) ✅
- [x] Disabled Vercel Deployment Protection for Preview deployments ✅
- [x] Promoted `prod` branch deployment to Production ✅
- [x] Triggered new Preview deployment for `main` branch ✅
- [x] Verified staging recognizes existing test accounts ✅

### Phase 9: Cleanup (In Progress)

- [ ] Increase DNS TTL back to 3600 (after 24 hours)
- [x] Verify CORS configuration is correct ✅
- [x] Document final configuration ✅
- [ ] Notify team of new workflow (main → prod for releases)
- [ ] Configure LIVE Stripe webhook for production (requires account verification)
- [ ] Deploy new smart contracts for production (see Phase 10)

---

### Phase 10: Deploy Production Smart Contracts (Pending)

> **Why New Contracts?**
> Currently, both staging and production share the same RCN/RCG contracts. These contracts have test balances and transaction history from staging testing. For a clean production environment with zero balances and no test history, new contracts should be deployed.

> **⚠️ Contact Required**: Contract deployment requires access to the Thirdweb account used for staging.
> - **Contact Zeff** (or whoever deployed the original contracts) to deploy new production contracts
> - They will need to log into [thirdweb.com/dashboard](https://thirdweb.com/dashboard)
> - Ask them:
>   1. Does he have access to the Thirdweb account used for staging?
>   2. Should production use the same Thirdweb project or a separate one?
>   3. Should production contracts be on Base Sepolia (testnet) or Base mainnet?

#### Current Shared Contracts (Staging & Production)
| Token | Contract Address | Network |
|-------|-----------------|---------|
| RCN | `0xBFE793d78B6B83859b528F191bd6F2b8555D951C` | Base Sepolia |
| RCG | `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D` | Base Sepolia |

#### Step 10.1: Deploy New RCN Contract for Production

1. Go to [Thirdweb Dashboard](https://thirdweb.com/dashboard)
2. Click **Deploy** → Select the same contract type used for RCN (ERC-20)
3. Configure:
   - **Name**: `RepairCoin` (or `RepairCoin Production`)
   - **Symbol**: `RCN`
   - **Network**: Base Sepolia (or mainnet when ready)
   - **Initial Supply**: 0 (minted on demand)
4. Deploy and copy the new contract address

#### Step 10.2: Deploy New RCG Contract for Production

1. Go to [Thirdweb Dashboard](https://thirdweb.com/dashboard)
2. Click **Deploy** → Select the same contract type used for RCG (ERC-20)
3. Configure:
   - **Name**: `RepairCoin Governance` (or `RepairCoin Governance Production`)
   - **Symbol**: `RCG`
   - **Network**: Base Sepolia (or mainnet when ready)
   - **Initial Supply**: 100,000,000 (fixed supply)
4. Deploy and copy the new contract address

#### Step 10.3: Update Production Backend Environment Variables

In DigitalOcean → `repaircoin-prod` → **Settings** → **Environment Variables**:

| Variable | Old Value | New Value |
|----------|-----------|-----------|
| `RCN_CONTRACT_ADDRESS` | `0xBFE793d78B6B83859b528F191bd6F2b8555D951C` | `<new-rcn-contract-address>` |
| `RCG_CONTRACT_ADDRESS` | `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D` | `<new-rcg-contract-address>` |

**Optional - If using separate Thirdweb project for production:**
| Variable | Action |
|----------|--------|
| `RCN_THIRDWEB_CLIENT_ID` | Update if using new Thirdweb project |
| `RCN_THIRDWEB_SECRET_KEY` | Update if using new Thirdweb project |
| `RCG_THIRDWEB_CLIENT_ID` | Update if using new Thirdweb project |
| `RCG_THIRDWEB_SECRET_KEY` | Update if using new Thirdweb project |

#### Step 10.4: Update Production Frontend Environment Variables

In Vercel → **Settings** → **Environment Variables**:

For **Production** environment only:
| Variable | New Value |
|----------|-----------|
| `NEXT_PUBLIC_RCN_CONTRACT_ADDRESS` | `<new-rcn-contract-address>` |
| `NEXT_PUBLIC_RCG_CONTRACT_ADDRESS` | `<new-rcg-contract-address>` |

**Note**: Keep staging (Preview) pointing to the old contracts so test data remains accessible.

#### Step 10.5: Redeploy Production

1. **Backend**: DigitalOcean will auto-redeploy after env var changes, or manually trigger deploy
2. **Frontend**: Go to Vercel → Deployments → Find `prod` branch → Redeploy

#### Step 10.6: Verify New Contracts

```bash
# Test production API with new contracts
curl https://api.repaircoin.ai/api/system/info

# Verify contract addresses in response match new ones
```

#### Step 10.7: Grant Minting Permissions (If Required)

If the contracts require minter roles:
1. Go to Thirdweb Dashboard → Select new RCN contract
2. Go to **Permissions** tab
3. Add the production wallet address (`PRIVATE_KEY` wallet) as a minter
4. Repeat for RCG contract if needed

#### Final Contract Configuration

| Environment | RCN Contract | RCG Contract |
|-------------|--------------|--------------|
| **Staging** | `0xBFE793d78B6B83859b528F191bd6F2b8555D951C` | `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D` |
| **Production** | `<new-rcn-contract-address>` | `<new-rcg-contract-address>` |

**✅ Checkpoint**: Production has fresh contracts with zero balances, completely isolated from staging test data.

---

## Troubleshooting

### DNS not resolving

```bash
# Check DNS propagation
nslookup api.repaircoin.ai
nslookup api-staging.repaircoin.ai

# Clear local DNS cache (Windows)
ipconfig /flushdns
```

### CORS errors after switch

- Verify `FRONTEND_URL` matches the frontend domain
- Check `allowedOrigins` in `app.ts`
- Ensure `COOKIE_DOMAIN=.repaircoin.ai`

### Cookie issues

- Verify `COOKIE_DOMAIN=.repaircoin.ai` on both backends
- Check `sameSite` is `lax`
- Ensure `secure: true` in production

### Quick Rollback

```bash
# If production breaks, switch DNS back immediately:
# GoDaddy → api CNAME → repaircoin-staging-s7743.ondigitalocean.app
```

---

## Cost Estimate

| Resource                    | Monthly Cost   |
| --------------------------- | -------------- |
| Production Database (Basic) | ~$15           |
| Staging Database (existing) | (already paid) |
| Production Backend (Basic)  | ~$12           |
| Staging Backend (existing)  | (already paid) |
| Vercel (Pro)                | $20            |
| **Additional Cost**         | **~$27/month** |

---

## Security Considerations

1. **Separate JWT Secrets**: Use DIFFERENT JWT_SECRET for staging and production
2. **Stripe Keys**: NEVER use LIVE keys in staging/development
3. **Database Access**: Restrict trusted sources to only necessary apps
4. **Admin Addresses**: Review admin wallet addresses per environment
5. **Private Keys**: Use separate wallet private keys for staging and production
6. **Swagger**: Disable in production (`ENABLE_SWAGGER=false`)
7. **Environment Variables**: Never commit secrets to git

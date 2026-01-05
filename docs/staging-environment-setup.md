# Staging & Production Environment Setup Guide

## Overview

Complete 3-tier environment with **separate backend instances** for staging and production running in parallel.

**Last Updated**: January 5, 2026

---

## ⚡ Zero-Downtime Guarantee

### Why This Won't Cause Downtime

| Phase | What Happens | Live Site Impact |
|-------|--------------|------------------|
| 1-2 | Create new infrastructure | ✅ NONE - New resources, nothing touched |
| 3-6 | Configure DNS, Vercel, Stripe | ✅ NONE - Adding new records, not modifying |
| 7 | Full testing | ✅ NONE - Testing on new infrastructure |
| 8 | DNS Switch | ⚠️ 0-5 min propagation (backend already running!) |
| 9 | Cleanup | ✅ NONE - Post-migration tasks |

### Why Other Devs Won't Be Affected

| Their Action | During Migration | After Migration |
|--------------|------------------|-----------------|
| Merge to `main` | → Deploys to current backend (unchanged) | → Deploys to STAGING |
| Create PRs | → Works normally | → Works normally |
| Test locally | → Works normally | → Works normally |

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
│  Database: db-postgresql-repaircoin-staging (EXISTING)                   │
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
│  Database: db-postgresql-repaircoin-staging (or local Docker)            │
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
| Component | URL/Name | Branch | Points To |
|-----------|----------|--------|-----------|
| Frontend (prod) | repaircoin.ai | main | Vercel |
| Backend | api.repaircoin.ai | main | `repaircoin-staging-s7743` (staging!) |
| Database | - | - | `db-postgresql-repaircoin-staging` |

### Target State (After Migration)
| Environment | Frontend | Backend | Database | Branch |
|-------------|----------|---------|----------|--------|
| **Production** | repaircoin.ai | api.repaircoin.ai → `repaircoin-prod` | `db-repaircoin-prod` | `prod` |
| **Staging** | staging.repaircoin.ai | api-staging.repaircoin.ai → `repaircoin-staging-s7743` | `db-repaircoin-staging` | `main` |

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

#### Step 1.1: Update CORS Configuration

Edit `backend/src/app.ts` to include all future domains:

```typescript
const allowedOrigins = [
  // Local development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',

  // Production
  'https://repaircoin.ai',
  'https://www.repaircoin.ai',
  'https://api.repaircoin.ai',

  // Staging
  'https://staging.repaircoin.ai',
  'https://api-staging.repaircoin.ai',

  // Vercel previews
  /\.vercel\.app$/,
];
```

#### Step 1.2: Commit and Deploy CORS Update

```bash
# Commit to main (deploys to current backend, other devs unaffected)
git checkout main
git pull origin main
git add backend/src/app.ts
git commit -m "feat: add staging and production domains to CORS"
git push origin main
```

#### Step 1.3: Create Production Branch

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

#### Step 2.1: Create Production Database

1. Go to [DigitalOcean Databases](https://cloud.digitalocean.com/databases)
2. Click **Create Database Cluster**
3. Configure:
   - **Engine**: PostgreSQL 15
   - **Name**: `db-postgresql-repaircoin-prod`
   - **Region**: SGP1 (Singapore) - same as staging
   - **Plan**: Basic ($15/mo)
4. Click **Create Database Cluster**
5. Wait for provisioning (~5-10 min)
6. Copy connection string for later

#### Step 2.2: Create Production Backend App

1. Go to [DigitalOcean Apps](https://cloud.digitalocean.com/apps)
2. Click **Create App**
3. Configure:
   - **Source**: GitHub → RepairCoin/RepairCoin
   - **Branch**: `prod` ← **IMPORTANT: Use prod branch, not main!**
   - **Source Directory**: `/backend`
   - **Name**: `repaircoin-prod`
   - **Region**: Singapore (sgp1)
   - **Plan**: Basic ($12/mo)

#### Step 2.3: Set Production Backend Environment Variables

In DigitalOcean → `repaircoin-prod` app → **Settings** → **Environment Variables**:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `DATABASE_URL` | `postgresql://...repaircoin-prod...?sslmode=require` |
| `DB_SSL` | `true` |
| `JWT_SECRET` | `<generate-NEW-secure-32+-char-secret>` |
| `FRONTEND_URL` | `https://repaircoin.ai` |
| `COOKIE_DOMAIN` | `.repaircoin.ai` |
| `STRIPE_SECRET_KEY` | `sk_live_...` (LIVE key) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (will create later) |
| `THIRDWEB_CLIENT_ID` | `<your-client-id>` |
| `THIRDWEB_SECRET_KEY` | `<your-secret-key>` |
| `PRIVATE_KEY` | `<production-wallet-private-key>` |
| `ADMIN_ADDRESSES` | `0x761E5E59485ec6feb263320f5d636042bD9EBc8c` |
| `ENABLE_SWAGGER` | `false` |

#### Step 2.4: Run Migrations on Production Database

```bash
# Set production DATABASE_URL temporarily
export DATABASE_URL="postgresql://doadmin:PASSWORD@db-postgresql-repaircoin-prod-xxx:25060/defaultdb?sslmode=require"

cd backend
npm run db:migrate
```

#### Step 2.5: Migrate Data from Staging to Production Database

> ⚠️ **CRITICAL**: Production database is NEW and EMPTY. You must migrate existing data!

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

#### Step 2.6: Add Production Backend to Database Trusted Sources

1. Go to **Database** → `db-postgresql-repaircoin-prod` → **Settings** → **Trusted Sources**
2. Add: `repaircoin-prod` app

#### Step 2.6: Deploy and Test Production Backend

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

#### Step 3.1: Add api-staging DNS Record

1. Go to GoDaddy → **DNS Management** for repaircoin.ai
2. **Add** new CNAME record:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `api-staging` | `repaircoin-staging-s7743.ondigitalocean.app` | 600 |

3. **DO NOT** modify the existing `api` record yet!

#### Step 3.2: Add staging Frontend DNS Record

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `staging` | `cname.vercel-dns.com` | 600 |

#### Step 3.3: Wait for DNS Propagation

```bash
# Check DNS (wait until it resolves)
nslookup api-staging.repaircoin.ai

# Test staging backend via new URL
curl https://api-staging.repaircoin.ai/api/health
```

**✅ Checkpoint**: `api-staging.repaircoin.ai` works. Live site still uses `api.repaircoin.ai` (unchanged).

---

### Phase 4: Configure Vercel (No Impact to Live Site)

> **Risk Level: NONE** - Only affects staging deployment, not production

#### Step 4.1: Add Staging Domain in Vercel

1. Go to [Vercel Dashboard](https://vercel.com) → repair-coin project
2. **Settings** → **Domains** → **Add Domain**
3. Enter: `staging.repaircoin.ai`
4. Select branch: `main` ← **Staging uses main branch (no change for devs!)**

#### Step 4.2: Configure Vercel Environment Variables - Staging

**For Preview/Staging Environment** (select "Preview"):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api-staging.repaircoin.ai/api` |
| `NEXT_PUBLIC_APP_URL` | `https://staging.repaircoin.ai` |
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | `<your-client-id>` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` (TEST key) |

#### Step 4.3: Configure Vercel Environment Variables - Production

**For Production Environment** (select "Production"):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.repaircoin.ai/api` |
| `NEXT_PUBLIC_APP_URL` | `https://repaircoin.ai` |
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | `<your-client-id>` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` (LIVE key) |

**Note**: We will change `repaircoin.ai` to use `prod` branch in Phase 8, right before DNS switch. This minimizes the "freeze" window where production frontend doesn't get updates from main.

**✅ Checkpoint**: Vercel staging configured. Production domain still on main (will change in Phase 8).

---

### Phase 5: Configure Stripe Webhooks (No Impact to Live Site)

> **Risk Level: NONE** - Adding new webhooks

#### Step 5.1: Create Production Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **LIVE Mode**
2. **Developers** → **Webhooks** → **Add endpoint**
3. Configure:
   - **URL**: `https://repaircoin-prod-xxxxx.ondigitalocean.app/api/shops/webhooks/stripe`
   - (Use DO URL for now, will update after DNS switch)
   - **Events**: Select all `customer.subscription.*`, `invoice.*`, `checkout.session.completed`
4. Copy signing secret → Update `repaircoin-prod` env: `STRIPE_WEBHOOK_SECRET`

#### Step 5.2: Create Staging Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **TEST Mode**
2. **Developers** → **Webhooks** → **Add endpoint**
3. Configure:
   - **URL**: `https://api-staging.repaircoin.ai/api/shops/webhooks/stripe`
   - **Events**: Same as above
4. Copy signing secret → Update `repaircoin-staging-s7743` env

**✅ Checkpoint**: Webhooks configured. Live site unaffected.

---

### Phase 6: Update Staging Backend (Staging Only)

> **Risk Level: LOW** - Only affects staging backend
> **Note**: Staging backend KEEPS main branch - no branch change needed!

#### Step 6.1: Update Staging Backend Environment

In DigitalOcean → `repaircoin-staging-s7743` → **Settings** → **Environment Variables**:

| Variable | Change To |
|----------|-----------|
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

### Phase 8: The DNS Switch (Brief Propagation Period)

> **Risk Level: LOW-MEDIUM** - This is the only step that affects the live site
> **Downtime**: Usually 0-5 minutes during DNS propagation

#### Pre-Switch Checklist

Before proceeding, verify:
- [ ] `repaircoin-prod` backend is healthy: `curl https://repaircoin-prod-xxxxx.ondigitalocean.app/api/health`
- [ ] Production database has all migrations AND data
- [ ] Production Stripe webhook is configured
- [ ] Staging environment is fully working on `api-staging.repaircoin.ai`

#### Step 8.1: Sync prod Branch with Latest main

> ⚠️ **IMPORTANT**: Do this RIGHT BEFORE the DNS switch to get latest code!

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

| Type | Name | Old Value | New Value |
|------|------|-----------|-----------|
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
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',

  // Production
  'https://repaircoin.ai',
  'https://www.repaircoin.ai',
  'https://api.repaircoin.ai',

  // Staging
  'https://staging.repaircoin.ai',
  'https://api-staging.repaircoin.ai',

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

| Environment | Frontend URL | Backend URL | Backend App | Database | Branch | Stripe |
|-------------|--------------|-------------|-------------|----------|--------|--------|
| **Production** | repaircoin.ai | api.repaircoin.ai | `repaircoin-prod` | `db-repaircoin-prod` | `prod` | LIVE |
| **Staging** | staging.repaircoin.ai | api-staging.repaircoin.ai | `repaircoin-staging-s7743` | `db-repaircoin-staging` | `main` | TEST |
| **Local** | localhost:3001 | localhost:4000 | - | staging DB | any | TEST |

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

### Phase 1: Prepare Codebase
- [ ] Update CORS configuration to include staging/production domains
- [ ] Commit and push CORS update to main
- [ ] Create `prod` branch from main
- [ ] Verify deploy to existing backend succeeds

### Phase 2: Create Production Infrastructure
- [ ] Create `db-postgresql-repaircoin-prod` database
- [ ] Create `repaircoin-prod` backend app (using `prod` branch!)
- [ ] Set production environment variables
- [ ] Run migrations on production database
- [ ] **Migrate data from staging to production database** ⚠️
- [ ] Add backend to database trusted sources
- [ ] Deploy and test via DO URL directly
- [ ] Verify health endpoint returns healthy

### Phase 3: Add DNS Records
- [ ] Add CNAME: `api-staging` → `repaircoin-staging-s7743.ondigitalocean.app`
- [ ] Add CNAME: `staging` → `cname.vercel-dns.com`
- [ ] Wait for DNS propagation
- [ ] Test: `curl https://api-staging.repaircoin.ai/api/health`

### Phase 4: Configure Vercel
- [ ] Add `staging.repaircoin.ai` domain (linked to `main` branch)
- [ ] Set Preview environment variables (pointing to api-staging)
- [ ] Set Production environment variables (pointing to api.repaircoin.ai)
- [ ] ~~Change repaircoin.ai to prod branch~~ (moved to Phase 8)

### Phase 5: Configure Stripe Webhooks
- [ ] Create production webhook (LIVE mode) - use DO URL initially
- [ ] Create staging webhook (TEST mode)
- [ ] Update backend env variables with webhook secrets

### Phase 6: Update Staging Backend
- [ ] Update `FRONTEND_URL` to `https://staging.repaircoin.ai`
- [ ] Redeploy staging backend (keeps `main` branch - no change!)

### Phase 7: Full Testing
- [ ] Test staging frontend connects to api-staging backend
- [ ] Test login and basic functionality on staging
- [ ] Test production backend health via DO URL directly
- [ ] Verify both backends are healthy and ready

### Phase 8: DNS Switch (The Big Moment)
- [ ] Lower DNS TTL to 300 (**do this 1 hour before next steps!**)
- [ ] **Sync prod branch with latest main** (get other devs' changes)
- [ ] **Switch Vercel repaircoin.ai to prod branch**
- [ ] Wait for Vercel and DO to redeploy
- [ ] Verify production backend is still healthy
- [ ] Switch `api` CNAME to production backend
- [ ] Monitor DNS propagation
- [ ] Update Stripe webhook URL to `api.repaircoin.ai`
- [ ] Verify production site works

### Phase 9: Cleanup
- [ ] Increase DNS TTL back to 3600 (after 24 hours)
- [ ] Verify CORS configuration is correct
- [ ] Document final configuration
- [ ] Notify team of new workflow (main → prod for releases)

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

| Resource | Monthly Cost |
|----------|--------------|
| Production Database (Basic) | ~$15 |
| Staging Database (existing) | (already paid) |
| Production Backend (Basic) | ~$12 |
| Staging Backend (existing) | (already paid) |
| Vercel (Pro) | $20 |
| **Additional Cost** | **~$27/month** |

---

## Security Considerations

1. **Separate JWT Secrets**: Use DIFFERENT JWT_SECRET for staging and production
2. **Stripe Keys**: NEVER use LIVE keys in staging/development
3. **Database Access**: Restrict trusted sources to only necessary apps
4. **Admin Addresses**: Review admin wallet addresses per environment
5. **Private Keys**: Use separate wallet private keys for staging and production
6. **Swagger**: Disable in production (`ENABLE_SWAGGER=false`)
7. **Environment Variables**: Never commit secrets to git

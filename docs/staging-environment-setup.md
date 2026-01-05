# Staging Environment Setup Guide

## Overview

Simplified 3-tier environment using shared backend infrastructure.

**Last Updated**: December 30, 2024

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION                               │
│  Frontend: repaircoin.ai (Vercel, main branch)             │
│  Backend: api.repaircoin.ai (current DO backend)           │
│  Database: db-postgresql-repaircoin-prod (NEW - clean)     │
└─────────────────────────────────────────────────────────────┘
                              ↑
                         Switch DATABASE_URL when ready
                              │
┌─────────────────────────────────────────────────────────────┐
│                    STAGING                                  │
│  Frontend: staging.repaircoin.ai (Vercel, staging branch)  │
│  Backend: api.repaircoin.ai (current DO backend)           │
│  Database: db-postgresql-repaircoin-staging (EXISTING)     │
└─────────────────────────────────────────────────────────────┘
                              ↑
                         Test on staging
                              │
┌─────────────────────────────────────────────────────────────┐
│                    LOCAL DEV                                │
│  Frontend: localhost:3001                                  │
│  Backend: localhost:4000                                   │
│  Database: db-postgresql-repaircoin-staging (EXISTING)     │
└─────────────────────────────────────────────────────────────┘
```

**Key Points:**

- Single API URL: `api.repaircoin.ai` (shared by staging & prod frontends)
- Staging frontend tests changes before merging to main
- Production cutover = update backend's DATABASE_URL to new prod DB

---

## Current State

| Component         | Current URL/Name   | Notes                                       |
| ----------------- | ------------------ | ------------------------------------------- |
| Domain Registrar  | **GoDaddy**        | ns27.domaincontrol.com                      |
| Frontend (Vercel) | www.repaircoin.ai  | Points to Vercel                            |
| Backend (DO)      | api.repaircoin.ai  | repaircoin-staging-s7743.ondigitalocean.app |
| Database          | repaircoin-staging | Current database with test data             |

---

## Implementation Steps

### Phase 1: Create Staging Subdomain (DNS)

**Location**: GoDaddy DNS Management for repaircoin.ai

1. Go to https://godaddy.com → Login
2. **My Products** → **Domains** → **repaircoin.ai** → **DNS**
3. Add CNAME record:

| Type  | Name      | Value                  | TTL |
| ----- | --------- | ---------------------- | --- |
| CNAME | `staging` | `cname.vercel-dns.com` | 600 |

**Result**: `staging.repaircoin.ai` → Vercel (staging frontend)

---

### Phase 2: Configure Vercel for Staging

#### Step 2.1: Create Staging Branch

```bash
git checkout main
git pull origin main
git checkout -b staging
git push -u origin staging
```

#### Step 2.2: Add Staging Domain to Vercel

1. Go to [Vercel Dashboard](https://vercel.com) → repair-coin project
2. **Settings** → **Domains** → **Add Domain**
3. Enter: `staging.repaircoin.ai`
4. Select branch: `staging`

#### Step 2.3: Configure Environment Variables

Go to Vercel → Project Settings → Environment Variables

**For Preview/Staging** (select "Preview" environment):

| Variable                             | Value                           |
| ------------------------------------ | ------------------------------- |
| `NEXT_PUBLIC_API_URL`                | `https://api.repaircoin.ai`     |
| `NEXT_PUBLIC_APP_URL`                | `https://staging.repaircoin.ai` |
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`     | (same as prod)                  |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` (TEST key)        |

**For Production** (select "Production" environment):

| Variable                             | Value                       |
| ------------------------------------ | --------------------------- |
| `NEXT_PUBLIC_API_URL`                | `https://api.repaircoin.ai` |
| `NEXT_PUBLIC_APP_URL`                | `https://www.repaircoin.ai` |
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`     | (same)                      |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` (LIVE key)    |

---

### Phase 3: Create New Production Database

#### Step 3.1: Create Database in DigitalOcean

1. Go to [DigitalOcean Databases](https://cloud.digitalocean.com/databases)
2. Click **Create Database Cluster**
3. Configure:
   - **Engine**: PostgreSQL 15
   - **Name**: `db-postgresql-repaircoin-prod`
   - **Region**: SGP1 (Singapore)
   - **Plan**: Basic ($15/mo)
4. Click **Create Database Cluster**
5. Wait for provisioning (~5-10 min)

#### Step 3.2: Get Connection String

1. Click on the new database
2. Go to **Connection Details**
3. Copy the connection string

Example:

```
postgresql://doadmin:PASSWORD@db-postgresql-repaircoin-prod-do-user-xxx.db.ondigitalocean.com:25060/defaultdb?sslmode=require
```

#### Step 3.3: Run Migrations on New Production DB

```bash
# Set the new production DATABASE_URL temporarily
export DATABASE_URL="postgresql://doadmin:PASSWORD@db-postgresql-repaircoin-prod-xxx:25060/defaultdb?sslmode=require"

# Run migrations
cd backend
npm run db:migrate
```

**Save the connection string** - you'll need it for production cutover.

---

### Phase 4: Local Development Setup

#### Step 4.1: Create Backend Environment File

Create `backend/.env.local`:

```env
# Local Development - Points to STAGING Database
NODE_ENV=development
PORT=4000

# STAGING DATABASE (shared with staging server)
DATABASE_URL=postgresql://doadmin:PASSWORD@db-repaircoin-staging-xxx:25060/defaultdb?sslmode=require

# Authentication
JWT_SECRET=your-jwt-secret

# Frontend URL
FRONTEND_URL=http://localhost:3001

# Stripe TEST keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Blockchain
THIRDWEB_CLIENT_ID=your-client-id
THIRDWEB_SECRET_KEY=your-secret-key
PRIVATE_KEY=your-test-wallet-private-key

# Admin
ADMIN_ADDRESSES=0x761E5E59485ec6feb263320f5d636042bD9EBc8c
ENABLE_SWAGGER=true
```

#### Step 4.2: Create Frontend Environment File

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your-client-id
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

#### Step 4.3: Run Local Development

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

---

## Production Cutover (When Ready)

When you're ready to launch with a clean production database:

### Step 1: Update Backend Environment Variables

In DigitalOcean → `repaircoin-staging-s7743` app → Environment Variables:

| Variable                | Change To                           |
| ----------------------- | ----------------------------------- |
| `DATABASE_URL`          | New production DB connection string |
| `STRIPE_SECRET_KEY`     | `sk_live_...` (LIVE key)            |
| `STRIPE_WEBHOOK_SECRET` | Production webhook secret           |

### Step 2: Update Stripe Webhook (if not already done)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Live Mode**
2. **Developers** → **Webhooks** → **Add endpoint**
3. URL: `https://api.repaircoin.ai/api/shops/webhooks/stripe`
4. Select events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.*`
5. Copy webhook secret → Update backend env

### Step 3: Redeploy Backend

The backend will now use the clean production database.

---

## Final Architecture Summary

| Environment    | Frontend URL          | Backend URL       | Database                         | Branch    |
| -------------- | --------------------- | ----------------- | -------------------------------- | --------- |
| **Production** | repaircoin.ai         | api.repaircoin.ai | db-postgresql-repaircoin-prod    | `main`    |
| **Staging**    | staging.repaircoin.ai | api.repaircoin.ai | db-postgresql-repaircoin-staging | `staging` |
| **Local**      | localhost:3001        | localhost:4000    | db-postgresql-repaircoin-staging | any       |

**Note**: Staging and Production share the same backend URL. The difference is:

- Staging tests frontend changes before merging to main
- Production cutover involves switching the backend's DATABASE_URL

---

## Development Workflow

```
1. Create feature branch from staging:
   git checkout staging && git pull
   git checkout -b feature/my-feature

2. Develop locally (localhost → staging DB)

3. Push and create PR to staging:
   git push -u origin feature/my-feature
   # Create PR: feature/my-feature → staging

4. PR merged → Auto-deploys to staging.repaircoin.ai

5. Test on staging environment

6. Create PR from staging to main:
   # Create PR: staging → main

7. PR merged → Auto-deploys to repaircoin.ai (production)
```

---

## Implementation Checklist

### Phase 1: DNS Setup

- [ ] Login to GoDaddy
- [ ] Add CNAME record: `staging` → `cname.vercel-dns.com`
- [ ] Verify DNS propagation (wait 5-10 min)

### Phase 2: Vercel Setup

- [ ] Create `staging` branch in Git
- [ ] Push staging branch to origin
- [ ] Add `staging.repaircoin.ai` domain in Vercel
- [ ] Configure Preview environment variables
- [ ] Configure Production environment variables
- [ ] Test staging deployment

### Phase 3: New Production Database

- [ ] Create `db-postgresql-repaircoin-prod` in DigitalOcean
- [ ] Get connection string
- [ ] Run migrations on new database
- [ ] Save connection string for production cutover

### Phase 4: Local Development

- [ ] Create `backend/.env.local`
- [ ] Create `frontend/.env.local`
- [ ] Test local dev connects to staging DB

### Final Verification

- [ ] Staging: staging.repaircoin.ai works
- [ ] Local: localhost works with staging DB
- [ ] Production DB is ready (migrations run)

---

## Troubleshooting

### DNS not resolving

- Wait 5-10 minutes for propagation
- Use `nslookup staging.repaircoin.ai` to verify
- Clear browser DNS cache

### Vercel deployment failing

- Check branch exists and is pushed
- Verify environment variables are set
- Check build logs in Vercel dashboard

### Database connection issues

- Verify connection string is correct
- Check database firewall allows connections
- Ensure SSL mode is set correctly

---

## Cost Estimate

| Resource                        | Monthly Cost   |
| ------------------------------- | -------------- |
| New Production Database (Basic) | ~$15           |
| Existing Staging Database       | (already paid) |
| Existing Backend                | (already paid) |
| Vercel (Pro)                    | $20            |
| **Additional Cost**             | **~$15/month** |

# Database Migration: NYC to Singapore (Zero Downtime)

## Overview

This guide migrates the PostgreSQL database from New York to Singapore to reduce latency. The app server is in Singapore (SGP1), so co-locating the database will reduce query times from ~2600ms to ~10-50ms.

**Current Setup:**
- App Server: Singapore (SGP1)
- Database: New York (NYC)
- Latency: ~2600ms per query

**Target Setup:**
- App Server: Singapore (SGP1)
- Database: Singapore (SGP1)
- Latency: ~10-50ms per query

---

## Prerequisites

- [ ] DigitalOcean account access
- [ ] App Platform admin access
- [ ] PostgreSQL client installed locally (`psql`, `pg_dump`)
- [ ] New Singapore database created

---

## Step 1: Create New Database in Singapore

1. Go to **DigitalOcean** → **Databases** → **Create Database Cluster**
2. Configure:
   - **Engine:** PostgreSQL 16 (match current version)
   - **Region:** Singapore (SGP1)
   - **Plan:** Same as current DB
   - **Name:** `db-postgresql-repaircoin-sg`
3. Click **Create Database Cluster**
4. Wait 5-10 minutes for provisioning

**Status:** ✅ Completed

---

## Step 2: Gather Connection Strings

### New Singapore Database
1. Go to new database → **Connection Details**
2. Select **Connection String** (Public Network)
3. Copy and save as `NEW_DATABASE_URL`

```
postgresql://doadmin:PASSWORD@db-postgresql-repaircoin-sg-do-user-XXXXX-0.c.db.ondigitalocean.com:25060/defaultdb?sslmode=require
```

### Old New York Database
1. Go to **App Platform** → **repaircoin-staging** → **Settings**
2. Click on **repaircoin-backend** component
3. Find **Environment Variables**
4. Copy `DATABASE_URL` value and save as `OLD_DATABASE_URL`

```
postgresql://doadmin:PASSWORD@db-postgresql-repaircoin-do-user-XXXXX-0.b.db.ondigitalocean.com:25060/defaultdb?sslmode=require
```

---

## Step 3: Initial Data Sync (No Downtime)

This step copies all data without affecting production. The old database remains fully operational.

### 3.1 Export from NYC Database

```bash
# Set environment variable (replace with actual URL)
export OLD_DATABASE_URL="postgresql://doadmin:PASSWORD@nyc-host:25060/defaultdb?sslmode=require"

# Export schema and data (does NOT lock the database)
pg_dump "$OLD_DATABASE_URL" \
  --no-owner \
  --no-acl \
  --verbose \
  > repaircoin_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify export file size (should be ~19MB)
ls -lh repaircoin_backup_*.sql
```

### 3.2 Import to Singapore Database

```bash
# Set environment variable (replace with actual URL)
export NEW_DATABASE_URL="postgresql://doadmin:PASSWORD@sgp-host:25060/defaultdb?sslmode=require"

# Import data to Singapore
psql "$NEW_DATABASE_URL" < repaircoin_backup_*.sql
```

**Estimated time:** 5-15 minutes (DB is ~19MB)

---

## Step 4: Verify Data Integrity

### 4.1 Connect to Singapore Database

```bash
psql "$NEW_DATABASE_URL"
```

### 4.2 Check Tables Exist

```sql
\dt
```

### 4.3 Verify Row Counts Match

Run this on **BOTH** databases and compare:

```sql
SELECT 'customers' as table_name, COUNT(*) as row_count FROM customers
UNION ALL SELECT 'shops', COUNT(*) FROM shops
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'service_orders', COUNT(*) FROM service_orders
UNION ALL SELECT 'services', COUNT(*) FROM services
ORDER BY table_name;
```

### 4.4 Verify Critical Data

```sql
-- Check recent transactions exist
SELECT id, customer_address, amount, created_at
FROM transactions
ORDER BY created_at DESC
LIMIT 5;

-- Check shops exist
SELECT shop_id, name, active
FROM shops
LIMIT 5;
```

---

## Step 5: Final Sync + Switch (Minimal Downtime)

This step ensures any data created between initial sync and switch is captured.

### 5.1 Notify Team

> "Database migration in 5 minutes. Brief read-only period (~2 min). Please avoid creating new records."

### 5.2 Final Data Sync

```bash
# Export latest data from NYC
pg_dump "$OLD_DATABASE_URL" \
  --no-owner \
  --no-acl \
  > repaircoin_final_backup.sql

# Import to Singapore (will update/insert new records)
psql "$NEW_DATABASE_URL" < repaircoin_final_backup.sql
```

### 5.3 Verify Final Sync

```sql
-- On Singapore DB, verify latest records exist
SELECT MAX(created_at) as latest_transaction FROM transactions;
SELECT MAX(created_at) as latest_notification FROM notifications;
```

---

## Step 6: Update App Platform

### 6.1 Update Environment Variable

1. Go to **App Platform** → **repaircoin-staging**
2. Click **Settings** tab
3. Click on **repaircoin-backend** component
4. Find **Environment Variables**
5. Update `DATABASE_URL`:
   - **Old value:** NYC connection string
   - **New value:** Singapore connection string
6. Click **Save**

### 6.2 Wait for Redeploy

- App Platform will automatically redeploy (~2-3 minutes)
- Monitor deployment in **Activity** tab

---

## Step 7: Verify Migration Success

### 7.1 Test Ping Endpoint (No DB)

```bash
curl -w "\nTime: %{time_total}s\n" https://api.repaircoin.ai/api/health/ping
```

**Expected:** < 0.5s

### 7.2 Test Performance Endpoint (With DB)

```bash
curl -s https://api.repaircoin.ai/api/health/perf | jq
```

**Expected:** `db_health_check` < 100ms (was 2600ms)

### 7.3 Test Full Health Check

```bash
curl -w "\nTime: %{time_total}s\n" https://api.repaircoin.ai/api/health
```

**Expected:** < 1s (was 4-5s)

### 7.4 Test Application Endpoints

```bash
# Test balance endpoint
curl -w "\nTime: %{time_total}s\n" "https://api.repaircoin.ai/api/tokens/balance/0x960Aa947468cfd80b8E275C61Abce19E13D6a9e3"
```

**Expected:** < 1s (was 8s)

---

## Step 8: Post-Migration

### 8.1 Monitor for 24 Hours

- Watch application logs for errors
- Monitor response times
- Check user reports

### 8.2 Keep Old Database (7 Days)

Do **NOT** delete the NYC database immediately. Keep it for 7 days in case rollback is needed.

### 8.3 Rollback Plan (If Needed)

If issues occur:
1. Go to App Platform → Settings → Environment Variables
2. Change `DATABASE_URL` back to NYC connection string
3. Save and redeploy

### 8.4 Delete Old Database (After 7 Days)

1. Verify application stable for 7 days
2. Go to DigitalOcean → Databases
3. Select NYC database
4. Click **Destroy**

---

## Timeline Summary

| Step | Duration | Downtime |
|------|----------|----------|
| Create new DB | 10 min | None |
| Initial sync | 10-15 min | None |
| Verify data | 5 min | None |
| Final sync | 2-3 min | ~30 sec |
| Update env var | 1 min | None |
| Redeploy | 2-3 min | None |
| **Total** | **~30 min** | **~30 sec** |

---

## Troubleshooting

### Import Fails with Permission Error

```bash
# Use superuser or grant permissions
psql "$NEW_DATABASE_URL" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO doadmin;"
```

### Connection Timeout

```bash
# Test connectivity
psql "$NEW_DATABASE_URL" -c "SELECT 1;"

# Check SSL mode
psql "postgresql://...?sslmode=require" -c "SELECT 1;"
```

### Data Mismatch

```bash
# Re-run full export/import
pg_dump "$OLD_DATABASE_URL" --clean --no-owner --no-acl > full_backup.sql
psql "$NEW_DATABASE_URL" < full_backup.sql
```

---

## Quick Reference Commands

```bash
# Export from NYC
pg_dump "$OLD_DATABASE_URL" --no-owner --no-acl > backup.sql

# Import to Singapore
psql "$NEW_DATABASE_URL" < backup.sql

# Test connection
psql "$NEW_DATABASE_URL" -c "SELECT version();"

# Count rows
psql "$NEW_DATABASE_URL" -c "SELECT COUNT(*) FROM customers;"

# Test latency
curl -w "Time: %{time_total}s\n" https://api.repaircoin.ai/api/health/ping
```

---

## Contact

If issues occur during migration, contact:
- DevOps Team
- Database Administrator

---

**Document Version:** 1.0
**Last Updated:** January 2026
**Author:** Claude Code

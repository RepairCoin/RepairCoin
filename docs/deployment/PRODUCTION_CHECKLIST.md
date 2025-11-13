# Production Deployment Checklist for RepairCoin

## ⚠️ Critical Issues Found During Migration Review

### 1. **Database Migration Issues**
- ❌ **No initial schema migration (001)** - Base tables are only in `complete-schema-2025-09-19.sql`
- ❌ **Missing migrations** - Gaps in numbering (004, 008, 011, 013)
- ❌ **Unnumbered migration** - `add_stripe_email_column.sql` breaks naming convention
- ⚠️ **Manual fixes required** - You had to manually add columns during staging deployment

### 2. **Migration Order Problems**
The migrations should be consolidated into a single initial schema for production.

## ✅ Production Deployment Checklist

### Pre-Deployment (1 week before)

#### 1. **Database Preparation**
- [ ] Consolidate all migrations into a single production schema
- [ ] Test complete schema on a fresh database
- [ ] Create rollback scripts
- [ ] Document all manual SQL fixes from staging

#### 2. **Environment Variables**
- [ ] Generate production JWT_SECRET (use `openssl rand -base64 32`)
- [ ] Get production Stripe keys (live mode)
- [ ] Verify Thirdweb production credentials
- [ ] Set up production domain CORS origins

#### 3. **Contracts & Blockchain**
- [ ] Deploy contracts to Base Mainnet (currently on testnet)
- [ ] Update contract addresses in environment
- [ ] Test mainnet transactions
- [ ] Set up multi-sig wallet for admin operations

### Deployment Day

#### 1. **Database Setup**
```bash
# 1. Create production database
psql -h your-prod-db -U admin -d postgres -c "CREATE DATABASE repaircoin_prod;"

# 2. Run complete schema
psql -h your-prod-db -U admin -d repaircoin_prod < backend/migrations/generated/complete-schema-2025-09-19.sql

# 3. Run critical updates
psql -h your-prod-db -U admin -d repaircoin_prod < backend/migrations/000_complete_schema.sql

# 4. Verify all tables
psql -h your-prod-db -U admin -d repaircoin_prod -c "\dt"
```

#### 2. **Application Deployment**
- [ ] Set NODE_ENV=production
- [ ] Configure production database URL
- [ ] Set all production environment variables
- [ ] Deploy backend to Digital Ocean
- [ ] Deploy frontend to Vercel/DO
- [ ] Configure production domain

#### 3. **Stripe Configuration**
- [ ] Create production webhook endpoint
- [ ] Add production webhook secret to environment
- [ ] Configure webhook events (checkout.session.completed, etc.)
- [ ] Test webhook with Stripe CLI
- [ ] Create production products and prices

#### 4. **Security Checklist**
- [ ] Enable HTTPS only
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerts
- [ ] Configure backup strategy
- [ ] Enable rate limiting
- [ ] Review CORS settings
- [ ] Audit environment variables

### Post-Deployment

#### 1. **Verification**
- [ ] Test health endpoint: `/api/health`
- [ ] Test Stripe health: `/api/shops/subscription/health`
- [ ] Create test shop registration
- [ ] Process test subscription
- [ ] Verify webhook processing
- [ ] Check database connections

#### 2. **Monitoring Setup**
- [ ] Configure error tracking (Sentry)
- [ ] Set up uptime monitoring
- [ ] Configure database connection alerts
- [ ] Set up Stripe webhook failure alerts
- [ ] Monitor application logs

## 🔧 Recommended Fixes Before Production

### 1. **Create Proper Migration System**
```sql
-- Create 001_initial_schema.sql combining:
-- 1. complete-schema-2025-09-19.sql
-- 2. All fixes discovered during staging
-- 3. Remove deprecated tables (commitment_enrollments)
```

### 2. **Add Migration Validation**
```typescript
// Add to deployment script
async function validateSchema() {
  const requiredTables = [
    'shops', 'customers', 'admins', 'transactions',
    'stripe_customers', 'stripe_subscriptions',
    'referrals', 'promo_codes'
  ];
  
  for (const table of requiredTables) {
    const exists = await checkTableExists(table);
    if (!exists) throw new Error(`Missing table: ${table}`);
  }
}
```

### 3. **Environment Variable Template**
Create `.env.production.template`:
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/repaircoin_prod?sslmode=require
DB_POOL_MAX=10

# Stripe (LIVE KEYS)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...

# Thirdweb
THIRDWEB_CLIENT_ID=...
THIRDWEB_SECRET_KEY=...

# Contracts (MAINNET)
REPAIRCOIN_CONTRACT_ADDRESS=0x...
RCG_CONTRACT_ADDRESS=0x...

# Security
JWT_SECRET=<generate-strong-secret>
ADMIN_ADDRESSES=0x...

# App
NODE_ENV=production
CORS_ORIGIN=https://repaircoin.ai
```

## 🚨 Critical Actions

1. **Fix Migration System** - Consolidate into numbered sequence
2. **Test Fresh Deployment** - Ensure it works from scratch
3. **Document All Manual Fixes** - Prevent staging issues in production
4. **Backup Strategy** - Implement before going live
5. **Monitoring** - Must have alerts for database connections

## 📅 Recommended Timeline

- **Week 1**: Fix migration system, test fresh deployments
- **Week 2**: Deploy to production staging, full testing
- **Week 3**: Production deployment with rollback plan

---

**Note**: Do NOT deploy to production until the migration system is properly consolidated. The current state requires too many manual interventions.
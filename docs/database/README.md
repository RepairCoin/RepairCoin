# Database Documentation

Database schema, migration guides, and PostgreSQL best practices for RepairCoin.

---

## 📁 Documentation Files

| Document | Description |
|----------|-------------|
| **DATABASE_SCHEMA.md** | Complete schema documentation with all tables |
| **DATABASE_MIGRATION_GUIDE.md** | How to create and run database migrations |
| **DATABASE_GUIDE.md** | General database usage and best practices |

---

## 🗄️ Key Tables

### Core Tables

- **customers** - Customer accounts, tiers, balances
- **shops** - Shop registrations, subscriptions, RCN balances
- **admins** - Admin users with role-based permissions
- **transactions** - All RCN/RCG token transactions
- **refresh_tokens** - ⭐ NEW: Refresh tokens for authentication

### Feature Tables

- **notifications** - Real-time notification system
- **promo_codes** - Promotional code management
- **affiliate_shop_groups** - Shop coalitions and group tokens
- **referrals** - Customer referral tracking
- **shop_subscriptions** - Stripe subscription management

### System Tables

- **schema_migrations** - Migration version tracking
- **webhook_logs** - Webhook event logging
- **treasury** - Platform treasury tracking

---

## 🚀 Quick Commands

```bash
# Run all migrations
npm run db:migrate

# Create new migration
npm run db:create-migration <name>

# Check database connection
npm run db:check

# Connect to database (production)
psql "postgresql://user:pass@host:25060/db?sslmode=require"
```

---

## 📊 Latest Changes

**Migration 029** (2025-11-10): Created `refresh_tokens` table
- UUID primary key
- Foreign key to shops(shop_id)
- 6 performance indexes
- Token hashing (SHA-256)
- Revocation support

---

**Last Updated**: November 10, 2025

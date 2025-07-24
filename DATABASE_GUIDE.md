# RepairCoin Database Guide

## What is Shop ID?

**Shop ID** is a unique identifier for each repair shop in the RepairCoin network. It serves several purposes:

### 1. **Human-Readable Identifier**
- Example: `"mikes-electronics-repair"`, `"quick-fix-mobile"`, `"downtown-tech-center"`
- Much easier to remember than wallet addresses or database IDs
- Used in URLs, QR codes, and customer-facing interfaces

### 2. **Business Purposes**
- **Shop Discovery**: Customers can search for shops by shop ID
- **Referrals**: Easy to share shop IDs with friends
- **Marketing**: Shops can use their ID in promotional materials
- **Cross-Shop Network**: Facilitates the 20% cross-shop redemption system

### 3. **Technical Benefits**
- **URL-friendly**: Used in routes like `/shop/mikes-electronics-repair`
- **Database indexing**: Fast lookups for shop operations
- **API endpoints**: Used in REST API calls
- **QR Codes**: Customers scan QR codes containing shop IDs

### 4. **Example Flow**
```
Customer scans QR code → Shop ID "mikes-electronics-repair" 
→ Backend looks up shop details → Customer sees shop info
→ Customer completes repair → Tokens awarded to customer wallet
```

## Database Tables & Connection Guide

### TablePlus Connection Settings

**Connection Name**: RepairCoin Local
**Host**: `localhost` (or `127.0.0.1`)
**Port**: `5432`
**User**: `repaircoin`
**Password**: `repaircoin123`
**Database**: `repaircoin`

### Main Tables Structure

#### 1. **customers** table
```sql
-- View all customers
SELECT * FROM customers ORDER BY created_at DESC;

-- View customers with their wallet addresses
SELECT 
  address as wallet_address,
  name,
  email,
  tier,
  lifetime_earnings,
  is_active,
  created_at
FROM customers;
```

#### 2. **shops** table
```sql
-- View all shops
SELECT * FROM shops ORDER BY created_at DESC;

-- View shop info with balances
SELECT 
  shop_id,
  name,
  wallet_address,
  email,
  phone,
  verified,
  active,
  purchased_rcn_balance,
  total_rcn_purchased,
  created_at
FROM shops;
```

#### 3. **transactions** table
```sql
-- View all transactions
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 50;

-- View transactions with readable info
SELECT 
  t.transaction_hash,
  t.from_address,
  t.to_address,
  t.amount,
  t.transaction_type,
  t.reason,
  t.created_at,
  c.name as customer_name,
  s.name as shop_name
FROM transactions t
LEFT JOIN customers c ON c.address = t.to_address
LEFT JOIN shops s ON s.wallet_address = t.from_address
ORDER BY t.created_at DESC;
```

#### 4. **shop_rcn_purchases** table
```sql
-- View shop RCN purchases
SELECT 
  shop_id,
  amount,
  price_per_rcn,
  total_cost,
  payment_method,
  status,
  created_at
FROM shop_rcn_purchases 
ORDER BY created_at DESC;
```

#### 5. **tier_bonuses** table
```sql
-- View tier bonus applications
SELECT 
  customer_address,
  shop_id,
  tier,
  bonus_amount,
  repair_amount,
  created_at
FROM tier_bonuses 
ORDER BY created_at DESC;
```

#### 6. **cross_shop_verifications** table
```sql
-- View cross-shop redemption attempts
SELECT 
  customer_address,
  home_shop_id,
  redemption_shop_id,
  requested_amount,
  approved_amount,
  status,
  created_at
FROM cross_shop_verifications 
ORDER BY created_at DESC;
```

### Useful Queries

#### Find a specific user by wallet address:
```sql
-- Check if user exists (admin check)
SELECT 'admin' as user_type, '0x761E5E59485ec6feb263320f5d636042bD9EBc8c' as address
WHERE '0x761E5E59485ec6feb263320f5d636042bD9EBc8c' = ANY(string_to_array('0x761E5E59485ec6feb263320f5d636042bD9EBc8c', ','))

UNION ALL

-- Check customers table
SELECT 'customer' as user_type, address FROM customers 
WHERE LOWER(address) = LOWER('0x761E5E59485ec6feb263320f5d636042bD9EBc8c')

UNION ALL

-- Check shops table
SELECT 'shop' as user_type, wallet_address as address FROM shops 
WHERE LOWER(wallet_address) = LOWER('0x761E5E59485ec6feb263320f5d636042bD9EBc8c');
```

#### View platform statistics:
```sql
-- Platform overview
SELECT 
  (SELECT COUNT(*) FROM customers) as total_customers,
  (SELECT COUNT(*) FROM shops WHERE active = true) as active_shops,
  (SELECT COUNT(*) FROM transactions) as total_transactions,
  (SELECT SUM(amount) FROM transactions WHERE transaction_type = 'earned') as total_tokens_earned,
  (SELECT SUM(amount) FROM transactions WHERE transaction_type = 'redeemed') as total_tokens_redeemed;
```

#### Find shops by location:
```sql
-- Shops in specific city
SELECT shop_id, name, address, location FROM shops 
WHERE location->>'city' = 'New York' AND active = true;
```

### Database Schema Creation

If you need to recreate tables, here are the key CREATE TABLE statements:

```sql
-- Core tables are already created by the application
-- But you can check table structure with:
\d customers
\d shops  
\d transactions
\d shop_rcn_purchases
\d tier_bonuses
\d cross_shop_verifications
```

### Troubleshooting Database Connection

1. **Can't connect?**
   ```bash
   # Check if PostgreSQL is running
   docker ps | grep postgres
   
   # Start PostgreSQL if needed
   cd /Users/zeff/Desktop/Work/repaircoin/RepairCoin
   docker-compose up -d postgres
   ```

2. **Wrong credentials?**
   - Check `/Users/zeff/Desktop/Work/repaircoin/RepairCoin/.env` file
   - Look for `DB_USER`, `DB_PASSWORD`, `DB_NAME` values

3. **Tables don't exist?**
   ```bash
   # Run backend to create tables
   cd /Users/zeff/Desktop/Work/repaircoin/RepairCoin/backend
   npm run dev
   ```

### Admin Operations via Database

```sql
-- Manually set a wallet as admin (alternative to .env)
-- This is handled by .env ADMIN_ADDRESSES, but you could create an admins table:

-- Make someone an admin (if you had an admins table)
INSERT INTO admins (wallet_address, name, permissions, created_at) 
VALUES ('0x761E5E59485ec6feb263320f5d636042bD9EBc8c', 'Main Admin', '["*"]', NOW());

-- View admin addresses from environment (current approach)
-- Admins are defined in ADMIN_ADDRESSES=0x761E5E59485ec6feb263320f5d636042bD9EBc8c
```

Your admin status is controlled by the `.env` file, not the database. This is why your wallet `0x761E5E59485ec6feb263320f5d636042bD9EBc8c` should automatically have admin access when you connect it to the frontend.
# Expired Subscription Test Data — DC Shopuo

## Purpose

Snapshot of shop `dc_shopu` in its expired/cancelled subscription state, taken before resubscription on March 5, 2026. Use this data to recreate an expired subscription scenario for testing without needing a real Stripe cancellation cycle.

---

## Snapshot Date: March 5, 2026

### 1. `shops` Table

```sql
-- Shop record
INSERT INTO shops (shop_id, name, wallet_address, email, subscription_active, subscription_id, active, created_at, updated_at)
VALUES (
  'test_expired_shop',
  'Test Expired Shop',
  '0x0000000000000000000000000000000000expired',
  'test-expired@example.com',
  false,        -- subscription_active = OFF
  NULL,         -- no subscription_id
  true,         -- shop account still active
  '2025-11-05 05:50:07.764',
  NOW()
);
```

**Key state:**
| Field | Value | Meaning |
|-------|-------|---------|
| `subscription_active` | `false` | Subscription features disabled |
| `subscription_id` | `NULL` | No linked subscription |
| `active` | `true` | Shop account exists but features locked |

### 2. `stripe_subscriptions` Table

DC Shopuo had 3 subscription records showing the full lifecycle:

```sql
-- Record 1: Stale "active" (ghost record — does NOT exist on Stripe)
-- This is the bug case: status=active but period ended Jan 2025
INSERT INTO stripe_subscriptions (shop_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, status, current_period_start, current_period_end, cancel_at_period_end, canceled_at, ended_at, metadata, created_at, updated_at)
VALUES (
  'test_expired_shop',
  'sub_TEST_GHOST_ACTIVE',
  'cus_TEST_EXPIRED',
  'price_1S7oRjL8hwPnzzXkaY10IE9k',
  'active',                             -- STATUS SAYS ACTIVE (stale!)
  '2025-12-01 06:41:38.941',
  '2025-01-01 00:00:00',                -- PERIOD ENDED JAN 2025
  false,
  NULL,                                  -- Never cancelled in DB
  NULL,
  '{"syncedManually": true}',
  '2025-11-05 11:20:14.541',
  '2026-01-06 09:48:01.177'
);

-- Record 2: Properly cancelled subscription
INSERT INTO stripe_subscriptions (shop_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, status, current_period_start, current_period_end, cancel_at_period_end, canceled_at, ended_at, metadata, created_at, updated_at)
VALUES (
  'test_expired_shop',
  'sub_TEST_CANCELLED_2',
  'cus_TEST_EXPIRED',
  'price_1S7oRjL8hwPnzzXkaY10IE9k',
  'canceled',
  '2025-12-17 20:40:26',
  '2026-01-17 20:40:26',
  false,
  '2026-01-01 02:00:05',
  NULL,
  '{"syncedManually": true}',
  '2025-11-17 12:40:43.95',
  '2026-01-29 04:11:51.804'
);

-- Record 3: Most recent — cancelled by shop owner
INSERT INTO stripe_subscriptions (shop_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, status, current_period_start, current_period_end, cancel_at_period_end, canceled_at, ended_at, metadata, created_at, updated_at)
VALUES (
  'test_expired_shop',
  'sub_TEST_CANCELLED_3',
  'cus_TEST_EXPIRED',
  'price_1S7oRjL8hwPnzzXkaY10IE9k',
  'canceled',
  '2026-01-24 05:47:17',
  '2026-02-24 05:47:17',
  false,
  '2026-02-19 12:18:50',
  '2026-02-22 05:52:32',
  '{}',
  '2025-11-24 05:47:32.886',
  '2026-02-22 05:52:33.636'
);
```

**Key states across records:**

| id | status | period_end | canceled_at | Bug? |
|----|--------|------------|-------------|------|
| 11 | `active` | 2025-01-01 | NULL | YES — ghost record, doesn't exist on Stripe |
| 14 | `canceled` | 2026-01-17 | 2026-01-01 | No — properly cancelled |
| 22 | `canceled` | 2026-02-24 | 2026-02-19 | No — most recent, cancelled by owner |

### 3. `stripe_customers` Table

```sql
INSERT INTO stripe_customers (shop_id, stripe_customer_id, email, name, created_at)
VALUES (
  'test_expired_shop',
  'cus_TEST_EXPIRED',
  'test-expired@example.com',
  'Test Expired Shop',
  '2025-11-05 11:07:10.031'
);
```

---

## How to Recreate an Expired Subscription for Testing

### Quick Method: SQL Insert

Run the SQL statements above with a test shop ID to create a shop in the expired state. This gives you:
- A shop with `subscription_active = false`
- A stale `active` subscription record (tests the self-healing fix)
- Two properly cancelled records (tests normal resubscription)

### Test Scenarios

**Scenario 1: Resubscription with stale record (bug case)**
1. Insert the test shop + all 3 subscription records
2. Try to subscribe via `/api/shops/subscription/subscribe`
3. Expected (before fix): `400 — Shop already has an active subscription`
4. Expected (after fix): Stale record auto-corrected, subscription created

**Scenario 2: Normal resubscription (no stale data)**
1. Insert the test shop + only records 2 and 3 (both `canceled`)
2. Try to subscribe
3. Expected: Subscription created successfully

**Scenario 3: Active subscription blocks resubscription (correct behavior)**
1. Insert the test shop + one record with `status = 'active'` and `current_period_end` in the future
2. Try to subscribe
3. Expected: `400 — Shop already has an active subscription`

### Cleanup

```sql
DELETE FROM stripe_subscriptions WHERE shop_id = 'test_expired_shop';
DELETE FROM stripe_customers WHERE shop_id = 'test_expired_shop';
DELETE FROM shops WHERE shop_id = 'test_expired_shop';
```

---

## Original DC Shopuo Data Reference

| Field | Value |
|-------|-------|
| Shop ID | `dc_shopu` |
| Name | DC Shopuo |
| Wallet | `0x42be8b92a770eb5eb97b7abe7a06183952ec5eb0` |
| Email | `deobernard@yahoo.com` |
| Stripe Customer | `cus_TMoAJH79TOXitt` |
| Last Subscription | `sub_1SWscNL8hwPnzzXkX4QQooOJ` (canceled 2026-02-19) |
| Ghost Subscription | `sub_1SQ4ksL8hwPnzzXkYtuCqK3w` (status=active, doesn't exist on Stripe) |
| Cancellation Reason | Cancelled by shop owner |
| Total Paid | $500 |

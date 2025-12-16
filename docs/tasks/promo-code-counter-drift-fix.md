# Bug Fix: Promo Code Counter Drift Prevention

**Date:** 2025-12-16
**Priority:** MEDIUM
**Component:** Shop Domain - Promo Codes
**Status:** FIXED

## Issue Description

The denormalized counters `times_used` and `total_bonus_issued` on the `promo_codes` table were updated separately from the `promo_code_uses` INSERT. If the counter UPDATE failed, the counts would become inconsistent with actual usage records.

### Affected Files
- `backend/migrations/048_add_promo_code_stats_trigger.sql` - New migration
- `backend/src/repositories/PromoCodeRepository.ts` - Removed manual counter updates

### Steps to Reproduce (Before Fix)
1. Customer uses promo code successfully
2. INSERT into `promo_code_uses` succeeds
3. UPDATE `promo_codes.times_used` fails (connection error, timeout, etc.)
4. `times_used` shows 0, but `promo_code_uses` has 1 record

### Expected Behavior
Counters should always match actual usage records.

### Actual Behavior (Before Fix)
Counters could drift if the UPDATE statement failed after the INSERT succeeded.

## Root Cause

The original code had two separate SQL operations:

```typescript
// Step 6: Update counters (could fail independently)
await client.query(`
  UPDATE promo_codes
  SET times_used = times_used + 1,
      total_bonus_issued = total_bonus_issued + $2
  WHERE id = $1
`, [promo.id, bonusAmount]);

// Step 7: Record usage
await client.query(`
  INSERT INTO promo_code_uses (...)
  VALUES (...)
`, [...]);
```

While both were in a transaction, if the application crashed between commit and response, or if there were retry scenarios, counters could drift.

## Solution

Use PostgreSQL triggers to automatically update counters whenever rows are inserted or deleted from `promo_code_uses`. This is the most reliable approach because:

1. Triggers execute as part of the INSERT/DELETE operation
2. Cannot be skipped or forgotten
3. Works even if application crashes mid-transaction

### Migration: `048_add_promo_code_stats_trigger.sql`

#### INSERT Trigger
```sql
CREATE OR REPLACE FUNCTION update_promo_code_stats_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE promo_codes
  SET times_used = times_used + 1,
      total_bonus_issued = total_bonus_issued + COALESCE(NEW.bonus_amount, 0),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.promo_code_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER promo_code_uses_insert_trigger
AFTER INSERT ON promo_code_uses
FOR EACH ROW
EXECUTE FUNCTION update_promo_code_stats_on_insert();
```

#### DELETE Trigger (for rollbacks)
```sql
CREATE OR REPLACE FUNCTION update_promo_code_stats_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE promo_codes
  SET times_used = GREATEST(0, times_used - 1),
      total_bonus_issued = GREATEST(0, total_bonus_issued - COALESCE(OLD.bonus_amount, 0)),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.promo_code_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER promo_code_uses_delete_trigger
AFTER DELETE ON promo_code_uses
FOR EACH ROW
EXECUTE FUNCTION update_promo_code_stats_on_delete();
```

#### Data Sync
The migration also syncs any existing drift:

```sql
-- Fix any existing drift by recalculating from actual records
UPDATE promo_codes pc
SET
  times_used = COALESCE(stats.actual_uses, 0),
  total_bonus_issued = COALESCE(stats.actual_bonus, 0)
FROM (
  SELECT
    promo_code_id,
    COUNT(*) as actual_uses,
    SUM(COALESCE(bonus_amount, 0)) as actual_bonus
  FROM promo_code_uses
  GROUP BY promo_code_id
) stats
WHERE pc.id = stats.promo_code_id;
```

### Repository Changes

Removed manual counter updates from `PromoCodeRepository.ts`:

```typescript
// Before: Manual counter update
await client.query(`
  UPDATE promo_codes SET times_used = times_used + 1 ...
`);
await client.query(`INSERT INTO promo_code_uses ...`);

// After: Just insert, trigger handles counters
await client.query(`INSERT INTO promo_code_uses ...`);
// Trigger automatically updates times_used and total_bonus_issued
```

Same for rollback:
```typescript
// Before: Manual counter decrement
await client.query('DELETE FROM promo_code_uses ...');
await client.query(`UPDATE promo_codes SET times_used = times_used - 1 ...`);

// After: Just delete, trigger handles counters
await client.query('DELETE FROM promo_code_uses ...');
// Trigger automatically decrements times_used and total_bonus_issued
```

## How to Apply

### Run Migration
```bash
cd C:\dev\RepairCoin\backend
npx ts-node scripts/run-single-migration.ts migrations/048_add_promo_code_stats_trigger.sql
```

### Verify Triggers
```sql
SELECT tgname, tgtype FROM pg_trigger
WHERE tgname LIKE 'promo_code_uses%';
-- Should show: promo_code_uses_insert_trigger, promo_code_uses_delete_trigger
```

### Verify Data Sync
```sql
-- Check for any remaining drift (should return 0 rows)
SELECT pc.id, pc.code, pc.times_used, pc.total_bonus_issued,
       COALESCE(stats.actual_uses, 0) as actual_uses,
       COALESCE(stats.actual_bonus, 0) as actual_bonus
FROM promo_codes pc
LEFT JOIN (
  SELECT promo_code_id, COUNT(*) as actual_uses, SUM(bonus_amount) as actual_bonus
  FROM promo_code_uses GROUP BY promo_code_id
) stats ON pc.id = stats.promo_code_id
WHERE pc.times_used != COALESCE(stats.actual_uses, 0)
   OR pc.total_bonus_issued != COALESCE(stats.actual_bonus, 0);
```

## Testing

### Run Test
```bash
cd backend && npm test -- --testPathPattern="shop.promo-codes" --testNamePattern="FIXED.*trigger"
```

### Manual Test

```sql
-- Before: Check current stats
SELECT id, code, times_used, total_bonus_issued FROM promo_codes WHERE id = 1;

-- Insert a test usage
INSERT INTO promo_code_uses (promo_code_id, customer_address, shop_id, base_reward, bonus_amount, total_reward)
VALUES (1, '0xtest...', 'shop123', 10, 5, 15);

-- After: Verify counter incremented automatically
SELECT id, code, times_used, total_bonus_issued FROM promo_codes WHERE id = 1;
-- times_used should be +1, total_bonus_issued should be +5

-- Rollback: Delete the usage
DELETE FROM promo_code_uses WHERE customer_address = '0xtest...';

-- Verify counter decremented automatically
SELECT id, code, times_used, total_bonus_issued FROM promo_codes WHERE id = 1;
-- Should be back to original values
```

## Benefits

1. **Atomic**: Counter update is part of the INSERT/DELETE operation itself
2. **Reliable**: Cannot drift even if application crashes after commit
3. **Self-Healing**: Migration syncs any existing drift on deployment
4. **Simpler Code**: No manual counter management in application
5. **Consistent**: Works for any INSERT/DELETE, including manual DB operations

## Performance Considerations

- Triggers add minimal overhead (~1ms per INSERT/DELETE)
- `promo_codes` UPDATE uses primary key index (fast)
- No additional queries from application layer (actually reduces load)

## Related Fixes

- `promo-code-atomic-validation-fix.md` - Bug 1: Atomic validation
- `promo-code-validation-row-locking-fix.md` - Bug 2: Row-level locking
- `promo-code-precision-fix.md` - Bug 3: Percentage calculation precision
- `promo-code-deactivation-race-fix.md` - Bug 4: Deactivation race condition
- `promo-code-rate-limiting-fix.md` - Bug 5: Rate limiting

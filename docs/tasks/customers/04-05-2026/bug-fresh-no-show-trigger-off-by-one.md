# Bug: Fresh No-Show Tier Trigger Has Off-By-One — Customers Crossing Suspension Threshold Stay Mis-Tiered

## Status: Open
## Priority: High
## Date: 2026-05-04
## Category: Bug - No-Show Penalty / Tier System
## Discovered during: verification of `docs/tasks/customers/07-04-2026/bug-dispute-approval-doesnt-recalculate-tier.md`
## Related (sibling, fixed): `docs/tasks/customers/07-04-2026/bug-dispute-approval-doesnt-recalculate-tier.md`

---

## Overview

When a customer's no-show count crosses one of the tier thresholds (caution=2, deposit_required=3, suspended=5 by default) via a fresh no-show, the database trigger `trg_update_customer_tier` calculates the new tier using the **OLD** `no_show_count` value — not the new value the customer is about to be incremented to. This produces a one-step lag in tier transitions.

The most user-visible failure mode: a customer reaching `no_show_count = 5` (the suspension threshold) ends up with `tier = 'deposit_required'` and `booking_suspended_until = NULL` instead of `tier = 'suspended'` with a real future date. The frontend banner displays *"Booking suspended until unknown date"* because the date is null but downstream code may be treating the customer as suspended for other reasons.

This is the same symptom reported in the dispute-approval bug (`bug-dispute-approval-doesnt-recalculate-tier.md`) but via a different code path — fresh no-show, not dispute reversal.

---

## Root Cause

### Order-of-operations problem

`backend/src/services/NoShowPolicyService.ts:359-372` — `recordNoShowHistory`:

```typescript
const result = await this.pool.query(query, [...]);   // INSERT INTO no_show_history → fires trigger

// Increment customer no-show count
await this.incrementCustomerNoShowCount(params.customerAddress);  // UPDATE customers SET no_show_count = no_show_count + 1
```

`backend/migrations/065_recreate_no_show_tables.sql:192-238` — the trigger function and binding:

```sql
CREATE OR REPLACE FUNCTION update_customer_no_show_tier()
RETURNS TRIGGER AS $$
DECLARE
  v_policy RECORD;
BEGIN
  SELECT * INTO v_policy FROM shop_no_show_policy WHERE shop_id = NEW.shop_id;
  IF NOT FOUND THEN
    v_policy.caution_threshold := 2;
    v_policy.deposit_threshold := 3;
    v_policy.suspension_threshold := 5;
    v_policy.suspension_duration_days := 30;
  END IF;

  -- Reads customers.no_show_count BEFORE the TS-side increment runs
  UPDATE customers
  SET
    no_show_tier = CASE
      WHEN no_show_count >= v_policy.suspension_threshold THEN 'suspended'
      WHEN no_show_count >= v_policy.deposit_threshold THEN 'deposit_required'
      WHEN no_show_count >= v_policy.caution_threshold THEN 'caution'
      WHEN no_show_count = 1 THEN 'warning'
      ELSE 'normal'
    END,
    deposit_required = (no_show_count >= v_policy.deposit_threshold),
    booking_suspended_until = CASE
      WHEN no_show_count >= v_policy.suspension_threshold
      THEN NOW() + (v_policy.suspension_duration_days || ' days')::INTERVAL
      ELSE NULL
    END,
    last_no_show_at = NEW.marked_no_show_at
  WHERE wallet_address = NEW.customer_address;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_customer_tier
  AFTER INSERT ON no_show_history
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_no_show_tier();
```

### What actually happens, step-by-step

Customer at `no_show_count = 4, no_show_tier = 'deposit_required'` records their 5th no-show:

1. `recordNoShowHistory` INSERTs into `no_show_history` (row #5)
2. **Trigger fires** with `NEW` = the just-inserted row
3. Trigger reads `customers.no_show_count` — **still 4** (TS increment hasn't run yet)
4. Trigger executes `UPDATE customers SET no_show_tier = ...` based on `no_show_count = 4`:
   - `4 >= 5` → false → not 'suspended'
   - `4 >= 3` → true → tier = `'deposit_required'`
   - `4 >= 5` → false → `booking_suspended_until = NULL`
5. Trigger commits and returns
6. TypeScript runs `incrementCustomerNoShowCount` → `UPDATE customers SET no_show_count = no_show_count + 1` → `no_show_count` becomes 5
7. **Final state:** `no_show_count = 5, no_show_tier = 'deposit_required', booking_suspended_until = NULL`

The customer is now logically suspended (count = 5 = suspension threshold) but the database row says they're at `deposit_required`. The trigger never refires because the increment is on the `customers` table, not on `no_show_history`.

### Failure manifestations

- **`no_show_count = 1, tier = 'normal'`** instead of `'warning'` — the first no-show never tags the user.
- **`no_show_count = 5, tier = 'deposit_required', booking_suspended_until = NULL`** — customer should be suspended but isn't.
- **`no_show_count = N, tier = <tier_for_N-1>`** — every threshold transition is one step late.

This last point means the lag persists at every tier crossing, not just the suspension boundary. A customer who has 2 no-shows ends up `tier = 'warning'` instead of `'caution'`. A customer with 3 ends up `'caution'` instead of `'deposit_required'`. The bug's user-visible severity scales with the threshold (suspension is most visible because of the booking block + banner copy).

### Why `bug-dispute-approval-doesnt-recalculate-tier.md` doesn't paper over this

The dispute-approval fix (`reverseNoShowPenalty` in `DisputeController.ts:677-755`) only runs when a dispute is approved. It correctly counts `no_show_history` rows and SETs `no_show_count`, `no_show_tier`, and `booking_suspended_until` to consistent values.

But customers who reach a tier threshold via fresh no-shows and never have a dispute will sit in the wrong tier indefinitely. The dispute fix is good but doesn't backfill the broken-trigger state for non-disputed customers.

---

## Fix Options

### Option A — Reorder TypeScript: increment first, then INSERT

`NoShowPolicyService.ts:359-372`:

```diff
+    // Increment count FIRST so the trigger reads the new value
+    await this.incrementCustomerNoShowCount(params.customerAddress);
+
     const result = await this.pool.query(query, [...]);  // INSERT → trigger fires with new count

-    // Increment customer no-show count
-    await this.incrementCustomerNoShowCount(params.customerAddress);
-
     return result.rows[0];
```

**Pros:** smallest diff (~3-line swap), no migration needed.

**Cons:** brittle — couples trigger semantics to TS ordering. Anyone editing the function later might re-introduce the bug by reordering. Also: if the INSERT fails after the increment runs, the count is wrong with no history record. Not transactional.

### Option B (RECOMMENDED) — Rewrite trigger to count `no_show_history` rows directly

Mirrors the approach already used in `reverseNoShowPenalty`. The trigger becomes the single source of truth: `no_show_count` is recalculated from `no_show_history` (excluding `[DISPUTE_REVERSED]`-marked rows) on every INSERT.

**New migration** at `backend/migrations/<next>_fix_no_show_tier_trigger_off_by_one.sql`:

```sql
-- Rewrite trg_update_customer_tier to count no_show_history rows directly
-- instead of reading customers.no_show_count, which has an off-by-one race
-- against the TS-side incrementCustomerNoShowCount call.

CREATE OR REPLACE FUNCTION update_customer_no_show_tier()
RETURNS TRIGGER AS $$
DECLARE
  v_policy RECORD;
  v_effective_count INTEGER;
BEGIN
  -- Get shop's no-show policy (or use defaults if not found)
  SELECT * INTO v_policy
  FROM shop_no_show_policy
  WHERE shop_id = NEW.shop_id;

  IF NOT FOUND THEN
    v_policy.caution_threshold := 2;
    v_policy.deposit_threshold := 3;
    v_policy.suspension_threshold := 5;
    v_policy.suspension_duration_days := 30;
  END IF;

  -- Count effective no-shows directly from no_show_history (includes the
  -- just-inserted row via NEW). Excludes rows already marked as reversed
  -- via dispute approval (matches reverseNoShowPenalty's filter).
  SELECT COUNT(*) INTO v_effective_count
  FROM no_show_history
  WHERE LOWER(customer_address) = LOWER(NEW.customer_address)
    AND (notes IS NULL OR notes NOT LIKE '%[DISPUTE_REVERSED]%');

  -- Update customer tier and booking_suspended_until based on the
  -- authoritative effective count (not the lagging customers.no_show_count).
  UPDATE customers
  SET
    no_show_count = v_effective_count,
    no_show_tier = CASE
      WHEN v_effective_count >= v_policy.suspension_threshold THEN 'suspended'
      WHEN v_effective_count >= v_policy.deposit_threshold THEN 'deposit_required'
      WHEN v_effective_count >= v_policy.caution_threshold THEN 'caution'
      WHEN v_effective_count >= 1 THEN 'warning'
      ELSE 'normal'
    END,
    deposit_required = (v_effective_count >= v_policy.deposit_threshold),
    booking_suspended_until = CASE
      WHEN v_effective_count >= v_policy.suspension_threshold
      THEN NOW() + (v_policy.suspension_duration_days || ' days')::INTERVAL
      ELSE NULL
    END,
    last_no_show_at = NEW.marked_no_show_at,
    updated_at = NOW()
  WHERE LOWER(address) = LOWER(NEW.customer_address);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger binding unchanged
DROP TRIGGER IF EXISTS trg_update_customer_tier ON no_show_history;
CREATE TRIGGER trg_update_customer_tier
  AFTER INSERT ON no_show_history
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_no_show_tier();
```

**Then remove the now-redundant TypeScript increment** at `NoShowPolicyService.ts:371-372`:

```diff
     const result = await this.pool.query(query, [...]);  // trigger now sets no_show_count too

-    // Increment customer no-show count
-    await this.incrementCustomerNoShowCount(params.customerAddress);
-
     return result.rows[0];
```

The `incrementCustomerNoShowCount` private method becomes unused — can either delete it or leave as dead code with a deprecation comment for now.

**Pros:**
- Fully eliminates the off-by-one — trigger reads the just-inserted row plus all prior history
- Single source of truth (`no_show_history` is authoritative; `customers.no_show_count` becomes a derived cache that's always rebuilt)
- Matches the pattern `reverseNoShowPenalty` already uses → consistent behavior across fresh no-shows and dispute reversals
- `wallet_address` → `LOWER(address)` matcher fixes a separate latent bug (the original trigger filtered on `wallet_address`, but the customers table primary key is lowercased `address`)
- `customers.address` is the canonical primary key used throughout the rest of the codebase

**Cons:**
- Requires a migration (15 min)
- Slight perf hit per INSERT (`COUNT(*) FROM no_show_history` runs on every no-show), but typically dozens of rows max per customer — negligible. Indexed on `customer_address` already.

### Option C — Add a separate UPDATE trigger on `customers` when `no_show_count` changes

Less invasive of the existing INSERT trigger, but introduces complexity (two triggers that must agree on the calculation). If they ever diverge, debugging is harder than Option B's single source of truth.

Not recommended unless the team has a strong preference for not touching the existing trigger.

### Recommendation: Option B

Single source of truth, fully eliminates the off-by-one, mirrors the dispute-reversal logic, and fixes a latent `wallet_address` vs `address` matcher inconsistency.

---

## Files to Modify (Option B)

| File | Change |
|---|---|
| `backend/migrations/<next>_fix_no_show_tier_trigger_off_by_one.sql` | NEW — rewrites the trigger function to count `no_show_history` rows directly |
| `backend/src/services/NoShowPolicyService.ts` (lines 371-372) | Remove the redundant `await this.incrementCustomerNoShowCount(...)` call |
| `backend/src/services/NoShowPolicyService.ts` (lines 380-388) | Optionally delete the now-unused `incrementCustomerNoShowCount` method, OR leave with a deprecation comment until next cleanup pass |

No frontend changes required. No changes to existing data — the trigger will recalculate correctly on the next no-show INSERT for any affected customer. For customers in the broken state right now, see "Backfill" section below.

---

## Backfill — Existing Customers in Broken State

Production customers who hit a tier threshold under the broken trigger will be stuck with the wrong tier until they either get another no-show (which will trigger the fixed function) or someone manually fixes their row.

To find affected customers:

```sql
-- Customers whose stored tier doesn't match what the count says they should be
SELECT
  c.address,
  c.email,
  c.no_show_count,
  c.no_show_tier,
  c.booking_suspended_until,
  CASE
    WHEN c.no_show_count >= 5 THEN 'suspended'
    WHEN c.no_show_count >= 3 THEN 'deposit_required'
    WHEN c.no_show_count >= 2 THEN 'caution'
    WHEN c.no_show_count >= 1 THEN 'warning'
    ELSE 'normal'
  END AS expected_tier
FROM customers c
WHERE c.no_show_count > 0
  AND c.no_show_tier <> CASE
    WHEN c.no_show_count >= 5 THEN 'suspended'
    WHEN c.no_show_count >= 3 THEN 'deposit_required'
    WHEN c.no_show_count >= 2 THEN 'caution'
    WHEN c.no_show_count >= 1 THEN 'warning'
    ELSE 'normal'
  END;
```

Backfill SQL (run AFTER the migration lands and the trigger is fixed):

```sql
-- Recalculate tier and booking_suspended_until from the authoritative no_show_history count
UPDATE customers c
SET
  no_show_count = sub.effective_count,
  no_show_tier = CASE
    WHEN sub.effective_count >= 5 THEN 'suspended'
    WHEN sub.effective_count >= 3 THEN 'deposit_required'
    WHEN sub.effective_count >= 2 THEN 'caution'
    WHEN sub.effective_count >= 1 THEN 'warning'
    ELSE 'normal'
  END,
  deposit_required = (sub.effective_count >= 3),
  booking_suspended_until = CASE
    WHEN sub.effective_count >= 5 THEN NOW() + INTERVAL '30 days'
    ELSE NULL
  END,
  updated_at = NOW()
FROM (
  SELECT
    LOWER(customer_address) AS customer_address,
    COUNT(*) AS effective_count
  FROM no_show_history
  WHERE notes IS NULL OR notes NOT LIKE '%[DISPUTE_REVERSED]%'
  GROUP BY LOWER(customer_address)
) sub
WHERE LOWER(c.address) = sub.customer_address;
```

⚠️ **Caveats for the backfill:**
- Uses default thresholds (5/3/2). If any shop has custom `shop_no_show_policy` thresholds, those are NOT honored by this backfill — it applies the global defaults. For per-shop accuracy, the backfill would need to be more elaborate (and arguably a customer's tier should be calculated from the shop where their most recent no-show happened, matching `reverseNoShowPenalty`'s shop-policy lookup).
- Sets `booking_suspended_until = NOW() + INTERVAL '30 days'` for newly-suspended customers, which **resets** their suspension clock. If a customer was meant to be suspended weeks ago and the suspension already would have ended, this gives them a fresh suspension window. That's not great — but the alternative (using their `last_no_show_at` to compute when suspension should have started) requires a per-shop policy lookup for the duration. Trade-off the team needs to decide.
- Run during low-traffic window. ~Few hundred rows expected, fast.

If the team wants a fully accurate backfill (per-shop policy thresholds + correct suspension dates), it's another ~30 min of script work.

---

## QA Test Plan

### Reproduce the bug (before fix)

1. Find or create a test customer with `no_show_count = 4, no_show_tier = 'deposit_required'`
2. Mark a 5th no-show via the shop dashboard or `POST /api/services/orders/:id/mark-no-show`
3. Query the customer row:
   - **Bug:** `no_show_count = 5, no_show_tier = 'deposit_required', booking_suspended_until = NULL`
   - **Expected:** `no_show_count = 5, no_show_tier = 'suspended', booking_suspended_until = <NOW + 30d>`

### After fix (Option B)

1. Same scenario — customer at count=4 gets a 5th no-show
2. **Expected:** count=5, tier='suspended', booking_suspended_until set to a real date 30 days out
3. Customer's banner reads "Booking suspended until <date>" — no "unknown date"
4. `GET /api/services/orders/customer/:address` should reject new bookings while suspended

### Threshold transition tests (each tier crossing should fire correctly on the no-show that crosses it)

| Starting count | Action | Expected after fix |
|---|---|---|
| 0 | mark no-show | count=1, tier='warning' |
| 1 | mark no-show | count=2, tier='caution' |
| 2 | mark no-show | count=3, tier='deposit_required', `deposit_required=true` |
| 3 | mark no-show | count=4, tier='deposit_required' |
| 4 | mark no-show | count=5, tier='suspended', booking_suspended_until set |
| 5 (already suspended) | mark no-show | count=6, tier='suspended', booking_suspended_until updated to fresh `NOW + 30d` |

### Dispute-approval interaction (regression check)

This bug's fix shouldn't conflict with the dispute-approval fix in `bug-dispute-approval-doesnt-recalculate-tier.md`. Verify:

1. Customer reaches tier='suspended' via fresh no-shows (count=5, suspension date set correctly per fixed trigger)
2. One no-show is disputed and approved
3. **Expected:** `reverseNoShowPenalty` runs → effective count = 4 → tier='deposit_required', booking_suspended_until=NULL
4. Both fixes coexist; no double-update or conflict

### Custom shop policy test

1. Find a shop with a custom `shop_no_show_policy` (e.g., `suspension_threshold = 7` instead of default 5)
2. Customer of that shop reaches count=5
3. **Expected:** tier='deposit_required' (5 < 7), NOT 'suspended'
4. Customer reaches count=7 → tier='suspended'

### Backfill verification (production)

After deploying:
1. Run the diagnostic query in "Backfill" section to find mis-tiered customers
2. Run the backfill UPDATE in a transaction; verify the count of rows touched matches expectations
3. Spot-check 5-10 affected customer rows post-backfill — tier should match count, booking_suspended_until should be present where applicable

---

## Rollback Plan

The migration replaces the trigger function. Rolling back:

```sql
-- Restore the original trigger function from migration 065
CREATE OR REPLACE FUNCTION update_customer_no_show_tier()
RETURNS TRIGGER AS $$
-- (original content from migrations/065_recreate_no_show_tables.sql:192-231)
$$ LANGUAGE plpgsql;
```

Plus revert the TS edit at `NoShowPolicyService.ts:371-372` (re-add the `incrementCustomerNoShowCount` call).

The bug returns but doesn't break anything that wasn't already broken. Customers' wrong tier states from before the fix would still be wrong — backfill is irreversible in the sense that it overwrote stale state with correct state.

---

## Notes

- **Severity prioritization:** the suspension threshold case is most visible (suspended customer can't book + sees confused banner copy), but every tier transition has the same lag. Customers getting "deposit_required" instead of "suspended" might still attempt to book and get charged a deposit when they should have been blocked — small revenue/trust risk.
- **Long-term:** consider deprecating `customers.no_show_count` as a stored field entirely. It's a cache of `COUNT(*) FROM no_show_history WHERE not reversed`. If the trigger always rebuilds it, the field is denormalized cache, not source-of-truth — fine for query perf but anywhere reading it should know it's a cache. Document this clearly or build a service-layer accessor that always counts fresh.
- **Symmetric latent bug:** the original trigger used `WHERE wallet_address = NEW.customer_address` but the `customers` table primary key is `address` (lowercased). If `wallet_address` column is null or differently-cased on any row, the original trigger silently fails to update. Option B's fix moves to `WHERE LOWER(address) = LOWER(NEW.customer_address)` which matches the rest of the codebase. Verify whether this changes behavior for any existing rows where `wallet_address != address` — should be zero rows in practice but worth a quick query before deploy:

```sql
SELECT COUNT(*) FROM customers
WHERE wallet_address IS DISTINCT FROM address;
-- Expected: 0
```

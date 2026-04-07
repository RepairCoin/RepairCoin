# Bug: Dispute Approval Doesn't Properly Recalculate No-Show Tier

## Status: Open
## Priority: Critical
## Date: 2026-04-07
## Category: Bug - No-Show Dispute / Tier System
## Reported by: QA
## Customer: Mike (gossipmcallen@gmail.com, 0xe3e20bfa5a7edadb92fc89801bb756697b3c5640)
## Booking: BK-2AD215 at El Pajaro (shop_id: 1111)

---

## Overview

After a no-show dispute is approved and the penalty reversed, the customer's `no_show_count` is incorrectly decremented (goes below actual undisputed count) and the `no_show_tier` is not recalculated. This leaves the customer in a stale tier state — showing "Account Temporarily Suspended" with "0 missed appointments", which is contradictory and incorrect.

---

## Evidence from Database

### Customer record:
```
no_show_count: 0              ← WRONG (should be 5)
no_show_tier: "suspended"     ← STALE (not recalculated after dispute)
booking_suspended_until: null  ← Never set (causes "unknown date" in banner)
```

### No-show history (7 records):

| # | Order | Disputed | Status | Should Count? |
|---|---|---|---|---|
| 1 | BK-2AD215 | Yes | approved (reversed) | No |
| 2 | ord_8de59a25 | Yes | approved (reversed) | No |
| 3 | ord_53e90b9e | No | — | Yes |
| 4 | ord_f31bdd57 | No | — | Yes |
| 5 | ord_bbf685a2 | No | — | Yes |
| 6 | ord_4ef10a61 | No | — | Yes |
| 7 | ord_44ba3526 | No | — | Yes |

**Effective no-show count**: 7 total - 2 reversed = **5**
**DB `no_show_count`**: **0** (decremented below actual count)

### What the customer sees:
- Banner: "Account Temporarily Suspended"
- "Booking privileges suspended until unknown date due to **0 missed appointments**"
- This is contradictory — suspended with 0 no-shows makes no sense

---

## Root Cause

When a dispute is approved, the system:
1. Marks the no-show history record as `[DISPUTE_REVERSED]` — correct
2. Decrements `no_show_count` by 1 — **incorrect** (blind decrement without floor check)
3. Does NOT recalculate `no_show_tier` based on the new effective count — **missing**
4. Does NOT set/clear `booking_suspended_until` — **missing**

### The decrement problem:

If a customer had `no_show_count` at some value when disputes were approved, each approval decremented by 1. But the count was likely already out of sync with the actual no-show history, causing it to go to 0 or even negative.

### The tier recalculation problem:

After reversing a no-show, the tier should be recalculated based on the **effective count** (total no-shows minus reversed ones). Instead, the tier stays at whatever it was before the dispute.

---

## Expected Behavior After Dispute Approval

1. Count all no-show records where `dispute_status != 'approved'` (i.e., not reversed)
2. Set `no_show_count` = that effective count
3. Recalculate tier based on effective count using shop's policy thresholds
4. Update `booking_suspended_until` accordingly (clear if no longer suspended)
5. If tier drops from `suspended` to a lower tier, clear the suspension

For this customer:
- Effective count: 5 (7 - 2 reversed)
- With default thresholds (suspension at 5): tier should be `suspended`
- `booking_suspended_until` should be set to a real date (suspension start + duration)
- Banner should show "5 missed appointments" and the actual suspension end date

---

## Fix Required

### In the dispute approval handler:

After marking a dispute as reversed, recalculate the customer's effective count and tier:

```typescript
// After approving dispute:

// 1. Count effective no-shows (exclude reversed)
const effectiveCount = await pool.query(`
  SELECT COUNT(*) FROM no_show_history
  WHERE customer_address = $1
  AND (dispute_status IS NULL OR dispute_status != 'approved')
`, [customerAddress]);

// 2. Update customer with correct count
await pool.query(`
  UPDATE customers 
  SET no_show_count = $1,
      no_show_tier = $2,
      booking_suspended_until = $3
  WHERE wallet_address = $4
`, [effectiveCount, recalculatedTier, suspensionDate, customerAddress]);
```

### Also fix `booking_suspended_until`:

When a customer reaches `suspended` tier, `booking_suspended_until` should be set to `NOW() + suspensionDurationDays`. Currently it's null, causing "unknown date" in the banner.

---

## Files to Investigate/Modify

| File | Change |
|------|--------|
| `backend/src/services/NoShowPolicyService.ts` | Fix dispute approval to recalculate effective count and tier |
| `backend/src/domains/ServiceDomain/controllers/DisputeController.ts` | Ensure tier recalculation after approval |
| `backend/src/domains/ServiceDomain/controllers/OrderController.ts` | Ensure `booking_suspended_until` is set when reaching suspended tier |

---

## QA Test Plan

### Reproduce
1. Customer with 5+ no-shows reaches "suspended" tier
2. Submit dispute on one no-show → gets approved
3. **Bug**: Banner still shows "Suspended" with "0 missed appointments" and "unknown date"

### After fix
1. Same scenario — dispute approved
2. **Expected**: Effective count recalculated (e.g., 5 → 4)
3. **Expected**: Tier recalculated based on new count (4 may be "deposit_required" instead of "suspended")
4. **Expected**: Banner shows correct count and correct dates
5. If still suspended: shows real suspension end date (not "unknown")

### Edge cases
- All disputes approved → count drops below suspension threshold → tier should drop
- Dispute rejected → no change to count or tier
- Multiple disputes approved in sequence → each recalculates correctly

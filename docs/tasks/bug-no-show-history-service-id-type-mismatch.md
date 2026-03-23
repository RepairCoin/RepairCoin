# Bug: No-Show History Insert Fails Due to service_id Type Mismatch

## Status: Open
## Priority: Critical
## Date: 2026-03-18
## Category: Bug - Data Type Mismatch

---

## Problem

Marking a booking as no-show records the status in `service_orders` but **silently fails** to insert into `no_show_history`. This breaks the entire dispute system since disputes depend on `no_show_history` records.

### Root Cause

`service_orders.service_id` is `VARCHAR` with values like `srv_0ad92072-a032-49ea-82da-ddca9e0cd7c2` (prefixed with `srv_`).

`no_show_history.service_id` is `UUID` type which rejects the `srv_` prefix.

The INSERT into `no_show_history` throws a type cast error, caught by the try/catch in `OrderController.markNoShow()` (line 804-807) which silently continues.

### Impact
- No records ever created in `no_show_history`
- Customers cannot file disputes (no history record to dispute)
- No-show tier tracking doesn't work (tier never increments)
- The entire dispute resolution system is non-functional

---

## Fix

Change `no_show_history.service_id` column from `uuid` to `VARCHAR(255)` to match `service_orders.service_id`.

```sql
ALTER TABLE no_show_history ALTER COLUMN service_id TYPE VARCHAR(255);
```

---

## Files

| File | Issue |
|------|-------|
| `backend/migrations/065_recreate_no_show_tables.sql` | Created `service_id` as UUID |
| `backend/src/services/NoShowPolicyService.ts` | INSERT passes VARCHAR value into UUID column |
| `backend/src/domains/ServiceDomain/controllers/OrderController.ts` | Silent catch hides the error (line 804-807) |

---

## Verification

1. Apply migration to fix column type
2. Mark a booking as no-show
3. Verify record appears in `no_show_history`
4. Submit a dispute as customer
5. Verify dispute shows in `/shop?tab=disputes`

# Bug: Group Tokens Silently Fail When Shop Has No RCN Allocation

## Status: Fixed (2026-04-09)
## Priority: High
## Date: 2026-04-09
## Category: Bug - Token Issuance / UX
## Affected: Affiliate Group token rewards
## Test Case: Shop peanut, Group "Amazing Resto", Service "Aqua Tech", Customer "Qua Ting", Booking BK-D68264

---

## Overview

When a service is linked to an affiliate group and a customer completes a booking, group tokens should be issued automatically. However, if the shop hasn't allocated RCN to back the token issuance, the tokens silently fail to issue — no error shown to the customer, no error shown to the shop, and no record of the failure.

The customer sees the purple group badge on the service, expects to earn group tokens, but receives nothing.

---

## Evidence

- Service "Aqua Tech" ($455) linked to "Amazing Resto" group at 100% reward, 1.0x multiplier
- Expected group tokens: 455 × (100/100) × 1.0 = **455 Amazing Resto tokens**
- Actual group tokens issued: **0**
- `affiliate_group_token_transactions`: empty for this customer
- `customer_affiliate_group_balances`: empty
- `shop_group_rcn_allocations` for peanut + Amazing Resto: **empty (no allocation)**

---

## Root Cause

**`OrderController.issueGroupTokensForService()`** calls `groupService.earnGroupTokens()` which validates RCN allocation before issuing. If allocation is insufficient, it throws an error — but the caller catches it silently and continues.

The shop linked a service to the group but never:
1. Navigated to the group's RCN Allocation tab
2. Allocated RCN to back the token issuance

No warning is shown at any point:
- Not when linking the service (no check for allocation)
- Not when the order completes (error silently caught)
- Not to the customer (they just don't receive tokens)
- Not to the shop (no notification of failed issuance)

---

## Fix Required — Multiple Layers

### Fix 1: Warn when linking service without allocation
When a shop links a service to a group, check if they have RCN allocated. If not, show a warning:

"You have no RCN allocated to this group. Customers won't earn group tokens until you allocate RCN. Go to Group → RCN Allocation to set this up."

**File:** `frontend/src/components/shop/ServiceGroupSettings.tsx` — after successful link, check allocation

### Fix 2: Show allocation status on Group Rewards tab
In the service's Group Rewards tab, show each linked group's allocation status:
- "Amazing Resto — Linked ✓ — RCN Allocated: 0 ⚠️ (tokens won't issue)"
- "CODEBILITY — Linked ✓ — RCN Allocated: 500 ✓"

**File:** `frontend/src/components/shop/ServiceGroupSettings.tsx` — enhance group display

### Fix 3: Log failed token issuance (not silent)
When group token issuance fails due to insufficient allocation, create a notification for the shop:

"Group token issuance failed for order BK-D68264: Insufficient RCN allocation for Amazing Resto. Customer did not receive group tokens."

**File:** `backend/src/domains/ServiceDomain/controllers/OrderController.ts` — in `issueGroupTokensForService()`, send notification on failure instead of silently catching

### Fix 4: Show group token earnings on order completion
When the shop marks an order as complete, the completion modal/toast should show:
- "25 RCN earned by customer"
- "455 Amazing Resto tokens earned by customer" (or "Failed: no allocation")

---

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/shop/ServiceGroupSettings.tsx` | Show allocation warning when linking, show allocation status per group |
| `backend/src/domains/ServiceDomain/controllers/OrderController.ts` | Send shop notification on failed group token issuance |
| `frontend/src/components/shop/bookings/` | Show group token result on order completion |

---

## QA Test Plan

### Silent failure (current bug)
1. Link service to group WITHOUT allocating RCN
2. Customer books and completes
3. **Bug**: No group tokens, no error anywhere

### After fix
1. Link service to group without allocation → **Expected**: Warning shown
2. Group Rewards tab shows "⚠️ No RCN allocated" next to group
3. Customer completes booking → shop gets notification: "Group token issuance failed"
4. Allocate RCN → customer books again → **Expected**: Group tokens issued successfully

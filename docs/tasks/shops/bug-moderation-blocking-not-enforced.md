# Bug: Moderation System — Blocking Not Enforced + UI Issues

## Status: Open
## Priority: Critical (Bug 1), Low (Bugs 2-4)
## Date: 2026-03-25
## Category: Bug - Moderation / Security
## Location: /shop?tab=settings → Moderation

---

## Overview

The Moderation Tools system is fully implemented for CRUD operations (block/unblock customers, submit reports, flag reviews) and all data persists correctly to the database. However, the blocking mechanism is never checked during the booking/payment flow, meaning blocked customers can still book and pay for services at the shop that blocked them.

---

## Bug 1: CRITICAL — Blocking Is NOT Enforced During Booking

**Severity:** Critical

The `PaymentService.createPaymentIntent()` and `createStripeCheckout()` methods check for no-show suspension but **never check if the customer is blocked** by the shop.

**What exists:**
- `ModerationRepository.isCustomerBlocked(shopId, customerWalletAddress)` — returns `true/false`
- `blocked_customers` table with `shop_id`, `customer_wallet_address`, `is_active` columns
- UI to block/unblock customers

**What's missing:**
- No call to `isCustomerBlocked()` in `PaymentService.ts`
- No call to `isCustomerBlocked()` in `OrderController.ts`
- No call to `isCustomerBlocked()` in `ManualBookingController.ts`

**Impact:** A shop blocks a problematic customer, but that customer can still book services, defeating the entire purpose of the moderation system.

**Fix:** Add a blocking check at the start of the payment/booking flow:

```typescript
// In PaymentService.createPaymentIntent() and createStripeCheckout()
const moderationRepo = new ModerationRepository();
const isBlocked = await moderationRepo.isCustomerBlocked(service.shopId, request.customerAddress);
if (isBlocked) {
  throw new Error('You are unable to book services at this shop. Please contact the shop for more information.');
}
```

**Files to modify:**
| File | Action |
|------|--------|
| `backend/src/domains/ServiceDomain/services/PaymentService.ts` | Add `isCustomerBlocked` check in both `createPaymentIntent` and `createStripeCheckout` |
| `backend/src/domains/ServiceDomain/controllers/ManualBookingController.ts` | Add blocking check before creating manual bookings |

---

## Bug 2: Shop Can Block Any Wallet — Should Be Limited to Own Customers

**Severity:** Medium (data integrity / abuse risk)

Currently a shop can enter any wallet address in the Block Customer form and block it, even if that person has never booked at or interacted with the shop. The `ModerationRepository.blockCustomer()` does not verify that the customer has any prior orders or relationship with the shop.

**Risk:** A shop could preemptively block competitors' customers or random addresses. Blocking should only be allowed for customers who have actually booked at or interacted with the shop.

**Fix — Backend:** Add a check in `blockCustomer()` or the moderation route that verifies the customer has at least one order with the shop:

```typescript
// In moderation route or ModerationRepository.blockCustomer()
const customerOrderQuery = `
  SELECT EXISTS (
    SELECT 1 FROM service_orders
    WHERE shop_id = $1
    AND customer_address = $2
  ) as has_orders
`;
const result = await this.pool.query(customerOrderQuery, [shopId, customerWalletAddress]);
if (!result.rows[0].has_orders) {
  throw new Error('You can only block customers who have booked at your shop');
}
```

**Fix — Frontend:** Optionally, replace the free-text wallet input with a customer search/dropdown that only shows the shop's existing customers.

**Files to modify:**
| File | Action |
|------|--------|
| `backend/src/repositories/ModerationRepository.ts` | Add customer-shop relationship check in `blockCustomer()` |
| `backend/src/domains/shop/routes/moderation.ts` | Or add check in the route handler before calling repository |
| `frontend/src/components/shop/ModerationSettings.tsx` | Optionally replace free-text input with customer picker |

---

## Bug 3: Native `confirm()` Dialog for Unblock (was Bug 2)

**Severity:** Low (UX inconsistency)

**File:** `frontend/src/components/shop/ModerationSettings.tsx` (line 99)

```typescript
if (!confirm("Are you sure you want to unblock this customer?")) return;
```

This uses the browser's native `confirm()` dialog which appears as a plain white/gray box — inconsistent with the dark-themed RepairCoin UI. The Block Customer flow uses a proper styled modal for confirmation.

**Fix:** Replace with a styled confirmation modal similar to the disconnect wallet confirmation in `PasswordAuthSettings.tsx`, or use a reusable confirmation component.

---

## Bug 4: Flagged Reviews Tab Not Visible

**Severity:** Low (incomplete feature)

The API client (`frontend/src/services/api/moderation.ts`) has methods for flagged reviews:
- `flagReview(reviewId, reason)` — POST to flag a review
- `getFlaggedReviews()` — GET flagged reviews list

But the `ModerationSettings.tsx` UI only shows two tabs:
1. Blocked Customers
2. Reports

There is no "Flagged Reviews" tab, so shop owners cannot see which reviews they've flagged or their status.

**Fix:** Add a third tab "Flagged Reviews" that displays results from `getFlaggedReviews()` with status indicators (pending/approved/removed).

---

## Bug 5: No Wallet Address Validation on Block Form

**Severity:** Low (input validation)

**File:** `frontend/src/components/shop/ModerationSettings.tsx` (lines 381-389)

The Block Customer form accepts any text in the wallet address field. There is no frontend validation for:
- `0x` prefix required
- 42-character length (0x + 40 hex chars)
- Valid hex characters only

The backend may reject invalid addresses, but the user gets a generic error instead of inline validation feedback.

**Fix:** Add frontend validation before submitting:

```typescript
const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(blockForm.customerWalletAddress);
if (!isValidAddress) {
  toast.error("Please enter a valid wallet address (0x followed by 40 hex characters)");
  return;
}
```

---

## Working Correctly

| Feature | Status |
|---------|--------|
| Block customer (CRUD) | Working |
| Unblock customer | Working |
| Search blocked customers | Working |
| Duplicate block prevention | Working (409 Conflict) |
| Submit report to admins | Working |
| View report status | Working |
| Report categories (5) | Working |
| Report severity (3 levels) | Working |
| Color-coded severity badges | Working |
| Status badges (pending/investigating/resolved/dismissed) | Working |
| Empty states for both tabs | Working |
| Loading spinner | Working |
| Block/Report modals with form validation | Working |
| Tab count indicators | Working |

---

## Verification Checklist

- [ ] Blocked customer cannot book services (payment rejected)
- [ ] Blocked customer sees clear error message (not generic 500)
- [ ] Manual bookings also check blocking status
- [ ] Shop can only block customers who have booked at their shop
- [ ] Attempting to block a non-customer returns clear error
- [ ] Unblock confirmation uses styled modal (not native confirm)
- [ ] Flagged Reviews tab visible with status tracking
- [ ] Block form validates wallet address format before submitting
- [ ] Blocking works across both payment methods (PaymentIntent + StripeCheckout)

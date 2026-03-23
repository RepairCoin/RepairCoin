# CRITICAL Bug: Deposit Amount String Concatenation Causes Massive Overcharge

## Status: Fixed (pending deploy)
## Priority: Critical
## Date: 2026-03-23
## Category: Billing / Payment

---

## Incident

A customer was charged **$5,925.00** instead of **$84.00** ($59 service + $25 deposit) via Stripe.

- **Stripe Payment Intent:** `pi_3TE1cFL8hwPnzzXk00Huuitx`
- **Order ID:** `ord_db3b75e1-907a-4b50-92b1-4a8c2bcae182`
- **Booking ID:** BK-AE182
- **Customer:** Qua Ting (0x6cd036477d1c39da021095a62a32c6bb919993cf)
- **Shop:** peanut
- **Service:** S Tripe Hair Cut ($59.00)
- **Expected charge:** $84.00 ($59 + $25 deposit)
- **Actual charge:** $5,925.00

---

## Root Cause

PostgreSQL's `numeric` type is returned as a **string** by the Node.js `pg` driver. When the deposit amount is added to the service price using `+=`, JavaScript performs **string concatenation** instead of numeric addition.

```typescript
// shopPolicy.depositAmount = "25.00" (string from PostgreSQL)
// finalAmountUsd = 59 (number)

finalAmountUsd += depositAmount;
// Result: "5925.00" (string concatenation: 59 + "25.00")
// NOT: 84 (numeric addition)

const amountInCents = Math.round(finalAmountUsd * 100);
// Result: 592500 ($5,925.00)
// NOT: 8400 ($84.00)
```

### Why it passed locally

Local testing may not have triggered the `deposit_required` tier, or the `priceUsd` value happened to be a number type in certain code paths. The bug only manifests when:
1. Customer is at `deposit_required` tier
2. `shopPolicy.depositAmount` comes from PostgreSQL as a string
3. The `+=` operator concatenates instead of adding

---

## Affected Code

**File:** `backend/src/domains/ServiceDomain/services/PaymentService.ts`

**Two flows affected:**
1. `createPaymentIntent()` — line ~250 (payment intent flow)
2. `createStripeCheckout()` — line ~450 (Stripe Checkout flow)

Both had:
```typescript
depositAmount = shopPolicy.depositAmount;         // string "25.00"
finalAmountUsd += depositAmount;                   // string concat
```

Also affected: `service.priceUsd` from the database is potentially a string, making ALL arithmetic unreliable.

---

## Fix Applied

```typescript
// Before (broken)
depositAmount = shopPolicy.depositAmount;
finalAmountUsd += depositAmount;

// After (fixed)
depositAmount = parseFloat(String(shopPolicy.depositAmount)) || 0;
finalAmountUsd = parseFloat(String(finalAmountUsd)) + depositAmount;
```

Also fixed `service.priceUsd` initialization:
```typescript
// Before
let finalAmountUsd = service.priceUsd;

// After
let finalAmountUsd = parseFloat(String(service.priceUsd)) || 0;
```

**Commit:** `5440b9b0` on `deo/dev`

---

## Immediate Actions Required

- [ ] **Refund the customer** — Issue partial refund of **$5,841.00** ($5,925 - $84) via Stripe dashboard for PI `pi_3TE1cFL8hwPnzzXk00Huuitx`
- [ ] **Merge and deploy** the fix to staging and production
- [ ] **Audit other Stripe charges** — Check if any other `deposit_required` tier bookings were overcharged
- [ ] **Notify the customer** — Explain the billing error and confirm refund

---

## Audit Query

Run this to find any other overcharged bookings:

```sql
SELECT order_id, total_amount, stripe_payment_intent_id, customer_address, created_at
FROM service_orders
WHERE total_amount > 500
AND status IN ('paid', 'completed', 'scheduled', 'approved')
ORDER BY created_at DESC;
```

---

## Prevention

- [ ] Add `parseFloat()` safety to ALL monetary values read from PostgreSQL
- [ ] Add a sanity check: reject Stripe charges above a threshold (e.g. $1,000) as likely errors
- [ ] Add unit tests for deposit calculation with string inputs
- [ ] Consider using `CAST(column AS FLOAT)` in SQL queries for monetary fields
- [ ] Review all other places where PostgreSQL numeric values are used in arithmetic

---

## Related

- `docs/tasks/post-review-cleanup-tasks.md` — general code review findings
- No-show tier system — `deposit_required` tier triggers the deposit logic
- `NoShowPolicyService.getShopPolicy()` — returns `depositAmount` as string from DB

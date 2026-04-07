# Bug: Non-Numeric Purchase Amount Returns 500 Instead of 400

## Status: Fixed (2026-04-07)
## Priority: Low
## Date: 2026-03-24
## Category: Bug - Validation / Error Handling
## Found by: E2E testing (`backend/tests/shop/shop.buy-credits.test.ts`)

---

## Problem

The `POST /api/shops/purchase/stripe-checkout` endpoint returns **500 Internal Server Error** when a non-numeric string is passed as the `amount` field, instead of a proper **400 Bad Request** validation error.

```json
// Request
POST /api/shops/purchase/stripe-checkout
{ "amount": "abc" }

// Expected: 400 "Amount must be a valid number"
// Actual: 500 "Purchase amount must be a whole number"
```

---

## What Works Correctly

| Input | Status | Result |
|-------|--------|--------|
| `amount: 0` | 400 | "Minimum purchase amount is 5 RCN" |
| `amount: -10` | 400 | "Minimum purchase amount is 5 RCN" |
| `amount: 4` | 400 | "Minimum purchase amount is 5 RCN" |
| `amount: 5` | 200 | Checkout created |
| `amount: "50"` (numeric string) | 200 | Checkout created (auto-parsed) |
| `amount: "abc"` | **500** | **Should be 400** |
| Missing amount | 400 | "Minimum purchase amount is 5 RCN" |

---

## Root Cause

The amount validation likely does a numeric comparison (`amount < 5`) which passes for `NaN` (since `NaN < 5` is `false`), then downstream code tries to use the value as a number and throws an unhandled error.

### File to check:
- `backend/src/domains/shop/routes/purchase.ts` — `stripe-checkout` route handler (line ~366)

---

## Fix

Add explicit type validation before numeric checks:

```typescript
const amount = Number(req.body.amount);
if (isNaN(amount) || !Number.isFinite(amount)) {
  return res.status(400).json({
    success: false,
    error: 'Amount must be a valid number'
  });
}

if (!Number.isInteger(amount)) {
  return res.status(400).json({
    success: false,
    error: 'Purchase amount must be a whole number'
  });
}

if (amount < 5) {
  return res.status(400).json({
    success: false,
    error: 'Minimum purchase amount is 5 RCN'
  });
}
```

---

## Verification

- [ ] `amount: "abc"` → 400 (not 500)
- [ ] `amount: "50"` → 200 (numeric string still works)
- [ ] `amount: null` → 400
- [ ] `amount: undefined` → 400
- [ ] `amount: true` → 400
- [ ] `amount: {}` → 400
- [ ] `amount: 5` → 200 (valid)

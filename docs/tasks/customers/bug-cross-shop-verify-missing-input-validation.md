# Bug: Cross-Shop Verify Endpoint Accepts Incomplete Requests

## Status: Fixed
## Priority: Low
## Date: 2026-03-26
## Category: Bug - Input Validation
## Found by: E2E testing (`backend/tests/customer/customer.gift-tokens.test.ts`)

---

## Problem

The `POST /api/customers/cross-shop/verify` endpoint does not validate required fields before calling the service layer. When `customerAddress`, `redemptionShopId`, or `requestedAmount` is missing, the endpoint returns `200 OK` instead of `400 Bad Request`.

### Evidence

```bash
# Missing customerAddress — returns 200 instead of 400
POST /api/customers/cross-shop/verify
{ "redemptionShopId": "shop-001", "requestedAmount": 10 }
# Expected: 400 "Missing required field: customerAddress"
# Actual: 200 { success: true, data: { ... } }

# Missing redemptionShopId — returns 200 instead of 400
POST /api/customers/cross-shop/verify
{ "customerAddress": "0xaaaa...", "requestedAmount": 10 }
# Expected: 400 "Missing required field: redemptionShopId"
# Actual: 200 { success: true, data: { ... } }

# Missing requestedAmount — returns 200 instead of 400
POST /api/customers/cross-shop/verify
{ "customerAddress": "0xaaaa...", "redemptionShopId": "shop-001" }
# Expected: 400 "Missing required field: requestedAmount"
# Actual: 200 { success: true, data: { ... } }
```

---

## Root Cause

The route handler at `backend/src/domains/customer/routes/crossShop.ts:89-112` passes `req.body` fields directly to the service with no guard:

```typescript
// Line 89-98 — NO validation before service call
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const redemptionRequest: RedemptionRequest = {
      customerAddress: req.body.customerAddress,    // Could be undefined
      redemptionShopId: req.body.redemptionShopId,  // Could be undefined
      requestedAmount: req.body.requestedAmount,    // Could be undefined
      purpose: req.body.purpose
    };

    const result = await crossShopVerificationService.verifyRedemption(redemptionRequest);
    // ^^^ Processes undefined values — may return misleading "approved" result

    res.json({ success: true, data: result });
  } catch (error) { ... }
});
```

Compare with the `/api/referrals/verify-redemption` endpoint which does validate:

```typescript
// referral.ts:221 — HAS validation
if (!customerAddress || !shopId || !amount) {
  return res.status(400).json({
    success: false,
    error: 'Missing required fields'
  });
}
```

---

## Impact

- **No data mutation** — this is a read-only verification endpoint, so no data corruption occurs
- **Misleading responses** — a malformed request may receive an incorrect "approved" result when the service processes `undefined` values
- **Frontend unaffected** — the frontend (`ServiceCheckoutModal.tsx`) validates all fields before calling this endpoint
- **Direct API callers affected** — any external integration or script calling this endpoint without validation could get wrong results

---

## Fix

Add input validation before the service call:

```typescript
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { customerAddress, redemptionShopId, requestedAmount } = req.body;

    if (!customerAddress || !redemptionShopId || !requestedAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customerAddress, redemptionShopId, requestedAmount'
      });
    }

    if (requestedAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'requestedAmount must be greater than zero'
      });
    }

    const redemptionRequest: RedemptionRequest = {
      customerAddress,
      redemptionShopId,
      requestedAmount,
      purpose: req.body.purpose
    };

    const result = await crossShopVerificationService.verifyRedemption(redemptionRequest);

    res.json({ success: true, data: result });
  } catch (error) { ... }
});
```

---

## Verification

- [ ] `POST /api/customers/cross-shop/verify` with missing `customerAddress` → 400
- [ ] `POST /api/customers/cross-shop/verify` with missing `redemptionShopId` → 400
- [ ] `POST /api/customers/cross-shop/verify` with missing `requestedAmount` → 400
- [ ] `POST /api/customers/cross-shop/verify` with all fields → 200 (unchanged)
- [ ] `POST /api/customers/cross-shop/verify` with `requestedAmount: 0` → 400
- [ ] `POST /api/customers/cross-shop/verify` with `requestedAmount: -5` → 400
- [ ] Frontend checkout flow still works (no regression)

---

## Files

- `backend/src/domains/customer/routes/crossShop.ts` (line 89-112) — needs validation added
- `backend/tests/customer/customer.gift-tokens.test.ts` — tests already written, assertions accept `[200, 400, 500]` to handle current behavior; tighten to `400` after fix

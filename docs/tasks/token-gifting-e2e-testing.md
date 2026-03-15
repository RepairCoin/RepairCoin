# Token Gifting — End-to-End Testing Report

## Overview

End-to-end testing of the Token Gifting tab (`/customer?tab=gifting`). Testing revealed **8 bugs** including a **critical security vulnerability** — all three transfer API endpoints have **zero authentication**, allowing anyone to drain any customer's balance.

**Created**: March 2, 2026
**Completed**: March 3, 2026
**Status**: Resolved
**Priority**: Critical
**Category**: Security / Bug / E2E Testing

---

## E2E Flow Test Results

| Step | Action | Result |
|---|---|---|
| 1. Visit gifting tab | Navigate to `/customer?tab=gifting` | **PASS** — Form renders with recipient, amount, message fields |
| 2. Scan QR code | Click "Scan QR" button | **PASS** — Camera opens, validates scanned address format |
| 3. Enter recipient | Type wallet address | **PASS** — Address accepted, validation triggers |
| 4. Enter amount | Type RCN amount | **PASS** — Validation fires on every keystroke (no debounce) |
| 5. Validation check | Real-time validation response | **PASS** — Shows valid/invalid with balance info |
| 6. Self-transfer check | Enter own address as recipient | **PASS** — Blocked with "Cannot transfer to yourself" |
| 7. Insufficient balance | Enter amount > balance | **PASS** — Shows "Insufficient balance" |
| 8. Send tokens | Click "Send Token" → confirmation modal | **PASS** — Modal shows details with USD conversion |
| 9. Confirm & Send | Click "Confirm & Send" | **FAIL** — Uses fake transaction hash, no auth |
| 10. Transfer history | View "Recent Gift History" | **FAIL** — Only loads after Thirdweb restores (race condition) |
| 11. Auth security | All 3 endpoints accessible without login | **CRITICAL FAIL** — No authentication at all |

---

## Bug 1: CRITICAL — No Authentication on Transfer Endpoints

**Severity**: Critical (security vulnerability)

**File**: `backend/src/domains/token/routes/transfer.ts`

All three transfer endpoints have **zero authentication middleware**:

```typescript
// Line 101 — NO authMiddleware
router.post('/transfer', asyncHandler(async (req, res) => { ... }));

// Line 337 — NO authMiddleware
router.get('/transfer-history/:address', asyncHandler(async (req, res) => { ... }));

// Line 447 — NO authMiddleware
router.post('/validate-transfer', asyncHandler(async (req, res) => { ... }));
```

Compare with other token routes in the same domain that DO have auth:
```typescript
// redemptionSession.ts — has auth
router.post('/create', authMiddleware, requireShopOrAdmin, ...);

// verification.ts — has auth
router.post('/verify', requireShopOrAdmin, ...);
```

**Impact**: An attacker can call `POST /api/tokens/transfer` with ANY `fromAddress` and steal their entire balance. No login, no JWT, no cookie required. The only check is balance sufficiency — there is NO verification that the caller owns the `fromAddress`.

**Attack scenario**:
```bash
curl -X POST https://api.repaircoin.ai/api/tokens/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "fromAddress": "0xVICTIM_ADDRESS",
    "toAddress": "0xATTACKER_ADDRESS",
    "amount": 9999,
    "transactionHash": "0xfake123..."
  }'
```

**Fix**: Add `authMiddleware` + `requireRole(['customer'])` to all three endpoints AND verify that `req.user.address === fromAddress`:
```typescript
router.post('/transfer', authMiddleware, requireRole(['customer']), asyncHandler(async (req, res) => {
  if (req.user?.address?.toLowerCase() !== fromAddress.toLowerCase()) {
    return ResponseHelper.forbidden(res, 'Cannot transfer from another wallet');
  }
  // ... rest of handler
}));
```

---

## Bug 2: Fake Transaction Hash (No Blockchain Transaction)

**Severity**: Medium (data integrity)

**File**: `frontend/src/components/customer/TokenGiftingTab.tsx:131`

```tsx
const mockTransactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;
```

The frontend generates a **random fake hash** instead of performing an actual blockchain transaction. The backend interface comments say "Hash of the on-chain transfer" (`transfer.ts:20`) but no on-chain transfer occurs.

**Impact**:
- Token transfers are database-only, creating a mismatch between on-chain and off-chain balances
- The `transactionHash` field is meaningless — it's random data
- `Math.random()` can produce duplicate hashes (not cryptographically secure), though the backend has a duplicate check

**Fix**: Either:
- A) Perform actual on-chain transfers using Thirdweb SDK (match the architecture intent)
- B) Remove the `transactionHash` requirement and generate a proper UUID server-side

---

## Bug 3: Race Condition with `useActiveAccount()` on Page Load

**Severity**: Medium (UX)

**File**: `frontend/src/components/customer/TokenGiftingTab.tsx`

The component uses `account?.address` from `useActiveAccount()` (Thirdweb) for ALL operations:

```tsx
// Line 41 — only source of wallet address
const account = useActiveAccount();

// Line 67 — validation blocked during page load
if (!formData.recipientAddress || !formData.amount || !account?.address) return;

// Line 111 — send blocked during page load
if (!account?.address || ...) { toast.error("Please fill in all required fields"); return; }

// Line 167 — history fetch blocked during page load
if (!account?.address) return;
```

Unlike other components that use `userProfile?.address` as a fallback, this component has NO fallback. During the 1-3 second Thirdweb restoration window after page refresh:
- Transfer history doesn't load
- Validation doesn't work
- Send button errors with "Please fill in all required fields"

**Fix**: Use `account?.address || userProfile?.address` like other components:
```tsx
const walletAddress = account?.address || userProfile?.address;
```

---

## Bug 4: Raw `fetch()` Without Auth Headers or Cookies

**Severity**: Medium (architectural inconsistency)

**File**: `frontend/src/components/customer/TokenGiftingTab.tsx:73-84, 133-146, 171-173`

The component uses raw `fetch()` for ALL three API calls instead of the standard `apiClient`:

```tsx
// Line 73 — raw fetch, no credentials
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/validate-transfer`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ... }),
});
```

The standard `apiClient` (axios) is configured with:
- `withCredentials: true` — sends cookies
- Response interceptor — unwraps `response.data`
- Error interceptor — handles token refresh, enhanced errors
- Account switch blocking — prevents stale requests

None of these apply to `fetch()` calls.

**Impact**: When auth middleware IS added (Bug 1 fix), these `fetch()` calls won't send the JWT cookie, causing 401 errors.

**Fix**: Replace all `fetch()` calls with `apiClient`:
```tsx
import apiClient from "@/services/api/client";

const response = await apiClient.post('/tokens/validate-transfer', {
  fromAddress: walletAddress,
  toAddress: formData.recipientAddress,
  amount: parseFloat(formData.amount),
});
```

---

## Bug 5: `lifetime_earnings` Corrupted by Transfers

**Severity**: High (data integrity / tier corruption)

**File**: `backend/src/repositories/CustomerRepository.ts:313-332`

```typescript
async updateBalanceAfterTransfer(address: string, amount: number): Promise<void> {
  const query = `
    UPDATE customers SET
      lifetime_earnings = GREATEST(0, COALESCE(lifetime_earnings, 0) + $1),
      current_rcn_balance = GREATEST(0, COALESCE(current_rcn_balance, 0) + $1),
      updated_at = NOW()
    WHERE address = $2
  `;
}
```

This method modifies BOTH `current_rcn_balance` (correct) AND `lifetime_earnings` (wrong).

- **Sender** (`amount = -50`): `lifetime_earnings` **decreases** by 50. But lifetime earnings should NEVER decrease — it's a cumulative total used for tier calculations. Gifting 50 RCN could cause a **tier downgrade** (Gold → Silver).

- **Recipient** (`amount = +50`): `lifetime_earnings` **increases** by 50. But received gifts shouldn't count as "earnings." This could cause an **undeserved tier upgrade** (Bronze → Silver) just from receiving gifts.

**Impact**: Tier system integrity compromised. A customer who earned 200 RCN (Gold tier) and gifted 150 RCN would drop to Bronze (50 lifetime earnings). A new customer who receives 100 RCN in gifts would get Silver tier without ever getting a repair.

**Fix**: Only update `current_rcn_balance`, NOT `lifetime_earnings`:
```typescript
const query = `
  UPDATE customers SET
    current_rcn_balance = GREATEST(0, COALESCE(current_rcn_balance, 0) + $1),
    updated_at = NOW()
  WHERE address = $2
`;
```

---

## Bug 6: No Debounce on Validation API Calls

**Severity**: Low (performance)

**File**: `frontend/src/components/customer/TokenGiftingTab.tsx:190-194`

```tsx
useEffect(() => {
  if (formData.recipientAddress && formData.amount) {
    validateTransfer();
  }
}, [formData.recipientAddress, formData.amount]);
```

Validation fires on **every keystroke**. Typing a 42-character wallet address triggers 42 API calls. Each call hits the database to check sender balance and recipient existence.

Additionally, `validateTransfer` is NOT in the dependency array — React will warn about missing dependencies.

**Fix**: Add a debounce:
```tsx
useEffect(() => {
  if (!formData.recipientAddress || !formData.amount) return;
  const timer = setTimeout(() => validateTransfer(), 500);
  return () => clearTimeout(timer);
}, [formData.recipientAddress, formData.amount]);
```

---

## Bug 7: Misleading Redemption Info in Confirmation Modal

**Severity**: Low (misleading UX)

**File**: `frontend/src/components/customer/TokenGiftingTab.tsx:586-589`

```tsx
<p className="text-xs text-blue-300">
  The recipient can redeem these tokens at any participating shop
  (20% value) or at the shop where you earned them (100% value).
</p>
```

This is inaccurate per the business rules:
- Gifted tokens can ONLY be redeemed at 20% at ANY shop
- The "100% at home shop" rule only applies to tokens the customer EARNED, not received as gifts
- The recipient's home shop is determined by where THEY earned RCN, not where the sender earned it

**Fix**:
```tsx
<p className="text-xs text-blue-300">
  Gifted tokens can be redeemed at 20% value at any participating shop.
  The recipient earns full value only on tokens they earn from repairs.
</p>
```

---

## Bug 8: `useEffect` Missing Dependencies

**Severity**: Low (React warning)

**File**: `frontend/src/components/customer/TokenGiftingTab.tsx:186-194`

```tsx
// Line 186-188 — fetchTransferHistory not in deps
useEffect(() => {
  fetchTransferHistory();
}, [account?.address]);  // Missing: fetchTransferHistory

// Line 190-194 — validateTransfer not in deps
useEffect(() => {
  if (formData.recipientAddress && formData.amount) {
    validateTransfer();
  }
}, [formData.recipientAddress, formData.amount]);  // Missing: validateTransfer
```

React's exhaustive-deps lint rule will flag these. While it may not cause runtime bugs (the functions are recreated on each render anyway), it indicates potential stale closure issues.

**Fix**: Either add the functions to the dependency array or wrap them in `useCallback`.

---

## Affected Files

| File | Issues |
|---|---|
| `backend/src/domains/token/routes/transfer.ts` | Bug 1 (no auth on 3 endpoints) |
| `frontend/src/components/customer/TokenGiftingTab.tsx` | Bug 2 (fake hash), Bug 3 (race condition), Bug 4 (raw fetch), Bug 6 (no debounce), Bug 7 (misleading text), Bug 8 (missing deps) |
| `backend/src/repositories/CustomerRepository.ts:313-332` | Bug 5 (lifetime_earnings corruption) |

---

## Verification Checklist

- [x] All transfer endpoints require authentication (JWT/cookie)
- [x] Transfer endpoint verifies `req.user.address === fromAddress`
- [x] Transaction hash is either real (on-chain) or generated server-side (UUID)
- [x] Gifting tab works immediately on page refresh (no Thirdweb race condition)
- [x] API calls use `apiClient` with proper credentials
- [x] Sending a gift does NOT reduce sender's `lifetime_earnings`
- [x] Receiving a gift does NOT increase recipient's `lifetime_earnings`
- [x] Tier remains unchanged after gifting/receiving tokens
- [x] Validation is debounced (not on every keystroke)
- [x] Confirmation modal text accurately describes gifted token redemption rules
- [x] Transfer history loads correctly
- [x] Suspended accounts cannot send gifts

---

## References

- **Frontend Component**: `frontend/src/components/customer/TokenGiftingTab.tsx`
- **Backend Transfer Routes**: `backend/src/domains/token/routes/transfer.ts`
- **Balance Update Method**: `backend/src/repositories/CustomerRepository.ts:313-332`
- **Route Registration**: `backend/src/domains/token/routes/index.ts`
- **Gift Token Tests**: `backend/tests/customer/customer.gift-tokens.test.ts`
- **Notification Handler**: `backend/src/domains/notification/NotificationDomain.ts`

---

## Resolution Summary (March 3, 2026)

All 8 documented bugs fixed + 1 additional bug discovered during E2E testing:

- **Bug 1 (CRITICAL)** — Added `authMiddleware, requireRole(['customer'])` to all 3 transfer endpoints (`/transfer`, `/transfer-history/:address`, `/validate-transfer`). Added ownership verification `req.user?.address === fromAddress` on `/transfer` and address match check on `/transfer-history`. File: `backend/src/domains/token/routes/transfer.ts`
- **Bug 2** — Removed client-side fake hash (`Math.random()`). Server now generates `transfer_${uuidv4()}` server-side. Made `transactionHash` optional in the request interface. Frontend no longer sends a hash. Files: `transfer.ts` (backend), `TokenGiftingTab.tsx` (frontend)
- **Bug 3** — Added `const walletAddress = account?.address || userProfile?.address` fallback. All functions now use `walletAddress` instead of `account?.address`, eliminating the Thirdweb race condition on page load. File: `TokenGiftingTab.tsx`
- **Bug 4** — Replaced all 3 raw `fetch()` calls with `apiClient` (axios). This sends JWT cookies via `withCredentials: true`, uses response interceptors, and handles token refresh. File: `TokenGiftingTab.tsx`
- **Bug 5** — Removed `lifetime_earnings` from `updateBalanceAfterTransfer()`. Now only updates `current_rcn_balance`. Prevents tier corruption from gifts. File: `backend/src/repositories/CustomerRepository.ts`
- **Bug 6** — Added 500ms debounce to the validation `useEffect`. Clears validation when fields are empty. Returns cleanup function to cancel pending timers. File: `TokenGiftingTab.tsx`
- **Bug 7** — Replaced misleading redemption text ("20% value or 100% at home shop") with accurate text: "Gifted tokens are transferred directly to the recipient's balance. This action cannot be reversed." File: `TokenGiftingTab.tsx`
- **Bug 8** — Wrapped `validateTransfer` and `fetchTransferHistory` in `useCallback` with proper dependency arrays. Updated both `useEffect` hooks to include the memoized functions as dependencies. File: `TokenGiftingTab.tsx`
- **Extra Fix** — Balance check in `/transfer` and `/validate-transfer` used `getCustomerBalance().totalBalance` which is calculated from `lifetimeEarnings - totalRedemptions - totalMintedToWallet`. This formula doesn't account for received transfers, causing customers with legitimate balances to get "Insufficient balance" errors. Fixed by adding `currentRcnBalance` to `getCustomerBalance()` return type and using it for transfer sufficiency checks.

### Files Modified

| File | Changes |
|---|---|
| `backend/src/domains/token/routes/transfer.ts` | Added auth middleware to 3 endpoints, ownership verification, server-side UUID generation, fixed balance check to use `currentRcnBalance` |
| `backend/src/repositories/CustomerRepository.ts` | Removed `lifetime_earnings` from transfer balance update, added `currentRcnBalance` to `getCustomerBalance()` return |
| `frontend/src/components/customer/TokenGiftingTab.tsx` | walletAddress fallback, apiClient replacement, useCallback wrappers, debounce, modal text fix |

### E2E Test Results (46/46 passed)

**Bug 1 — Authentication (6 tests)**
- POST /transfer without auth returns 401
- GET /transfer-history without auth returns 401
- POST /validate-transfer without auth returns 401
- Customer login successful
- Cannot transfer from another wallet (403 Forbidden)
- Cannot view another wallet's transfer history (403 Forbidden)

**Bug 2 — Server-Side Hash (3 tests)**
- Transfer succeeds without client-side transactionHash
- Server-generated hash format: `transfer_<uuid>`
- Server ignores client-provided hash, generates its own

**Bug 5 — lifetime_earnings (5 tests)**
- Sender balance decreased correctly
- Recipient balance increased correctly
- Sender lifetime_earnings unchanged after transfer
- Recipient lifetime_earnings unchanged after transfer
- Sender tier unchanged after transfer

**Authenticated Endpoints (5 tests)**
- Validate transfer works with auth (correct balance returned)
- Self-transfer validation blocked
- Insufficient balance validation works
- Transfer history accessible with auth
- Test transfer found in history with correct data

**Edge Cases (6 tests)**
- Self-transfer blocked, negative/zero amount blocked, invalid address blocked
- Insufficient balance blocked, missing fields blocked

**Transaction Records (3 tests)**
- transfer_out record with negative amount
- transfer_in record with positive amount
- Metadata correct (type=gift, recipient, message)

**Frontend Static Analysis (10 tests)**
- walletAddress fallback, apiClient import, no raw fetch(), no mock hash
- Debounce, modal text, useCallback wrappers, dependency arrays

**Backend Static Analysis (7 tests)**
- authMiddleware on all 3 endpoints, requireRole, ownership verification
- Server-side UUID, lifetime_earnings not in SQL SET clause

**Cleanup (1 test)**
- Test data reversed, balances restored

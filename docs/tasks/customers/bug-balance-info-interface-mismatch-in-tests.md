# Bug: BalanceInfo Interface Mismatch in Test Mocks

## Status: Fixed
## Priority: Low
## Date: 2026-03-26
## Category: Bug - Test Maintenance
## Found by: E2E testing (`backend/tests/customer/customer.edge-cases.test.ts`)

---

## Problem

The `BalanceInfo` interface in `VerificationService.ts` was updated to include `pendingMintBalance: number`, but the test mock in `customer.edge-cases.test.ts` was not updated accordingly. This caused the test suite to fail to compile with:

```
TS2345: Argument of type '{ availableBalance: number; lifetimeEarned: number;
totalRedeemed: number; earningHistory: {...}; }' is not assignable to parameter
of type 'BalanceInfo'.
Property 'pendingMintBalance' is missing in type...
```

---

## Root Cause

When the `pendingMintBalance` field was added to the `BalanceInfo` interface, the mock at `customer.edge-cases.test.ts:759` was not updated to include the new required field.

### Interface (current):
```typescript
// backend/src/domains/token/services/VerificationService.ts
export interface BalanceInfo {
  availableBalance: number;
  lifetimeEarned: number;
  totalRedeemed: number;
  pendingMintBalance: number;  // <-- Added later, test mock missed this
  earningHistory: {
    fromRepairs: number;
    fromReferrals: number;
    fromBonuses: number;
    fromTierBonuses: number;
  };
}
```

---

## Fix Applied

Added `pendingMintBalance: 0` to the mock in `customer.edge-cases.test.ts`:

```typescript
.mockResolvedValue({
  availableBalance: 150,
  lifetimeEarned: 200,
  totalRedeemed: 50,
  pendingMintBalance: 0,  // <-- Added
  earningHistory: {
    fromRepairs: 150,
    fromReferrals: 30,
    fromBonuses: 10,
    fromTierBonuses: 10,
  },
});
```

---

## Verification

- [x] `customer.edge-cases.test.ts` compiles without errors
- [x] TypeScript check (`npx tsc --noEmit`) passes with zero errors

---

## Recommendation

When adding required fields to shared interfaces like `BalanceInfo`, grep for all test mocks that use the interface and update them in the same PR:

```bash
grep -r "mockResolvedValue.*availableBalance" backend/tests/
```

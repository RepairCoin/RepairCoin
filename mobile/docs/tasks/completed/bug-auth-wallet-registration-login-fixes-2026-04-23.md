# Bug: Auth / Wallet / Registration — 6-bug fix batch (2026-04-23)

**Status:** Completed
**Priority:** Critical
**Est. Effort:** 3-4 hours
**Created:** 2026-04-23
**Updated:** 2026-04-23
**Completed:** 2026-04-23

---

## Problem

Six related bugs stemming from auth state split across three layers (Thirdweb wallet session, Zustand `account` store, SecureStore-persisted `userProfile`) without recovery when one layer gets out of sync.

## Bugs Fixed

### Phase 1 — Acquisition blockers (Critical)

**Bug 1: Customer registration crashes with generic error** — `account.address` accessed without optional chaining when `account` is null. Added wallet guard, disabled form when wallet missing, removed misleading try/catch.

**Bug 2: Shop registration stuck on third slide** — Same root cause. Continue button silently disabled with no explanation. Added error message on wallet field, explicit guard in submit.

**Bug 3a: Customer login silently fails** — Two branches in `useConnectWallet.onSuccess` drop to `setIsLoading(false)` without toast or navigation when token fetch fails. Added user-facing error toasts on both branches.

### Phase 2 — Shared foundation

**Bug 4: Customer home "No wallet connected" despite logged in** — `account` null but `userProfile` populated. Derived `walletAddress` from `account?.address || userProfile?.walletAddress`. Added splash self-heal that reconstructs `account` from `userProfile` when missing.

### Phase 3 — Belt-and-suspenders

**Bug 5: Suspended screen "Missing wallet address"** — Added fallback to `account?.address` in address resolution chain.

### Independent

**Bug 6: Shop registration uncapped fields in ThirdSlide/FourthSlide** — Added `maxLength` to Street Address (255), City (100), Country (100), Reimbursement Address (42), FixFlow Shop ID (100).

## Changes

| File | Change |
|------|--------|
| `feature/register/hooks/ui/useCustomerRegister.ts` | Wallet guard in `isFormValid` + `validateAndSubmit`; removed try/catch |
| `feature/register/hooks/ui/useShopRegister.ts` | Wallet guard in `handleSubmit`; removed try/catch |
| `feature/register/components/ThirdSlide.tsx` | Error text on wallet field when missing; `maxLength` on 4 fields |
| `feature/register/components/FourthSlide.tsx` | `maxLength` on FixFlow Shop ID |
| `shared/hooks/auth/useAuth.ts` | Toast on silent-fail branches; splash self-heal for null `account` |
| `feature/home/components/customer-wallet/index.tsx` | Derive `walletAddress` from account+userProfile; use throughout |
| `feature/register/hooks/ui/useShopSuspended.ts` | Fallback to `account?.address` in address resolution |

## Verification

- Customer registration with null wallet: form disabled, clear error message
- Shop registration with null wallet: ThirdSlide shows red error on wallet field, Continue disabled
- Login with failed token fetch: toast appears, loading clears
- Customer home after rehydrating with null account but valid userProfile: dashboard loads normally
- Suspended screen check-status: works even when userProfile lacks walletAddress
- ThirdSlide/FourthSlide fields respect maxLength caps

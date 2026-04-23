# Bug: Phase 1b — Registration wallet recovery via useActiveAccount fallback

**Status:** Completed
**Priority:** Critical
**Est. Effort:** 30 minutes
**Created:** 2026-04-23
**Updated:** 2026-04-23
**Completed:** 2026-04-23

---

## Problem

Phase 1 defensive fixes (commit `5db89b6b`) made registration crash-safe but left fresh users stranded — Create Account button stayed greyed out because Zustand `account` was null even though Thirdweb's wallet session was active.

## Root Cause

Zustand `account` can be null while Thirdweb's `useActiveAccount()` returns the live wallet. The Phase 1 defensive fix correctly disabled the button when `account` was null, but didn't provide a fallback source for the wallet address.

## Fix

Added `useActiveAccount` from `thirdweb/react` as a fallback wallet source in both registration hooks:

1. Derived `account` via fallback chain: `storeAccount.address ?? activeAccount.address ?? null`
2. Added `useEffect` self-heal that syncs Zustand when Thirdweb has a wallet but Zustand doesn't

### Changes

| File | Change |
|------|--------|
| `feature/register/hooks/ui/useCustomerRegister.ts` | Import `useActiveAccount`, derive `account` with fallback, self-heal effect |
| `feature/register/hooks/ui/useShopRegister.ts` | Same pattern |

## Verification

- Fresh user connects wallet → fills customer registration form → Create Account button is active → registration succeeds
- Fresh shop owner connects wallet → fills all slides → ThirdSlide shows wallet → Continue active → registration succeeds
- Self-heal logs visible in Metro when Zustand was null but Thirdweb had wallet
- Existing users with populated Zustand account: no behavior change (Zustand wins in fallback chain)

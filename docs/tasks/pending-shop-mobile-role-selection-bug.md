# Bug: Pending Shop Shown Role Selection Screen on Mobile Login

## Status: Open
## Priority: High
## Date: February 3, 2026

## Description

A user who registered as a shop on web (pending admin approval) is shown the "I'm a Customer / I'm a Shop Owner" role selection screen again when logging in on mobile. This allows them to go through the registration flow again as if they were a new user.

## Steps to Reproduce

1. Register as a shop on web (wallet: 0xf8e9af7de86b39e79aeefc47eab248d20e11ed77, email: testdeo016@gmail.com)
2. Shop is pending admin approval
3. Log in on mobile with the same wallet
4. Role selection screen appears instead of redirecting to pending screen

## Root Cause

**File**: `mobile/shared/hooks/auth/useAuth.ts` (lines 52-86)

The `onSuccess` handler in `useConnectWallet` has navigation gaps:

1. **Line 63**: Dead code — `if (!result.exists)` inside `if (result.exists)` block never executes
2. **Lines 84-85**: When `result.exists === false`, only sets `isLoading(false)` but doesn't navigate, leaving user stranded
3. **Lines 80-82**: When token generation fails, same problem — no navigation fallback

The pending shop flow (line 74) should work: `isActive === false` → navigate to `/register/pending`. But if token generation fails for the pending shop, the app falls through without navigating, defaulting to the role selection screen.

## Backend Behavior (Correct)

- `/auth/check-user` returns `{ exists: true, type: 'shop', user: { isActive: false, verified: false } }` for pending shops
- `/auth/token` generates JWT for pending shops with limited access

## Fix

In `mobile/shared/hooks/auth/useAuth.ts`:

1. Remove dead code at line 63-66
2. Add `router.replace("/register")` at line 85 when `result.exists === false`
3. Add fallback navigation at line 81 when token generation fails
4. Verify that pending shops (`isActive === false`) correctly reach line 74: `router.replace("/register/pending")`

## Files to Modify

- `mobile/shared/hooks/auth/useAuth.ts` — Fix navigation gaps in onSuccess handler

## Impact

- Pending shops can accidentally re-register or choose a different role on mobile
- Confusing UX for users who already registered on web

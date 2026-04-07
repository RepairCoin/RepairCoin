# Bug: Pending Shop Account Shows Role Selection Instead of Pending Screen

## Status: Open
## Priority: High
## Date: 2026-04-07
## Category: Bug - Authentication / Registration
## Affected: Shop login flow (mobile only)

---

## Overview

When a user registers as a shop on the web (status: pending approval, `verified: false`, `active: false`), then logs into the mobile app, they see the "Welcome to FixFlow" role selection screen ("I'm a Customer" / "I'm a Shop Owner") as if they have no account. The web correctly recognizes the pending shop and shows a limited dashboard.

This is confusing — the user already registered as a shop and expects to see a "pending approval" status, not a fresh registration flow.

---

## How Web Handles It (Correct)

1. Calls `POST /auth/check-user` → gets `{ exists: true, type: 'shop', user: { verified: false, active: false } }`
2. Calls `POST /auth/shop` to authenticate → gets **403** (shop not verified)
3. Web catches the 403, detects "verified" in error message
4. Sets `isUnverifiedShop = true` → shows limited dashboard with pending status
5. User sees their shop profile and knows they're waiting for approval

**File:** `frontend/src/stores/authStore.ts` lines 229-239

---

## How Mobile Handles It (Broken)

1. Calls `POST /auth/check-user` → gets `{ exists: true, type: 'shop', user: { isActive: false } }`
2. Checks `result.user?.isActive` → is `false`
3. Should redirect to `/register/pending` but may fall through to `/register` (role selection) due to error handling or missing field mapping
4. User sees "I'm a Customer / I'm a Shop Owner" — thinks they need to register again

**File:** `mobile/shared/hooks/auth/useAuth.ts` lines 41-99

### Specific Code Issue

```typescript
// useConnectWallet hook (line 54-79)
if (result.exists) {
  if (result.type === 'shop') {
    if (result.user?.isActive) {
      router.replace('/shop/tabs/home');     // active shop → dashboard
    } else {
      router.replace('/register/pending');   // inactive shop → pending screen
    }
  }
}
```

The logic looks correct on paper, but the issue may be:
- `result.user?.isActive` — the backend returns `active` not `isActive` (field name mismatch)
- If `isActive` is `undefined`, the `else` branch fires → `/register/pending`
- But if the mutation errors or the response parsing fails, it falls to the error handler which redirects to `/register` (role selection)

---

## Root Cause Candidates

### 1. Field Name Mismatch (Most Likely)
Backend `check-user` returns `active: false` but mobile checks `result.user?.isActive`. If the response mapper doesn't convert `active` → `isActive`, the field is undefined, and depending on error handling, may redirect to role selection instead of pending.

### 2. Error in Auth Flow
Mobile does NOT call `/auth/shop` endpoint (unlike web). If the `check-user` response is handled differently or throws, the catch block at line 92-96 redirects to `/register`.

### 3. Missing Pending Screen
The route `/register/pending` may not exist in the mobile app, causing a navigation failure that falls back to `/register`.

---

## Fix Required

### Step 1: Verify field mapping
Check what `checkUserExists` returns and ensure `isActive` maps correctly from the backend's `active` field.

**File:** `mobile/shared/services/auth.services.ts` — check the response mapping for `checkUserExists`

### Step 2: Ensure pending screen exists
Verify `/register/pending` route exists in `mobile/app/` directory.

### Step 3: Handle pending shop gracefully
If the pending screen doesn't exist, create one showing:
- Shop name and status
- "Your shop is pending approval"
- "You'll be notified when your shop is approved"
- Logout button

### Step 4: Prevent role selection for existing accounts
If `result.exists === true` and `result.type === 'shop'`, never show the role selection screen — always go to either the dashboard (active) or pending screen (inactive).

---

## Files to Investigate/Modify

| File | Change |
|------|--------|
| `mobile/shared/services/auth.services.ts` | Check `checkUserExists` response mapping (active → isActive) |
| `mobile/shared/hooks/auth/useAuth.ts:41-99` | Fix pending shop routing, ensure no fallthrough to `/register` |
| `mobile/app/(auth)/register/pending.tsx` | Verify this screen exists, create if missing |

---

## QA Test Plan

### Before fix
1. Register a new shop on web → status shows "Pending Approval"
2. Login with same account on mobile
3. **Bug**: Shows "Welcome to FixFlow" role selection screen

### After fix
1. Register a new shop on web → status shows "Pending Approval"
2. Login with same account on mobile
3. **Expected**: Shows "Pending Approval" screen (not role selection)
4. Approve the shop via admin dashboard
5. Login on mobile again
6. **Expected**: Goes directly to shop dashboard

### Edge cases
- Approved shop logs in on mobile → goes to dashboard (no change)
- Customer logs in on mobile → goes to customer home (no change)
- New wallet with no account → shows role selection (correct behavior)

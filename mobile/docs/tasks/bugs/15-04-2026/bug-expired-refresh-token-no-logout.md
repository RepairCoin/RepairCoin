# Bug: Expired Refresh Token Doesn't Log User Out — Stuck in Broken Auth State

## Status: Open
## Priority: High
## Date: 2026-04-15
## Category: Bug - Authentication / Session Management
## Platform: Mobile (React Native / Expo)
## Affects: All users after 7-day session expiry or failed token refresh

---

## Problem

When the refresh token expires (after 7 days) or token refresh fails, `clearAuthToken()` only removes the axios Authorization header. It does NOT clear the Zustand auth store or navigate to onboarding. The user stays on the dashboard with `isAuthenticated = true` but every API call fails with 401. The app is stuck in a broken state until the user manually kills and reopens the app.

---

## Root Cause

**File:** `mobile/shared/utilities/axios.ts` (lines 292-299)

```typescript
public async clearAuthToken(): Promise<void> {
  try {
    delete this.instance.defaults.headers.Authorization;
    console.log('[ApiClient] Auth tokens cleared');
  } catch (error) {
    console.error('Failed to clear auth token:', error);
  }
}
```

This only clears the axios header. Missing:
- Clear Zustand store (`accessToken`, `refreshToken`, `isAuthenticated`, `userProfile`)
- Clear SecureStore persisted data
- Navigate to onboarding screen

### Where `clearAuthToken()` is called

| Location | Line | Trigger |
|---|---|---|
| `refreshToken()` | 119 | Refresh fails with 401 (refresh token invalid/expired) |
| Request interceptor | 150 | Proactive refresh fails before API call |
| Response interceptor | 225 | 401 response and refresh fails (non TOKEN_EXPIRED errors) |

All three paths leave the user stuck.

### Additional Issue: TOKEN_EXPIRED skips logout entirely

**Line 224:**
```typescript
if (errorCode !== 'TOKEN_EXPIRED') {
  await this.clearAuthToken();
}
```

If the error code IS `TOKEN_EXPIRED` and refresh fails, `clearAuthToken()` is never called. The user remains with an expired token that keeps failing.

---

## Fix Required

**File:** `mobile/shared/utilities/axios.ts`

Update `clearAuthToken()` to fully clear auth state and navigate:

```typescript
public async clearAuthToken(): Promise<void> {
  try {
    // 1. Clear axios header
    delete this.instance.defaults.headers.Authorization;
    
    // 2. Clear Zustand auth store (which also clears SecureStore via persist)
    const { logout } = useAuthStore.getState();
    await logout(false);  // false = don't navigate (we'll handle it)
    
    // 3. Navigate to onboarding
    router.replace("/onboarding1");
    
    console.log('[ApiClient] Auth fully cleared, navigating to onboarding');
  } catch (error) {
    console.error('Failed to clear auth:', error);
  }
}
```

Also fix line 224 — remove the `TOKEN_EXPIRED` exception so all failed refreshes trigger logout:

```typescript
// Before (broken):
if (errorCode !== 'TOKEN_EXPIRED') {
  await this.clearAuthToken();
}

// After (fixed):
await this.clearAuthToken();
```

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/shared/utilities/axios.ts` | Update `clearAuthToken()` to clear Zustand store + navigate; fix TOKEN_EXPIRED skip at line 224 |

---

## QA Verification

- [ ] Login, wait 7+ days (or manually expire refresh token in DB) → app redirects to onboarding
- [ ] Login, invalidate refresh token in DB → next API call triggers logout + redirect
- [ ] After auto-logout, SecureStore is cleared (no auto-login on reopen)
- [ ] After auto-logout, navigating back doesn't return to dashboard
- [ ] Normal token refresh (within 7 days) still works silently
- [ ] Concurrent API calls during failed refresh don't cause multiple logout attempts

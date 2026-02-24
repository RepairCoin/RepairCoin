# Auto Account Switching

## Overview

Automatically detect and switch user accounts when MetaMask wallet changes, seamlessly transitioning between admin/shop/customer roles without requiring manual logout/login.

**Created**: February 9, 2026
**Completed**: February 24, 2026
**Status**: Complete

---

## Problem Statement

**Original Behavior (pre-implementation):**
- Switching MetaMask accounts showed a "wallet mismatch" warning toast
- Disconnected the wallet and reloaded the page
- User had to manually re-authenticate

**Bug (initial implementation - two-phase approach):**
- `switchAccount` used redirect-first, login-later: logout, set localStorage marker, `window.location.replace('/shop')`, then detect marker on new page and login
- Race condition: new page loads, immediate session check finds no valid session, dashboard auth guard fires `router.push('/')` before login can run
- API client's 401 interceptor also redirected to `/` independently
- Result: URL redirects but page shows landing page, console full of 404s and "Failed to connect" errors

---

## Solution: Login-First, Redirect-Second

The fix eliminates all race conditions by authenticating **before** navigating, so the new page always loads with a valid session cookie.

### Flow

```
MetaMask switch
  -> switchAccount(newAddress)
  -> checkUser(newAddress)          // Determine role (non-destructive)
  -> setAccountSwitchingState(true) // Block stale API calls
  -> await logout()                 // Clear old session (awaited, not fire-and-forget)
  -> await authenticateXxx()        // Set new session cookie directly
  -> clearAllAuthCaches()           // Clear stale cached data
  -> window.location.replace(path)  // Redirect with valid session

New page loads
  -> immediate session check
  -> getSession() finds valid cookie
  -> set profile, render dashboard  // No race condition
```

### Why This Works

1. **Session cookie is set before redirect** - the new page's immediate session check succeeds on first try
2. **No localStorage markers** - no two-phase coordination across page loads
3. **No Zustand state updates during switch** - avoids triggering dashboard redirect effects
4. **API calls blocked during switch** - prevents stale requests from old dashboard components

---

## Files Modified

### 1. `frontend/src/stores/authStore.ts`

**`switchAccount` rewritten (login-first approach):**
```typescript
switchAccount: async (newAddress, email?) => {
  // 1. checkUser() - determine target role
  // 2. setAccountSwitchingState(true) - block stale API calls
  // 3. await authApi.logout() - clear old session
  // 4. await authApi.authenticateXxx() - set new session cookie directly
  //    (uses authenticateAdmin/Shop/Customer, NOT login() which has side effects)
  // 5. clearAllAuthCaches() - clear stale cached data
  // 6. window.location.replace(targetPath) - redirect with valid session
  // On auth failure: redirect to '/' as fallback
  // On unregistered wallet: redirect to '/choose'
}
```

**`auth:login-failed` event suppressed during switch:**
- Two locations in `login()` where `window.dispatchEvent('auth:login-failed')` is called
- Both now check `!get().switchingAccount` before dispatching
- Prevents AuthProvider's login-failed handler from interfering during switch

**Removed imports:** `setAccountSwitchPending`, `clearAccountSwitchPending` (dead code)

### 2. `frontend/src/hooks/useAuthInitializer.ts`

**Removed switch pending system (dead code):**
- `AUTH_SWITCH_PENDING_KEY`, `SWITCH_PENDING_TTL_MS`, `SwitchPendingData` interface
- `setAccountSwitchPending()`, `getAccountSwitchPending()`, `clearAccountSwitchPending()` functions
- Switch pending checks in immediate session check and secondary effect Case 4

**Added `switchingAccount` guard to secondary effect:**
```typescript
const initializeAuth = async () => {
  const { switchingAccount: isSwitching } = useAuthStore.getState();
  if (isSwitching) {
    console.log('[AuthInitializer] Account switch in progress, skipping initializeAuth');
    return;
  }
  // ... rest of initializeAuth
};
```

**Kept intact:** MetaMask `accountsChanged` listener and wallet mismatch debounce detection - these correctly trigger `switchAccount`.

### 3. `frontend/src/services/api/client.ts`

**Expanded allowed endpoints during switch:**
```typescript
// Before: only /auth/logout and /auth/check-user
const isAllowedDuringSwitch = config.url?.includes('/auth/');
// Now: all /auth/ endpoints (needed for authenticate calls during switch)
```

**Suppressed redirect-to-home during switch:**
```typescript
// In response interceptor's refresh-failure handler:
if (isProtectedRoute && !isAccountSwitching) {
  window.location.href = '/';
}
// When switching, switchAccount handles its own navigation
```

**Silent cancellation for blocked requests:**
```typescript
// Response error interceptor resolves (not rejects) for AccountSwitchError:
if (error instanceof AccountSwitchError) {
  return { data: null, success: false, _accountSwitchCancelled: true };
}
```

This is the key fix for console noise. By resolving instead of rejecting, callers' `catch` blocks are never triggered. The empty response is safe because:
- Callers that check `response.success` skip processing (false)
- Callers that do `response.data || defaultValue` get the default (null)
- The page is about to redirect anyway, so partial data doesn't matter

### 4. `frontend/src/providers/AuthProvider.tsx`

**Added `switchingAccount` guard to `auth:login-failed` handler:**
```typescript
const handleLoginFailed = async (event: CustomEvent) => {
  if (useAuthStore.getState().switchingAccount) {
    console.log('[AuthProvider] Skipping login-failed handler - account switch in progress');
    return;
  }
  // ... rest of handler (toast, page reload, etc.)
};
```

Redundant safety net alongside the authStore change.

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Customer -> Shop switch | checkUser -> logout -> authenticateShop -> redirect `/shop` |
| Shop -> Customer switch | checkUser -> logout -> authenticateCustomer -> redirect `/customer` |
| Any role -> Admin switch | checkUser -> logout -> authenticateAdmin -> redirect `/admin` |
| Switch to unregistered wallet | checkUser (not found) -> logout -> redirect `/choose`, toast "New wallet detected" |
| Auth failure after logout | Redirect to `/` as fallback, clear caches |
| Rapid switching | `switchingAccount` flag prevents concurrent switches |
| Stale API calls from old dashboard | Blocked by `setAccountSwitchingState(true)`, resolve with empty data |
| MetaMask `accountsChanged` event | Debounced 500ms, triggers `switchAccount` if address differs |
| Email-based login (social) | Detected and preserved - no switch triggered |

---

## API Call Blocking Strategy

During account switch, non-auth API calls are blocked at the request interceptor level to prevent stale dashboard components from making requests with the old/no session:

```
Request interceptor:
  if (isAccountSwitching && !url.includes('/auth/')) {
    -> reject with AccountSwitchError

Response error interceptor:
  if (error is AccountSwitchError) {
    -> resolve with { data: null, success: false }  // NOT reject
    -> callers get empty response in try block, catch blocks never fire
    -> no console.error noise from dozens of catch blocks across the app
```

This approach is critical because:
- Dashboard components have many `catch (err) { console.error(...) }` blocks
- Patching each one individually is not scalable
- Resolving at the interceptor level silences all of them at once

---

## Key Architectural Decisions

### Why `authenticateXxx()` directly instead of `login()`

The `login()` function in authStore has side effects:
- Updates Zustand state (`userProfile`, `isAuthenticated`, `userType`)
- Dispatches `auth:login-failed` events on failure
- Has its own `loginInProgress` lock that can conflict

During switch, we only need the **session cookie** to be set. The new page will hydrate its own state from `getSession()`. Calling authenticate endpoints directly avoids triggering state changes that could cause the old page's dashboard components to re-render.

### Why `await logout()` instead of fire-and-forget

The old approach did `authApi.logout().catch(() => {})` (fire-and-forget) then redirected immediately. This created a race where the authenticate call could arrive at the backend while the old session was still being cleared, potentially causing session conflicts. Awaiting ensures clean sequencing: old session cleared, then new session created.

### Why resolve instead of reject for AccountSwitchError

The original design rejected with `AccountSwitchError` expecting callers to check `isAccountSwitchError()`. In practice, only 2-3 top-level callers had this check while dozens of inner catch blocks logged the error. Resolving with empty data at the interceptor level is a zero-maintenance solution that works for all current and future callers.

---

## Verification Checklist

- [x] Customer to Shop switch - redirects to `/shop` dashboard
- [x] Shop to Customer switch - redirects to `/customer` dashboard
- [x] Any role to Admin switch - redirects to `/admin`
- [x] Switch to unregistered wallet - redirects to `/choose`
- [x] Rapid switching - no duplicate switches or errors
- [x] Console clean - no 404 errors, no "Failed to connect" errors, no AccountSwitchError noise
- [x] Loading overlay shown during switch ("Switching account...")
- [x] Email-based logins (social login) continue to work

---

## References

- Auth initializer: `frontend/src/hooks/useAuthInitializer.ts`
- Auth store: `frontend/src/stores/authStore.ts`
- API client interceptors: `frontend/src/services/api/client.ts`
- Auth provider: `frontend/src/providers/AuthProvider.tsx`
- Auth API service: `frontend/src/services/api/auth.ts`

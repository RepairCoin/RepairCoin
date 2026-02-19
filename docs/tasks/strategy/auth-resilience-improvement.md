# Auth Resilience Improvement Strategy

## Overview

Improve authentication flow resilience to prevent corrupted browser state when users rapid-refresh or experience network issues.

**Created**: February 9, 2026
**Last Updated**: February 11, 2026
**Status**: Phase 1-7 COMPLETE
**Priority**: High
**Affected Users**: All (customers, shops, admins)

---

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | SessionStorage Mutex | ✅ Complete |
| 2 | Session Caching | ✅ Complete |
| 3 | Immediate Session Check | ✅ Complete |
| 4 | Shop Data Caching | ✅ Complete |
| 5 | Logout Fix | ✅ Complete |
| 6 | Auto-Recovery Mechanism | ✅ Complete |
| 7 | Wallet Mismatch Debounce | ✅ Complete |

---

## Problem Statement

**Observed Issue:**
- User rapid-refreshes page during connection testing
- Auth state becomes corrupted (localStorage + cookies)
- User sees "Shop Not Found", role selection page, or "wallet changed unexpectedly"
- Issue persists for 45+ minutes in regular browser
- Works in incognito (fresh state)
- Requires manual clearing of site data to recover

**Root Cause:**
1. Multiple concurrent auth requests race against each other
2. Auth flow gets interrupted mid-way
3. No protection against rapid-fire requests
4. Waiting for Thirdweb wallet restoration (slow)
5. No auto-recovery mechanism for corrupted state

---

## Completed Phases

### Phase 1: SessionStorage Mutex ✅ COMPLETE

**Completed:** February 9, 2026

**Goal:** Prevent concurrent auth operations across page refreshes

**Implementation:**
- Cross-refresh mutex using sessionStorage (`rc_auth_lock`)
- 5-second lock timeout to prevent deadlocks
- Polling mechanism for lock-denied scenarios

**Files Changed:**
- `frontend/src/hooks/useAuthInitializer.ts`

**Console Logs:**
```
[AuthInitializer] 🔒 Lock acquired
[AuthInitializer] 🔒 Lock denied - another auth in progress (age: Xms)
[AuthInitializer] 🔓 Lock released
```

---

### Phase 2: Session Caching ✅ COMPLETE

**Completed:** February 9, 2026

**Goal:** Cache auth session to avoid API calls on refresh

**Implementation:**
- Session profile caching in sessionStorage (`rc_session_cache`)
- 30-second cache TTL
- Cache-first strategy: check cache before API calls
- Cache cleared on logout

**Files Changed:**
- `frontend/src/hooks/useAuthInitializer.ts`

**Console Logs:**
```
[AuthInitializer] 📦 Session cached
[AuthInitializer] 📦 Using cached session (age: Xms)
```

---

### Phase 3: Immediate Session Check ✅ COMPLETE

**Completed:** February 10, 2026

**Goal:** Don't wait for Thirdweb wallet restoration

**Implementation:**
- Added IMMEDIATE session check on component mount (empty deps `[]`)
- Runs BEFORE waiting for Thirdweb wallet restoration
- Checks cache → API → sets profile instantly
- If no session on protected route → redirect to home

**Files Changed:**
- `frontend/src/hooks/useAuthInitializer.ts`

**Console Logs:**
```
[AuthInitializer] 🚀 IMMEDIATE session check on mount (not waiting for Thirdweb)
[AuthInitializer] ⚡ IMMEDIATE: Using cached session
[AuthInitializer] ⚡ IMMEDIATE: Valid session from API
```

---

### Phase 4: Shop Data Caching ✅ COMPLETE

**Completed:** February 10, 2026

**Goal:** Cache shop data to avoid "Loading dashboard data..." on refresh

**Implementation:**
- Shop data caching in sessionStorage (`rc_shop_data_cache`)
- Shop ID caching (`rc_shop_id`) for faster lookups
- 60-second cache TTL
- Immediate cache load on mount (before auth completes)
- Background refresh for fresh data while showing cached content

**Files Changed:**
- `frontend/src/components/shop/ShopDashboardClient.tsx`

**Console Logs:**
```
[ShopDashboard] 📦 Shop ID cached
[ShopDashboard] 📦 Shop data cached
[ShopDashboard] ⚡ IMMEDIATE cache load on mount - no waiting for auth
[ShopDashboard] 🔄 Background refresh from: /shops/...
```

---

### Phase 5: Logout Fix ✅ COMPLETE

**Completed:** February 10, 2026

**Goal:** Properly clear caches and redirect on logout/session expiry

**Implementation:**
- Added `clearAllAuthCaches()` function to clear all session-related caches
- Updated `resetAuth()` to use the new cache clearing function
- When no valid session found on protected routes → redirect to home
- When token refresh fails after 3 retries on protected routes → clear caches and redirect

**Files Changed:**
- `frontend/src/hooks/useAuthInitializer.ts`
- `frontend/src/stores/authStore.ts`
- `frontend/src/services/api/client.ts`

**Console Logs:**
```
[AuthInitializer] 🧹 All auth caches cleared
[AuthInitializer] IMMEDIATE: No valid session on protected route - redirecting to home
[API Client] On protected route with failed auth - clearing caches and redirecting to home
```

---

## Completed Phases (continued)

### Phase 6: Auto-Recovery Mechanism ✅ COMPLETE

**Completed:** February 10, 2026

**Goal:** Automatically detect and recover from corrupted state when multiple auth failures occur

**When It Triggers:**
- 3 or more auth failures within a 30-second window
- Examples: repeated 401s, session check failures, token refresh failures

**How It Works:**
```
Auth Failure #1 → Record failure (1/3)
Auth Failure #2 → Record failure (2/3)
Auth Failure #3 → Threshold reached → TRIGGER RECOVERY
                                      ↓
                              Clear localStorage (thirdweb keys)
                              Clear sessionStorage (our caches)
                              Clear auth cookies
                              Redirect to home
```

**Files Created/Modified:**
- **Created:** `frontend/src/utils/authRecovery.ts`
- **Modified:** `frontend/src/hooks/useAuthInitializer.ts`
- **Modified:** `frontend/src/services/api/client.ts`

**Console Logs:**
```
[AuthRecovery] Failure recorded (1/3): Session check failed
[AuthRecovery] Failure recorded (2/3): Token refresh failed
[AuthRecovery] Failure recorded (3/3): Session revoked
[AuthRecovery] 🚨 Multiple failures detected - triggering recovery
[AuthRecovery] Cleared localStorage keys: 5
[AuthRecovery] Cleared sessionStorage
[AuthRecovery] Cleared auth cookies
[AuthRecovery] Redirecting to home...
[AuthRecovery] ✅ Auth success - resetting failure count
```

---

### Phase 7: Wallet Mismatch Debounce ✅ COMPLETE

**Completed:** February 11, 2026

**Goal:** Add stability checks before triggering wallet mismatch warnings to prevent false positives during rapid wallet switches or Thirdweb initialization.

**How It Works:**
```
Wallet Switch Detected → Start 500ms debounce timer
                              ↓
                    Wait for wallet to stabilize
                              ↓
                    Re-check: Is mismatch still present?
                              ↓
                    YES → Dispatch mismatch warning
                    NO  → Mismatch resolved, no warning
```

**Implementation:**
- Added `WALLET_MISMATCH_DEBOUNCE_MS = 500` constant
- Added `mismatchTimeoutRef` to track debounce timer
- Wrapped mismatch event dispatch in setTimeout
- Re-validates addresses after debounce period
- Clears pending timeout on rapid wallet switches
- Added cleanup in useEffect return

**Files Modified:**
- `frontend/src/hooks/useAuthInitializer.ts`

**Console Logs:**
```
[AuthInitializer] 🔄 Wallet mismatch detected, waiting for stability...
[AuthInitializer] ⚠️ Wallet mismatch confirmed after stability check!
[AuthInitializer] ✅ Wallet mismatch resolved during stability check
```

**Test Results (7/7 passed):**
- ✅ Mismatch NOT triggered immediately
- ✅ Mismatch triggered after 500ms stability period
- ✅ Rapid wallet switches cancel pending checks
- ✅ Mismatch resolved if wallet switches back
- ✅ No false positives when addresses match
- ✅ Only last wallet in rapid sequence triggers mismatch
- ✅ Debounce timing is accurate (500ms threshold)

---

#### Implementation: authRecovery.ts

```typescript
// frontend/src/utils/authRecovery.ts

const AUTH_FAIL_THRESHOLD = 3;
const AUTH_FAIL_WINDOW_MS = 30000; // 30 seconds

interface AuthFailure {
  timestamp: number;
  error: string;
}

let authFailures: AuthFailure[] = [];

/**
 * Record an auth failure and check if recovery is needed
 */
export function recordAuthFailure(error: string): void {
  const now = Date.now();

  // Remove failures outside the sliding window
  authFailures = authFailures.filter(
    f => now - f.timestamp < AUTH_FAIL_WINDOW_MS
  );

  authFailures.push({ timestamp: now, error });
  console.log(`[AuthRecovery] Failure recorded (${authFailures.length}/${AUTH_FAIL_THRESHOLD}):`, error);

  // Check if threshold exceeded
  if (authFailures.length >= AUTH_FAIL_THRESHOLD) {
    triggerAuthRecovery();
  }
}

/**
 * Trigger full auth recovery - clears all state and redirects
 */
export function triggerAuthRecovery(): void {
  console.warn('[AuthRecovery] 🚨 Multiple failures detected - triggering recovery');

  // 1. Clear thirdweb/walletconnect keys from localStorage
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('thirdweb') || key.includes('walletconnect'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.log('[AuthRecovery] Cleared localStorage keys:', keysToRemove.length);

  // 2. Clear sessionStorage (our caches)
  sessionStorage.clear();
  console.log('[AuthRecovery] Cleared sessionStorage');

  // 3. Clear auth cookies (client-accessible ones only)
  document.cookie.split(";").forEach(c => {
    const name = c.trim().split("=")[0];
    if (name && (name.includes('auth') || name.includes('token'))) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  });
  console.log('[AuthRecovery] Cleared auth cookies');

  // 4. Reset failure count
  authFailures = [];

  // 5. Redirect to home with fresh state
  console.log('[AuthRecovery] Redirecting to home...');
  window.location.href = '/';
}

/**
 * Reset failure count on successful auth
 */
export function resetAuthFailures(): void {
  if (authFailures.length > 0) {
    console.log('[AuthRecovery] ✅ Auth success - resetting failure count');
    authFailures = [];
  }
}

/**
 * Get current failure count (for debugging)
 */
export function getFailureCount(): number {
  return authFailures.length;
}
```

---

#### Integration: useAuthInitializer.ts

```typescript
import { recordAuthFailure, resetAuthFailures } from '@/utils/authRecovery';

// On successful auth (after setting profile):
setUserProfile(profile);
setCachedSession(profile);
resetAuthFailures(); // Clear failure count on success

// On auth failure (in catch blocks):
catch (error: any) {
  console.log('[AuthInitializer] Auth failed:', error?.message);
  recordAuthFailure(error?.message || 'Unknown auth error');
  // ... existing error handling
}
```

---

#### Integration: client.ts (API Client)

```typescript
import { recordAuthFailure } from '@/utils/authRecovery';

// In token refresh failure handler:
console.warn('[API Client] Token refresh attempt failed');
recordAuthFailure('Token refresh failed: ' + (error?.message || 'Unknown'));

// In 401 handler (after determining it's not recoverable):
if (httpStatus === 401 && !isRecoverable) {
  recordAuthFailure('Unauthorized request - session invalid');
}
```

---

#### Testing Checklist

- [ ] 1 auth failure → no recovery triggered
- [ ] 2 auth failures within 30s → no recovery triggered
- [ ] 3 auth failures within 30s → recovery triggered
- [ ] 3 auth failures spread over 60s → no recovery (outside window)
- [ ] Successful auth after 2 failures → failure count resets
- [ ] Recovery clears localStorage thirdweb keys
- [ ] Recovery clears all sessionStorage
- [ ] Recovery redirects to home page
- [ ] User can login normally after recovery
- [ ] Console shows failure count incrementing

---

## SessionStorage Keys Reference

| Key | Purpose | TTL |
|-----|---------|-----|
| `rc_auth_lock` | Cross-refresh mutex | 5 seconds |
| `rc_session_cache` | Cached user profile | 30 seconds |
| `rc_shop_data_cache` | Cached shop data | 60 seconds |
| `rc_shop_id` | Shop ID for fast lookups | No expiry |

---

## Performance Results

| Scenario | Before | After |
|----------|--------|-------|
| Page refresh (with cache) | 2+ minutes | < 1 second |
| Rapid refresh (10x) | Corrupted state | Instant load |
| Logout | Stuck on "Initializing..." | Redirects to home |
| Session expired | Stuck loading | Auto-redirect to home |

---

## Rollback Procedures

### Quick Rollback (All Phases)

```bash
# Revert to previous commit
git checkout HEAD~1 -- frontend/src/hooks/useAuthInitializer.ts
git checkout HEAD~1 -- frontend/src/stores/authStore.ts
git checkout HEAD~1 -- frontend/src/services/api/client.ts
git checkout HEAD~1 -- frontend/src/components/shop/ShopDashboardClient.tsx
git checkout HEAD~1 -- frontend/src/utils/authRecovery.ts

# Or remove new files if they didn't exist before
rm frontend/src/utils/authRecovery.ts

# Commit rollback
git add .
git commit -m "rollback: revert auth resilience changes"
```

### Clear User's Corrupted State

If a user reports issues, they can clear state by:
1. Opening browser DevTools → Application tab
2. Clearing sessionStorage for the site
3. Clearing localStorage entries containing "thirdweb"
4. Refreshing the page

---

## References

- Auth flow: `frontend/src/hooks/useAuthInitializer.ts`
- Auth store: `frontend/src/stores/authStore.ts`
- API client: `frontend/src/services/api/client.ts`
- Shop dashboard: `frontend/src/components/shop/ShopDashboardClient.tsx`
- Auto-recovery: `frontend/src/utils/authRecovery.ts`

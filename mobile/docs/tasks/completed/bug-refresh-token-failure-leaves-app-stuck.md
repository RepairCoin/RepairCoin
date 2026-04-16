# Bug: Expired refresh token leaves app stuck on dashboard

**Status:** Completed
**Priority:** Critical
**Est. Effort:** 30 minutes
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

## Problem

When the refresh token expired (after 7 days) or token refresh failed for any reason, the app ended up in a broken state:

- `isAuthenticated` stayed `true` in the Zustand store
- Every API call returned 401
- The user remained on the dashboard with no way out except force-closing the app
- Reopening the app restored the broken state from SecureStore

`clearAuthToken()` was only dropping the axios `Authorization` header — it did not clear the auth store, the persisted SecureStore data, or navigate to onboarding. In addition, the 401 handler deliberately skipped calling `clearAuthToken()` when the error code was `TOKEN_EXPIRED`, so the most common failure path never triggered logout at all.

## Analysis

### Root cause (two separate issues)

1. `mobile/shared/utilities/axios.ts` — `clearAuthToken()` only performed `delete this.instance.defaults.headers.Authorization`. No store reset, no SecureStore clear, no navigation.
2. Same file, inside the response interceptor's 401 handler:
   ```ts
   if (errorCode !== "TOKEN_EXPIRED") {
     await this.clearAuthToken();
   }
   ```
   If the 401 came from the most common cause — an expired access token whose refresh also failed — auth was never cleared.

### Circular-call trap

`useAuthStore.logout()` already calls `apiClient.clearAuthToken()`. A naive fix where `clearAuthToken()` calls `logout()` would recurse infinitely. The fix uses an `isClearingAuth` re-entry guard on the `ApiClient` instance so `logout()` can call back into `clearAuthToken()` for its header-delete step without re-triggering the full pipeline.

## Implementation

### Files modified

- `mobile/shared/utilities/axios.ts`
  - Imported `router` from `expo-router`.
  - Added `isClearingAuth` private flag on `ApiClient`.
  - Rewrote `clearAuthToken()` to:
    1. Always drop the axios header (even during re-entry).
    2. Return early if already clearing (breaks `logout → clearAuthToken → logout` recursion).
    3. Call `useAuthStore.getState().logout(false)` to clear Zustand state + SecureStore + disconnect wallet + deactivate push tokens.
    4. Only navigate to `/onboarding1` if the user was actually authenticated (so a public-endpoint 401 doesn't punt them out).
  - Removed the `if (errorCode !== "TOKEN_EXPIRED")` guard in the 401 handler so every failed refresh now triggers the full logout.

### Approach

Minimal edits in a single file. Did not modify `useAuthStore.logout()` itself; the re-entry flag lets the existing logout pipeline handle the heavy lifting (clearing SecureStore, disconnecting wallet, deactivating push tokens) without recursion.

## Verification Checklist

- [x] Login, then invalidate refresh token server-side → next API call triggers logout + redirect
- [x] After auto-logout, SecureStore is cleared (no auto-login on app reopen)
- [x] After auto-logout, navigating back doesn't return to dashboard (router.replace)
- [x] Normal token refresh (valid refresh token) still works silently — `clearAuthToken()` only fires when refresh fails
- [x] Concurrent requests during a failed refresh do not cause multiple navigate calls (re-entry guard + subscribeTokenRefresh queue)
- [x] TOKEN_EXPIRED with a dead refresh token now logs the user out instead of leaving them stuck

## Notes

- **Test setup:** Quickest repro is to manually clear the user's `refresh_tokens` row in the DB, then trigger any authenticated call. Previously the app silently stayed on-screen with failing calls; now it redirects to onboarding.
- **Why not navigate unconditionally:** A 401 on a public endpoint (or one called before login completes) would otherwise bounce the user to onboarding mid-flow. Gating on `isAuthenticated` avoids that.
- **Downstream regression areas:** Any hook that calls `apiClient.clearAuthToken()` directly will now also log the user out. Only three call sites exist and all are in `axios.ts` itself (request interceptor refresh-failure, response interceptor refresh-failure, and `refreshToken()` 401 branch), which is the intended behavior.

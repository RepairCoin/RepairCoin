# Bug: Logout hangs indefinitely and cannot be recovered except by uninstalling the app

**Status:** Open
**Priority:** Critical
**Est. Effort:** 30 minutes
**Created:** 2026-04-20
**Updated:** 2026-04-20

---

## Problem

Tapping **Log Out** on the Settings screen leaves the button stuck showing "Logging Out…" with no progress and no error, **indefinitely**. Reported by a real device user — one session stayed stuck for 3+ minutes and was still loading when the user gave up. The issue is reproducible ("I encountered this several times") and is happening to the user at the time of filing this report.

Worse: the stuck state **persists across force-close**. The user closed the app, reopened it, and was still logged in. The only recovery path they found was **uninstalling the app**.

This is an effective total-loss logout failure for any user who hits the bad code path:

- Users cannot switch accounts
- Users cannot hand the device to someone else
- Users on a shared or test device cannot hygienically clear their session
- Users experiencing suspicious activity cannot sign themselves out

During the hang, the "Logging Out…" label is the only UI feedback. No error, no retry, no cancel. The hang looks to the user like the app has silently died.

---

## Root Cause

There is one genuinely-awaited network call in the logout chain, plus two architectural weaknesses that compound any delay on that call.

### The awaited chain (what "Logging Out…" is waiting for)

`feature/settings/hooks/ui/useSettings.ts:28-39` → `shared/hooks/auth/useAuth.ts:213-251` (`useLogout`) → `shared/store/auth.store.ts:131-191` (Zustand `logout`).

The button text is driven by `isLoggingOut` in `useSettings`, which is cleared in a `finally` block only after `performLogout()` resolves. The awaited steps inside `performLogout` are:

1. `queryClient.cancelQueries()` — `useAuth.ts:225`
2. `await logout(true)` — `useAuth.ts:241`, which in turn awaits:
   - `notificationApi.deactivateAllPushTokens()` — `auth.store.ts:136` (HTTP `DELETE /notifications/push-tokens`, axios timeout **60s**)
   - `apiClient.clearAuthToken()` — local
   - `Promise.all(SecureStore.deleteItemAsync(...))` × 6 keys — local
   - `set({...})` — synchronous state reset
   - `router.replace("/onboarding1")` — navigation

Only step 2's first sub-call (`deactivateAllPushTokens`) touches the network. Everything else is sub-millisecond.

### Weakness 1 — `cancelQueries()` cannot actually cancel HTTP requests

Verified: `mobile/shared/utilities/axios.ts` does not wire up `AbortController` / `signal` for any request (`grep AbortController|signal|CancelToken` → zero matches).

React Query's `cancelQueries()` only signals cancellation via the query's `AbortSignal`. Without AbortController integration, the in-flight HTTP requests continue running in the background until the server responds or the 60 s axios timeout fires. They keep consuming connection-pool slots even after React Query has marked them cancelled.

### Weakness 2 — `resetQueries()` fires new HTTP requests during logout

`useAuth.ts:231` calls `queryClient.resetQueries()` without awaiting it. `resetQueries` removes cached data **and triggers refetches** of every query that still has an active observer. On the Settings screen those include shop profile, notification prefs, and any mounted query hooks higher up in the tree. Each refetch:

- Goes through the axios interceptor (token check, potential refresh queue wait)
- Competes with `deactivateAllPushTokens` for connection-pool slots
- Is eligible for up to 3 retries per `mobile/shared/config/queryClient.ts:12` (`failureCount < 3`)
- Each attempt can run up to 60 s before timing out

These refetches don't directly block the awaited chain, but on a saturated or degraded connection they crowd the pipe the awaited `DELETE /notifications/push-tokens` call is using.

### Weakness 3 — `deactivateAllPushTokens` is awaited but blocks UX for no reason

Marking a push-token inactive server-side is an idempotent cleanup that has no user-visible effect at logout time. There is no reason the user should wait for it. Making it fire-and-forget removes the only awaited network call from the critical path.

### Why the hang is indefinite, not merely 60 seconds

Axios timeout is configured at 60 s (`axios.ts:81`). A well-behaved request-response cycle should error out at that point and the catch block around `await notificationApi.deactivateAllPushTokens()` would swallow the error, allowing execution to continue to the local-cleanup steps.

The hang persists well past 60 s (user-observed 3+ minutes, "still loading" when they gave up). This means the axios timeout is not actually firing — the request is in a state where it neither resolves nor rejects. Likely contributors:

- **Mobile OS TCP keep-alive / retry** outlasting the app-level timeout. On iOS/Android, sockets can stay open past the documented client timeout when the OS is doing its own retries at the transport layer.
- **Token-refresh queue stall**: the axios request interceptor (`axios.ts:200-270`) checks `isTokenExpired` on every outgoing request and may subscribe to an in-progress refresh via `subscribeTokenRefresh`. If the refresh itself hangs on a dead connection, every subsequent request waits on the `onTokenRefreshed` callback that never fires.
- **`resetQueries()` contention**: the unawaited refetches from `useAuth.ts:231` queue up on the same HTTP connection pool and may extend the time the single `deactivateAllPushTokens` request takes to even leave the device.

Root pathology aside, the architectural issue is the same either way: **the user's ability to log out depends on a network call completing.** It shouldn't.

---

## Evidence

- **Reproduced user symptom:** screenshot 2026-04-20 showing shop Settings screen stuck at "Logging Out…" for 3+ minutes and still loading when the user gave up. Reporter confirms the hang is indefinite — they have never seen it self-recover.
- **Persistence across force-close confirmed by reporter:** closing and reopening the app leaves the user still logged in. The only reliable recovery they have found is uninstalling the app.
- **Verified no AbortController:** grep across `mobile/shared/utilities/axios.ts` for `AbortController|signal|CancelToken` returns zero matches.
- **Verified `resetQueries()` is called mid-logout, not awaited:** `mobile/shared/hooks/auth/useAuth.ts:231`.
- **Verified only one awaited network call:** `auth.store.ts:136` — `await notificationApi.deactivateAllPushTokens()`.
- **Verified axios timeout = 60 s:** `axios.ts:81` (`timeout: 60000`) — yet real-world hang exceeds this, meaning the timeout is not reliably firing.
- **Verified React Query retry config:** `queryClient.ts:12` — up to 3 retries for non-401/404 errors.
- **Verified `state.account?.disconnect` branch is dead code:** the only `setAccount` call in the codebase passes `{ address, email }` (`useAuth.ts:51`). The object has no `disconnect` method after JSON rehydration either, so the `if (state.account?.disconnect)` guard is always false.
- **Verified SecureStore clear and Zustand `set({})` are downstream of the hanging `await`:** `auth.store.ts:136` (await) → `:164` (SecureStore clear) → `:171` (state reset). Execution never reaches the clear, so `auth-store` in SecureStore retains the pre-logout `accessToken` / `isAuthenticated: true`. On next app launch Zustand persist rehydrates the stale state — the user is back in their session. This is why uninstall is the only reliable recovery.

**Not verified:**
- The exact interaction (TCP retry vs token-refresh queue vs refetch contention) during the indefinite hang. Cannot reproduce without the same network/device state the user had.
- Whether the same behaviour reproduces on production vs staging API targets.

## Workarounds while the fix is pending

In order of preference for an affected user:

1. **Android:** Settings → Apps → FixFlow → Storage → Clear Data. Same end result as uninstall, no re-download.
2. **iOS:** Delete app and reinstall from App Store.
3. Leave the app open on "Logging Out…" and wait. *Not reliable* — the 60 s axios timeout is documented as 60 s but real-world observation exceeds that.

None of these are acceptable UX. Only shipping the fix below resolves this for users.

---

## Fix Required

Four independent changes, each safe on its own; apply in order. Changes 1 and 3 are the primary fixes; 2 and 4 are hardening.

### Change 1 — Make `deactivateAllPushTokens` fire-and-forget

**File:** `mobile/shared/store/auth.store.ts` (around line 134-141)

```diff
- // Deactivate push notification tokens before logout
- try {
-   await notificationApi.deactivateAllPushTokens();
-   console.log("[Auth] Push tokens deactivated");
- } catch (error) {
-   console.error("[Auth] Error deactivating push tokens:", error);
-   // Continue with logout even if this fails
- }
+ // Deactivate push notification tokens server-side in the background.
+ // Idempotent cleanup; no UX reason to block logout on this completing.
+ notificationApi.deactivateAllPushTokens().catch((error) => {
+   console.error("[Auth] Error deactivating push tokens:", error);
+ });
```

This is the single highest-impact change — removes the only awaited network call from the critical path.

### Change 2 — Remove `resetQueries()` from logout

**File:** `mobile/shared/hooks/auth/useAuth.ts` (around line 231)

```diff
  queryClient.clear();
  await queryClient.cancelQueries();
  queryClient.removeQueries();
- queryClient.resetQueries();
```

`clear()` + `removeQueries()` fully wipe the cache. `resetQueries()` then schedules refetches of data we just cleared, using the still-valid auth token, for queries belonging to screens the user is leaving. This wastes connections and can extend logout on degraded networks.

### Change 3 — Local-first logout: clear state and navigate before any server call

**File:** `mobile/shared/store/auth.store.ts` — reorder the `logout` body so local cleanup + navigation happen first, server cleanup runs in the background:

```ts
logout: async (navigate = true) => {
  // 1. Local state cleanup + immediate navigation (user-visible)
  try {
    await apiClient.clearAuthToken();
  } catch (error) {
    console.error("[Auth] Error clearing API token:", error);
  }

  try {
    const keys = ['auth-store', 'repairCoin_authData', 'repairCoin_authToken', 'repairCoin_userType', 'repairCoin_walletAddress', 'payment-session-storage'];
    await Promise.all(keys.map(key => SecureStore.deleteItemAsync(key)));
  } catch (error) {
    console.error("[Auth] Error clearing SecureStore:", error);
  }

  set(
    {
      account: null,
      userProfile: null,
      isAuthenticated: false,
      userType: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      authMethod: null,
    },
    false,
    "logout"
  );

  if (navigate) router.replace("/onboarding1");

  // 2. Background server cleanup (not awaited, not user-blocking)
  notificationApi.deactivateAllPushTokens().catch((error) => {
    console.error("[Auth] Error deactivating push tokens:", error);
  });
},
```

After this change, the button text changes from "Logging Out…" to gone almost instantly — `await logout(true)` resolves after only local file + SecureStore operations, typically < 50 ms.

Remove the `if (state.account?.disconnect)` branch while editing — it's dead code (`setAccount` is never called with a function-bearing object in this codebase).

### Change 4 — Defensive overall race timeout

**File:** `mobile/shared/hooks/auth/useAuth.ts` (inside `handleLogout` in `useLogout`)

```ts
await Promise.race([
  (async () => {
    queryClient.clear();
    await queryClient.cancelQueries();
    queryClient.removeQueries();
    await logout(true);
  })(),
  new Promise<void>((resolve) => setTimeout(resolve, 5000)),
]);

// Fallback navigation in case the race timed out before logout finished.
// logout(true) already navigates; this is a belt-and-braces.
router.replace("/onboarding1");
```

Guarantees the UI unblocks within 5 seconds regardless of what happens inside the chain. Should not normally trigger after Change 3, but protects against future regressions.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/shared/store/auth.store.ts` | Changes 1 + 3 — fire-and-forget push-token deactivation, reorder logout to local-first, drop dead `account.disconnect` branch |
| `mobile/shared/hooks/auth/useAuth.ts` | Changes 2 + 4 — remove `resetQueries()`, wrap logout in 5-second race |

No other files need modification. No backend changes required.

---

## Verification Checklist

- [ ] **Happy path, good network:** Tap Log Out on Settings — onboarding screen appears in under 1 second. No "Logging Out…" text visible (or visible only for a frame).
- [ ] **Degraded network, airplane mode:** Enable airplane mode, tap Log Out — onboarding screen still appears within 1-2 seconds. No multi-second hang.
- [ ] **Server down:** Point app at a stopped staging server, tap Log Out — onboarding screen still appears within 1-2 seconds.
- [ ] **Force-quit during logout:** Tap Log Out, immediately force-close app. Relaunch. App opens to onboarding (local state was cleared before the hang would have mattered).
- [ ] **Server cleanup still happens:** After a successful logout on good network, verify backend `device_push_tokens` rows for this wallet are marked inactive (DB query on `device_push_tokens WHERE wallet_address = <user>`). Confirms the fire-and-forget actually runs.
- [ ] **Re-login works cleanly:** After logout, log back in with the same wallet. Wallet auth and push-token registration work without stale-state issues.
- [ ] **Both roles:** Test as customer AND shop — each has slightly different query sets that `resetQueries()` was firing.

---

## Notes

- **Why Critical:** logout failure persists across force-close. The user's only recovery path is uninstalling the app. There is no data-loss risk, but the feature is functionally broken in a way that also blocks multiple user-trust scenarios (account switching, shared device hand-off, self-initiated sign-out on suspected compromise). This is a release blocker.
- **Why the state survives force-close:** the hang happens at `await notificationApi.deactivateAllPushTokens()` in `auth.store.ts:136`. The SecureStore clear (`auth.store.ts:164`) and the Zustand `set({...})` that writes the logged-out state (`auth.store.ts:171`) are both *downstream* of that `await`. Because execution never reaches them, `auth-store` in SecureStore still holds the pre-logout `accessToken` / `isAuthenticated: true`. On relaunch, Zustand persist rehydrates, and the user is back in their session. Uninstalling wipes SecureStore along with the app data directory, which is why it works.
- **Related but out of scope:**
  - Adding `AbortController` / `signal` integration to axios so React Query's `cancelQueries()` can actually terminate HTTP requests. Worth a separate enhancement; affects the whole app, not just logout.
  - Reviewing other blocking-network-on-nav paths (login, role-switch) for the same anti-pattern. Quick audit recommended after this lands.
- **Why not just add a timeout to `deactivateAllPushTokens()`:** making it fire-and-forget is simpler than plumbing a custom timeout and has the same end-user effect. A timeout would still keep the user waiting up to `timeoutMs` for a call that doesn't need to block UX.
- **Confidence the fix works:** high. The awaited chain will contain zero network calls after Change 3, so UX blocking on network is mathematically impossible for logout. Change 4 is defensive against future regressions.
- **Test customer:** any logged-in account works. The original report was on a shop Settings screen, but the logout code path is shared between customer and shop.

# Bug: Customer login silently fails — stuck on onboarding with no navigation or feedback

**Status:** Open
**Priority:** Critical
**Est. Effort:** 15-30 minutes (primary fix); 1-2 hrs (secondary cleanup)
**Created:** 2026-04-23
**Updated:** 2026-04-23

---

## Problem / Goal

After the customer logs out and attempts to log back in, the app sometimes stays on the onboarding "welcome" screen (OnboardingScreen3) instead of navigating to the customer dashboard. No error toast may appear depending on the exact failure mode. The "Connect" button may or may not still show a loading spinner.

Reproduced: customer logged in successfully once → logged out → attempted re-login → stuck on onboarding with no clear indication of what went wrong.

The user is not permanently locked out (re-tapping Connect can eventually succeed), but the failure mode is opaque — they can't tell if they need to retry, restart the app, or reinstall.

---

## Analysis

### Full login flow traced

```
OnboardingScreen3 "Connect" button
  → Wallet selection modal
  → Thirdweb `connect()` runs (MetaMask / Google / etc.)
  → w.getAccount() → address
  → connectWalletMutation.mutate({ address, email })
  → useAuth.ts:45 useConnectWallet.mutationFn:
    • setIsLoading(true)
    • setAccount({ address, email })
    • authApi.checkUserExists(address)
  → useAuth.ts:55 onSuccess(result):
    ├── !result.exists → router.replace("/register") ✓ OK
    ├── shop + pending/suspended → route accordingly ✓ OK
    └── else → getTokenMutation:
          try:
            getTokenResult.success ? navigate : setIsLoading(false) ❌
          catch:
            shop ? route : setIsLoading(false) ❌
```

### The silent-failure branches (root cause)

**`mobile/shared/hooks/auth/useAuth.ts:103-105`:**
```typescript
} else {
  setIsLoading(false);  // ← no navigation, no toast
}
```
Triggers if `getTokenResult.success` is falsy (unexpected backend response shape, HTTP 200 but `success: false`, malformed JSON, etc.).

**`mobile/shared/hooks/auth/useAuth.ts:121-123`:**
```typescript
} else {
  setIsLoading(false);  // ← no navigation; customer path
}
```
Triggers when `getTokenMutation.mutateAsync` throws (HTTP 429, 5xx, network timeout, 401 that gets silently swallowed during token-refresh, 400, 403, non-404 HTTP errors).

Shop users have a recovery path in the catch (routed to `/register/pending` or `/register/suspended`). **Customer users have no recovery — they stay on whatever screen they were on**, which is OnboardingScreen3 because the onboarding is the entry point for logged-out users.

### Why the axios global toast doesn't always help

`mobile/shared/utilities/axios.ts:323` calls `handleGlobalErrorToast(error)` for network / timeout / 429 / 5xx errors. This toast helps users in THOSE specific cases but:
- 400, 403, and other 4xx errors don't fire the global toast
- The toast alone doesn't re-enable the Connect button cleanly or explain the user should retry
- Even when the toast fires, the user is still stuck on the screen with no navigation guidance

### Compounding issue — Thirdweb wallet not disconnected at logout

`mobile/shared/store/auth.store.ts:166-173` has a dead code branch:
```typescript
if (state.account?.disconnect) {
  try {
    await state.account.disconnect();
    // ...
```

`state.account` is always set as `{ address, email }` (a plain object via `setAccount({address, email})` at `useAuth.ts:51`). It has no `.disconnect` method. **This branch never executes.** So logout clears our Zustand state + SecureStore but leaves the Thirdweb wallet session intact on the device.

Consequence: on the next login attempt, Thirdweb's internal state is "already connected" which can cause:
- `w.connect()` to reuse a stale session rather than initiate a fresh OAuth/WalletConnect handshake
- Race conditions where `w.getAccount()` returns an account from the old session that may have differing state from what the backend expects
- Subtle timing issues that manifest as silent login failures downstream

This is already noted as a non-blocking follow-up in the closed `bug-logout-hangs-for-minutes.md` doc, but it becomes directly relevant to this login bug.

### Correlation with earlier bug

This bug is closely related to `bug-customer-home-no-wallet-connected-despite-logged-in.md` (also filed 2026-04-23). Both stem from the same underlying issue: **the app's auth state is split across three layers (Thirdweb wallet session, Zustand store, SecureStore persistence) without a single source of truth, and there's no cohesive recovery when one layer gets out of sync.**

The two bugs are different symptoms of the same architectural gap. Fixing one without the other will leave the other symptom still reachable.

---

## Implementation

### Primary fix (Critical, ~15 min) — Never strand a customer on login failure

**File:** `mobile/shared/hooks/auth/useAuth.ts` — lines 86-124

Add explicit error feedback on both silent branches. Keep the user on onboarding (so the Connect button is available for retry), clear the loading state, and show a toast if the axios interceptor didn't already show one.

```diff
  try {
    const getTokenResult = await getTokenMutation.mutateAsync(address);
    if (getTokenResult.success) {
      setUserProfile(result.user);
      setAccessToken(getTokenResult.token);
      setRefreshToken(
        getTokenResult.data?.refreshToken || getTokenResult.refreshToken,
      );
      setUserType(result.type);
      apiClient.setAuthToken(getTokenResult.token);

      if (result.type === "customer") {
        router.replace("/customer/tabs/home");
      } else if (result.type === "shop") {
        router.replace("/shop/tabs/home");
      } else {
        router.replace("/customer/tabs/home");
      }
    } else {
      setIsLoading(false);
+     showError("Could not complete sign-in. Please try again.");
    }
  } catch (err) {
    console.error("[useConnectWallet] Token error:", err);
    if (result.type === "shop") {
      // ... existing shop-specific routing to pending/suspended
    } else {
      setIsLoading(false);
+     if (!(err as any)?.__toastShown) {
+       showError("Could not complete sign-in. Please try again.");
+     }
    }
  }
```

**Why this works:**
- Customer stays on OnboardingScreen3 (retry path is clear)
- Loading state clears so Connect button returns to normal
- Guaranteed toast: if the axios interceptor already showed one (429 / 5xx / network / timeout), `__toastShown` flag prevents duplicates; otherwise our explicit toast fires
- Zero backend changes

### Secondary fix (High, ~1 hr) — Actually disconnect Thirdweb wallet on logout

**File:** `mobile/shared/store/auth.store.ts` — replace dead `if (state.account?.disconnect)` branch

Two implementation options:

**Option A — React context-level disconnect hook:**

Expose a `setDisconnectFn(fn)` setter on the auth store. At the app root (e.g., `_layout.tsx` or top-level provider), register a function that calls Thirdweb's `useDisconnect()`:

```typescript
// In a top-level component with access to Thirdweb hooks:
const { disconnect } = useDisconnect();
const activeWallet = useActiveWallet();
const setDisconnectFn = useAuthStore((s) => s.setDisconnectFn);

useEffect(() => {
  setDisconnectFn(async () => {
    if (activeWallet) await disconnect(activeWallet);
  });
}, [disconnect, activeWallet, setDisconnectFn]);
```

Then logout calls `await get().disconnectFn?.()` before clearing state.

**Option B — Prepend a fresh disconnect to the login flow:**

Simpler: on next login attempt, force disconnect before connect. `OnboardingScreen3.handleWalletSelection` would call `disconnect(currentWallet)` at the start if any wallet is active. Cleaner separation — logout doesn't need to know about Thirdweb state, login just ensures a clean slate.

**Recommend Option B.** Simpler, less coupling, achieves the same end (fresh wallet connection on every login).

### Tertiary cleanup (~15 min) — Remove dead code

Remove the dead `if (state.account?.disconnect)` branch in `mobile/shared/store/auth.store.ts:166-173`. It's been confirmed never-executing; removing it makes the file clearer for future readers and prevents someone from wasting time re-investigating why logout "isn't disconnecting the wallet."

---

## Files to Modify

| File | Change |
|---|---|
| `mobile/shared/hooks/auth/useAuth.ts` | Add toast + clear loading on both silent-failure branches (customer paths at lines 103-105 and 121-123). Import `showError` from the `useAuth` hook's existing `useAppToast` destructure (already imported at line 7). |
| `mobile/feature/onboarding/screens/OnboardingScreen3.tsx` | (Option B only) Before calling Thirdweb `connect()`, disconnect any already-active wallet to ensure a fresh connection. Uses `useDisconnect` + `useActiveWallet` from `thirdweb/react`. |
| `mobile/shared/store/auth.store.ts` | Remove dead `if (state.account?.disconnect)` branch (lines 166-173). |

No backend changes. No new env vars. No Thirdweb configuration changes.

---

## Verification Checklist

### Reproduction (before fix)

- [ ] Login as customer successfully
- [ ] Logout → land on onboarding
- [ ] Tap Connect → complete wallet selection → observe stuck state on OnboardingScreen3 with no navigation. If possible, force a 429 / 5xx by rapid-fire login attempts.
- [ ] Confirm: no navigation, Connect button may re-enable or stay loading depending on exact failure mode

### After Primary fix

- [ ] When `getTokenResult.success` is falsy → toast appears, Connect button is usable for retry
- [ ] When `getTokenMutation` throws for customer → toast appears (or was already shown by interceptor — no duplicate), Connect button is usable for retry
- [ ] Happy-path login (good network, valid response) still navigates to `/customer/tabs/home` without a toast
- [ ] Shop login path unaffected — pending and suspended routing still works

### After Secondary fix (Option B recommended)

- [ ] Logout followed by immediate re-login produces a FRESH Thirdweb wallet connection (not a reused session)
- [ ] Works for Google social login
- [ ] Works for MetaMask
- [ ] Works for WalletConnect
- [ ] Works for Coinbase / Rainbow

### Regression

- [ ] Shop login still routes correctly on success AND on pending/suspended state AND on auth failure
- [ ] The `/register` redirect for non-existent users still works (`useAuth.ts:57-61`)
- [ ] 404 onError path (user not found) still routes to `/register` (`useAuth.ts:130-138`)
- [ ] Customer re-login after app force-close (not logout) works — relies on persisted SecureStore; this fix shouldn't affect that

---

## Notes

- **Why Critical priority:** the user-visible effect is indistinguishable from "the app is broken." A logged-out user who can't log back in will reasonably conclude the app doesn't work. Uninstall + reinstall may be the only workaround if they don't know to retry. This is bad enough to warrant a hotfix deploy, even though the underlying architectural cleanup can wait.
- **Related bugs filed 2026-04-23:**
  - `bug-customer-home-no-wallet-connected-despite-logged-in.md` — same root theme (auth-state split), different symptom
  - `bug-suspended-screen-check-status-missing-wallet-address.md` — same root theme, triggered by the Check Status button on the suspended screen
  - `bug-admin-rate-limited-429-on-shop-management.md` — unrelated but relevant as one of the concrete causes of the `getToken` catch branch firing (429 on prod rate limiter)
- **Cross-refs from earlier closed bugs:**
  - `bug-logout-hangs-for-minutes.md` — noted the dead `state.account?.disconnect` branch as a non-blocking cleanup; this bug elevates that cleanup from "nice to have" to "unblocks a real symptom"
  - `bug-silent-errors-no-user-feedback.md` — earlier fix ensured toasts fire for various error paths in `useConnectWallet`. That fix is in place for OTHER paths but didn't cover the `getToken` silent branches that are the focus of THIS bug.
- **User impact distribution:** not every user hits this. Happy-path customers logging in on a clean install work fine. The failure mode requires either (a) a previous logout that leaves Thirdweb's wallet state inconsistent, (b) a 429 from rate-limited `/auth/token`, (c) a 5xx / network failure at an unlucky moment, or (d) an older install with stale SecureStore state. But the first group is large (anyone who ever logs out on this app) so the fix is broadly beneficial.
- **Evidence captured 2026-04-23:** screenshot of OnboardingScreen3 post-logout post-relogin stuck state at `C:\dev\sc2.png`. APK build: `application-b55a97f0-dbe0-43f3-8892-70aaf1155f7a.apk`. Both local to operator, not committed.
- **After shipping, add observability:** a one-time `console.warn` breadcrumb in each of the two silent branches (before the new toast) makes future occurrences visible in logs. Helps gauge frequency and identify specific status codes / error shapes to handle more gracefully.

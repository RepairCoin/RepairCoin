# Bug: Shop Suspended Screen "Check Status" Button Errors with "Missing wallet address"

**Status:** Open
**Priority:** Medium
**Est. Effort:** 1-2 hrs
**Created:** 2026-04-23
**Updated:** 2026-04-23

---

## Problem / Goal

On the mobile Shop Suspended screen, tapping the "Check Status" button shows the error toast: **"Missing wallet address. Please log out and try again."** instead of re-checking the shop's suspension status against the backend.

The error message is intentional defensive copy — it directs the user to log out and re-login, which is a workaround. But this defensive path should NOT fire on a legitimate user session; it's a fail-safe for edge cases. The bug is that a valid user on the suspended screen is hitting the fail-safe.

---

## Analysis

### Where the error fires

`mobile/feature/register/hooks/ui/useShopSuspended.ts:20-26`:

```typescript
const handleCheckStatus = useCallback(async () => {
  if (isChecking) return;
  const address = userProfile?.walletAddress || userProfile?.address;
  if (!address) {
    showError("Missing wallet address. Please log out and try again.");
    return;
  }
  // ... proceed to call authApi.checkUserExists(address)
```

The guard reads `userProfile.walletAddress || userProfile.address` from the Zustand auth store. If both are falsy, the error fires before the API call is made.

### Expected state of userProfile on the suspended screen

When a shop user reaches `/register/suspended`, `userProfile` should be populated via one of two code paths:

1. **Fresh login via `useConnectWallet.onSuccess`** (`mobile/shared/hooks/auth/useAuth.ts:67-82`): calls `setUserProfile(result.user)` with the response from `/auth/check-user`. The backend's shop response at `backend/src/routes/auth.ts:464-527` (wallet-first) and `backend/src/routes/auth.ts:564-629` (email-fallback) BOTH return `address` and `walletAddress` populated. So fresh login should always populate these.

2. **Splash navigation from persisted store** (`mobile/shared/hooks/auth/useAuth.ts:154-204`): reads `userProfile` from Zustand persist (SecureStore-backed). If the previously-persisted profile had these fields, they should hydrate intact.

Either path should leave `walletAddress` / `address` populated. The fact that they're missing means something produced a stale/partial profile.

### Likely root causes (needs investigation)

1. **Stale mobile build.** The user is testing a built APK. If the build predates any fix that properly populates these fields, the persisted profile may not have them. Verify the build's commit matches the latest code.

2. **Mid-registration transition state.** If the user was in the middle of shop registration when they got suspended (edge case), their profile may have been stored before `walletAddress` was set. Possible via registration-interrupted-by-admin-action path.

3. **setUserProfile called elsewhere with an incomplete object.** Search for every call site that sets the profile and confirm they always include wallet fields. Offending call sites, if any, would need to be patched to preserve existing wallet data.

4. **Persist migration / schema drift.** If the persist config once stored a leaner profile and the code now expects richer fields, old installs could have stale data. Possible if the suspended-screen fix landed after some users already had a persisted profile.

5. **Backend returning null wallet fields for this specific shop.** Less likely, but worth ruling out — inspect the DB directly for the test shop's `wallet_address` column.

---

## Why Medium priority (not High)

- The error copy itself provides the workaround: "Please log out and try again." Users ARE directed to the fix path.
- Logging out and logging back in forces a fresh `/auth/check-user` call, which should return a properly populated profile per the backend code.
- The suspended screen already works for the main case (viewing the reason) — only Check Status is affected.
- The Logout button on the same screen works correctly and provides the exact remediation.

**But still worth fixing** because:
- Defensive copy shouldn't fire on legitimate user flows; doing so erodes trust in the tooling.
- An admin monitoring support tickets may get complaints from suspended shops whose Check Status "doesn't work" — time sink to diagnose.
- Once the root cause is found, the fix is likely small (populate missing field, fix a single call site, or add a fresh re-fetch).

---

## Implementation

### Step 1 — Reproduce with instrumentation

Add temporary debug logging to `useShopSuspended.ts:22` to capture `userProfile` contents when the error fires:

```typescript
if (!address) {
  console.warn("[useShopSuspended] userProfile on suspended screen:", JSON.stringify(userProfile));
  showError("Missing wallet address. Please log out and try again.");
  return;
}
```

Reproduce the bug, capture the log from a dev build or Reactotron session. Determines which keys ARE present → points at which code path populated this profile.

### Step 2 — Confirm the build vs code lineage

- Check the git commit the tested APK was built from.
- Compare against the current `deo/dev` / `main` branches — specifically, is commit `d1335518` (the original suspended-screen fix) and any later wallet-related commits included?
- If the build is stale, rebuild from current code and re-test before investigating further.

### Step 3 — Based on Step 1 findings, patch either:

**Option A — Make Check Status self-healing (simplest fix).**
If `walletAddress`/`address` is missing, try to recover from other sources before showing the error:

```typescript
const handleCheckStatus = useCallback(async () => {
  if (isChecking) return;

  // Primary: try userProfile
  let address = userProfile?.walletAddress || userProfile?.address;

  // Fallback 1: try the connected thirdweb account (store.account)
  if (!address) {
    const account = useAuthStore.getState().account;
    address = account?.address;
  }

  if (!address) {
    showError("Missing wallet address. Please log out and try again.");
    return;
  }
  // ... rest unchanged
```

**Pros:** makes Check Status more resilient to stale profile state. Zero backend changes.
**Cons:** papers over the root cause; the underlying data issue remains.

**Option B — Fix the code path that populates an incomplete profile.**
Requires Step 1 to identify which setUserProfile caller is missing wallet fields, then patch that caller.

**Pros:** root-cause fix; profile stays consistent.
**Cons:** more investigation required.

### Step 4 — Defensive improvement regardless of root cause

Update the error copy to be more informative and offer a retry path:

```typescript
showError("Couldn't read your shop wallet. Please try Logout below and log in again.");
```

Or better — automatically log the user out and redirect to `/onboarding1` rather than leaving them stranded on the suspended screen. Mirrors the current "Logout" button behavior but happens in one step:

```typescript
if (!address) {
  console.warn("[useShopSuspended] Missing wallet — forcing logout");
  await logout();
  return;
}
```

(Call logout instead of showing a toast. User lands on onboarding1 → re-connects → flows through normal suspended-screen logic with a properly populated profile.)

---

## Verification Checklist

### After investigation (Step 1 + Step 2)

- [ ] Captured JSON contents of `userProfile` when the error fires — confirm which fields ARE present
- [ ] Confirmed the tested build's git commit and whether it includes suspension-screen fixes (commit `d1335518` + any later suspension-related commits)

### After fix (whichever path applies)

- [ ] Tap "Check Status" on Suspended screen → no error toast, backend is called
- [ ] If shop is still suspended → toast says "Status checked — your shop is still suspended"
- [ ] If shop was unsuspended → routes back to `/shop/tabs/home` with success toast
- [ ] Works on MetaMask login
- [ ] Works on social login (Google — goes through backend email-fallback path)
- [ ] Does not regress the Logout button on the same screen

### Long-term

- [ ] Defensive debug log (Step 1) removed before merging
- [ ] If Option A (self-healing) chosen, also file the underlying populate-path issue as a separate follow-up for later root-cause fix

---

## Notes

- **Screenshot evidence:** `C:\dev\sc1.png` at time of testing, showing the red toast "Missing wallet address. Please log out and try again." over the Shop Suspended screen. Not committed to repo — local only.
- **Workaround available:** Tap Logout (the button directly below Check Status) → reconnect → suspended screen reloads with a fresh profile → Check Status works. User isn't stuck.
- **Related work:**
  - Parent suspension-routing fix: commit `d1335518` (mobile: route suspended shops to a dedicated Shop Suspended screen). Added `ShopSuspendedScreen.tsx` and `useShopSuspended.ts`.
  - The defensive "Missing wallet address" guard was introduced alongside that fix — see line 22-26 of `useShopSuspended.ts`.
  - Real-time delivery follow-up: `mobile/docs/tasks/bugs/22-04-2026/bug-mobile-no-realtime-suspension-detection.md` (different scope, tracks instant push-notification delivery; not related to this bug).
- **Hybrid auth reminder:** per today's investigations, the web auth is hybrid (cookies + localStorage) and mobile auth uses SecureStore for persistence. This bug is mobile-only — SecureStore contents for the tested device hold whatever profile was persisted there. A full uninstall + reinstall of the APK would wipe SecureStore and give a clean re-login — useful as a nuclear workaround during investigation but not a long-term fix.

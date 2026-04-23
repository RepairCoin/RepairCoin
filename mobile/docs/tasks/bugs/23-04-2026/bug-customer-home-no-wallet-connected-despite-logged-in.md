# Bug: Customer Home Shows "No wallet connected" Despite Successful Login

**Status:** Open
**Priority:** Medium
**Est. Effort:** 30 minutes
**Created:** 2026-04-23
**Updated:** 2026-04-23

---

## Problem / Goal

On the customer home tab, the main content area shows **"No wallet connected"** even though the user is clearly logged in — the header greeting ("Hello!"), navigation tabs, and notification bell are all visible and functional. The balance card, quick actions, trending services, and recently-viewed sections never render.

**Behavior: transient.** Reproduced on FIRST attempt after fresh install of the Khalid APK; resolved itself on second attempt after re-connecting / re-logging in. One re-login is sufficient workaround — this is not a permanent block. Users are NOT stuck forever; the misleading error message just makes it LOOK permanent on first hit.

Users in this state can navigate to other tabs (History, Services, Find Shop, Account) but the primary Home view is unusable until they re-authenticate. No error toast, no retry CTA, no "please reconnect" hint — just the stuck message.

Observed in the Khalid APK build `application-b55a97f0-dbe0-43f3-8892-70aaf1155f7a.apk` (distributed 2026-04-23). Screenshot at `C:\dev\sc1.png` (local to operator, not committed). Reproduced as customer role on a real device.

Side note: this build correctly resolves the related trending-services 500 bug (task doc `bug-trending-services-500-server-error-toast.md`) — the user explicitly confirmed that error is no longer showing. This new "No wallet connected" bug is latent (always existed) but was masked by the trending 500 error because the error toast would surface first. With the 500 fixed, the content-area `!account` guard becomes visible.

---

## Analysis

### Where the text renders

`mobile/feature/home/components/customer-wallet/index.tsx:177-183` — the Customer Wallet tab's early-return guard:

```typescript
const { account } = useAuthStore();
// ...
if (!account) {
  return (
    <View className="flex-1 justify-center items-center mt-20">
      <Text className="text-white text-lg">No wallet connected</Text>
    </View>
  );
}
```

When `account` is null/undefined in the Zustand auth store, this guard renders the error and blocks the rest of the screen.

### Why `account` can be null while the user is authenticated

The auth store has **multiple fields that represent authentication state**:
- `account` — plain object `{ address, email }` set ONLY during `useConnectWallet.mutationFn` at `mobile/shared/hooks/auth/useAuth.ts:51` (the active login flow)
- `userProfile` — backend response from `/auth/check-user`, set by `setUserProfile` in multiple code paths
- `accessToken`, `refreshToken`, `userType`, `isAuthenticated` — set by `useConnectWallet.onSuccess`

**Splash navigation** at `mobile/shared/hooks/auth/useAuth.ts:173` ONLY checks `isAuthenticated && userProfile?.address && accessToken`. It does NOT validate that `account` is also present. So a user with stale persistence that has userProfile + accessToken but MISSING `account` is navigated to `/customer/tabs/home` — and lands on the "No wallet connected" screen.

### How a user can end up in this state

Three concrete scenarios — all consistent with the transient "first attempt fails, second attempt works" symptom:

1. **Upgrade from an older build that didn't persist `account`.** If a previous version of the app had a bug in the `partialize` config (e.g., `account` not in the list), that user's SecureStore would hold `userProfile + accessToken` but not `account`. Installing the new APK on top rehydrates the incomplete state. **On re-login, `setAccount` fires fresh** and the stuck state resolves — matches observed behavior.

2. **Persistence serialization failure from an older build.** If at some point `account` held a Thirdweb-native object with methods (functions don't serialize to JSON), SecureStore would persist the object minus its methods, and depending on subsequent shape checks could end up null after rehydration. Verified this isn't happening today (`setAccount` is always called with `{ address, email }` — a plain JSON-safe object), but legacy installs may have carried forward a bad persisted shape from an earlier version. **Re-login overwrites the bad shape with a clean `{ address, email }`** — consistent with the second-attempt-works observation.

3. **Partial write from an interrupted prior session.** If the app was killed while SecureStore writes for the persist middleware were in flight, `account` might be missing even though other fields made it through. Related to the logout-hangs-for-minutes bug we just closed — if anyone was ever in that hung-logout state, partial writes are plausible. **Re-login resolves it** because the connect-wallet flow sets `account` synchronously at mutation start.

The common thread: **the screen requires `account` specifically, but several other auth fields are sufficient to convince splash navigation the user is logged in.** Re-login is sufficient workaround because it always sets `account` fresh via `useConnectWallet.mutationFn`.

### Why the retry fixes it

`useConnectWallet.mutationFn` at `mobile/shared/hooks/auth/useAuth.ts:51` synchronously calls `setAccount({ address, email })` BEFORE any async work. So once the user goes through the connect-wallet flow a second time, `account` is guaranteed to be populated. After that, subsequent re-opens of the app work because the now-complete auth state persists correctly.

This explains why:
- First attempt after fresh install of this APK → hit the stuck state (stale hydration)
- Second attempt → worked (re-login repaired the persisted state)
- Going forward → user never sees this again on this install

### Same pattern in shop-wallet (not currently broken for shops)

`mobile/feature/home/components/shop-wallet/index.tsx:47-53` has an identical guard. Shops currently work because the shop dashboard flow populates `account` via a different code path and/or users aren't re-opening with stale state. But the same vulnerability exists.

---

## Implementation

### Option A — Fall back to `userProfile.walletAddress` (recommended)

Decouple the screen from requiring `account` specifically. The screen needs ONE thing: a wallet address to pass to `useGetCustomerByWalletAddress`. That address can come from either `account.address` or `userProfile.walletAddress`.

**File:** `mobile/feature/home/components/customer-wallet/index.tsx`

```diff
- const { account } = useAuthStore();
+ const { account, userProfile } = useAuthStore();
+ const walletAddress = account?.address || userProfile?.walletAddress;

  // ...

- } = useGetCustomerByWalletAddress(account?.address);
+ } = useGetCustomerByWalletAddress(walletAddress);

  // ...

- if (!account) {
+ if (!walletAddress) {
    return (
      <View className="flex-1 justify-center items-center mt-20">
        <Text className="text-white text-lg">No wallet connected</Text>
      </View>
    );
  }

  // Update the mint mutation too:
- return apiClient.post(`/customers/balance/${account?.address}/instant-mint`, { amount });
+ return apiClient.post(`/customers/balance/${walletAddress}/instant-mint`, { amount });
```

Apply the same fix to `mobile/feature/home/components/shop-wallet/index.tsx:47-53` for consistency.

**Pros:** surgical, low risk, fixes the observed symptom immediately. Doesn't require auth-store refactor.
**Cons:** doesn't address the underlying "why is `account` null" question — just routes around it. Fine as a user-facing fix; the root cause deserves a separate follow-up investigation.

### Option B — Auto-populate `account` during splash hydration

Add a self-heal step in the splash navigation hook: if `isAuthenticated && userProfile?.walletAddress && !account`, call `setAccount({ address: userProfile.walletAddress, email: userProfile.email })` to reconstruct the missing `account` from `userProfile`.

**File:** `mobile/shared/hooks/auth/useAuth.ts` — inside `useSplashNavigation`, before the route decisions:

```typescript
const setAccount = useAuthStore((state) => state.setAccount);

const navigate = async () => {
  if (!hasHydrated) return;

  // Self-heal: if userProfile is present but account is missing, reconstruct account
  if (isAuthenticated && userProfile?.walletAddress && !account) {
    console.warn("[Auth] Rehydrated with missing account — reconstructing from userProfile");
    setAccount({
      address: userProfile.walletAddress,
      email: userProfile.email,
    });
  }

  // ... rest of navigate logic
};
```

**Pros:** fixes the root cause for splash-based entry. Any screen checking `account` would now work.
**Cons:** only runs on splash path. If `account` somehow becomes null mid-session, the user still gets stuck until they restart the app. Doesn't help screens that check `account` AND the user enters via a non-splash path.

### Option C — Both A + B (most defensive)

Apply Option A as the immediate user-facing fix AND Option B for the underlying resilience. Safest choice — the screen gracefully degrades regardless of auth-store state, and the auth store self-heals when it can.

**Recommendation:** ship Option C. Option A unblocks users today; Option B prevents future stuck states.

### Post-fix root-cause investigation (separate follow-up)

After shipping the fix, add a one-time telemetry breadcrumb when Option B's self-heal fires, to understand HOW FREQUENTLY users end up in this state. If it's common, trace back to the persistence layer; if it's rare, the self-heal is sufficient and no further work needed.

```typescript
if (isAuthenticated && userProfile?.walletAddress && !account) {
  console.warn("[Auth-telemetry] account-missing-self-heal", {
    userType,
    hasUserProfile: !!userProfile,
    hasAccessToken: !!accessToken,
  });
  // ... setAccount
}
```

Log retention in the APK is limited, so use console.warn and consider wiring into existing error-tracking if the team has one.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/home/components/customer-wallet/index.tsx` | Option A — derive `walletAddress` from `account?.address \|\| userProfile?.walletAddress`, use it in useGetCustomerByWalletAddress + mint mutation + guard |
| `mobile/feature/home/components/shop-wallet/index.tsx` | Same Option A pattern applied to the shop-wallet guard (preemptive — shop side isn't broken today but same vulnerability exists) |
| `mobile/shared/hooks/auth/useAuth.ts` | Option B — add self-heal block in `useSplashNavigation.navigate` before route decisions |

No backend changes. No auth store API changes.

---

## Verification Checklist

### Reproduction

- [ ] Obtain the Khalid APK build `application-b55a97f0-...apk` or reproduce the stuck state another way (e.g., manually set `account: null` in SecureStore via a dev helper while other fields stay populated).
- [ ] Confirm the exact error: "No wallet connected" text on customer home tab while other tabs and header elements are visible.
- [ ] Check auth-store state via Flipper/dev tools: `account === null`, `userProfile !== null`, `accessToken !== null`, `isAuthenticated === true`. This confirms the specific bug state.

### After Option A + B fix

- [ ] Customer home renders balance card, quick actions, and service sections after login (happy path)
- [ ] With manually nulled `account` but preserved userProfile, customer home STILL renders correctly (fallback to userProfile.walletAddress works)
- [ ] Self-heal on splash fires when `account` is missing but userProfile is present — console warn visible
- [ ] Shop home also renders correctly in both normal and stuck states (preemptive fix)
- [ ] Mint RCN flow works (uses the unified walletAddress for the POST body)
- [ ] QR code / gift token / tier info / redeem quick-actions still navigate correctly (none of them read `account` directly from this component, so they should be unaffected)
- [ ] Customer entity ID / customer data fetches work (uses walletAddress to query backend)
- [ ] No regression for fresh login via MetaMask OR social login — both paths set `account` correctly and the fallback never fires
- [ ] Log out → log back in → customer home renders → account state is populated normally via the connect-wallet flow

### Regression

- [ ] Shop dashboard still works correctly (ShopWalletTab receives shopData prop from parent, not the auth store directly — but the guard fix shouldn't affect that flow)
- [ ] Navigation: Home → History → back to Home doesn't break; account/userProfile persist across tab switches
- [ ] Backgrounding the app and returning doesn't re-trigger the "No wallet connected" state

---

## Notes

- **Trending-services fix is confirmed working:** the user tested the APK and did NOT see the 500-error toast that was the subject of `bug-trending-services-500-server-error-toast.md`. That bug is fully resolved. This new bug surfaced AFTER that fix was applied, on the same screen — the customer home that was previously hitting 500 errors is now hitting this different issue.
- **Related:** the logout-hangs-for-minutes bug (just closed 2026-04-23) may have contributed to a corrupted auth state for some users — if anyone's app was ever in the hung-logout state, partial writes to SecureStore could have left inconsistent persistence. Option B's self-heal covers this too.
- **Not a regression from the trending fix:** Khalid's commit `802d29fb fix(backend): add missing s.shop_id to GROUP BY in trending services query` only touches backend SQL. The customer-wallet guard has been in place since `09c74fa9 feat(mobile): add mint RCN to wallet and wallet balance card` (weeks earlier). The bug was there; the trending 500 just masked it — users were seeing the "Server error" toast and not the content-area message because queries were failing before the `!account` guard became visible. Fixing trending reveals this latent issue.
- **Screenshot evidence stored locally at `C:\dev\sc1.png`** on the operator's machine; not committed (per convention).
- **APK hash:** `application-b55a97f0-dbe0-43f3-8892-70aaf1155f7a.apk` — record for reproducibility. If the team needs to determine which commit this was built from, check the EAS build artifact metadata.

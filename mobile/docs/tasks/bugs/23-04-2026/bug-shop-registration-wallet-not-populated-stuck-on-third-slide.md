# Bug: Shop registration stuck on ThirdSlide — Connected Wallet empty, Continue button silently disabled

**Status:** In Progress
**Priority:** Critical
**Est. Effort:** 20-30 minutes (defensive) + 15-20 minutes (recovery, pending)
**Created:** 2026-04-23
**Updated:** 2026-04-23

---

## Problem / Goal

On the FixFlow mobile Shop Registration flow (multi-slide: `FirstSlide` → `SecondSlide` → `ThirdSlide` → `SocialMediaSlide` → `FourthSlide`), users are stuck on **ThirdSlide (Location & Wallet)**. The **Connected Wallet** field shows its placeholder *"Connect wallet to continue"* and the **Continue** button is disabled (grayed yellow). There is no error toast, no helper hint, no retry path — the button just refuses to advance the wizard.

Evidence: `c:\dev\sc4.png` — ThirdSlide with location filled (Dito lang sa malapit / SM City / Pelepens / 15.294988, 120.941337), wallet empty, Continue disabled.

This is the same root cause as `bug-customer-registration-wallet-not-populated-generic-error.md` (filed today) — `account === null` in the Zustand auth store at the time the screen reads it — but the shop flow surfaces a *different* user-visible symptom.

### Why Critical

New shop sign-ups are the revenue entry point ($500/month Stripe subscription). A prospective shop owner who fills in their address and pin and then can't advance past ThirdSlide has zero information to recover: no toast explaining the wallet is missing, no CTA to reconnect, no fallback path. They either bounce or contact support. Ship-blocker for shop acquisition.

---

## Analysis

### Same root cause as customer registration, different expression

Both registration flows read the wallet address from `useAuthStore((s) => s.account)`. When `account === null` (see sibling customer-registration bug for the three scenarios that produce this state), both screens break — but in different ways.

| Aspect | Customer Register (`bug-customer-registration-wallet-not-populated-generic-error.md`) | Shop Register (this bug) |
|---|---|---|
| Root | `account === null` in Zustand auth store | Same — `account === null` |
| Wallet value source | `account.address` directly in hook | `account?.address` passed via `address` prop to `ThirdSlide` |
| Form gating | **Broken** — `isFormValid` does NOT require wallet; Create Account is tappable | **Gated** — `isFormValid` requires `address && isValidEthAddress(address)`; Continue stays disabled |
| Outcome on tap | Submits → line 52 `account.address` throws TypeError → bare catch → lying network toast | User can't tap — button disabled with no explanation |
| User's mental model | "The network is broken" (wrong) | "I filled everything, why doesn't this work?" (no feedback to answer) |
| Path to submit | Customer mutation runs (and crashes) | Never reaches FourthSlide submit path |

### Where the gating happens (on ThirdSlide)

**`mobile/feature/register/components/ThirdSlide.tsx:49-65`:**
```typescript
const isFormValid = useMemo(() => {
  return (
    hasMinLength(formData.address, 3) &&
    hasMinLength(formData.city, 2) &&
    hasMinLength(formData.country, 2) &&
    address &&                                 // ← wallet address prop
    isValidEthAddress(address) &&              // ← must be valid 0x...
    (formData.reimbursementAddress.trim() === "" ||
      isValidEthAddress(formData.reimbursementAddress.trim()))
  );
}, [...]);
```

Line 179-183:
```tsx
<PrimaryButton
  title="Continue"
  onPress={validateAndProceed}
  disabled={!isFormValid}
/>
```

And line 143:
```tsx
value={address || "Connect wallet to continue"}
```

The `address` prop is `account?.address` — passed from `ShopRegisterScreen.tsx:43`:
```tsx
{item.key === "3" && (
  <ThirdSlide {...slideProps} address={account?.address} />
)}
```

When `account` is null, `account?.address` is `undefined`. `isFormValid` short-circuits on `address &&`. Button disabled.

### What happens if the user DID reach FourthSlide submit

The same TypeError bug exists in the shop submit hook — it just isn't reachable from ThirdSlide when `account` is null:

**`mobile/feature/register/hooks/ui/useShopRegister.ts:70-95`:**
```typescript
const handleSubmit = useCallback(() => {
  if (isSubmitting) return;

  setIsSubmitting(true);

  try {
    const submissionData = {
      ...formData,
      website: normalizeUrl(formData.website),
      facebook: normalizeUrl(formData.facebook),
      instagram: normalizeUrl(formData.instagram),
      twitter: normalizeUrl(formData.twitter),
      walletAddress: account.address,            // ← line 82: same null-deref bug
    };

    registerShop(submissionData, {
      onSettled: () => setIsSubmitting(false),
    });
  } catch (error) {
    console.error("Registration error:", error);
    showError(
      "Unable to complete registration. Please check your connection and try again.",
    );                                           // ← same misleading toast
    setIsSubmitting(false);
  }
}, [formData, account, registerShop, showError, isSubmitting]);
```

Identical shape to `useCustomerRegister.ts:35-65`. The same fix (optional chaining + explicit guard + remove broad catch) applies.

### Why the silent-disabled-Continue UX is arguably worse than the customer symptom

- Customer side: bad but *actionable* in principle — the user sees an error and would try again (even if the message lies).
- Shop side: **no signal at all**. User re-reads their address, city, country — everything looks right — and has no mental model for what's broken. Support tickets from shops saying "your app is broken" with no context are hard to diagnose.

---

## Implementation

> **Status note (2026-04-23, post-Khalid commit `5db89b6b`):** The **Defensive Fix** shipped — `useShopRegister.handleSubmit` guards null account and the TypeError path is eliminated. But the **same shortcoming as customer-registration applies here**: the shop user reaches ThirdSlide, Continue stays disabled because `account?.address` is still null at Zustand level, and there's no recovery path on the screen. The **Recovery Fix** below resolves this using the same `useActiveAccount()` fallback pattern — a fresh shop owner's Thirdweb wallet is alive and reachable, so we read from it directly. The goal is end-to-end: *shop owner connects wallet, fills location + social + review slides, taps Submit, shop application created.* If they stall on ThirdSlide they never get there. Both the defensive and recovery fixes must land for this bug to close.

### Defensive fix (shipped in commit `5db89b6b`) — Surface the real reason Continue is disabled

**File:** `mobile/feature/register/components/ThirdSlide.tsx`

Show an inline helper message on the Connected Wallet field when `address` is missing. Keep the gating as-is (correctly prevents TypeError), but tell the user what's wrong:

```diff
         <FormInput
           label="Connected Wallet"
           icon={<Ionicons name="wallet-outline" size={20} color="#666" />}
-          value={address || "Connect wallet to continue"}
+          value={address ?? ""}
           onChangeText={() => {}}
-          placeholder="Wallet address"
+          placeholder="Connect wallet to continue"
           editable={false}
-          helperText="Used for shop operations and token management"
+          helperText={
+            address
+              ? "Used for shop operations and token management"
+              : "Wallet not connected — return to the welcome screen and reconnect to continue shop registration."
+          }
+          error={!address}
         />
```

If `FormInput` doesn't support an `error` prop, fall back to rendering a small red `<Text>` below it. Verify by reading `mobile/shared/components/ui/FormInput.tsx` before editing.

### Recovery fix (Critical, PENDING, ~15-20 min) — let the shop actually continue past ThirdSlide

**Why this is needed:** the defensive fix correctly gates Continue on `address && isValidEthAddress(address)`, which prevents the TypeError path — but it doesn't populate `address`. A fresh shop owner who hit the Zustand-null state (hydration race on cold start, Google-login timing, dev Fast Refresh) reaches ThirdSlide, fills in location, pins the map, and then stares at a greyed-out Continue button with no CTA. Same architectural story as the customer-registration bug, same fix pattern.

**Source of truth chain (same as customer side):**
1. Thirdweb's `useActiveAccount()` — live wallet session, kept alive by `WalletAutoConnect` in `mobile/app/_layout.tsx`. Most reliable.
2. Zustand `account` — cache mirror; may drift.
3. `userProfile.walletAddress` — not available to fresh registrants.

**File:** `mobile/feature/register/hooks/ui/useShopRegister.ts`

```diff
 import { useCallback, useEffect, useMemo, useRef, useState } from "react";
 import {
   FlatList,
   NativeSyntheticEvent,
   NativeScrollEvent,
   Dimensions,
 } from "react-native";
 import { goBack } from "expo-router/build/global-state/routing";
+import { useActiveAccount } from "thirdweb/react";
 import { useAuthStore } from "@/shared/store/auth.store";
 import { useAppToast } from "@/shared/hooks";
 import { useShop } from "@/shared/hooks/shop/useShop";
 import { ShopFormData, Slide } from "../../types";
 import { INITIAL_SHOP_FORM_DATA, SHOP_REGISTER_SLIDES } from "../../constants";
 import { normalizeUrl } from "../../utils";

 const { width } = Dimensions.get("window");

 // ...

 export const useShopRegister = () => {
-  const account = useAuthStore((state) => state.account);
+  const storeAccount = useAuthStore((state) => state.account);
+  const setAccount = useAuthStore((state) => state.setAccount);
+  const activeAccount = useActiveAccount();
+
+  const account = useMemo(() => {
+    if (storeAccount?.address) return storeAccount;
+    if (activeAccount?.address) {
+      return { address: activeAccount.address, email: storeAccount?.email };
+    }
+    return null;
+  }, [storeAccount, activeAccount?.address]);
+
+  useEffect(() => {
+    if (!storeAccount?.address && activeAccount?.address) {
+      console.warn(
+        "[useShopRegister] Self-healing: Zustand account null but Thirdweb active — syncing",
+      );
+      setAccount({
+        address: activeAccount.address,
+        email: storeAccount?.email,
+      });
+    }
+  }, [storeAccount?.address, activeAccount?.address, setAccount, storeAccount?.email]);
+
   const { useRegisterShop } = useShop();
   const { mutate: registerShop, isPending: isRegistering } = useRegisterShop();
   const { showError } = useAppToast();
```

Because `useShopRegister` already `return { ... account }` and `ShopRegisterScreen.tsx:43` passes `address={account?.address}` to ThirdSlide, the existing wiring picks up the derived account **with no screen-level changes**. ThirdSlide's `isFormValid` (at `ThirdSlide.tsx:49-65`) becomes true once the address comes through from Thirdweb, the FormInput displays the real wallet address (`ThirdSlide.tsx:143`), and Continue enables.

**Result after this fix:**
- Fresh Google-login shop owner lands on ThirdSlide → Zustand's `account` is null but Thirdweb's `activeAccount` has the wallet → hook returns `{address: <thirdweb>, email: undefined}` → ThirdSlide's Connected Wallet field populates → `isFormValid` becomes true once location fields are filled → Continue enables → flow proceeds through SocialMediaSlide → FourthSlide → submit completes.
- Zustand store is healed as a side effect.
- No regression for shops whose Zustand `account` is already populated — the storeAccount branch wins the ternary.

**Edge cases:** identical to customer-registration case (see that doc's matching section). Thirdweb also null → graceful failure via defensive guard; email missing for Google login → user's own typed form value wins; concurrent self-heal → Zustand tolerates idempotent sets.

### Tertiary fix (shipped in commit `5db89b6b`) — TypeError guard on submit

Even though ThirdSlide's gating prevents today's user from reaching the crash path, the bug exists and any future change to gating (or a race) could expose it. Apply the same shape of fix we're using for customer registration.

**File:** `mobile/feature/register/hooks/ui/useShopRegister.ts`

```diff
   const handleSubmit = useCallback(() => {
     if (isSubmitting) return;

+    if (!account?.address) {
+      showError("Wallet not connected. Please return to the welcome screen and connect your wallet.");
+      return;
+    }
+
     setIsSubmitting(true);

-    try {
-      const submissionData = {
-        ...formData,
-        website: normalizeUrl(formData.website),
-        facebook: normalizeUrl(formData.facebook),
-        instagram: normalizeUrl(formData.instagram),
-        twitter: normalizeUrl(formData.twitter),
-        walletAddress: account.address,
-      };
-
-      registerShop(submissionData, {
-        onSettled: () => setIsSubmitting(false),
-      });
-    } catch (error) {
-      console.error("Registration error:", error);
-      showError(
-        "Unable to complete registration. Please check your connection and try again.",
-      );
-      setIsSubmitting(false);
-    }
+    const submissionData = {
+      ...formData,
+      website: normalizeUrl(formData.website),
+      facebook: normalizeUrl(formData.facebook),
+      instagram: normalizeUrl(formData.instagram),
+      twitter: normalizeUrl(formData.twitter),
+      walletAddress: account.address,
+    };
+
+    registerShop(submissionData, {
+      onSettled: () => setIsSubmitting(false),
+    });
   }, [formData, account, registerShop, showError, isSubmitting]);
```

Same rationale as the customer fix: `registerShop` is the `mutate` function from React Query (not `mutateAsync`), so it can't throw synchronously. The broad `try/catch` was only ever catching the TypeError on `account.address`. Remove it — let the mutation's own `onError` surface real backend errors.

**Confirm before shipping:** check `useShop().useRegisterShop()` has an `onError` handler that extracts `error.response.data.error` (mirroring `useCustomer.ts:97-105`). If it doesn't, add one there — but keep that as a separate follow-up if it complicates this PR.

### Follow-up (out of scope — shared with customer bug)

Same cross-reference as the customer task: the sibling `bug-customer-home-no-wallet-connected-despite-logged-in.md` proposes a splash-time self-heal (`setAccount` from `userProfile.walletAddress` if `userProfile` is present but `account` is null). That self-heal does NOT apply to registration flows (no `userProfile` yet) — fresh users still need the fix in this task. But it does reduce the frequency of returning-user desync that can fuel this bug.

---

## Files to Modify

| File | Change | Status |
|---|---|---|
| `mobile/feature/register/hooks/ui/useShopRegister.ts` | **Defensive:** add explicit wallet guard before submit; remove broad `try/catch`; use optional chaining on `account.address`. | ✅ Shipped (5db89b6b) |
| `mobile/feature/register/hooks/ui/useShopRegister.ts` | **Recovery:** import `useActiveAccount`; derive effective `account` via fallback chain; `useEffect` self-heal. | ⏳ Pending |
| `mobile/feature/register/components/ThirdSlide.tsx` | (Helper) inline red error message when `address` is missing; use `placeholder` prop instead of `value` fallback. | ⏳ Pending |
| `mobile/shared/components/ui/FormInput.tsx` | (Optional) add an `error` prop if not present — else use a `<Text>` block in ThirdSlide. | ⏳ Pending |

No backend changes. No shared-store changes.

---

## Verification Checklist

### Reproduction (before any fix)

- [x] Reproduced on 2026-04-23 (sc4.png): fresh shop flow, ThirdSlide with street/city/country/pin filled, Connected Wallet showed placeholder, Continue visibly disabled with no feedback.

### After defensive fix only (5db89b6b — current state)

- [x] Continue button is correctly disabled when `address` is falsy — no TypeError, no lying toast.
- [❌] **Shop owner cannot advance past ThirdSlide** — wallet field remains empty, Continue remains disabled, no helper text or recovery CTA. Bug not truly fixed. This is the gap the Recovery fix addresses.

### After recovery fix (pending)

- [ ] Fresh Google-login shop owner: Connected Wallet field **auto-populates** with the Thirdweb wallet address on ThirdSlide mount (even if Zustand's `account` is null)
- [ ] Continue enables once street/city/country/pin are filled (no extra action needed for wallet)
- [ ] Flow advances SocialMediaSlide → FourthSlide → Submit succeeds → shop pending or active depending on admin flow
- [ ] Console shows one-time warn `[useShopRegister] Self-healing: Zustand account null but Thirdweb active — syncing` when the self-heal fires
- [ ] Returning user (already-populated Zustand `account`): no regression
- [ ] Server-side submit error shows real backend message; rate-limit / network errors handled by axios interceptor
- [ ] Customer registration fix (`bug-customer-registration-wallet-not-populated-generic-error.md`) lands with the same pattern and the two fixes are confirmed non-conflicting

### Truly-stuck edge case

- [ ] Simulate **both** Zustand and Thirdweb null: Continue stays disabled, ThirdSlide shows inline helper message (pending helper-fix), no TypeError. Same graceful failure as the defensive fix.

### Regression

- [ ] Customer registration flow unaffected (different hook, different screen — but uses the same Zustand selector AND the same recovery pattern)
- [ ] Other shop slides (First, Second, SocialMedia, Fourth) still render with the correct props
- [ ] OnboardingScreen3 → Connect → checkUserExists → `/register` → ChooseRoleScreen → `/register/shop` happy path works end-to-end
- [ ] Pending-approval (`/register/pending`) and Suspended (`/register/suspended`) routing still works after a successful shop registration → admin suspension → login cycle

---

## Notes

- **Relationship to the customer registration bug:** same root, same recovery pattern. Both docs should land their Recovery sections together — the fixes are near-identical (one shares `useActiveAccount` from `thirdweb/react`, one `useMemo` derivation, one `useEffect` self-heal, all applied to their respective hook).
- **Defensive vs Recovery scoping lesson (2026-04-23):** Same lesson as the customer-registration sibling. The original spec scoped only defensive (prevent TypeError, disable Continue). Khalid's implementation was faithful, but live QA (sc4.png) showed shop owners still stuck on ThirdSlide. The Recovery fix section above was added 2026-04-23 post-QA. **"Missing data" bugs need paired Defensive + Recovery fixes — one without the other is incomplete.** Carry this forward.
- **Revenue impact:** shop signups are the paying customer flow ($500/mo subscription). Of the 2026-04-23 bug slate, this one has the most direct revenue linkage. Combined with `bug-customer-registration-wallet-not-populated-generic-error.md`, the two together gate ALL new-user acquisition on mobile — both need Recovery before acquisition is truly unblocked.
- **The `isFormValid` gate was secretly saving us from the TypeError.** If anyone edits ThirdSlide's validation in the future (e.g., makes wallet optional for any reason), the TypeError reappears unless the hook fix lands. Which is why the tertiary-fix hook change isn't cosmetic — it's belt-and-suspenders against future edits.
- **`reimbursementAddress` gap:** `ThirdSlide.tsx:150-160` still lacks `maxLength` (tracked in sibling `bug-shop-registration-uncapped-fields-in-third-fourth-slides.md`). Unrelated to this bug, but a natural bundle if one PR touches ThirdSlide.
- **Evidence stored locally at `c:\dev\sc4.png`** — not committed.
- Commit policy: do not commit changes without explicit approval (per CLAUDE.md + memory `feedback_commit_policy.md`).

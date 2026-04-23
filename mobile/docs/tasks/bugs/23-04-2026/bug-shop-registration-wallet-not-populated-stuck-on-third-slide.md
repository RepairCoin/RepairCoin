# Bug: Shop registration stuck on ThirdSlide — Connected Wallet empty, Continue button silently disabled

**Status:** Open
**Priority:** Critical
**Est. Effort:** 20-30 minutes (shares diff shape with customer-registration bug)
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

### Primary fix (Critical) — Surface the real reason Continue is disabled

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

### Secondary fix (Critical) — Fix the TypeError bug in the submit hook

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

| File | Change |
|---|---|
| `mobile/feature/register/components/ThirdSlide.tsx` | Add inline helper message when `address` is missing; move placeholder from `value` fallback to `placeholder` prop. |
| `mobile/feature/register/hooks/ui/useShopRegister.ts` | Add explicit wallet guard before submit; remove broad `try/catch`; use optional chaining on `account.address`. |
| `mobile/shared/components/ui/FormInput.tsx` | Only if it lacks an `error` prop — add one (minor). If out of scope, use a `<Text>` fallback in ThirdSlide instead. |

No backend changes. No shared-store changes.

---

## Verification Checklist

### Reproduction (before fix)

- [ ] Reach ShopRegisterScreen with `account === null` (e.g., deep link to `/register/shop` without going through OnboardingScreen3 connect, or during hydration window)
- [ ] Fill FirstSlide + SecondSlide, advance to ThirdSlide
- [ ] Fill street address, city, country, pin location
- [ ] Observe Connected Wallet shows "Connect wallet to continue" placeholder, Continue button disabled
- [ ] Confirm nothing happens on tap — no toast, no log

### After fix

- [ ] When `account === null`: Continue stays disabled (unchanged — correct), AND a red helper message is visible under Connected Wallet explaining "Wallet not connected — return to the welcome screen and reconnect…"
- [ ] Happy path: wallet connected → `address` is a valid 0x…, Continue enables, navigation advances to SocialMediaSlide → FourthSlide → submit succeeds
- [ ] Direct test of `handleSubmit` with `account === null` (unit or dev-only) shows the new guard toast, not the lying network toast
- [ ] Server-side submit error (force 400 with duplicate email) shows the real backend error message via the mutation's `onError`, not the generic toast
- [ ] Customer registration fix (`bug-customer-registration-wallet-not-populated-generic-error.md`) lands separately and the two fixes are confirmed non-conflicting

### Regression

- [ ] Customer registration flow unaffected (different hook, different screen — but uses the same Zustand selector)
- [ ] Other shop slides (First, Second, SocialMedia, Fourth) still render with the correct props
- [ ] OnboardingScreen3 → Connect → checkUserExists → `/register` → ChooseRoleScreen → `/register/shop` happy path works end-to-end
- [ ] Pending-approval (`/register/pending`) and Suspended (`/register/suspended`) routing still works after a successful shop registration → admin suspension → login cycle

---

## Notes

- **Relationship to the customer registration bug:** same root, different expression, both fixes ship independently. Customer fix unblocks new customer signups; this fix unblocks new shop signups.
- **Revenue impact:** shop signups are the paying customer flow ($500/mo subscription). Of the five 23-04-2026 bugs, this one has the direct revenue linkage. Combined with `bug-customer-registration-wallet-not-populated-generic-error.md`, the two together gate ALL new-user acquisition on mobile.
- **The `isFormValid` gate was secretly saving us from the TypeError.** If anyone edits ThirdSlide's validation in the future (e.g., makes wallet optional for any reason), the TypeError reappears unless the hook fix lands. Which is why the secondary-fix hook change isn't cosmetic — it's belt-and-suspenders against future edits.
- **`reimbursementAddress` gap:** `ThirdSlide.tsx:150-160` still lacks `maxLength` (tracked in sibling `bug-shop-registration-uncapped-fields-in-third-fourth-slides.md`). Unrelated to this bug, but a natural bundle if one PR touches ThirdSlide.
- **Evidence stored locally at `c:\dev\sc4.png`** — not committed.
- Commit policy: do not commit changes without explicit approval (per CLAUDE.md + memory `feedback_commit_policy.md`).

# Bug: Double-Tap Register Button Shows Error Toast on Dashboard

## Status: 🔄 Re-opened (2026-05-04) — partial fix shipped 2026-05-01 catches fast double-taps but a race window for slow double-taps remains
## Priority: Medium
## Date: 2026-04-15
## Updated: 2026-05-04 — verified fast-double-tap case fixed; reproduced slow-double-tap variant on staging today; root cause is `onSettled: reset` clearing the guard before screen navigation unmounts
## Category: Bug - Registration / UX
## Platform: Mobile (React Native / Expo)
## Affects: Customer registration AND shop registration (both hooks share the same race-window bug)

> **Status note (2026-05-04):** Khalid's `useSubmitGuard` shipped in commit `3a94f7e5` is correctly placed and prevents the original very-fast double-tap (within ~10ms). A different timing variant — slow-double-tap with ~200-500ms between taps — still produces the same symptom because the guard is reset on `onSettled` rather than `onError`, opening a race window between mutation success and navigation completion. See "Updated 2026-05-04" section below for the live reproduction and the proposed one-line fix.

---

## Problem

When a user double-taps the "Create Account" button during customer registration:

1. **First tap**: Registration succeeds, account created in database
2. **Second tap**: Backend rejects with "This email address is already in use"
3. App navigates to the customer dashboard (from first tap's success)
4. Error toast from second tap appears **on top of the dashboard**

The user sees their dashboard with a confusing error message overlaid. No duplicate account is created (backend prevents it), but the UX is broken.

---

## Root Cause (original — superseded by 2026-05-04 race-window finding below)

> **Note (2026-05-04):** Mobile codebase was refactored — `feature/register/` moved to `feature/auth/`, and `shared/hooks/customer/` moved to `feature/profile/customer/hooks/`. Paths below reflect the original (pre-refactor) layout; current paths are listed in the "Updated 2026-05-04" section. The original ROOT CAUSE described here was correct but only partially closed by the shipped fix — a slower-tap variant survives.

**File:** `mobile/feature/register/hooks/ui/useCustomerRegister.ts` (line 46) — *now at `mobile/feature/auth/hooks/useCustomerRegister.ts`*

```typescript
registerCustomer(submissionData);  // mutate() — fire-and-forget, non-blocking
```

`registerCustomer` is `mutate()` (not `mutateAsync()`), so it returns immediately. The button is not disabled between the first and second tap because:

1. `mutate()` fires asynchronously — `isPending` becomes `true` after the first microtask
2. Between the first and second tap (milliseconds), `isPending` may still be `false`
3. Second `mutate()` fires before the first one resolves
4. First succeeds → navigates to dashboard
5. Second fails → error toast shows on the dashboard

**File:** `mobile/shared/hooks/customer/useCustomer.ts` (lines 57-81) — *now at `mobile/feature/profile/customer/hooks/useCustomer.ts`*

The mutation's `onSuccess` navigates to the success screen, while `onError` logs the error. Both run independently — the second tap's error has no way to know the first tap already succeeded.

---

## Why Backend Doesn't Create Duplicates

The backend correctly blocks the second request:

```typescript
// CustomerService.ts line 152-155
const existingCustomer = await customerRepository.getCustomer(data.walletAddress);
if (existingCustomer) {
  throw new Error('This wallet address is already registered as a customer.');
}
```

The first request creates the customer. The second request finds the existing customer and throws. The database is safe — this is purely a frontend UX issue.

---

## Fix Required

### Fix 1: Disable button immediately on tap (Primary fix)

**File:** `mobile/feature/register/hooks/ui/useCustomerRegister.ts`

Add a local `isSubmitting` state that's set `true` synchronously on tap, before `mutate()` fires:

```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

const validateAndSubmit = useCallback(() => {
  if (isSubmitting) return;  // Block double-tap

  const errors = validateCustomerForm(formData.fullName, formData.email);
  if (errors.length > 0) {
    showError(errors.join("\n"));
    return;
  }

  setIsSubmitting(true);  // Disable immediately, synchronously

  const submissionData = {
    ...formData,
    name: formData.fullName,
    referralCode: formData.referral,
    walletAddress: account.address,
  };

  registerCustomer(submissionData, {
    onSettled: () => setIsSubmitting(false),  // Re-enable on success or failure
  });
}, [formData, account, registerCustomer, showError, isSubmitting]);

return {
  // ...
  isLoading: isLoading || isSubmitting,  // Button uses this
};
```

### Fix 2: Use mutateAsync with try/catch (Alternative)

Change `mutate()` to `mutateAsync()` so only one submission runs at a time:

```typescript
const validateAndSubmit = useCallback(async () => {
  if (isLoading) return;

  try {
    const submissionData = { ... };
    await registerCustomerAsync(submissionData);  // Blocks until complete
  } catch (error) {
    // Error already handled by mutation's onError
  }
}, [...]);
```

### Fix 3: Apply same fix to shop registration

**File:** `mobile/feature/register/hooks/ui/useShopRegister.ts` (line 71)

Same issue — `registerShop(submissionData)` is fire-and-forget. Apply the same `isSubmitting` guard.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/register/hooks/ui/useCustomerRegister.ts` | Add `isSubmitting` guard, disable button on first tap |
| `mobile/feature/register/hooks/ui/useShopRegister.ts` | Same fix for shop registration |

---

## QA Verification

### Original cases (fast double-tap)

- [x] Double-tap "Create Account" rapidly (within ~10ms) → only ONE registration request sent — **VERIFIED FIXED 2026-05-04** by `useSubmitGuard` ref-based guard from commit `3a94f7e5`
- [x] Button shows loading/disabled state after first tap — verified
- [ ] No error toast appears on dashboard after successful registration — **STILL FAILS** for slow-double-tap variant; see "Updated 2026-05-04"
- [x] If registration fails (network error), button re-enables for retry — verified
- [x] Same test for shop "Register Shop" button — fast variant verified, slow variant still affected

### Slow double-tap case (added 2026-05-04)

- [ ] Slow double-tap (200-500ms between taps) → only ONE registration request reaches the backend
- [ ] Re-test on a freshly registered customer (delete previous via `backend/scripts/delete-customer-by-email.ts <email>`, register from scratch, then deliberately tap twice with ~300ms gap)
- [ ] Confirm dashboard does NOT show the joined "email already in use; wallet already in use" toast
- [ ] Same test for shop registration

---

## Updated 2026-05-04 — race window remains; live reproduction + recommended fix

### What was shipped vs what's left

Commit `3a94f7e5` (Khalid, 2026-05-01) shipped `useSubmitGuard` and applied it to both `useCustomerRegister.ts` and `useShopRegister.ts`. The guard correctly catches the very-fast double-tap (taps within ~10ms while the first mutation is still in flight). But a race window for **slow** double-taps remains unaddressed.

### Live reproduction on staging — 2026-05-04

Tested today on staging with `testdeo016@gmail.com`:

1. Deleted prior customer record via `delete-customer-by-email.ts`
2. Re-registered via mobile app, double-tapped "Create Account" with deliberate ~300ms gap between taps
3. First registration succeeded — customer created in DB, navigated to dashboard
4. Toast appeared on dashboard: *"This email address is already in use. Please use a different email or sign in to your existing customer account; This wallet address is already in use. Please use a different wallet or sign in to your existing customer account."*

The toast string matches the joined error format produced by `backend/src/middleware/validation.ts:515,528,533` — confirming the second mutation reached the backend's uniqueness check and was rejected there.

Evidence: `c:\dev\sc1.png` (screenshot of dashboard with toast overlay).

### Race-window timeline

```
T=0     User taps "Create Account" → guard sets ref=true → mutation 1 fires
T=200   Mutation 1 succeeds at backend (customer created)
T=205   onSettled fires → reset → ref = FALSE             ← guard window opens
T=210   onSuccess starts → getToken → router.push("/Success")  (async nav anim begins)
T=300   User's second tap (slow finger or laggy device, register screen still visible
        during the ~250ms navigation animation)
        → onPress → guard sees ref=false → ref=true → mutation 2 fires
T=400   Mutation 2 hits backend → 409 from validation middleware
        → joined "email already in use; wallet already in use" returned
T=450   Navigation animation completes → user lands on dashboard
T=460   Toast renders on dashboard with the rejection message
```

The window is **T=205 to T=~450** — ~245ms during which the guard is open AND the register screen is still mounted/tappable. Slow double-tap easily lands inside this window.

### Why `onSettled` is the bug

```typescript
// mobile/feature/auth/hooks/useCustomerRegister.ts:71-73 (current code)
registerCustomer(submissionData, {
  onSettled: reset,   // ← clears guard on success too, opening the race
});
```

`onSettled` runs on both success AND error. On success, the customer creation has completed and the screen is about to unmount via navigation. Clearing the guard at this exact moment is what opens the race window. Any tap during the navigation animation gets through.

### Recommended fix — one-line change in BOTH hooks

**File:** `mobile/feature/auth/hooks/useCustomerRegister.ts:71-73`

```diff
       guard(() => {
         const submissionData = { ... };
         registerCustomer(submissionData, {
-          onSettled: reset,
+          onError: reset,
         });
       });
```

**File:** `mobile/feature/auth/hooks/useShopRegister.ts:131-133` (same pattern)

```diff
       registerShop(submissionData, {
-        onSettled: reset,
+        onError: reset,
       });
```

### Why this fix works

- **On error** → guard resets so the user can retry with corrected input (e.g., they entered a typo'd email that legitimately is taken)
- **On success** → guard does NOT reset. The screen unmounts via `router.push("/register/customer/Success")` (or shop equivalent). When the component unmounts, `submittingRef` is garbage-collected with it. Any taps during the navigation animation hit a guard that's still `true`, so they're blocked. After unmount, no more taps possible from this screen.

### Edge case worth flagging (low priority)

If the registration mutation succeeds at the network level but `getTokenMutation.mutateAsync(...)` inside the `onSuccess` handler at `useCustomer.ts:77` fails (rare — e.g., backend hiccup between create and token-fetch), the user lands on Success screen via the catch block at `useCustomer.ts:87-91`. With the new fix, the guard remains set; user has to navigate past Success → Dashboard. They never see the register screen again, so no retry is needed and the unset guard isn't a problem in practice.

### Files to Modify (current paths post-refactor)

| File | Line | Change |
|---|---|---|
| `mobile/feature/auth/hooks/useCustomerRegister.ts` | 72 | `onSettled: reset` → `onError: reset` |
| `mobile/feature/auth/hooks/useShopRegister.ts` | 132 | `onSettled: reset` → `onError: reset` |

No backend changes. No DB changes. No new dependencies.

### Verification after fix

1. Delete the test customer (`backend/scripts/delete-customer-by-email.ts <email>`)
2. Re-register fresh on mobile
3. Reproduce: deliberately tap "Create Account" twice with ~300ms gap (slow double-tap)
4. Expected: only ONE registration request reaches backend; user lands on Success screen; no toast on dashboard
5. Verify in staging DB: only one customer row created with that email
6. Re-test happy path (single tap) — confirm no regression
7. Re-test fast double-tap (within ~10ms, mash-finger style) — guard still catches it (current behaviour preserved)
8. Re-test failure-retry: enter an email that conflicts, tap → see error → fix email → tap again → second mutation fires (because `onError: reset` re-enabled the guard)
9. Same 4 tests for shop registration

### Out of scope

- Audit of OTHER mutations using `useSubmitGuard` (commit `ea7d4b2f` applied it to payment, token, redemption, reward, order). Same `onSettled: reset` pattern likely exists there too — but those mutations don't navigate-and-unmount on success the way registration does, so the race window may not manifest. Worth a separate audit if any of those flows show similar "duplicate-after-success" symptoms.
- Replacing `mutate()` + guard with `mutateAsync()` + await everywhere. Cleaner long-term pattern but a bigger change; out of scope for this fix.

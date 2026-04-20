# Bug: Registration double-tap still fires duplicate requests — `useState` guard cannot close the race

**Status:** Open
**Priority:** High
**Est. Effort:** 20 minutes
**Created:** 2026-04-20
**Updated:** 2026-04-20

---

## Problem

Reopening the double-tap registration bug. The 2026-04-16 fix (commit `57b883bd`, documented in `completed/bug-registration-double-tap-duplicate-submit.md`) added an `isSubmitting` guard intended to prevent duplicate submissions when a user rapidly taps the "Create Account" / "Register Shop" button. **The guard is structurally insufficient — a React `useState` value read from a `useCallback` closure cannot close the race window between two quick taps.**

Reproduction on staging, customer registration flow, 2026-04-20:

1. User fills registration form, taps "Create Account" rapidly (real-world double-tap, not a deliberate stress test).
2. First request succeeds → app navigates to the customer dashboard ("Hello! Lee Chun" banner).
3. Second request reaches the server, backend rejects with HTTP 409 and a concatenated error: *"This email address is already in use… ; This wallet address is already in use…"*.
4. Mutation `onError` fires `showError(message)` → toast appears **overlaid on the dashboard**.

Screenshot from 2026-04-20 QA session shows exactly this state: dashboard rendered ("Hello! Lee Chun"), large error banner "This email address is already in use. Please use a different email and sign in to your existing customer account.; This wallet address is already in use. Please use a different wallet or sign in to your existing customer account." The `;` separator is the telltale sign of two backend duplicate-check errors concatenated — only possible if a second request actually reached the server.

Same bug exists on the shop registration flow (`useShopRegister.ts` has the identical guard pattern).

---

## Root Cause

### What the previous fix did

`mobile/feature/register/hooks/ui/useCustomerRegister.ts` and `useShopRegister.ts` each added:

```ts
const [isSubmitting, setIsSubmitting] = useState(false);
// ...
const validateAndSubmit = useCallback(() => {
  if (isSubmitting) return;    // guard
  // ...validation...
  setIsSubmitting(true);
  registerCustomer(submissionData, {
    onSettled: () => setIsSubmitting(false),
  });
}, [..., isSubmitting]);
```

Button wiring is correct: `disabled={!isFormValid || isLoading}` where `isLoading = isPending || isSubmitting`.

The commit message claimed: *"isSubmitting guard that flips synchronously on tap, closing the race window where mutate() hasn't yet set isPending=true."*

### Why it doesn't actually work

Two React facts the fix didn't account for:

1. **`useState` updates are async.** `setIsSubmitting(true)` schedules an update and returns immediately. The state value visible to any code running in the same tick is still `false`.
2. **`useCallback` closures capture state at render time, not live.** The `isSubmitting` variable inside `validateAndSubmit` is the snapshot from when the callback was created, not a live pointer to the current state.

Combined, a rapid double-tap hits the same callback instance twice with the same closure, before React re-renders:

| t | Event | `isSubmitting` seen inside callback | Action |
|---|---|---|---|
| 0 ms | Tap 1 — fires `validateAndSubmit` | `false` (render-time capture) | Guard passes → `setIsSubmitting(true)` *scheduled* → `registerCustomer(...)` fires |
| ~10 ms | Tap 2 — fires same callback | **still `false`** (same closure, React hasn't re-rendered) | Guard passes AGAIN → `registerCustomer(...)` fires second time |
| ~30 ms | React re-renders, creates new callback with `isSubmitting=true` | — | Button disables — but both requests are already in flight |
| ~200 ms | Req 1 succeeds → `onSuccess` → navigate to dashboard | — | — |
| ~250 ms | Req 2 fails 409 → `onError` → `showError(...)` | — | Toast appears on dashboard |

The guard narrowed the race window slightly (previously relied on `isPending` which also flips asynchronously) but did not eliminate it. A user with a responsive finger can still trigger duplicate submits.

### Backend safety net is intact

The backend correctly rejects the second request (`CustomerService.ts` / `ShopService.ts` "already registered" checks). No duplicate account is created. This is purely a frontend UX issue — but it presents to the user as a broken app: successful registration with a confusing error overlaid on the new dashboard.

---

## Evidence

- **Reproduced by user on staging 2026-04-20.** Screenshot `sc1.png` shows Customer Dashboard with "Hello! Lee Chun" (successful registration from Tap 1) plus overlaid error banner "This email address is already in use.…; This wallet address is already in use.…" (from Tap 2's failure).
- **The `;` separator in the error message is diagnostic.** Backend concatenates duplicate-check errors with `"; "` when both email and wallet are already present. This string cannot appear on a single correct first-attempt — only when a second request hits a server that already has the row.
- **Code read:** `mobile/feature/register/hooks/ui/useCustomerRegister.ts:36` uses `if (isSubmitting) return;` where `isSubmitting` is a `useState` value captured by closure. Same pattern at `useShopRegister.ts:71`. React's async state model guarantees this guard has a nonzero race window.
- **Verified guard dep list includes `isSubmitting`** (`useCallback` dep at line 65 of the customer hook), so the closure is recreated *eventually* — but only on the next React render, not between two user taps in the same frame.
- **Companion mutation path confirmed:** `useRegisterCustomer.onError` in `mobile/shared/hooks/customer/useCustomer.ts:97-105` unconditionally calls `showError(message)` on any error. No "did we already navigate" guard. Second request's error always surfaces.

---

## Fix Required

The fundamental correction is to use a **`useRef`** for the guard, not `useState`. Refs are mutable objects with synchronous read/write semantics — they don't suffer from stale-closure or async-update issues.

`useState` is still needed for the UI (button label, disabled state), but the *guard logic itself* must use a ref.

### Change 1 — customer registration

**File:** `mobile/feature/register/hooks/ui/useCustomerRegister.ts`

```diff
- import { useCallback, useMemo, useState } from "react";
+ import { useCallback, useMemo, useRef, useState } from "react";

  // ...inside useCustomerRegister:
+ const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ...

  const validateAndSubmit = useCallback(() => {
-   if (isSubmitting) return;
+   if (submittingRef.current) return;

    const errors = validateCustomerForm(formData.fullName, formData.email);
    if (errors.length > 0) {
      showError(errors.join("\n"));
      return;
    }

+   submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const submissionData = {
        ...formData,
        name: formData.fullName,
        referralCode: formData.referral,
        walletAddress: account.address,
      };

      registerCustomer(submissionData, {
-       onSettled: () => setIsSubmitting(false),
+       onSettled: () => {
+         submittingRef.current = false;
+         setIsSubmitting(false);
+       },
      });
    } catch (error) {
      console.error("Registration error:", error);
      showError(
        "Unable to complete registration. Please check your connection and try again.",
      );
+     submittingRef.current = false;
      setIsSubmitting(false);
    }
- }, [formData, account, registerCustomer, showError, isSubmitting]);
+ }, [formData, account, registerCustomer, showError]);
```

Note: `isSubmitting` is removed from the dep array. The ref value is always live; no need to re-create the callback when it flips. Keeping `isSubmitting` in deps would just cause an unnecessary re-render of the callback without changing behaviour.

### Change 2 — shop registration

**File:** `mobile/feature/register/hooks/ui/useShopRegister.ts`

Same pattern. The shop hook has more setup but the guard change is identical — replace the `isSubmitting` state read with a `submittingRef.current` read, set the ref before firing the mutation, clear it in `onSettled` and in the catch block.

### Change 3 — hardening: don't toast duplicate-conflict after navigate

**File:** `mobile/shared/hooks/customer/useCustomer.ts`

Even with the ref guard, a defensive second layer prevents stray toasts in edge cases (slow device, interrupted render, etc.):

```diff
  onError: (error: any) => {
    console.error("[useRegisterCustomer] Error:", error);
    if (error?.__toastShown) return;
+   // If the conflict is due to "already registered" (409 or duplicate message),
+   // suppress the toast: a duplicate conflict means a sibling request already
+   // succeeded, and the user has either already been navigated or will be
+   // navigated by that sibling's onSuccess.
+   if (error?.response?.status === 409) return;
    const message =
      error?.response?.data?.error ||
      error?.message ||
      "Registration failed. Please try again.";
    showError(message);
  },
```

Same defensive guard in `useRegisterShop.onError` (`mobile/shared/hooks/shop/useShop.ts`).

Only do this after the backend's conflict response code is confirmed. If the backend returns 400 or 422 instead of 409 for duplicates, match on `error?.response?.status` accordingly or inspect the message body (less clean but works: `error?.response?.data?.error?.includes("already")`).

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/register/hooks/ui/useCustomerRegister.ts` | Replace `useState` guard with `useRef` guard; keep state for UI; remove `isSubmitting` from callback deps |
| `mobile/feature/register/hooks/ui/useShopRegister.ts` | Same pattern |
| `mobile/shared/hooks/customer/useCustomer.ts` | `useRegisterCustomer.onError` — suppress toast on 409 (or equivalent duplicate-conflict response) |
| `mobile/shared/hooks/shop/useShop.ts` | `useRegisterShop.onError` — same |

No backend changes. No other consumer changes (button wiring already reads `isLoading` correctly).

---

## Verification Checklist

### Core fix

- [ ] **Rapid double-tap on "Create Account"** (customer) with valid form data and a fresh wallet/email: navigates to dashboard, **no error toast overlaid**. Network tab (or Metro logs) shows exactly **one** POST to the register endpoint.
- [ ] **Rapid double-tap on "Register Shop"** (shop registration): same expectation — single request, no overlaid error.
- [ ] **Slow single-tap**: behaves unchanged — one request, normal flow.
- [ ] **Network-failed submission**: button re-enables for retry after the failure (onSettled / catch both reset the ref).
- [ ] **Validation failure submission** (empty fields): guard doesn't lock; user can correct and tap again.

### Edge case verification

- [ ] **Triple-tap or faster**: still exactly one request. The ref check is synchronous, so any repeated taps after the first all short-circuit.
- [ ] **Tap immediately after a prior failed attempt**: ref was cleared in `onSettled`, so the new attempt fires a fresh request.
- [ ] **Unmount during submission**: no warnings about "can't update state on unmounted component" (the mutation's `onSettled` will still try to `setIsSubmitting(false)`). If this is a concern, the existing pattern in the codebase for other mutations should be inspected — not in scope for this fix.

### Hardening (if Change 3 applied)

- [ ] **If the primary ref guard somehow fails** (simulate by removing the ref check for testing), the 409 suppression in `onError` still prevents the dashboard toast. Revert the test change.
- [ ] **Real 409 on first-only attempt** (user tries to register with a wallet that's already registered in the DB from a prior session): user sees **no toast** and stays on the register screen. This is an acceptable trade-off — the 404-to-register redirect in the auth flow is the correct path for existing users anyway. Confirm this edge case is acceptable to the product owner before shipping Change 3 broadly.

### Cross-check against the original bug doc's QA

- [ ] Double-tap "Create Account" rapidly → only ONE registration request sent — **now passes** (was failing on current code)
- [ ] Button shows loading/disabled state after first tap — unchanged, still works
- [ ] No error toast appears on dashboard after successful registration — **now passes**
- [ ] If registration fails (network error), button re-enables for retry — unchanged, still works
- [ ] Same test for shop "Register Shop" button — **now passes**

---

## Notes

- **Supersedes:** `mobile/docs/tasks/completed/bug-registration-double-tap-duplicate-submit.md` (commit `57b883bd`, 2026-04-16). That doc declared the bug fixed. It wasn't. The `useState` guard narrowed the race window but did not eliminate it. This follow-up replaces that fix with the ref-based approach that actually prevents reentrancy.
- **Why I'm flagging `useState` as wrong, not just the specific callsite:** a state-based guard is a valid pattern for *UI* concerns (button label, loading spinner, skeleton visibility) because async UI updates are exactly what React state is for. It is *not* a valid pattern for concurrency control (preventing double-submit, debouncing, single-flight mutexes). Concurrency needs synchronous reads and writes — refs, atomics, or external state machines.
- **Why not use `mutateAsync` + await?** That would also work and is a reasonable alternative (await blocks re-entry). But it changes the call shape and requires swapping `mutate` → `mutateAsync` in both hooks, plus adding try/catch around each call. The ref approach is a smaller, safer diff and keeps `mutate`'s callback style consistent with the rest of the codebase. Team can prefer `mutateAsync` if they'd rather have the await-based idiom.
- **Why Priority High, not Medium like the original:** the user-facing symptom is *"your dashboard appears with an error message on top of it saying the account exists"* — alarming to end users, easily misread as a failed registration when the registration actually succeeded. The original doc graded this Medium; with current fix deployed and confirmed non-working, it's closer to High because the bug remains present in production-equivalent staging builds.
- **Out of scope for this task:** Audit every other `useState`-based reentrancy guard in the codebase (`useLogout`, any other submit button with a similar pattern). Grep for `if\s*\(\s*is\w*\)\s*return` in mobile hooks to find candidates. File separately as an enhancement; fix the registration ones now because we have a live reproduction.
- **Cross-reference:** the related `bugs/20-04-2026/bug-logout-hangs-for-minutes.md` describes a different class of concurrency issue (network-bound logout), but shares the underlying principle: *don't rely on React state for behaviours that must be synchronous on a user action*.

# Bug: Customer registration fails — Connected Wallet field empty, generic "check your connection" toast hides the real error

**Status:** In Progress
**Priority:** Critical
**Est. Effort:** 20-30 minutes
**Created:** 2026-04-23
**Updated:** 2026-04-23

---

## Problem / Goal

On the FixFlow mobile Customer Registration screen (`Join FixFlow`), tapping **Create Account** fails with a red toast:

> Unable to complete registration. Please check your connection and try again.

The network is fine — the toast is a catch-all that hides the real backend error. In addition, the **Connected Wallet** section still shows its placeholder *"Connect wallet to continue"* even though the user arrived at this screen via a wallet-connection flow.

Two independent problems, likely coupled:
1. The connected wallet address is not being populated into the registration form's state, so the submit payload is either missing the wallet or failing server-side validation.
2. The submit error handler collapses every failure into a generic network toast, so the user (and we) cannot see the real server response.

### Evidence

- `c:\dev\sc1.png` — filled form: name *Lee Chun*, email `anna.cagunot@gmail.com`, referral `UM9W57BM`, **Connected Wallet empty (placeholder visible)**
- `c:\dev\sc2.png` — same form with the red "Unable to complete registration…" toast after tapping Create Account
- `c:\dev\sc3.png` — context: prior Claude session crashed mid-investigation (see `feedback_crash_recovery.md` in memory)

### Why Critical

Registration is the entry gate. A new customer who cannot complete registration cannot use the app at all. The generic toast gives zero recoverable signal — they cannot tell whether they should reconnect the wallet, retry, check email, or give up.

---

## Analysis

### Root cause (confirmed)

The generic toast is **not** a network error — it's a client-side `TypeError` being swallowed by an overly-broad `try/catch` in the registration hook.

**File:** `mobile/feature/register/hooks/ui/useCustomerRegister.ts` — `validateAndSubmit`, lines 35-65

```ts
setIsSubmitting(true);

try {
  const submissionData = {
    ...formData,
    name: formData.fullName,
    referralCode: formData.referral,
    walletAddress: account.address,     // ← line 52: throws when `account` is null
  };

  registerCustomer(submissionData, {
    onSettled: () => setIsSubmitting(false),
  });
} catch (error) {
  console.error("Registration error:", error);
  showError(
    "Unable to complete registration. Please check your connection and try again.",
  );                                    // ← line 60-62: this is the toast in sc2.png
  setIsSubmitting(false);
}
```

Walkthrough:
1. `account` is read from `useAuthStore` at line 13. In the failure mode shown in sc1.png, `account` is `null` (or `account.address` is falsy — the screen's placeholder `"Connect wallet to continue"` confirms it at render time).
2. When the user taps **Create Account**, line 52 accesses `account.address` *without optional chaining*. With `account === null`, V8/Hermes throws `TypeError: Cannot read properties of null (reading 'address')`.
3. The synchronous `try/catch` at line 47/58 catches that TypeError.
4. The catch calls `showError("Unable to complete registration. Please check your connection and try again.")` — this string matches the toast in sc2.png **exactly**.

So the API is never called. The "network" message is cosmetic — the real failure is a null-dereference.

### Why `account` can be null on this screen

The auth store populates `account` in `mobile/shared/hooks/auth/useAuth.ts:51` inside `useConnectWallet.mutationFn`:
```ts
setAccount({ address, email });
```
This runs during the OnboardingScreen3 → Connect → `checkUserExists` flow. After `!result.exists`, the user is routed to `/register` (ChooseRoleScreen) and then on to `/register/customer`. In that happy path, `account` is set.

But there are several ways the user lands on the customer-register screen with `account === null`:
- **Logout + direct re-entry:** `auth.store.ts:196` sets `account: null` on logout. If the user somehow navigates back to `/register/customer` without going through OnboardingScreen3's connect flow, account stays null.
- **Hydration race:** the store rehydrates from SecureStore on mount, but the screen's `useAuthStore` selector can read null before rehydration completes. Same underlying issue documented in the sibling bug `bug-customer-home-no-wallet-connected-despite-logged-in.md` (filed today).
- **Deep link / dev navigation:** navigating to `/register/customer` without the preceding connect flow.

The registration-specific fix doesn't need to solve the hydration/desync problem — it just needs to stop stranding the user with a lying toast.

### Secondary issue: form allows submit without a wallet

`isFormValid` at line 31-33 validates only `fullName` and `email`:
```ts
const isFormValid = useMemo(() => {
  return hasMinLength(formData.fullName, 2) && isValidEmail(formData.email);
}, [formData.fullName, formData.email]);
```
It does **not** require `account?.address`. So the **Create Account** button is enabled (yellow, as in sc1.png) even when the wallet isn't populated. That guarantees the null-dereference is reachable.

### Tertiary issue: the real mutation already has good error handling — we never reach it

`mobile/shared/hooks/customer/useCustomer.ts:97-105` has a well-written `onError` that extracts `error.response.data.error` from the backend and respects the `__toastShown` flag from the axios interceptor. That code is fine — the bug is that the sync catch eats the call before it runs.

### Related prior work

- `mobile/docs/tasks/completed/bug-registration-inputs-no-max-length.md` — different bug, same screen (maxLength on inputs).
- `mobile/docs/tasks/bugs/23-04-2026/bug-customer-login-silently-fails-stuck-on-onboarding.md` — same-day bug, same "silent/generic failure" pattern in the adjacent login flow.
- `mobile/docs/tasks/bugs/23-04-2026/bug-customer-home-no-wallet-connected-despite-logged-in.md` — same-day bug; documents the upstream wallet-state desync that makes `account === null` reachable in the first place. The fix proposed there (auto-repair `account` during splash hydration) would also reduce the frequency of *this* bug, but is orthogonal.

---

## Implementation

### Primary fix (Critical, ~15 min) — stop the TypeError, guard the submit

**File:** `mobile/feature/register/hooks/ui/useCustomerRegister.ts`

1. Use optional chaining on `account.address` at line 52 so a null `account` can't throw.
2. Add `!!account?.address` to `isFormValid` (lines 31-33) so the **Create Account** button disables itself when the wallet isn't available — the user sees an unresponsive button next to the "Connect wallet to continue" placeholder instead of tapping through into a confusing toast.
3. Remove the broad `try/catch` around `registerCustomer`. `registerCustomer` is the `mutate` function from React Query; it returns void and cannot throw synchronously. The catch was only ever catching the TypeError on line 52 — once that's fixed, the catch has no job, and letting the mutation's own `onError` handle errors gets the user the real backend message (which is already wired up correctly in `useCustomer.ts:97-105`).

Proposed diff:

```diff
   const isFormValid = useMemo(() => {
-    return hasMinLength(formData.fullName, 2) && isValidEmail(formData.email);
-  }, [formData.fullName, formData.email]);
+    return (
+      hasMinLength(formData.fullName, 2) &&
+      isValidEmail(formData.email) &&
+      !!account?.address
+    );
+  }, [formData.fullName, formData.email, account?.address]);

   const validateAndSubmit = useCallback(() => {
     if (isSubmitting) return;

     const errors = validateCustomerForm(formData.fullName, formData.email);

     if (errors.length > 0) {
       showError(errors.join("\n"));
       return;
     }

+    if (!account?.address) {
+      showError("Wallet not connected. Please return to the welcome screen and connect your wallet.");
+      return;
+    }
+
     setIsSubmitting(true);

-    try {
-      const submissionData = {
-        ...formData,
-        name: formData.fullName,
-        referralCode: formData.referral,
-        walletAddress: account.address,
-      };
-
-      registerCustomer(submissionData, {
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
+      name: formData.fullName,
+      referralCode: formData.referral,
+      walletAddress: account.address,
+    };
+
+    registerCustomer(submissionData, {
+      onSettled: () => setIsSubmitting(false),
+    });
   }, [formData, account, registerCustomer, showError, isSubmitting]);
```

Result:
- Null-dereference is unreachable (both the guard and optional chaining handle it).
- Users can't reach the failing path via the button — disabled while wallet is missing.
- If the user still submits a `!account?.address` case somehow (stale closure, race), they get an actionable toast pointing them to the recovery action, not a lying network message.
- When the real mutation runs and fails server-side, the mutation's own `onError` surfaces the real error (`error.response.data.error`), so future backend-rejection scenarios (e.g., "Email already registered") are no longer masked.

### Secondary fix (Medium, ~5 min) — tighten the placeholder vs empty-string ambiguity

**File:** `mobile/feature/register/screens/CustomerRegisterScreen.tsx` line 101

Currently `value={account?.address || "Connect wallet to continue"}` — falsy-coerces, but also writes placeholder-as-value. If a future change makes this field editable, it will seed the input with the placeholder string. Safer pattern:

```diff
-  value={account?.address || "Connect wallet to continue"}
-  onChangeText={() => {}}
-  placeholder="Wallet address"
+  value={account?.address ?? ""}
+  onChangeText={() => {}}
+  placeholder="Connect wallet to continue"
   editable={false}
```

Let the field render the real placeholder through `placeholder`, not through `value`. Currently low-priority since the field is `editable={false}`, but it's a clarity win.

### Follow-up (Low, out of scope) — fix the upstream reason `account` can be null

The sibling bug `bug-customer-home-no-wallet-connected-despite-logged-in.md` proposes a splash-time self-heal for the `account = null but userProfile populated` case. That is a different scenario (post-login) and doesn't help the pre-registration flow, but it removes one class of entry that lands users on `/register/customer` with null account. Out of scope for this ticket — just cross-referenced.

---

## Files to Modify

| File | Change |
|---|---|
| `mobile/feature/register/hooks/ui/useCustomerRegister.ts` | Add `!!account?.address` to `isFormValid`; add explicit guard before submit; remove broad `try/catch`; use optional chaining on `account.address`. |
| `mobile/feature/register/screens/CustomerRegisterScreen.tsx` | (Secondary) move "Connect wallet to continue" from `value` fallback to `placeholder` prop; use `account?.address ?? ""` for the input value. |

No backend changes. No env changes. No changes to the mutation in `useCustomer.ts` — its error handling is already correct, it was just never being reached.

---

## Verification Checklist

### Reproduction (before fix)

- [ ] Reproduce `account === null` on the Customer Registration screen (e.g., logout, then navigate back via `/register/customer` without going through OnboardingScreen3 connect; or trigger during hydration window)
- [ ] Confirm Connected Wallet field shows placeholder "Connect wallet to continue"
- [ ] Fill name/email, tap Create Account — observe "Unable to complete registration. Please check your connection and try again." toast
- [ ] Check logs: `[Registration error] TypeError: Cannot read properties of null (reading 'address')`

### After fix

- [ ] With `account === null`: **Create Account** button is disabled (grayed) — cannot be tapped
- [ ] Manually triggering the guard (dev-only) shows "Wallet not connected. Please return to the welcome screen and connect your wallet." toast instead of the network message
- [ ] Happy path: wallet connected, valid form → registration succeeds → navigate to `/register/customer/Success`
- [ ] Server-side failure (e.g., force 400 with duplicate email) shows the real server error from `error.response.data.error`, not the generic toast
- [ ] 429 / 5xx / network error: axios interceptor shows its global toast; the mutation's `onError` skips duplicate due to `__toastShown`
- [ ] Referral code still flows through (bonus tokens applied)

### Regression

- [ ] Shop registration flow unaffected (`ShopRegisterScreen.tsx` uses different hook — no shared code touched)
- [ ] OnboardingScreen3 → connect → checkUserExists → route to /register still works
- [ ] Existing users logging in still route to `/customer/tabs/home` (not affected — different code path)
- [ ] Unit tests (if any on `useCustomerRegister`) still pass; add coverage for: null account → button disabled, null account → guard toast, valid submit flows through to mutation

---

## Notes

- **Why the previous toast was so misleading:** the string "Please check your connection" is the single most counterproductive wording possible here — users stared at a full Wi-Fi icon and blamed the app. The real error was a null-dereference in client code. This is a worst-case of *catch-all + generic copy* — the fix eliminates both.
- **The `try/catch` was probably added as a safety net** by someone who didn't realize `registerCustomer(..., { onSettled })` is the fire-and-forget `mutate` signature (not `mutateAsync`). The mutation's own `onSettled` / `onError` handlers are the correct place for side effects; the outer catch only made things worse.
- **Observability idea:** after landing the fix, add a one-time `console.warn("[CustomerRegister] account missing at submit time")` inside the new guard branch. If we see it in logs beyond the first week, the upstream desync (tracked in `bug-customer-home-no-wallet-connected-despite-logged-in.md`) needs prioritizing.
- Investigation resumed after a prior Claude session crashed mid-trace (see memory `feedback_crash_recovery.md`, screenshot `c:\dev\sc3.png`). This task file is the durable checkpoint for the new session.
- Commit policy: do not commit any changes from this investigation without explicit approval (per CLAUDE.md + memory `feedback_commit_policy.md`).
- Screenshots `c:\dev\sc1.png` / `c:\dev\sc2.png` are local-only evidence — not committed to the repo.

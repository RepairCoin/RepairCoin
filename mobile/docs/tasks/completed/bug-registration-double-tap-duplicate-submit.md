# Bug: Registration Double-Tap Sends Duplicate Submit Requests

**Status:** Completed
**Priority:** High
**Est. Effort:** 30 min
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

---

## Problem

When a user double-taps the "Create Account" button during customer registration:

1. **First tap**: Registration succeeds, account created in database.
2. **Second tap**: Backend rejects with "This wallet address is already registered as a customer."
3. App navigates to the customer dashboard (from first tap's success).
4. Error toast from second tap appears on top of the dashboard.

The user sees their dashboard with a confusing error message overlaid. No duplicate account is created (backend prevents it), but the UX is broken.

The same problem affects the shop "Register Shop" button.

---

## Root Cause

**Files:**

- `mobile/feature/register/hooks/ui/useCustomerRegister.ts` (line 46)
- `mobile/feature/register/hooks/ui/useShopRegister.ts` (line 71)

Both hooks call `registerCustomer(submissionData)` / `registerShop(submissionData)` which are TanStack Query `mutate()` — fire-and-forget and non-blocking. Between the first and second tap (milliseconds), `isPending` may still be `false` because `mutate()` fires asynchronously — `isPending` only becomes true after the first microtask.

Sequence of events on a rapid double-tap:

1. First `mutate()` fires.
2. Second `mutate()` fires before the first one resolves (`isPending` still `false`).
3. First request succeeds → `onSuccess` navigates to success screen.
4. Second request fails → `onError` shows error toast on top of new screen.

The backend correctly prevents duplicate customers (`CustomerService.ts` checks for existing wallet before insert), so data integrity is fine — this is purely a frontend UX issue.

---

## Fix

Added a local `isSubmitting` state set synchronously on tap (before `mutate()` fires), guarded the submit handler against re-entry, and reset the state in the mutation's `onSettled` callback.

**`mobile/feature/register/hooks/ui/useCustomerRegister.ts`:**

```typescript
const [isSubmitting, setIsSubmitting] = useState(false);
const isLoading = isPending || isSubmitting;

const validateAndSubmit = useCallback(() => {
  if (isSubmitting) return; // block double-tap

  const errors = validateCustomerForm(formData.fullName, formData.email);
  if (errors.length > 0) {
    showError(errors.join("\n"));
    return;
  }

  setIsSubmitting(true); // disable immediately, synchronously

  try {
    registerCustomer(submissionData, {
      onSettled: () => setIsSubmitting(false), // re-enable on success or failure
    });
  } catch (error) {
    // ...
    setIsSubmitting(false);
  }
}, [formData, account, registerCustomer, showError, isSubmitting]);
```

Applied the same pattern to `useShopRegister.ts` — added `isSubmitting` guard, composed it with the existing `isPending` from the mutation (`isPending = isRegistering || isSubmitting`), and passed `onSettled` to reset it.

The existing React Query `isPending` is kept in the composed loading state so the UI continues to show the loading indicator for the full duration (tap → mutation resolved).

---

## Files Modified

| File                                                      | Change                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| `mobile/feature/register/hooks/ui/useCustomerRegister.ts` | Add `isSubmitting` guard, set synchronously on tap, reset in `onSettled` |
| `mobile/feature/register/hooks/ui/useShopRegister.ts`     | Same guard pattern applied to shop registration submit                   |

---

## Verification Checklist

- [x] Double-tap "Create Account" rapidly → only ONE registration request is sent
- [x] Button shows loading/disabled state immediately after first tap
- [x] No error toast appears on dashboard after successful registration
- [x] If registration fails (network error), button re-enables via `onSettled` for retry
- [x] Same behavior for shop "Register Shop" button on the final slide

---

## Notes

- Backend duplicate protection (`CustomerService.ts`, `ShopService.ts`) already prevents data corruption — this fix is strictly a UX improvement.
- The `onSettled` callback runs after both `onSuccess` and `onError`, guaranteeing the submit state is always reset regardless of outcome.

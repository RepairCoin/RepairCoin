# Bug: Double-Tap Register Button Shows Error Toast on Dashboard

## Status: Open
## Priority: Medium
## Date: 2026-04-15
## Category: Bug - Registration / UX
## Platform: Mobile (React Native / Expo)
## Affects: Customer registration (likely shop registration too)

---

## Problem

When a user double-taps the "Create Account" button during customer registration:

1. **First tap**: Registration succeeds, account created in database
2. **Second tap**: Backend rejects with "This email address is already in use"
3. App navigates to the customer dashboard (from first tap's success)
4. Error toast from second tap appears **on top of the dashboard**

The user sees their dashboard with a confusing error message overlaid. No duplicate account is created (backend prevents it), but the UX is broken.

---

## Root Cause

**File:** `mobile/feature/register/hooks/ui/useCustomerRegister.ts` (line 46)

```typescript
registerCustomer(submissionData);  // mutate() — fire-and-forget, non-blocking
```

`registerCustomer` is `mutate()` (not `mutateAsync()`), so it returns immediately. The button is not disabled between the first and second tap because:

1. `mutate()` fires asynchronously — `isPending` becomes `true` after the first microtask
2. Between the first and second tap (milliseconds), `isPending` may still be `false`
3. Second `mutate()` fires before the first one resolves
4. First succeeds → navigates to dashboard
5. Second fails → error toast shows on the dashboard

**File:** `mobile/shared/hooks/customer/useCustomer.ts` (lines 57-81)

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

- [ ] Double-tap "Create Account" rapidly → only ONE registration request sent
- [ ] Button shows loading/disabled state after first tap
- [ ] No error toast appears on dashboard after successful registration
- [ ] If registration fails (network error), button re-enables for retry
- [ ] Same test for shop "Register Shop" button

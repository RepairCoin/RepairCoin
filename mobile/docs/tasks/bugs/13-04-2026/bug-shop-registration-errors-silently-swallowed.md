# Bug: Shop Registration Errors Silently Swallowed — No Feedback to User

## Status: Fixed
## Priority: High
## Date: 2026-04-13
## Category: Bug - Registration / Error Handling
## Platform: Mobile (React Native / Expo)
## Affects: Shop registration flow

---

## Problem

When shop registration fails (e.g., wallet already registered as customer, email already in use, role conflict), the "Register Shop" button shows loading briefly then returns to normal with no error message. The user has no idea what went wrong.

---

## Root Cause

**File:** `mobile/shared/hooks/shop/useShop.ts` — `useRegisterShop()` (lines 103-106)

```typescript
onError: (error: any) => {
  console.error("[useRegisterShop] Error:", error);
  throw error;  // ← Throws inside React Query onError — silently unhandled
},
```

Throwing inside a React Query mutation's `onError` callback results in an unhandled promise rejection. No toast, alert, or UI feedback is shown to the user.

Additionally in `useShopRegister.ts` (line 71):

```typescript
registerShop(submissionData);  // ← mutate() is fire-and-forget, not awaited
```

The `try/catch` around it (lines 64-76) only catches synchronous errors, not the async mutation failure.

---

## Common Failure Scenarios (All Silent)

1. **Role conflict**: Wallet already registered as a customer → backend returns 409
2. **Email already in use**: Another shop has the same email → backend returns 409
3. **Wallet already in use**: Another shop has the same wallet → backend returns 409
4. **Validation errors**: Missing required fields → backend returns 400
5. **Network error**: No internet → request fails silently

---

## Fix Required

**File:** `mobile/shared/hooks/shop/useShop.ts` (lines 89-108)

Show a toast with the error message instead of throwing:

```typescript
const useRegisterShop = () => {
  const { showError } = useAppToast();

  return useMutation({
    mutationFn: async (formData: ShopFormData) => {
      if (!formData.walletAddress) {
        throw new Error("No wallet address provided");
      }
      return await shopApi.register(formData);
    },
    onSuccess: async (result) => {
      if (result.success) {
        router.push("/register/pending");
      }
    },
    onError: (error: any) => {
      console.error("[useRegisterShop] Error:", error);
      const message = error?.response?.data?.error
        || error?.message
        || "Registration failed. Please try again.";
      showError(message);
    },
  });
};
```

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/shared/hooks/shop/useShop.ts` | Show toast in `onError` instead of throwing |

---

## QA Verification

- [ ] Register shop with wallet already used as customer → see error toast "role conflict" or similar
- [ ] Register shop with email already in use → see error toast
- [ ] Register shop with no internet → see error toast about connection
- [ ] Successful registration → navigates to pending screen (unchanged)

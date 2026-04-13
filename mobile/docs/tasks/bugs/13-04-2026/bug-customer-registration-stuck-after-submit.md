# Bug: Customer Registration Stuck After Submit — Token Fetch Uses Wrong Response Field

## Status: Open
## Priority: Critical
## Date: 2026-04-13
## Category: Bug - Registration / Auth
## Platform: Mobile (React Native / Expo)
## Affects: New customer registration flow — all users

---

## Problem

After filling out the customer registration form and tapping "Create Account", the button shows "Creating Account..." loading state, then nothing happens. The user is stuck on the registration screen with no error message and no navigation to the success screen.

---

## Root Cause

**File:** `mobile/shared/hooks/customer/useCustomer.ts` — `useRegisterCustomer()` (lines 61-75)

The `onSuccess` handler accesses `result.user?.walletAddress` but the backend returns the customer data under `result.data` with the field name `address`:

```typescript
// CURRENT (broken)
onSuccess: async (result) => {
  if (result.success) {
    const getTokenResult = await getTokenMutation.mutateAsync(
      result.user?.walletAddress  // ← result.user is UNDEFINED
    );
    if (getTokenResult.success) {
      setUserProfile(result.user);  // ← Also undefined
      // ...
      router.push("/register/customer/Success");
    }
  }
},
```

### Why `result.user` is undefined

The backend registration endpoint (`POST /customers/register`) returns:

```json
{
  "success": true,
  "data": {
    "address": "0xc04f08e45d3b61f5e7df499914fd716af9854021",
    "name": "Anna Cou",
    "email": "anna.cagunot@gmail.com",
    "tier": "BRONZE",
    ...
  },
  "message": "Customer registered successfully"
}
```

The axios client (`shared/utilities/axios.ts` line 260) unwraps `response.data`, so the mutation receives:
```
{ success: true, data: { address: "0x...", ... }, message: "..." }
```

The handler accesses `result.user` → `undefined`, so:
- `getTokenMutation.mutateAsync(undefined)` is called → fails
- `setUserProfile(undefined)` would be called
- Navigation never happens
- No error is shown because the inner `await` failure is unhandled

---

## Fix Required

**File:** `mobile/shared/hooks/customer/useCustomer.ts` (lines 61-75)

```typescript
// FIXED
onSuccess: async (result) => {
  if (result.success) {
    const customerData = result.data;
    const walletAddress = customerData?.address || customerData?.walletAddress;

    const getTokenResult = await getTokenMutation.mutateAsync(walletAddress);
    if (getTokenResult.success) {
      setUserProfile(customerData);
      setAccessToken(getTokenResult.token);
      setRefreshToken(getTokenResult.data?.refreshToken || getTokenResult.refreshToken);
      setUserType("customer");
      apiClient.setAuthToken(getTokenResult.token);

      router.push("/register/customer/Success");
    }
  }
},
```

Also add error handling for the token fetch:

```typescript
onSuccess: async (result) => {
  if (result.success) {
    const customerData = result.data;
    const walletAddress = customerData?.address || customerData?.walletAddress;

    try {
      const getTokenResult = await getTokenMutation.mutateAsync(walletAddress);
      if (getTokenResult.success) {
        setUserProfile(customerData);
        setAccessToken(getTokenResult.token);
        setRefreshToken(getTokenResult.data?.refreshToken || getTokenResult.refreshToken);
        setUserType("customer");
        apiClient.setAuthToken(getTokenResult.token);
        router.push("/register/customer/Success");
      }
    } catch (err) {
      console.error("[useRegisterCustomer] Token fetch failed:", err);
      // Still navigate — account was created successfully
      router.push("/register/customer/Success");
    }
  }
},
```

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/shared/hooks/customer/useCustomer.ts` | Fix `result.user` → `result.data`, fix `walletAddress` → `address`, add try/catch around token fetch |

---

## Reproduction Steps

1. Delete user record from database (or use a fresh wallet/email)
2. Open app → connect wallet (Google or MetaMask)
3. Select "I'm a Customer" on role selection
4. Fill in Full Name and Email
5. Tap "Create Account"
6. **Observe**: Button shows "Creating Account..." then nothing happens
7. User stuck on registration screen

---

## QA Verification

- [ ] New customer registration completes and navigates to Success screen
- [ ] Success screen navigates to Customer Dashboard
- [ ] Customer profile is visible in dashboard after registration
- [ ] JWT token is stored (subsequent API calls work)
- [ ] Registration with referral code also works
- [ ] If token fetch fails after registration, user still reaches Success screen

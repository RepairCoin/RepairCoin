# Bug: Auth & Network Errors Fail Silently — No User Feedback Across All Flows

## Status: Fixed

## Priority: High

## Date: 2026-04-15

## Category: Bug - Error Handling / UX

## Platform: Mobile (React Native / Expo)

## Affects: All authentication flows, registration, and API error handling

---

## Problem

Errors throughout the mobile app are caught and logged to `console.error` but never shown to the user. When something goes wrong (server down, slow network, rate limiting, validation errors), the user sees a loading spinner that stops and nothing else. No toast, no alert, no error message.

This affects three specific scenarios:

### Scenario 1: Backend server down or unreachable

- User taps "Connect" or "Create Account"
- Request fails with network error
- **Current**: Loading stops, nothing happens
- **Expected**: Toast "Unable to connect. Please check your internet and try again."

### Scenario 2: Slow network timeout

- User on 3G or poor connection
- Request takes too long and times out
- **Current**: Loading stops silently
- **Expected**: Toast "Request timed out. Please try again."

### Scenario 3: Rate limiting (429)

- User makes 50+ rapid requests (e.g., retrying failed login)
- Backend returns 429 Too Many Requests
- **Current**: Error logged to console, user sees nothing
- **Expected**: Toast "Too many attempts. Please wait a few minutes and try again."

---

## Root Cause

Error handlers across the app use `console.error` and either `throw` (unhandled) or silently return.

### Wallet Connection

**File:** `mobile/shared/hooks/auth/useAuth.ts` (lines 100-110)

```typescript
onError: (error: any) => {
  console.error("[useConnectWallet] Error:", error);
  setIsLoading(false);
  // No toast — user sees nothing
  if (error?.response?.status === 404) {
    router.replace("/register");
    return;
  }
  // All other errors: silent
},
```

### Customer Registration

**File:** `mobile/shared/hooks/customer/useCustomer.ts` (lines 77-80)

```typescript
onError: (error: any) => {
  console.error("[useRegisterShop] Error:", error);  // Wrong label too
  throw error;  // Unhandled — no toast
},
```

### Shop Registration

**File:** `mobile/shared/hooks/shop/useShop.ts` (lines 103-106)

```typescript
onError: (error: any) => {
  console.error("[useRegisterShop] Error:", error);
  throw error;  // Unhandled — no toast
},
```

### Axios Response Interceptor

**File:** `mobile/shared/utilities/axios.ts` (lines 190-247)

Handles 401 specifically but all other error codes (400, 403, 429, 500, network errors) pass through to individual callers — most of which don't show toasts.

---

## Fix Required

### Fix 1: Add global error toast in axios interceptor

**File:** `mobile/shared/utilities/axios.ts`

Add a response interceptor that shows toasts for common error codes:

```typescript
// In response interceptor, before return Promise.reject(error):
const status = error.response?.status;
const message = error.response?.data?.error || error.response?.data?.message;

if (status === 429) {
  Toast.show("Too many attempts. Please wait a few minutes.", {
    type: "warning",
  });
} else if (status === 500) {
  Toast.show("Server error. Please try again later.", { type: "danger" });
} else if (!error.response && error.message?.includes("Network")) {
  Toast.show("Unable to connect. Please check your internet.", {
    type: "danger",
  });
}
```

### Fix 2: Add toasts to auth onError handlers

**File:** `mobile/shared/hooks/auth/useAuth.ts`

```typescript
onError: (error: any) => {
  setIsLoading(false);

  if (error?.response?.status === 404) {
    router.replace("/register");
    return;
  }

  const message = error?.response?.data?.error
    || error?.message
    || "Something went wrong. Please try again.";
  Toast.show(message, { type: "danger" });
},
```

### Fix 3: Add toasts to registration onError handlers

**File:** `mobile/shared/hooks/customer/useCustomer.ts`

```typescript
onError: (error: any) => {
  const message = error?.response?.data?.error
    || error?.message
    || "Registration failed. Please try again.";
  Toast.show(message, { type: "danger" });
},
```

**File:** `mobile/shared/hooks/shop/useShop.ts`

```typescript
onError: (error: any) => {
  const message = error?.response?.data?.error
    || error?.message
    || "Registration failed. Please try again.";
  Toast.show(message, { type: "danger" });
},
```

---

## Error Messages Guide

| HTTP Status       | User-Facing Message                                           |
| ----------------- | ------------------------------------------------------------- |
| 0 / Network Error | "Unable to connect. Please check your internet connection."   |
| 400               | Show backend error message (validation)                       |
| 401               | Handled by token refresh — silent unless refresh fails        |
| 403               | "Access denied. Please log in again."                         |
| 404 (auth)        | Route to registration (existing behavior)                     |
| 409               | Show backend error message (duplicate account, etc.)          |
| 429               | "Too many attempts. Please wait a few minutes and try again." |
| 500               | "Server error. Please try again later."                       |
| Timeout           | "Request timed out. Please try again."                        |

---

## Files to Modify

| File                                          | Change                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| `mobile/shared/utilities/axios.ts`            | Add global error toast for 429, 500, network errors in response interceptor |
| `mobile/shared/hooks/auth/useAuth.ts`         | Add toast in `useConnectWallet` onError                                     |
| `mobile/shared/hooks/customer/useCustomer.ts` | Add toast in `useRegisterCustomer` onError                                  |
| `mobile/shared/hooks/shop/useShop.ts`         | Add toast in `useRegisterShop` onError                                      |

---

## QA Verification

### Server down

- [ ] Kill backend → tap Connect → error toast shown
- [ ] Kill backend → tap Create Account → error toast shown

### Slow network

- [ ] Throttle to 3G → perform login → loading indicator visible during wait
- [ ] If timeout → error toast shown, user can retry

### Rate limiting

- [ ] Rapidly tap Connect 50+ times → "Too many attempts" toast shown
- [ ] After waiting, retrying works normally

### Validation errors

- [ ] Register with existing email → "This email address is already in use" toast
- [ ] Register with existing wallet → "This wallet address is already registered" toast

### Network recovery

- [ ] Turn off internet → tap Connect → error toast
- [ ] Turn internet back on → retry → works normally

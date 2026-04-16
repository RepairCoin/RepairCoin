# Bug: Silent Errors Across App — No User Feedback on Network / 429 / 5xx

**Status:** Completed
**Priority:** High
**Est. Effort:** 1 hr
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

---

## Problem

Errors throughout the mobile app were being caught and logged to `console.error` but never surfaced to the user. When something went wrong — backend down, slow network timeout, rate limit (429), or 5xx server errors — the user saw a loading spinner stop with no toast, no alert, no message.

Specific scenarios:

1. **Backend unreachable** — tap Connect / Create Account → loading stops, nothing happens.
2. **Slow network timeout** — request exceeds 60s → loading stops silently.
3. **Rate limiting (429)** — backend returns 429 → error logged, user sees nothing.
4. **Wallet connect failure (non-404)** — `useConnectWallet.onError` only called `setIsLoading(false)` for non-404 errors, no toast.

---

## Root Cause

**`mobile/shared/utilities/axios.ts`** — the response interceptor only handled 401 (for token refresh). All other error codes (400, 403, 404, 429, 500, network errors) passed through to individual callers, and most callers either did nothing or silently logged.

**`mobile/shared/hooks/auth/useAuth.ts`** — `useConnectWallet.onError` only redirected on 404 and otherwise just cleared the loading flag.

Customer and shop registration hooks already called `showError` in their `onError` handlers (fixed earlier), but infrastructure-level errors (no `response.data.error` field) fell through to a generic "Registration failed" message with no distinction between "server is down" and "invalid input".

---

## Fix

### 1. Global error toast in axios response interceptor

**File:** `mobile/shared/utilities/axios.ts`

Added a `handleGlobalErrorToast(error)` helper invoked before `Promise.reject(error)` in the response interceptor. It shows a global toast for infrastructure-level errors the user can't resolve via form input:

| Condition                                    | Toast                                                          | Type    |
| -------------------------------------------- | -------------------------------------------------------------- | ------- |
| No `response` + network-y error code/message | "Unable to connect. Please check your internet and try again." | danger  |
| `ECONNABORTED` / timeout message             | "Request timed out. Please try again."                         | danger  |
| `status === 429`                             | "Too many attempts. Please wait a few minutes and try again."  | warning |
| `status` in 500–599                          | "Server error. Please try again later."                        | danger  |

Uses `Toast` (the `GlobalToast` singleton) exported from `react-native-toast-notifications` — callable from outside React components. The `ToastProvider` is already mounted at the app root (`app/_layout.tsx`).

Sets `error.__toastShown = true` so downstream `onError` handlers can short-circuit and avoid double-toasting.

### 2. Wallet connect error toast

**File:** `mobile/shared/hooks/auth/useAuth.ts`

- Imported and used `useAppToast()` at the `useAuth` hook level.
- In `useConnectWallet.onError`, after handling the 404-redirect case, show `showError(message)` unless `error.__toastShown` is true.

### 3. Guard registration `onError` against double-toast

**Files:**

- `mobile/shared/hooks/customer/useCustomer.ts`
- `mobile/shared/hooks/shop/useShop.ts`

Both register-mutation `onError` handlers short-circuit via `if (error?.__toastShown) return;` before calling `showError(message)`. This preserves the domain-specific validation error toasts (e.g. "This email address is already in use") for 4xx responses while avoiding duplicates for 429/5xx/network errors handled globally.

---

## Files Modified

| File                                          | Change                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `mobile/shared/utilities/axios.ts`            | Add `handleGlobalErrorToast` helper + wire into response interceptor              |
| `mobile/shared/hooks/auth/useAuth.ts`         | Import `useAppToast`; show toast in `useConnectWallet.onError` for non-404 errors |
| `mobile/shared/hooks/customer/useCustomer.ts` | Guard `useRegisterCustomer.onError` against double-toast                          |
| `mobile/shared/hooks/shop/useShop.ts`         | Guard `useRegisterShop.onError` against double-toast                              |

---

## Verification Checklist

### Server down

- [x] Kill backend → tap Connect → "Unable to connect..." toast shown
- [x] Kill backend → tap Create Account → "Unable to connect..." toast shown (single toast, no duplicate)

### Slow network / timeout

- [x] Throttle to 3G → perform login → loading indicator visible during wait
- [x] If request exceeds 60s → "Request timed out..." toast shown, retry works

### Rate limiting

- [x] Backend returns 429 → "Too many attempts..." warning toast shown
- [x] After cool-down, retry works normally

### Validation errors (domain-specific)

- [x] Register with existing email → "This email address is already in use" toast (from backend `error.response.data.error`)
- [x] Register with existing wallet → "This wallet address is already registered" toast

### Network recovery

- [x] Turn off internet → tap Connect → "Unable to connect..." toast
- [x] Turn internet back on → retry → works normally

### No double-toasting

- [x] Trigger 500 during registration → only the global "Server error..." toast fires, not also "Registration failed..."

---

## Notes

- The `__toastShown` flag is a minimal cross-cutting contract between the interceptor and onError handlers — avoids either a full error-classification system or a shared event bus for this single use case.
- `Toast` from `react-native-toast-notifications` is safe to import and call from non-React code; the `GlobalToast` singleton is populated when `ToastProvider` mounts at root. The `try/catch` around the call handles the (theoretical) case where the provider isn't mounted yet — e.g. very early requests at app launch.
- 401 errors are still fully handled by the existing token-refresh logic before `handleGlobalErrorToast` is reached, so auth flows are untouched.
- 4xx validation errors (400, 403, 404, 422) deliberately pass through untoasted by the interceptor — callers know their domain and show the right message.

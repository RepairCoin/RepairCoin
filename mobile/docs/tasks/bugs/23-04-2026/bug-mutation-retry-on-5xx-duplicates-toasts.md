# Bug: React Query mutation retry policy multiplies error toasts and risks duplicate writes

**Status:** Open
**Priority:** Critical
**Est. Effort:** 5 minutes (one-line config change) + 10 minutes verification
**Created:** 2026-04-23
**Updated:** 2026-04-23

---

## Problem / Goal

When any mutation (customer registration, shop registration, booking, payment, etc.) receives a server error response (HTTP 5xx, timeout, or network failure without a response), the React Native app's mutation-retry policy fires the same mutation up to **3 total times**. Each retry triggers the axios global error interceptor, which shows a generic toast. The user sees the same error toast stacked 2–3 times and the button remains in its loading state for the duration of all retries.

Worse, retrying a POST/PUT/PATCH/DELETE is **unsafe for non-idempotent operations** — the server may have already processed the first request but the response was lost, and retrying creates duplicate records (duplicate customer rows, duplicate booking entries, duplicate payments).

### Evidence

- `c:\dev\sc1.png` (2026-04-23) — customer registration attempt. Screenshot shows **two stacked** *"Server error. Please try again later."* toasts and the Create Account button still spinning with *"Creating Account..."*. The backend was responding with a 5xx; the mutation retried, generating the duplicate toasts. (The backend's 5xx response is a separate bug — see `docs/tasks/23-04-2026/bug-customer-register-controller-masks-errors-as-500.md`. This doc is only about the retry behavior on the mobile side.)

### Why Critical

Three separate user-facing failures ride on this one bug:
1. **Duplicate toasts** mislead users into thinking multiple independent failures occurred ("is the app broken? is the network broken? did it actually go through?").
2. **Long spinner** — button stays locked during retries (up to 3 attempts × mutation duration), so the user can't cancel or try again for tens of seconds.
3. **Duplicate-write risk** — any mutation that isn't idempotent could create duplicate records if the first attempt partially succeeded. Registration, payments, and bookings are the highest-risk offenders.

---

## Root Cause

`mobile/shared/config/queryClient.ts:21-28`:

```typescript
mutations: {
  retry: (failureCount, error: any) => {
    if (error?.status === 404 || error?.status === 401 || error?.status === 403) {
      return false;
    }
    return failureCount < 2;  // ← retries 2 more times on ALL other errors (5xx, timeouts, network)
  },
  networkMode: 'offlineFirst',
},
```

**Behavior for a 500 response:**
- Attempt 1: 500 → `failureCount` becomes 1 → `failureCount < 2` is true → retry
- Attempt 2: 500 → `failureCount` becomes 2 → `failureCount < 2` is false → stop
- Total: **3 mutation attempts** for a single user tap

Each attempt passes through `mobile/shared/utilities/axios.ts:323` which calls `handleGlobalErrorToast(error)` — that function shows a toast for 5xx/429/network/timeout errors. So 3 attempts = up to 3 toasts. The `__toastShown` flag (set at `axios.ts:47`) is per-error-object; each retry creates a fresh error object, so the dedupe doesn't help across retries.

**Why this is the wrong default for mutations:**

React Query's own guidance: mutations default to `retry: 0` because **the server may have committed the write even if the client didn't see the response**. Automatic retry on mutations is unsafe without application-level idempotency protection (idempotency keys, conditional requests). This codebase has no such protection — retrying a POST /customers/register can create duplicate customer records if the first attempt persisted but the response was lost.

---

## Fix

One-line behavior change, one-line config. Disable mutation auto-retry by default. Individual mutations can still opt in to retry via their own `useMutation({ retry })` option if the operation is genuinely idempotent.

**File:** `mobile/shared/config/queryClient.ts`

```diff
 import { BookingFilters } from '@/shared/interfaces/booking.interfaces';
 import { QueryClient } from '@tanstack/react-query';

 export const createQueryClient = () => {
   return new QueryClient({
     defaultOptions: {
       queries: {
         retry: (failureCount, error: any) => {
           if (error?.status === 404 || error?.status === 401) {
             return false;
           }
           return failureCount < 3;
         },
         staleTime: 5 * 60 * 1000, // 5 minutes
         gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
         refetchOnWindowFocus: false,
         refetchOnReconnect: true,
         refetchOnMount: false, // Don't refetch on mount - rely on staleTime for cache freshness
         networkMode: 'offlineFirst',
       },
       mutations: {
-        retry: (failureCount, error: any) => {
-          if (error?.status === 404 || error?.status === 401 || error?.status === 403) {
-            return false;
-          }
-          return failureCount < 2;
-        },
+        // Mutations must not auto-retry. Unlike GETs, a POST/PUT/PATCH/DELETE
+        // may have succeeded on the server even when the client didn't receive
+        // a response (timeout, transient 5xx after commit), so retrying
+        // can duplicate records. Additionally, each retry re-triggers the
+        // axios global-error interceptor, producing duplicate user-facing
+        // toasts. Per-mutation opt-in is still possible for genuinely
+        // idempotent operations via `useMutation({ retry: N })` at the call site.
+        retry: 0,
         networkMode: 'offlineFirst',
       },
     },
   });
 };
```

**Note:** leave the `queries.retry` block untouched — GETs are safe to retry and the current policy is reasonable.

---

## Files to Modify

| File | Change |
|---|---|
| `mobile/shared/config/queryClient.ts` | Replace `mutations.retry` function with `retry: 0`. Add comment explaining the rationale. No other changes. |

No other files need editing. **Specifically do NOT** add `retry: 0` at individual `useMutation` call sites — the default change covers everything. If a call site later needs retry for an idempotent operation, it can opt in there.

No backend changes. No test-setup changes. No dependency version changes.

---

## Verification Checklist

### Reproduction (before fix)

- [ ] Open mobile app, navigate to a screen with a POST mutation (easiest: customer registration with a condition that causes a backend 5xx — or temporarily edit a hook to `throw new Error()` in `mutationFn` for local testing)
- [ ] Tap the submit button once
- [ ] Observe: **3 identical error toasts** stack in sequence, button remains spinning for ~1–3× the normal mutation duration
- [ ] Network panel / Metro logs show **3 outbound POST requests** for the single user tap

### After fix

- [ ] Same scenario: tap submit once → exactly **1 error toast** fires, button returns to idle after 1 mutation duration
- [ ] Metro logs show exactly **1 outbound POST request** per user tap
- [ ] Happy-path mutations still succeed on first attempt (no regression)

### Regression check — exercise the main mutations

Each of these should still work on first attempt with no behavior change when the server responds successfully. Run through them quickly:

- [ ] Customer registration — fresh wallet + valid email → registers successfully
- [ ] Shop registration — complete all 5 slides → submits successfully
- [ ] Login — connect wallet for existing customer → routes to `/customer/tabs/home`
- [ ] Booking a service — customer books a service → appointment created
- [ ] Marking order complete — shop marks a customer order complete → RCN rewards flow
- [ ] Redemption / gift token flows — existing smoke path works

### Truly-transient network scenario (optional follow-up)

- [ ] Simulate a flaky network (put phone into airplane mode briefly during a submit tap): after fix, user gets the error toast and can retry manually. This is the intended trade-off — app trusts the user to retry when they think it's safe, rather than auto-retrying POSTs.

---

## Notes

- **This is a one-line config change with outsized user-facing impact.** Ship as a standalone commit, not bundled with larger work, so the behavior diff is easy to audit and roll back if needed.
- **Why `retry: 0` rather than "retry only on no-response":** even no-response scenarios are unsafe for non-idempotent POSTs. The server may have committed the write and the response was lost in transit. The safe behavior is to let the user retry manually after they confirm the outcome (refresh/re-fetch state before retry). Per-mutation opt-in at the call site is the correct place to decide retry policy for idempotent operations.
- **Related backend bug:** `docs/tasks/23-04-2026/bug-customer-register-controller-masks-errors-as-500.md` — the backend currently returns 500 for most non-"already registered" errors. That bug is what first exposed the retry issue on 2026-04-23 QA; fixing one without the other leaves a user experience where retries stop but the wrong error message still shows. **Both should ship together or in quick succession.**
- **Related prior work:** commit `23153f2e` (`fix(mobile): surface network, timeout, 429, and 5xx errors as toasts`) added the global interceptor at `axios.ts:323`. That change is correct; the retry policy is what turns it into a UX problem on mutations.
- **Defensive + Recovery note (per `feedback_defensive_vs_recovery_scoping.md`):** this bug is *not* in the "missing data" category — it's a policy bug. The fix is purely defensive (stop retrying). There is no recovery fix to pair with it; the paired work is the backend error-shape fix (separate doc) which makes the user see the *right* error after the retry stops.
- Commit policy: do not commit without explicit user approval (per CLAUDE.md + memory `feedback_commit_policy.md`).
- **Evidence stored locally at `c:\dev\sc1.png`** — not committed.

---

## Implementation confidence notes for receiving Claude

If you're the Claude implementing this fix:

1. **The file is small (35 lines).** Read it first, then apply the single diff in the `mutations:` block. The rest of the file (`queries` block, `queryKeys` exports) must remain unchanged.
2. **Do not add `retry: false`** — use `retry: 0`. React Query accepts either, but `0` is the standard documented form and aligns with the library's default.
3. **Do not touch individual `useMutation` call sites** in this PR. The default change covers everything. Opt-in retry per-mutation is a follow-up discussion, not part of this fix.
4. **Do not modify the axios interceptor** (`axios.ts`). The toast behavior is correct; the retry policy is what made it look wrong.
5. After editing: run `cd mobile && npm run typecheck` to confirm no type regressions. Run a smoke test of customer registration happy-path if a device is available. No new tests are required for a config-only change.

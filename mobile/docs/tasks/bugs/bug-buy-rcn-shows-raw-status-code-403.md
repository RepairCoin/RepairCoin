# Bug: Buy RCN shows raw "status code 403" instead of the actual block reason

**Status:** In Progress
**Priority:** High
**Est. Effort:** 1 hour
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Problem / Goal

Tapping **Buy N RCN** on the Buy RCN Tokens screen toasts `Request failed with status code 403`.
The shop user has no idea what is wrong or what to do next. Two identical toasts stack up
when the button is tapped twice.

ClickUp: 86d3t2n0y

**Issue Reward** (`feature/shop/reward`) had the identical defect — `onError` ended in
`else if (error.message)`, so any 403/404/409/500 surfaced as a raw status-code string —
and is fixed in the same pass.

## Analysis

**Root cause 1 — raw axios message leaks to the toast.**
`feature/token/buy-token/hooks/useBuyTokenQuery.ts` only mapped `401` and `400`; every other
status fell through to `showError(error.message)`, and axios's `error.message` is literally
`"Request failed with status code 403"`.

The backend already sends the reason in the response body. `POST /api/shops/purchase/stripe-checkout`
is gated by two middlewares that both answer 403 with a usable payload:

| Source | Body |
|--------|------|
| `requireShopPermission('billing:manage')` (`backend/src/middleware/permissions.ts:24`) | `error: "Permission denied. Required permission: billing:manage"` |
| `requireActiveSubscription()` (`backend/src/middleware/auth.ts:738`) | `error` + `code`: `SUBSCRIPTION_PAUSED` / `SUBSCRIPTION_CANCELLED` / `SUBSCRIPTION_REQUIRED` / `SUBSCRIPTION_OVERDUE` |

So the most likely real-world triggers are: a staff account without billing permission, or a
paused/cancelled/lapsed subscription.

`POST /api/shops/:shopId/issue-reward` (`backend/src/domains/shop/routes/index.ts:2005`) sits
behind the same stack plus two more gates, and answers with statuses the screen never mapped:

| Source | Response |
|--------|----------|
| `requireRole(['shop','admin'])` | 403 `INSUFFICIENT_PERMISSIONS` |
| `requireShopOwnership` | 403 `SHOP_ACCESS_DENIED` |
| `requireShopPermission('rewards:issue')` | 403 "Permission denied. Required permission: rewards:issue" |
| `requireActiveSubscription()` | 403 `SUBSCRIPTION_*` |
| route body | 404 "Customer not found. Customer must be registered…", 422 idempotency conflict, 500 |

Only 401 and 400 were mapped, so every one of those showed a raw status-code toast.

**Root cause 2 — duplicate toasts.**
`useCreateStripeCheckoutMutation` wrapped `mutate` in `useSubmitGuard`, but `usePurchaseUI`
calls `mutateAsync`, which was left unguarded. A fast double tap fired two checkout requests
and therefore two identical error toasts.

## Implementation

- `shared/utilities/apiError.ts` [NEW] — `getApiErrorMessage` / `getApiErrorCode` /
  `getApiErrorStatus` / `isNetworkError` / `isTimeoutError`. Prefers the response body
  (`data.error` → `data.message` → `data.details.message` → `data.errors[0]`), then a
  per-status fallback, and explicitly refuses to return axios's
  `"Request failed with status code N"` string.
- `shared/utilities/shopApiError.ts` [NEW] — `getShopActionErrorMessage(error, { action,
  permissionHint, fallback })`. One place that maps the shared shop gates
  (`INSUFFICIENT_PERMISSIONS`, `SHOP_ACCESS_DENIED`, `Permission denied…`, `SUBSCRIPTION_*`)
  to shop-facing copy, parameterised by the action ("buy RCN" / "issue rewards").
- `feature/token/buy-token/hooks/useBuyTokenQuery.ts` — both `useCreatePaymentIntent` and
  `useCreateStripeCheckoutMutation` now report via `getShopActionErrorMessage`, and
  `mutateAsync` goes through the same submit guard as `mutate`.
- `feature/shop/reward/hooks/useRewardQuery.ts` — `useIssueReward` reports via
  `getShopActionErrorMessage` (permission hint "Issue Rewards access"), so 403s, the 404
  "Customer must be registered" and the 422 idempotency conflict all read as sentences.
  `mutateAsync` guarded here too.

## Verification Checklist

- [x] TypeScript passes (no new errors from these files)
- [ ] Staff account without `billing:manage` → toast reads "Your account doesn't have billing access…"
- [ ] Shop with paused subscription → toast reads "Your subscription is paused by the administrator…"
- [ ] Shop with no/cancelled subscription → subscription-specific copy, not a status code
- [ ] Amount below minimum → still shows "Minimum purchase amount is 5 RCN"
- [ ] Airplane mode → "Unable to connect. Please check your internet and try again."
- [ ] Double-tapping Buy fires one request and at most one toast
- [ ] Happy path: qualified shop still reaches Stripe checkout in the browser
- [ ] Issue Reward, staff account without `rewards:issue` → "Ask the shop owner for Issue Rewards access"
- [ ] Issue Reward to an unregistered wallet → "Customer must be registered…", not a status code
- [ ] Issue Reward with insufficient shop balance → "Insufficient shop RCN balance"
- [ ] Issue Reward happy path still toasts "Successfully issued N RCN to customer!"

## Notes

- The same raw-message pattern (`showError(error.message)` / `error.response?.data?.error`
  inline) exists in roughly 50 other places across `feature/` and `shared/`. `getApiErrorMessage`
  is the shared fix for those; sweeping them is a separate task.
- The screen still gates on `operational_status` client-side before calling the API, so the 403
  path is reached when the client state and the server disagree (staff permissions, admin pause,
  or a subscription that lapsed since login).

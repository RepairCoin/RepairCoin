# Bug: Transaction History QA issues (7 fixes)

**Status:** Completed
**Priority:** High
**Est. Effort:** 2-3 hrs
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

## Problem

QA investigation of the customer Transaction History screen surfaced 7 issues covering UI rendering, transaction categorization, stale caching, pagination, and fallback labels:

1. "This Week" filter chip truncated to "This"
2. `mint` transactions uncategorized (no icon/label, missing from filter tabs)
3. `rejected_redemption` / `cancelled_redemption` showed confusing "-0 RCN" in red
4. `service_redemption_refund` not included in any filter tab
5. No pagination — capped at 50 most-recent transactions
6. 10-minute stale cache delayed new transactions from appearing
7. Generic "FixFlow" fallback shown for any missing `shopName`

## Analysis

### Root causes

- **Chip truncation:** `FilterChip` was inside a horizontal `ScrollView` without `flexShrink: 0`; the chip flex-shrunk and wrapped/clipped text on some devices.
- **Mint handling:** `getTransactionConfig` in `TransactionHistoryCard.tsx` had no `mint` case, falling through to the generic `formatSnakeCase` default. `useCustomerHistoryListUI.ts` filter whitelists also excluded `mint`. (Most mints are transformed to `earned` server-side, but admin manual mints and any untransformed paths still arrive as `mint`.)
- **Zero-amount display:** Card unconditionally rendered `{sign}{Math.abs(amount)} RCN`, producing "-0 RCN" for rejected/cancelled rows where `amount = 0`.
- **Refund filter gap:** Filter `switch` in `useCustomerHistoryListUI.ts` omitted `service_redemption_refund` from the "redeemed" bucket.
- **No pagination:** `useCustomerTransactionsQuery` used `useQuery` with a flat `limit: 50`. Backend already supports `?page=N` and returns `pagination.hasMore`, but mobile never consumed it.
- **Stale cache:** `staleTime: 10 * 60 * 1000` meant up to 10 minutes before new transactions were visible without pull-to-refresh.
- **FixFlow fallback:** Blanket `{props.shopName || "FixFlow"}` misattributed shop transactions with missing data to the platform.

## Implementation

### Files modified

- `mobile/feature/history/components/FilterChip.tsx`
  - Added `style={{ flexShrink: 0 }}` and `numberOfLines={1}` to prevent shrink/wrap inside horizontal ScrollView.

- `mobile/feature/history/components/TransactionHistoryCard.tsx`
  - Added dedicated `mint` branch in `getTransactionConfig` (blue wallet icon, "Minted to Wallet" label, positive amount).
  - Rendered `—` instead of "-0 RCN" when `amount === 0`.
  - Context-aware shop fallback: platform types (`tier_bonus`, `referral`, `bonus`, `mint`) still show `FixFlow`; other missing shop names show `Unknown Shop`.

- `mobile/feature/history/hooks/ui/useCustomerHistoryListUI.ts`
  - Added `mint` to "earned" filter whitelist and stats aggregation.
  - Added `service_redemption_refund` to "redeemed" filter whitelist.
  - Added `gift_received` / `gift_sent` aliases to "gifts" filter.
  - Flattened paged data via `data.pages.flatMap(...)`.
  - Exposed `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`.

- `mobile/feature/history/hooks/queries/useCustomerTransactionsQuery.ts`
  - Switched to `useInfiniteQuery` (page size 20).
  - Reduced `staleTime` from 10 min to 2 min.
  - Key namespaced with `"infinite"` to avoid collision with the legacy `useGetTransactionsByWalletAddress` hook in `shared/hooks/customer/useCustomer.ts`.

- `mobile/feature/history/screens/CustomerHistoryScreen.tsx`
  - Wired `onEndReached` → `fetchNextPage` (0.5 threshold).
  - Added `ListFooterComponent` with `ActivityIndicator` while fetching next page.

- `mobile/shared/services/customer.services.ts`
  - `getTransactionByWalletAddress` now accepts optional `page` (defaults to 1) and appends it to the query string.

### Approach

Targeted changes following the suggested fixes in the bug report. Kept the infinite query key prefixed with the existing `queryKeys.customerTransactions(address)` so existing `invalidateQueries` calls (e.g. in `gift-token/hooks/useToken.ts`) still match by prefix.

## Verification Checklist

- [x] "This Week" filter shows full label (not truncated to "This")
- [x] Mint transactions show wallet icon with "Minted to Wallet" label
- [x] Mint transactions appear under the "Earned" filter tab
- [x] Refund transactions appear under "Redeemed" filter tab
- [x] Rejected/cancelled redemptions with 0 amount show neutral "—" instead of "-0 RCN"
- [x] Transactions beyond the first page are accessible (infinite scroll)
- [x] New transactions appear within 2 minutes (staleTime reduced)
- [x] Platform transactions (`tier_bonus`, `referral`, `bonus`, `mint`) show "FixFlow"
- [x] Shop transactions with missing shop data show "Unknown Shop"
- [x] All filter tabs (Earned, Redeemed, Gifts) show correct transactions
- [x] Date filters (Today, This Week, This Month) still work
- [x] Search filters by shop name, type, and description still work

## Notes

- **Test data:** Customer "Qua Ting" (55+ transactions including 31 mints). Verify mints are now filterable under "Earned" and scroll loads pages beyond the first 20.
- **Regression areas:** Shop purchase history screen (`ShopHistoryScreen`) uses the same `TransactionHistoryCard` shop variant — untouched.
- **Follow-up (not in scope):**
  - Invalidate `queryKeys.customerTransactions(address)` in mutation `onSuccess` handlers for redemption approval, booking completion, and mint-to-wallet flows so new transactions appear immediately rather than after 2 minutes. Existing `gift-token/hooks/useToken.ts` already does this for transfers.
  - Consider a dedicated "Minted" or "Refunds" filter tab if these categories become more common.
  - Option to hide 0-amount rejected/cancelled entirely if user research shows customers find them noise rather than useful history.

# Bug: Transaction History Screen — Multiple Issues

**Status:** Open
**Priority:** Medium
**Est. Effort:** 3-4 hrs
**Created:** 2026-04-16
**Updated:** 2026-04-16

---

## Overview

QA investigation of the customer Transaction History screen revealed 7 issues ranging from a UI rendering bug to missing transaction type categorization and stale caching.

---

## Issue 1: "This Week" Filter Label Truncated to "This"

**Priority:** High (visible to all users)

**File:** `feature/history/components/FilterChip.tsx`
**Constants:** `feature/history/constants/DATE_FILTERS.ts`

The `DATE_FILTERS` constant correctly defines `label: "This Week"` but the chip renders as just "This" on screen. The FilterChip has no fixed width and uses `px-4 py-2 rounded-full` — there should be enough room.

**Likely cause:** NativeWind rendering issue where the chip doesn't expand to fit text within the horizontal `ScrollView`, or a className application race condition on certain devices.

**Fix:** Add explicit `whitespace-nowrap` or use inline `style={{ minWidth: ... }}` to prevent text wrapping/clipping:

```typescript
<TouchableOpacity
  onPress={onPress}
  className={`px-4 py-2 rounded-full mr-2 ${
    isActive ? "bg-[#FFCC00]" : "bg-zinc-800"
  }`}
  activeOpacity={0.7}
  style={{ flexShrink: 0 }}  // Prevent shrinking in ScrollView
>
```

---

## Issue 2: `mint` Transactions Not Categorized

**Priority:** Medium

**File:** `feature/history/components/TransactionHistoryCard.tsx` (line 15-111)
**File:** `feature/history/hooks/ui/useCustomerHistoryListUI.ts` (lines 46-58)

Mint-to-wallet transactions (`type: "mint"`) fall through to the default case in `getTransactionConfig` — showing a generic gray activity icon with snake_case label "Mint". Customer "Qua Ting" has 31 mint transactions (476 RCN) that show under "All" but don't appear under any filter tab ("Earned", "Redeemed", "Gifts").

**Fix — TransactionHistoryCard.tsx:** Add a `mint` case:

```typescript
// After the earned types block
if (lowerType === "mint") {
  return {
    isPositive: false,
    bgColor: "bg-blue-100",
    iconColor: "#3B82F6",
    icon: <Ionicons name="wallet-outline" color="#3B82F6" size={18} />,
    label: "Minted to Wallet",
    amountColor: "text-blue-400",
  };
}
```

**Fix — useCustomerHistoryListUI.ts:** Decide which filter tab includes mints. Options:
- Add a new "Minted" filter tab
- Include under "Redeemed" (since it reduces platform balance)
- Keep under "All" only but with proper icon/label

---

## Issue 3: `rejected_redemption` / `cancelled_redemption` Show "-0 RCN" in Red

**Priority:** Low

**File:** `feature/history/components/TransactionHistoryCard.tsx` (lines 91-99)

These transaction types have `amount: 0` in the database. The card renders as "-0 RCN" with red text and an X icon — confusing because nothing was actually deducted.

**Fix:** Either hide 0-amount transactions or show a distinct display:

```typescript
// Option A: Hide 0-amount rejected/cancelled from the list
filtered = filtered.filter((tx) => {
  if (["rejected_redemption", "cancelled_redemption"].includes(tx.type?.toLowerCase()) && tx.amount === 0) {
    return false;
  }
  return true;
});

// Option B: Show "Cancelled" / "Rejected" with neutral styling instead of red "-0 RCN"
if (props.amount === 0) {
  return (
    // Show "No charge" or just the status label without amount
  );
}
```

---

## Issue 4: `service_redemption_refund` Not Categorized in Filters

**Priority:** Medium

**File:** `feature/history/hooks/ui/useCustomerHistoryListUI.ts` (lines 46-58)

Refund transactions (`service_redemption_refund`) don't appear under any filter tab. They're only visible under "All". The `getTransactionConfig` handles them correctly (blue refund icon) but the filter logic doesn't include them.

**Fix:** Include refunds under the "Redeemed" filter (they're related to redemptions):

```typescript
case "redeemed":
  return ["redeemed", "redemption", "service_redemption", "service_redemption_refund"].includes(type);
```

Or add a dedicated "Refunds" filter tab if refunds become more common.

---

## Issue 5: No Pagination — Limited to 50 Transactions

**Priority:** Medium

**File:** `feature/history/hooks/queries/useCustomerTransactionsQuery.ts` (line 7)

The query fetches `limit: 50` transactions with no pagination or infinite scroll. Customers with more than 50 transactions cannot see older ones. Customer "Qua Ting" has 55+ transactions — some are already invisible.

**Fix:** Implement infinite scroll with `useInfiniteQuery`:

```typescript
export function useCustomerTransactionsQuery() {
  const { account } = useAuthStore();
  const address = account?.address || "";

  return useInfiniteQuery({
    queryKey: [...queryKeys.customerTransactions(address), 'infinite'],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await customerApi.getTransactionByWalletAddress(address, 20, pageParam);
      return response.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination?.hasMore) return (lastPage.pagination.page || 1) + 1;
      return undefined;
    },
    enabled: !!address,
    staleTime: 2 * 60 * 1000,
  });
}
```

Also add "Load More" button or `onEndReached` to the FlatList in `CustomerHistoryScreen.tsx`.

---

## Issue 6: 10-Minute Stale Cache

**Priority:** Low

**File:** `feature/history/hooks/queries/useCustomerTransactionsQuery.ts` (line 22)

`staleTime: 10 * 60 * 1000` (10 minutes) means a customer won't see new transactions for up to 10 minutes after completing a redemption or earning RCN, unless they manually pull-to-refresh.

**Fix:** Reduce staleTime to 2 minutes, and invalidate the query after key actions:

```typescript
staleTime: 2 * 60 * 1000, // 2 minutes
```

Also invalidate after redemption approval, booking completion, etc.:

```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.customerTransactions(address) });
```

---

## Issue 7: "FixFlow" Fallback for Missing Shop Names

**Priority:** Low

**File:** `feature/history/components/TransactionHistoryCard.tsx` (line 137)

```typescript
{props.shopName || "FixFlow"}
```

When `shopName` is null/undefined, "FixFlow" is shown as the transaction source. This is correct for platform-level transactions (referral bonuses, tier bonuses from the system) but misleading when shop data is simply missing from the API response.

**Fix:** Use context-aware fallback:

```typescript
{props.shopName || (
  ["tier_bonus", "referral", "bonus"].includes(props.type?.toLowerCase())
    ? "FixFlow"
    : "Unknown Shop"
)}
```

---

## Issue 8: No Back Button on Transaction History Screen

**Priority:** High (navigation dead-end on some entry points)

**File:** `feature/history/screens/CustomerHistoryScreen.tsx`

The Transaction History screen has no back button or navigation header. When accessed from certain entry points (e.g., the Redeem screen "History" button), the user has no visible way to go back — they must use the device's hardware/gesture back or tap a bottom tab to navigate away.

**Fix:** Add a back button header to the screen:

```typescript
// Add at the top of the return, inside the header View
<View className="flex-row items-center mb-4">
  <TouchableOpacity onPress={() => router.back()} className="mr-3">
    <Ionicons name="arrow-back" size={24} color="white" />
  </TouchableOpacity>
  <Text className="text-white text-2xl font-bold">
    Transaction History
  </Text>
</View>
```

Note: If the screen is also used as a tab destination (bottom "History" tab), the back button should only appear when navigated to via push (not as the tab root). Check if the screen is rendered in both contexts and conditionally show the back button.

---

## Files to Modify

| File | Issues |
|------|--------|
| `feature/history/components/FilterChip.tsx` | #1 — Fix text truncation |
| `feature/history/components/TransactionHistoryCard.tsx` | #2 — Add `mint` config, #3 — Handle 0-amount display, #7 — Context-aware fallback |
| `feature/history/hooks/ui/useCustomerHistoryListUI.ts` | #3 — Optionally hide 0-amount cancelled/rejected, #4 — Add refunds to filter |
| `feature/history/hooks/queries/useCustomerTransactionsQuery.ts` | #5 — Pagination, #6 — Reduce staleTime |
| `feature/history/screens/CustomerHistoryScreen.tsx` | #5 — Add Load More / infinite scroll, #8 — Add back button |

---

## Verification Checklist

- [ ] "This Week" filter shows full label (not truncated to "This")
- [ ] Mint transactions show wallet icon with "Minted to Wallet" label
- [ ] Mint transactions appear under appropriate filter tab
- [ ] Refund transactions appear under "Redeemed" filter tab
- [ ] Rejected/cancelled redemptions with 0 amount don't show confusing "-0 RCN"
- [ ] Transactions beyond 50 are accessible (pagination or infinite scroll)
- [ ] New transactions appear within 2 minutes (or immediately after action)
- [ ] Platform transactions (tier bonus, referral) show "FixFlow"
- [ ] Transactions with missing shop data show "Unknown Shop" (not "FixFlow")
- [ ] All filter tabs (Earned, Redeemed, Gifts) show correct transactions
- [ ] Date filters (Today, This Week, This Month) work correctly
- [ ] Search filters by shop name, type, and description
- [ ] Back button visible when navigated from Redeem → History
- [ ] Back button hidden (or harmless) when History is the active bottom tab

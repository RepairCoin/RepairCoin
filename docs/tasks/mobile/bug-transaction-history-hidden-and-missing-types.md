# Bug: Transaction History — Hidden & Missing Transaction Types on Mobile

**Status:** confirmed
**Priority:** high
**Date:** 2026-03-30
**Platform:** Mobile (React Native / Expo)

---

## Summary

The mobile Transaction History explicitly filters out `rejected_redemption` and `cancelled_redemption` transactions, making them invisible to customers. These same transactions display correctly on the web frontend. Additionally, several transaction types fall outside any filter category and some have no icon/label mapping.

---

## Bug 1: Rejected & Cancelled Transactions Hidden (HIGH)

**File:** `mobile/feature/history/hooks/ui/useCustomerHistoryListUI.ts` (lines 30-33)

```typescript
return transactions.filter((tx) => {
  const type = tx.type?.toLowerCase() || "";
  return !["rejected_redemption", "cancelled_redemption", "rejected", "cancelled"].includes(type);
});
```

**Impact:** Customers cannot see when they rejected an incoming redemption request or when a shop cancelled a redemption. The web frontend shows these correctly with "Rejected" (orange badge) and "Cancelled" (gray badge).

**Evidence:**
- Web shows `rejected_redemption` from Shop Peanut (sc1.png)
- Mobile "All" tab does not show it (sc2.png)
- Mobile "Today" filter shows 0 transactions despite the rejection happening today (sc3.png)

**Icons already exist but are dead code** — `TransactionHistoryCard.tsx` (lines 70-78) has the red X icon and "Rejected"/"Cancelled" labels mapped, but they never render because the data is filtered before reaching the component.

**Fix:** Remove the exclusion filter in `useCustomerHistoryListUI.ts` lines 30-33. Replace with a pass-through:

```typescript
const rawTransactions = useMemo((): TransactionData[] => {
  return transactionData?.transactions || [];
}, [transactionData]);
```

---

## Bug 2: Missing Filter Categories for Some Transaction Types (MEDIUM)

**File:** `mobile/feature/history/hooks/ui/useCustomerHistoryListUI.ts` (lines 51-65)

Current filter mapping:

| Filter Tab | Types Included | Types Missing |
|---|---|---|
| Earned | `earned`, `bonus`, `referral`, `tier_bonus` | — |
| Redeemed | `redeemed`, `redemption`, `service_redemption` | `service_redemption_refund` |
| Gifts | `transfer_in`, `transfer_out`, `gift` | — |
| *(none)* | — | `rejected_redemption`, `cancelled_redemption`, `cross_shop_verification` |

**Impact:**
- `service_redemption_refund` — only visible under "All", not under "Redeemed" where it logically belongs
- `cross_shop_verification` — only visible under "All", no dedicated filter
- `rejected_redemption` / `cancelled_redemption` — once Bug 1 is fixed, these will only appear under "All" with no filter category

**Fix:** Add missing types to filter cases and/or add a new "Other" or "Status" filter:

```typescript
case "redeemed":
  return ["redeemed", "redemption", "service_redemption", "service_redemption_refund",
          "rejected_redemption", "cancelled_redemption", "cross_shop_verification"].includes(type);
```

---

## Bug 3: Missing Icon/Label for `service_redemption_refund` and `cross_shop_verification` (LOW)

**File:** `mobile/feature/history/components/TransactionHistoryCard.tsx`

These types fall through to the default gray "activity" icon:

| Type | Current Display | Expected Display |
|---|---|---|
| `service_redemption_refund` | Gray activity icon, raw type string | Green refund icon, "Refund" label |
| `cross_shop_verification` | Gray activity icon, raw type string | Teal/blue icon, "Verified" label |

The web frontend already has proper labels for these ("Refund" green badge, "Verified" teal badge).

**Fix:** Add config entries in `getTransactionConfig()`:

```typescript
if (lowerType === "service_redemption_refund") {
  return {
    isPositive: true,
    bgColor: "bg-green-100",
    iconColor: "#10B981",
    icon: <MaterialIcons name="refresh" color="#10B981" size={18} />,
    label: "Refund",
    amountColor: "text-green-400",
  };
}

if (lowerType === "cross_shop_verification") {
  return {
    isPositive: false,
    bgColor: "bg-teal-100",
    iconColor: "#14B8A6",
    icon: <MaterialIcons name="verified" color="#14B8A6" size={18} />,
    label: "Verified",
    amountColor: "text-teal-400",
  };
}
```

---

## All Backend Transaction Types vs Mobile Support

| Transaction Type | Backend | Web | Mobile Displayed | Mobile Icon | Mobile Filter |
|---|---|---|---|---|---|
| `mint`/`earned` | Yes | Yes | Yes | Green check | Earned |
| `redeem`/`redeemed` | Yes | Yes | Yes | Red dash | Redeemed |
| `tier_bonus` | Yes | Yes | Yes | Green check | Earned |
| `referral` | Yes | Yes | Yes | Green check | Earned |
| `transfer_in` | Yes | Yes | Yes | Purple gift | Gifts |
| `transfer_out` | Yes | Yes | Yes | Purple gift | Gifts |
| `service_redemption` | Yes | Yes | Yes | Orange discount | Redeemed |
| `service_redemption_refund` | Yes | Yes | Yes | Gray default | None (All only) |
| `cross_shop_verification` | Yes | Yes | Yes | Gray default | None (All only) |
| `rejected_redemption` | Yes | Yes | **NO — filtered out** | Red X (dead code) | **None** |
| `cancelled_redemption` | Yes | Yes | **NO — filtered out** | Red X (dead code) | **None** |

---

## Files to Modify

1. `mobile/feature/history/hooks/ui/useCustomerHistoryListUI.ts` — Remove exclusion filter, add missing filter categories
2. `mobile/feature/history/components/TransactionHistoryCard.tsx` — Add icon/label configs for `service_redemption_refund` and `cross_shop_verification`
3. `mobile/feature/history/constants/TRANSACTION_FILTERS.ts` — (Optional) Consider adding a new filter tab if needed

---

## Reproduction Steps (Bug 1)

1. Login as a shop (e.g., Shop Peanut)
2. Initiate a redemption request to customer `0x6cd036477D1C39dA021095a62A32c6bB919993Cf`
3. Login as the customer on mobile
4. Reject the incoming redemption
5. Go to Transaction History — the rejection does NOT appear
6. Check web Transaction History — the rejection DOES appear with "Rejected" badge

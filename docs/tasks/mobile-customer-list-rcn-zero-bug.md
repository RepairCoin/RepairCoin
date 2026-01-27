# Mobile Customer List - RCN Shows Zero Bug

## Priority: Medium
## Status: Open
## Assignee: Mobile Developer
## Created: January 21, 2026

## Problem

The mobile app's "Customers List" screen shows "0 RCN" for all customers, even though they have earned RCN at the shop and have transaction history.

### Current Behavior

1. Shop owner opens "Customer" tab in mobile app
2. Customer List displays all customers with their tiers and transaction counts
3. **Bug**: All customers show "0 RCN" regardless of actual earnings
4. Transaction counts display correctly (e.g., "4 transactions", "21 transactions")

### Expected Behavior

1. Customer List should show actual RCN earned at this shop
2. Example: Lee Ann should show "34 RCN" not "0 RCN"

## Root Cause

**Field name mismatch between API response and mobile interface.**

### API Response (snake_case)

The backend API `GET /shops/{shopId}/customers` returns:

```json
{
  "customers": [
    {
      "address": "0x960Aa947...",
      "name": "Lee Ann",
      "tier": "SILVER",
      "lifetime_earnings": 34,
      "last_transaction_date": "2026-01-14T...",
      "total_transactions": 4
    }
  ]
}
```

### Mobile Interface (camelCase)

`mobile/interfaces/customer.interface.ts`:

```typescript
export interface CustomerData {
  address: string;
  name: string;
  tier: string;
  lifetimeEarnings: number;  // ← Expects camelCase
  total_transactions: number;
  // ...
}
```

### The Mismatch

| API Field | Mobile Interface | Result |
|-----------|------------------|--------|
| `lifetime_earnings` | `lifetimeEarnings` | `undefined` → 0 |
| `total_transactions` | `total_transactions` | Works correctly |

The mobile code accesses `item.lifetimeEarnings` but the API returns `lifetime_earnings`, so it gets `undefined` which displays as "0 RCN".

## Solution

Transform the API response in the query hook to map snake_case to camelCase.

### File to Modify

`mobile/feature/tabs/customer/hooks/queries/useCustomerQueries.ts`

### Code Change

```typescript
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { shopApi } from "@/services/shop.services";
import { useAuthStore } from "@/store/auth.store";
import { CustomerData } from "@/interfaces/customer.interface";

export function useShopCustomersQuery() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  return useQuery({
    queryKey: queryKeys.shopCustomers(shopId),
    queryFn: async () => {
      const response = await shopApi.getShopCustomers(shopId);
      const data = response?.data;

      // Transform snake_case API response to camelCase for mobile interface
      if (data?.customers) {
        data.customers = data.customers.map((customer: any): CustomerData => ({
          ...customer,
          // Map snake_case to camelCase
          lifetimeEarnings: customer.lifetime_earnings || customer.lifetimeEarnings || 0,
          lastTransactionDate: customer.last_transaction_date || customer.lastTransactionDate,
          total_transactions: customer.total_transactions || 0,
        }));
      }

      return data;
    },
    enabled: !!shopId,
    staleTime: 10 * 60 * 1000,
  });
}
```

## Testing Checklist

- [ ] Customer List shows correct RCN values (not all zeros)
- [ ] Transaction counts still display correctly
- [ ] Tier badges display correctly
- [ ] Customer names display correctly
- [ ] Pull-to-refresh updates the data
- [ ] Search filtering still works
- [ ] Tapping customer card navigates to profile

## Related Files

- Query hook: `mobile/feature/tabs/customer/hooks/queries/useCustomerQueries.ts`
- UI hook: `mobile/feature/tabs/customer/hooks/ui/useCustomerListUI.ts`
- Screen: `mobile/feature/tabs/customer/screens/CustomerListScreen.tsx`
- Card component: `mobile/feature/tabs/customer/components/CustomerCard.tsx`
- Interface: `mobile/interfaces/customer.interface.ts`
- Backend API: `backend/src/repositories/ShopRepository.ts` (getShopCustomers method)

## Notes

- The web frontend handles this correctly by transforming the data in `CustomersTab.tsx:172`:
  ```typescript
  lifetimeEarnings: c.lifetime_earnings || c.lifetimeEarnings || 0,
  ```
- Consider standardizing API responses to camelCase across the backend to avoid similar issues

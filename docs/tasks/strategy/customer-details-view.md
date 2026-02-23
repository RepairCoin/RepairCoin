# Strategy: Customer Details View (Click to View)

## Overview

Enable shop owners to click on a customer row in the Customers tab to view detailed customer information, transaction history, and analytics.

## Current State Analysis

### What Already Exists

1. **CustomerDetailsModal** (`frontend/src/components/shop/customers/CustomerDetailsModal.tsx`)
   - Fully functional modal with 487 lines of code
   - Shows customer info, balance, lifetime earned, total redeemed
   - Has 3 tabs: Overview, Recent Transactions, History
   - Already imported and rendered in CustomersTab.tsx

2. **handleViewProfile Function** (`CustomersTab.tsx:283`)
   ```typescript
   const handleViewProfile = (address: string) => {
     setSelectedCustomer(address);
   };
   ```

3. **Modal Integration** (`CustomersTab.tsx:912-919`)
   ```typescript
   {selectedCustomer && (
     <CustomerDetailsModal
       customerAddress={selectedCustomer}
       shopId={shopId}
       onClose={() => setSelectedCustomer(null)}
     />
   )}
   ```

### What's Missing

The customer rows in "My Customers" table (lines 597-648) do NOT have an `onClick` handler. The `handleViewProfile` function is only passed to `CustomerCard` component in the "Search All Customers" view.

## Implementation Approach

### Recommendation: Simple Fix (Estimated: 5 minutes)

Add `onClick` and `cursor-pointer` to the customer row div.

### File to Modify

`frontend/src/components/shop/tabs/CustomersTab.tsx`

### Code Change

**Location:** Lines 598-600

**Before:**
```tsx
<div
  key={customer.address}
  className="px-7 py-4 hover:bg-[#1a1a1a] transition-colors"
>
```

**After:**
```tsx
<div
  key={customer.address}
  className="px-7 py-4 hover:bg-[#1a1a1a] transition-colors cursor-pointer"
  onClick={() => handleViewProfile(customer.address)}
>
```

## Customer Details Modal Features

The existing modal already provides:

### Header Section
- Customer avatar (profile image or tier emoji)
- Customer name and wallet address (copyable)
- Close button

### Stats Cards (4-column grid)
- Tier badge with icon
- Current RCN Balance
- Lifetime Earned (green)
- Total Redeemed (blue)

### Tabs

**Overview Tab:**
- Customer details
- Join date
- Last transaction
- Email
- Status (Active/Inactive)

**Recent Transactions Tab:**
- Transaction history
- Type, amount, status, shop name
- Color-coded (green for earn, blue for spend)

**History Tab:**
- Monthly activity breakdown
- Earnings vs redemptions chart

## API Endpoints Used by Modal

The modal fetches data from 4 endpoints in parallel:

```typescript
const [detailsRes, balanceRes, transactionsRes, analyticsRes] = await Promise.all([
  fetch(`/customers/{address}`),
  fetch(`/tokens/balance/{address}`),
  fetch(`/customers/{address}/transactions?limit=10`),
  fetch(`/customers/{address}/analytics`)
]);
```

All endpoints are already implemented and working.

## Testing Checklist

- [ ] Click customer row opens modal
- [ ] Modal displays correct customer info
- [ ] Balance shows correctly
- [ ] Transaction history loads
- [ ] Tabs switch properly
- [ ] Close button works
- [ ] Click outside modal closes it
- [ ] Works on mobile (responsive)

## No Backend Changes Required

All necessary API endpoints exist:
- `GET /customers/{address}` - Customer details
- `GET /tokens/balance/{address}` - RCN balance
- `GET /customers/{address}/transactions` - Transaction history
- `GET /customers/{address}/analytics` - Analytics data

## Alternative Approach (If More Features Needed)

If a full page is preferred over a modal:

1. Create route: `/shop/customers/[address]`
2. Create page component with same data
3. Use `router.push()` instead of modal

However, **modal approach is recommended** because:
- Already implemented
- Faster UX (no page navigation)
- Consistent with other shop dashboard patterns
- Less code to maintain

## Files Reference

| File | Purpose |
|------|---------|
| `frontend/src/components/shop/tabs/CustomersTab.tsx` | Main customers tab - add onClick |
| `frontend/src/components/shop/customers/CustomerDetailsModal.tsx` | Existing modal - no changes needed |
| `frontend/src/components/shop/customers/CustomerCard.tsx` | Card component - already has onViewProfile |

## Implementation Priority

**Priority:** Low effort, high impact
**Complexity:** Trivial (1-line change)
**Risk:** None - using existing, tested code

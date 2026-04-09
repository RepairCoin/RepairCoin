# Bug: Customer Cannot View Group Token Balances (Component Built but Not Rendered)

## Status: Open
## Priority: Medium
## Date: 2026-04-09
## Category: Bug - Missing UI Integration
## Affected: Customer dashboard (web)

---

## Overview

Customers who earn affiliate group tokens (e.g., 1,820 AMS from Amazing Resto) have no way to view their group token balances on the web. The `GroupBalancesCard` component is fully built but never imported or rendered on any page.

---

## What Exists

| Item | Status |
|---|---|
| `GroupBalancesCard` component | Built (`frontend/src/components/customer/GroupBalancesCard.tsx`) |
| API endpoint | Works (`GET /api/affiliate-shop-groups/balances/{customerAddress}`) |
| Backend data | Works (balances stored in `customer_affiliate_group_balances` table) |
| **Import on any page** | **Missing — component is orphaned** |

The component:
- Fetches all group balances for the connected wallet
- Shows group name, token symbol, icon, balance, lifetime earned
- Has expandable view for multiple groups
- Single API call (group data embedded in response)

---

## Fix Required

Import and render `GroupBalancesCard` on the customer dashboard. Suggested locations:

### Option A: Customer Overview tab (recommended)
Add below the RCN balance cards on the main overview:

```typescript
// In OverviewTab.tsx or CustomerDashboardClient.tsx
import GroupBalancesCard from '@/components/customer/GroupBalancesCard';

// Render after RCN balance section
<GroupBalancesCard />
```

### Option B: Dedicated "Gift Tokens" tab
The sidebar already has a "Gift Tokens" link — add group balances there alongside the token gifting feature.

### Option C: Both locations
Show a compact summary on Overview, full detail on Gift Tokens page.

---

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/customer/OverviewTab.tsx` | Import and render `GroupBalancesCard` |
| OR `frontend/src/app/(authenticated)/customer/CustomerDashboardClient.tsx` | Add to dashboard layout |

---

## QA Test Plan

1. Login as customer who has earned group tokens (e.g., Mamaw Cou with 1,820 AMS)
2. Go to Customer Dashboard → Overview
3. **Before fix**: No group token section visible
4. **After fix**: See "Amazing Resto — 1,820 AMS" in group balances section
5. Customer with no group tokens → section hidden or shows empty state

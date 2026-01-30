# Subscription Guard Standardization

## Overview

Standardized subscription blocking across all operational shop tabs using the `SubscriptionGuard` wrapper component in `ShopDashboardClient.tsx`. This replaces the previous inconsistent approach where some tabs used inline `isBlocked` props and others used the `useSubscriptionStatus` hook directly.

## How It Works

### Frontend (UX Layer)
Each operational tab is wrapped with `<SubscriptionGuard shopData={shopData}>` in `ShopDashboardClient.tsx`. When a shop cannot perform operations (expired, suspended, paused, not qualified), the guard renders a `BlockedOverlay` on top of the tab content, preventing interaction.

### Backend (Security Layer)
The `subscriptionGuard` middleware in `backend/src/middleware/subscriptionGuard.ts` independently validates subscription status on every API call. Even if a user removes the frontend overlay via browser DevTools, the backend rejects requests with HTTP 403.

**The frontend overlay is UX guidance. The backend middleware is the actual security enforcement.**

## Changes Made

### File: `frontend/src/components/shop/ShopDashboardClient.tsx`

**Added import:**
```tsx
import { SubscriptionGuard } from "@/components/shop/SubscriptionGuard";
```

**Wrapped these tabs with `<SubscriptionGuard shopData={shopData}>`:**

| Tab | Line (approx) | Notes |
|-----|---------------|-------|
| `services` | ~995 | Previously used `useSubscriptionStatus` hook internally |
| `bookings` | ~999 | Previously used `isBlocked`/`blockReason` props only |
| `appointments` | ~1011 | Previously had NO blocking |
| `messages` | ~1015 | Previously had NO blocking |
| `reschedules` | ~1019 | Previously had NO blocking |
| `purchase` | ~1023 | Previously used `isBlocked`/`blockReason` props only |
| `tools` (Issue Rewards, Redeem) | ~1049 | Previously used `isBlocked`/`blockReason` props only |
| `shop-location` | ~1067 | Previously had NO blocking |
| `marketing` | ~1083 | Previously had NO blocking |
| `groups` | ~1107 | Previously used `subscriptionActive` prop only |

**Tabs NOT wrapped (always accessible):**

| Tab | Reason |
|-----|--------|
| `overview` | Read-only dashboard summary |
| `customers` | Read-only customer browsing |
| `analytics` | Read-only analytics |
| `service-analytics` | Read-only analytics |
| `bonuses` | Read-only tier info |
| `settings` | Must be accessible to manage account |
| `subscription` | Must be accessible to reactivate subscription |
| `profile` | Must be accessible to update profile |
| `staking` | Independent of subscription |

## How to Add Blocking to a New Tab

Simply wrap the tab component in `ShopDashboardClient.tsx`:

```tsx
{activeTab === "your-new-tab" && shopData && (
  <SubscriptionGuard shopData={shopData}>
    <YourNewTab ... />
  </SubscriptionGuard>
)}
```

No changes needed inside the tab component itself.

## Revert Instructions

To revert ALL changes, remove the `<SubscriptionGuard shopData={shopData}>` wrapper from each tab in `ShopDashboardClient.tsx`. The tabs will fall back to their original blocking behavior (inline `isBlocked` props or no blocking).

### Revert Steps

1. Remove the import line:
```tsx
// DELETE this line:
import { SubscriptionGuard } from "@/components/shop/SubscriptionGuard";
```

2. For each wrapped tab, change from:
```tsx
{activeTab === "services" && shopData && (
  <SubscriptionGuard shopData={shopData}>
    <ServicesTab shopId={shopData.shopId} shopData={shopData} />
  </SubscriptionGuard>
)}
```

Back to:
```tsx
{activeTab === "services" && shopData && (
  <ServicesTab shopId={shopData.shopId} shopData={shopData} />
)}
```

3. Repeat for all 10 wrapped tabs listed above.

**Note:** The existing `isBlocked`/`blockReason` props were intentionally kept on tabs that already had them (bookings, purchase, tools). This means reverting the SubscriptionGuard wrapper will restore the original inline blocking behavior for those tabs without any additional changes.

## Previous Blocking Approaches (Before Standardization)

### Pattern A: `isBlocked` prop (IssueRewards, Redeem, Purchase, Bookings)
- Parent passes `isBlocked` and `blockReason` as props
- Each component manually disables buttons/inputs
- Inconsistent: each tab implements blocking differently

### Pattern B: `useSubscriptionStatus` hook (Services)
- Tab imports and calls the hook directly with `shopData`
- Uses `canPerformOperations` to control UI
- More complete but requires each tab to implement separately

### Pattern C: No blocking (Appointments, Messages, Marketing, etc.)
- No subscription check at all
- Operations could be attempted (backend would still reject)

### New Pattern: `SubscriptionGuard` wrapper
- Single wrapper at parent level
- Consistent overlay for all blocked tabs
- Zero changes needed inside tab components
- Easy to add/remove per tab

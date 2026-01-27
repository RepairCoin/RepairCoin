# Shop Subscription Validation & Enforcement

## Status: Done

## Priority: High

## Type: Enhancement / Security

## Summary
Prevent shops from performing operations (creating services, issuing rewards, processing redemptions) when their Stripe subscription is paused, expired, or cancelled.

## Completed Implementation

### Backend Changes

1. **Created `backend/src/middleware/subscriptionGuard.ts`**
   - New middleware that checks `operational_status` for blocked states: `'paused'`, `'not_qualified'`, `'pending'`
   - RCG qualification bypass (10K+ tokens)
   - Configurable via options object
   - User-friendly error messages with status codes

2. **Updated `backend/src/middleware/auth.ts`**
   - Added 'paused' status check to existing `requireActiveSubscription` middleware
   - Returns 403 with `SUBSCRIPTION_PAUSED` code when shop is paused

3. **Updated `backend/src/repositories/ShopRepository.ts`**
   - Added 'paused' to `operational_status` TypeScript type union

4. **Updated `backend/src/domains/admin/routes/subscription.ts`**
   - **Pause action**: Now updates `shops.operational_status = 'paused'` in addition to `shop_subscriptions.status`
   - **Resume action**: Now updates `shops.operational_status = 'subscription_qualified'` when resuming

5. **Applied middleware to Service Routes (`backend/src/domains/ServiceDomain/routes.ts`)**
   - POST `/` - Create service (protected)
   - PUT `/:id` - Update service (protected)
   - DELETE `/:id` - Delete service (protected)

6. **Created fix script `backend/scripts/fix-paused-shop-status.ts`**
   - One-time script to fix existing shops with paused subscriptions but wrong `operational_status`

### Frontend Changes

1. **Created `frontend/src/hooks/useSubscriptionStatus.ts`**
   - Comprehensive hook for checking subscription status
   - Handles paused, expired, cancelled, pending states
   - RCG qualification bypass check
   - Returns `canPerformOperations` boolean and status message

2. **Created `frontend/src/components/shop/SubscriptionGuard.tsx`**
   - Reusable components for subscription blocking:
     - `useSubscriptionGuard` hook - wraps useSubscriptionStatus with toast/guard utilities
     - `SubscriptionGuard` component - wrapper with overlay
     - `SubscriptionWarningBanner` - standalone warning banner
     - `GuardedInput` - wraps inputs to disable when blocked
     - `GuardedButton` - button that disables when blocked

3. **Updated `frontend/src/components/shop/tabs/ServicesTab.tsx`**
   - Uses `useSubscriptionStatus` hook
   - Shows orange warning banner for paused subscriptions
   - Shows red warning banner for expired/other blocked states
   - Disables Add, Edit, Delete, Toggle buttons when blocked

4. **Updated `frontend/src/components/shop/tabs/IssueRewardsTab.tsx`**
   - Accepts `isBlocked` and `blockReason` props
   - Disables wallet address input when blocked
   - Disables Scan QR button when blocked (with visual feedback)
   - Disables Issue RCN button when blocked
   - Disables promo code input when blocked
   - Shows toast error if user attempts action while blocked

5. **Updated `frontend/src/components/shop/tabs/ToolsTab.tsx`**
   - Passes `isBlocked` and `blockReason` to IssueRewardsTab and RedeemTabV2

6. **Updated `frontend/src/components/shop/ShopDashboardClient.tsx`**
   - Calculates `isPaused` from `operational_status === 'paused'` or `subscriptionStatus === 'paused'`
   - Calculates `isBlocked` including paused, expired, suspended, rejected, pending states
   - Passes `isBlocked` and `getBlockReason()` to child components

---

## How to Apply Subscription Validation to Other Features

### Backend: Using the Middleware

Import and apply the middleware to any route that should be blocked when subscription is paused/expired:

```typescript
// In your routes file
import { requireActiveSubscription } from '../../middleware/subscriptionGuard';

// Apply to protected routes
router.post('/your-endpoint', authMiddleware, requireRole(['shop']), requireActiveSubscription(), yourController.handler);
```

The middleware checks:
- `operational_status === 'paused'` - Blocked
- `operational_status === 'not_qualified'` - Blocked (unless RCG qualified)
- `operational_status === 'pending'` - Blocked
- `operational_status === 'subscription_qualified'` - Allowed
- `operational_status === 'rcg_qualified'` - Allowed (bypasses subscription)

### Frontend: Using Props Pattern (Recommended)

The simplest approach is to pass `isBlocked` and `blockReason` props from the parent component:

```typescript
// In your component
interface MyComponentProps {
  shopId: string;
  isBlocked?: boolean;
  blockReason?: string;
}

export function MyComponent({ shopId, isBlocked = false, blockReason = "Action blocked" }: MyComponentProps) {
  return (
    <div>
      {/* Disable inputs */}
      <input
        type="text"
        disabled={isBlocked}
        className={isBlocked ? "opacity-50 cursor-not-allowed" : ""}
      />

      {/* Disable buttons */}
      <button
        onClick={handleAction}
        disabled={isBlocked}
        className={isBlocked
          ? "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
          : "bg-[#FFCC00] text-black hover:bg-[#FFD700]"
        }
      >
        Action
      </button>
    </div>
  );
}
```

### Frontend: Using the Hook Directly

For components that have direct access to shopData:

```typescript
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

export function MyComponent({ shopData }) {
  const { canPerformOperations, statusMessage, isPaused, isExpired } = useSubscriptionStatus(shopData);

  // Show warning banner
  if (!canPerformOperations && statusMessage) {
    return (
      <div className={`p-4 rounded-lg ${isPaused ? 'bg-orange-900/20 border-orange-500' : 'bg-red-900/20 border-red-500'}`}>
        {statusMessage}
      </div>
    );
  }

  return (
    <button disabled={!canPerformOperations}>
      Do Something
    </button>
  );
}
```

### Frontend: Using SubscriptionGuard Component

For wrapping entire sections with an overlay:

```typescript
import { SubscriptionGuard, useSubscriptionGuard } from "@/components/shop/SubscriptionGuard";

// Option 1: Wrapper with overlay
<SubscriptionGuard shopData={shopData}>
  <YourContent />
</SubscriptionGuard>

// Option 2: Hook for custom logic
const { canPerformOperations, showBlockedToast, guardAction } = useSubscriptionGuard(shopData);

// Guard an action
const handleSubmit = guardAction(() => {
  // This only runs if canPerformOperations is true
  submitForm();
});
```

### Frontend: Using GuardedButton Component

```typescript
import { GuardedButton } from "@/components/shop/SubscriptionGuard";

<GuardedButton
  shopData={shopData}
  onClick={handleAction}
  className="px-4 py-2 rounded-lg"
>
  Action
</GuardedButton>
```

---

## Blocked States Reference

| Status | `operational_status` Value | Blocked? | Color Theme |
|--------|---------------------------|----------|-------------|
| Paused | `'paused'` | Yes | Orange |
| Expired | Subscription past end date | Yes | Red |
| Not Qualified | `'not_qualified'` | Yes | Red |
| Pending | `'pending'` | Yes | Yellow |
| Cancelled (in period) | Has `subscriptionCancelledAt` but before `subscriptionEndsAt` | No | Orange warning |
| RCG Qualified | `'rcg_qualified'` | No | - |
| Subscription Qualified | `'subscription_qualified'` | No | - |

---

## Routes Currently Protected (Backend)

| Route | Method | Description | Middleware Applied |
|-------|--------|-------------|-------------------|
| `/api/services` | POST | Create service | `requireActiveSubscription` |
| `/api/services/:id` | PUT | Update service | `requireActiveSubscription` |
| `/api/services/:id` | DELETE | Delete service | `requireActiveSubscription` |
| `/api/shops/:shopId/issue-reward` | POST | Issue RCN rewards | `requireActiveSubscription` (in auth.ts) |
| `/api/shops/:shopId/process-redemption` | POST | Process redemptions | `requireActiveSubscription` (in auth.ts) |

---

## Features Currently Protected (Frontend)

| Feature | Component | Elements Disabled |
|---------|-----------|-------------------|
| Services | ServicesTab | Add, Edit, Delete, Toggle Active buttons |
| Issue Rewards | IssueRewardsTab | Wallet input, Scan QR button, Issue RCN button, Promo code input |
| Redeem | RedeemTabV2 | (Props passed, needs implementation) |
| Promo Codes | PromoCodesTab | (Needs implementation) |

---

## Testing Checklist

- [x] Backend middleware blocks operations for paused subscriptions
- [x] Backend middleware blocks operations for expired subscriptions
- [x] Backend returns proper error codes (SUBSCRIPTION_INACTIVE, SUBSCRIPTION_EXPIRED, SUBSCRIPTION_PAUSED)
- [x] Admin pause action updates `shops.operational_status` to 'paused'
- [x] Admin resume action updates `shops.operational_status` to 'subscription_qualified'
- [x] Frontend ServicesTab disables buttons when blocked
- [x] Frontend IssueRewardsTab disables inputs/buttons when blocked
- [x] Frontend shows clear messaging about why actions are blocked
- [x] Edge case: Cancelled but still in billing period (should allow operations)
- [x] Edge case: RCG qualified shops bypass subscription check
- [ ] Frontend RedeemTabV2 disables elements when blocked
- [ ] Frontend PromoCodesTab disables elements when blocked
- [ ] Add integration tests

---

## Implementation Files

### Backend
- `backend/src/middleware/subscriptionGuard.ts` - Main middleware
- `backend/src/middleware/auth.ts` - Additional paused check
- `backend/src/repositories/ShopRepository.ts` - Type definitions
- `backend/src/domains/admin/routes/subscription.ts` - Pause/resume updates operational_status
- `backend/src/domains/ServiceDomain/routes.ts` - Protected routes
- `backend/scripts/fix-paused-shop-status.ts` - Fix script for existing data

### Frontend
- `frontend/src/hooks/useSubscriptionStatus.ts` - Status checking hook
- `frontend/src/components/shop/SubscriptionGuard.tsx` - Reusable guard components
- `frontend/src/components/shop/tabs/ServicesTab.tsx` - Services protection
- `frontend/src/components/shop/tabs/IssueRewardsTab.tsx` - Issue rewards protection
- `frontend/src/components/shop/tabs/ToolsTab.tsx` - Props passing
- `frontend/src/components/shop/ShopDashboardClient.tsx` - isBlocked calculation

---

## Notes

- RCG-qualified shops (10K+ RCG tokens) bypass subscription check
- Cancelled subscriptions work until the billing period ends
- Paused subscriptions block ALL operations immediately
- Backend enforcement is the primary security layer; frontend provides UX feedback
- When adding new protected features, always apply both backend middleware AND frontend blocking

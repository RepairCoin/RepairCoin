# Shop Issue Rewards Subscription Guard

## Status: Done

## Priority: High

## Type: Enhancement / Security

## Summary
Prevent shops with paused/expired subscriptions from issuing RCN rewards to customers. Both backend protection and frontend UI blocking are implemented.

## Parent Task
This is part of the broader [Shop Subscription Validation & Enforcement](./shop-subscription-validation-enforcement.md) initiative.

---

## Implementation

### Backend Changes

The backend already had protection via `requireActiveSubscription` middleware in `auth.ts` for the issue reward endpoint. The middleware was updated to check for 'paused' status.

**File: `backend/src/middleware/auth.ts`**

```typescript
// Check if shop is paused
if (shop?.operational_status === 'paused') {
  return res.status(403).json({
    success: false,
    error: 'Your subscription is paused by the administrator',
    code: 'SUBSCRIPTION_PAUSED',
    details: {
      status: 'paused',
      message: 'Your subscription has been temporarily paused. Please contact support or resume your subscription to continue operations.'
    }
  });
}
```

**Protected Endpoint:**
| Method | Route | Action |
|--------|-------|--------|
| POST | `/api/shops/:shopId/issue-reward` | Issue RCN rewards |

### Frontend Changes

**File: `frontend/src/components/shop/tabs/IssueRewardsTab.tsx`**

1. **Added props interface:**
```typescript
interface IssueRewardsTabProps {
  shopId: string;
  shopData: ShopData | null;
  onRewardIssued: () => void;
  isBlocked?: boolean;
  blockReason?: string;
}
```

2. **Disabled wallet address input:**
```typescript
<input
  type="text"
  value={customerAddress}
  onChange={(e) => handleCustomerAddressChange(e.target.value)}
  placeholder="Enter Customer Wallet Address.."
  disabled={isBlocked}
  className={`w-full pl-10 px-4 py-3 bg-white border border-gray-700 text-black rounded-lg ${
    isBlocked ? "opacity-50 cursor-not-allowed" : ""
  }`}
/>
```

3. **Disabled Scan QR button:**
```typescript
<button
  onClick={startQRScanner}
  disabled={isBlocked}
  className={`px-4 py-3 font-semibold rounded-lg transition-all flex items-center gap-2 ${
    isBlocked
      ? "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
      : "bg-[#FFCC00] text-black hover:bg-[#FFD700]"
  }`}
  title={isBlocked ? blockReason : "Scan customer's QR code"}
>
  <Camera className="w-5 h-5" />
  <span>Scan QR</span>
</button>
```

4. **Disabled promo code input:**
```typescript
<input
  type="text"
  value={promoCode}
  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
  placeholder="Enter or Select Promo Code.."
  disabled={isBlocked}
  className={`w-full px-4 py-3 bg-white border text-black rounded-lg ${
    isBlocked ? "opacity-50 cursor-not-allowed" : ""
  }`}
/>
```

5. **Added isBlocked check to Issue RCN button:**
```typescript
<button
  onClick={issueReward}
  disabled={
    isBlocked ||
    processing ||
    !customerAddress ||
    !customerInfo ||
    !hasSufficientBalance ||
    totalReward === 0
  }
  className="w-full bg-[#FFCC00] text-black font-bold py-4 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
>
  <Wallet className="w-5 h-5" />
  Issue {totalReward} RCN
</button>
```

6. **Added early return in issueReward function:**
```typescript
const issueReward = async () => {
  // Check if shop is blocked first
  if (isBlocked) {
    setError(blockReason);
    toast.error(blockReason, {
      duration: 5000,
      position: "top-right",
      style: {
        background: "#EF4444",
        color: "white",
        fontWeight: "bold",
      },
      icon: "🚫",
    });
    return;
  }
  // ... rest of function
};
```

**File: `frontend/src/components/shop/tabs/ToolsTab.tsx`**

Props are passed from ToolsTab to IssueRewardsTab:

```typescript
<IssueRewardsTab
  shopId={shopId}
  shopData={shopData}
  onRewardIssued={onRewardIssued}
  isBlocked={isBlocked}
  blockReason={blockReason ?? undefined}
/>
```

**File: `frontend/src/components/shop/ShopDashboardClient.tsx`**

The `isBlocked` value is calculated and passed down the component tree:

```typescript
// Check if subscription is paused
const isPaused = shopData?.operational_status === 'paused' || shopData?.subscriptionStatus === 'paused';

// Calculate isBlocked
const isBlocked = !!(isSuspended || isRejected || isPending || isPaused || (!isOperational && !isCancelledButActive));

// Get block reason
const getBlockReason = () => {
  if (isSuspended) return "Shop is suspended";
  if (isRejected) return "Shop application was rejected";
  if (isPaused) return "Shop subscription is paused";
  if (isPending) return "Shop application is pending approval";
  if (!isOperational) return "Shop subscription is required or expired";
  return null;
};
```

---

## User Experience

### When Subscription is Paused/Expired/Blocked

**Disabled Elements:**
- Customer wallet address text input (grayed out)
- Scan QR button (grayed out with tooltip)
- Promo code input (grayed out)
- Issue RCN button (grayed out)

**Visual Feedback:**
- All disabled elements have 50% opacity
- Cursor changes to not-allowed
- Scan QR button shows tooltip with block reason
- Toast error appears if user somehow triggers the action

**What Still Works:**
- Viewing the Issue Rewards page
- Seeing the reward calculator
- Viewing available balance
- Customer search dropdown (but selection does nothing useful)

---

## Data Flow

```
ShopDashboardClient
    ↓ calculates isBlocked, getBlockReason()
ToolsTab
    ↓ passes isBlocked, blockReason props
IssueRewardsTab
    ↓ uses props to disable inputs/buttons
```

---

## Testing Checklist

- [x] Backend returns 403 when issuing reward with paused subscription
- [x] Backend returns 403 when issuing reward with expired subscription
- [x] Wallet address input is disabled when blocked
- [x] Scan QR button is disabled when blocked
- [x] Scan QR button shows tooltip with block reason
- [x] Promo code input is disabled when blocked
- [x] Issue RCN button is disabled when blocked
- [x] Toast error appears if submit action is attempted while blocked
- [x] Reward calculator still visible (for reference)
- [x] Available balance still visible
- [x] RCG qualified shops (10K+) can still issue rewards

---

## Files Modified

- `backend/src/middleware/auth.ts` - Added 'paused' status check
- `frontend/src/components/shop/tabs/IssueRewardsTab.tsx` - Added isBlocked/blockReason props, disabled elements
- `frontend/src/components/shop/tabs/ToolsTab.tsx` - Passes props to IssueRewardsTab
- `frontend/src/components/shop/ShopDashboardClient.tsx` - Calculates isBlocked value

---

## Related Tasks

- [Shop Subscription Validation & Enforcement](./shop-subscription-validation-enforcement.md) - Parent task
- [Shop Services Subscription Guard](./shop-services-subscription-guard.md) - Services protection

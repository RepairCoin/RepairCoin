# Shop Redeem Subscription Guard

## Status: Done

## Priority: High

## Type: Enhancement / Security

## Summary
Prevent shops with paused/expired subscriptions from processing customer redemptions. Frontend UI blocking is implemented by disabling inputs and buttons.

## Parent Task
This is part of the broader [Shop Subscription Validation & Enforcement](./shop-subscription-validation-enforcement.md) initiative.

---

## Implementation

### Frontend Changes

**File: `frontend/src/components/shop/tabs/RedeemTabV2.tsx`**

#### Removed
- `ToggleDisableWrapper` component imports
- `DISABLE_CONTENT` constants import
- `maskState` useMemo that generated "Action Required" overlay boxes

#### Added/Updated

1. **Disabled wallet address input:**
```typescript
<input
  type="text"
  value={customerSearch}
  placeholder="Enter Customer Wallet Address..."
  disabled={isBlocked}
  className={`... ${isBlocked ? "opacity-50 cursor-not-allowed" : ""}`}
/>
```

2. **Disabled Scan QR button:**
```typescript
<button
  onClick={startQRScanner}
  disabled={isBlocked || loadingCustomers}
  className={`... ${
    isBlocked
      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
      : "bg-[#FFCC00] text-black hover:bg-[#FFD700]"
  }`}
  title={isBlocked ? blockReason : "Scan customer's QR code"}
>
  <Camera /> Scan QR
</button>
```

3. **Disabled redemption amount input:**
```typescript
<input
  type="number"
  value={redeemAmount || ""}
  placeholder="0"
  disabled={isBlocked}
  className={`... ${isBlocked ? "opacity-50 cursor-not-allowed" : ""}`}
/>
```

4. **Disabled quick select buttons:**
```typescript
<button
  onClick={() => setRedeemAmount(amount)}
  disabled={isBlocked}
  className={`... ${
    isBlocked
      ? "opacity-50 cursor-not-allowed border-gray-700 text-gray-500"
      : redeemAmount === amount
      ? "bg-[#FFCC00] text-black border-[#FFCC00]"
      : "bg-transparent text-white border-gray-600"
  }`}
>
  {amount} RCN
</button>
```

5. **Added isBlocked to Request Customer Approval button:**
```typescript
const isDisabled =
  isBlocked ||  // Added this check
  sessionStatus !== "idle" ||
  !selectedCustomer ||
  !redeemAmount ||
  // ... other conditions
```

6. **Updated button styling and title:**
```typescript
<button
  disabled={isDisabled}
  className={`... ${
    isBlocked
      ? "bg-gray-700 text-gray-500"
      : "bg-[#FFCC00] text-black hover:shadow-lg"
  }`}
  title={
    isBlocked
      ? blockReason
      : // ... other title conditions
  }
>
  Request Customer Approval
</button>
```

---

## User Experience

### Before (Old Implementation)
- Orange "Action Required" overlay boxes appeared inside Step 1 and Step 2 cards
- Separate overlay component with message "This feature requires an active account subscription"
- Inconsistent with Issue Rewards tab approach

### After (New Implementation)
- Clean disabled inputs with 50% opacity and not-allowed cursor
- Buttons show gray styling when blocked
- Tooltip on hover shows the block reason
- Consistent with Issue Rewards tab approach
- Top banner (from ShopDashboardClient) already shows "Subscription Paused" message

### Disabled Elements When Blocked
| Element | Location | Visual Feedback |
|---------|----------|-----------------|
| Wallet address input | Step 1 card | 50% opacity, cursor-not-allowed |
| Scan QR button | Step 1 card | Gray background, tooltip shows reason |
| Redemption amount input | Step 2 card | 50% opacity, cursor-not-allowed |
| Quick select buttons (10, 25, 50, 100 RCN) | Step 2 card | 50% opacity, gray border |
| Request Customer Approval button | Summary panel | Gray background, tooltip shows reason |

---

## Data Flow

```
ShopDashboardClient
    ↓ calculates isBlocked, getBlockReason()
ToolsTab
    ↓ passes isBlocked, blockReason props
RedeemTabV2
    ↓ uses props to disable inputs/buttons
```

---

## Testing Checklist

- [x] Wallet address input is disabled when blocked
- [x] Scan QR button is disabled when blocked
- [x] Redemption amount input is disabled when blocked
- [x] Quick select buttons are disabled when blocked
- [x] Request Customer Approval button is disabled when blocked
- [x] Tooltips show block reason on hover
- [x] Visual styling consistent with Issue Rewards tab
- [x] "Action Required" overlay boxes removed
- [x] TypeScript compiles without errors

---

## Files Modified

- `frontend/src/components/shop/tabs/RedeemTabV2.tsx` - Refactored to use direct disabled props

---

## Related Tasks

- [Shop Subscription Validation & Enforcement](./shop-subscription-validation-enforcement.md) - Parent task
- [Shop Services Subscription Guard](./shop-services-subscription-guard.md) - Services protection
- [Shop Issue Rewards Subscription Guard](./shop-issue-rewards-subscription-guard.md) - Issue rewards protection

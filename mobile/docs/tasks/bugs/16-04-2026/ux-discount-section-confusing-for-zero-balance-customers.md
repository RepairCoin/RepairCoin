# Enhancement: Disable RCN Discount Section for Zero-Balance Customers

**Status:** Open
**Priority:** Medium
**Est. Effort:** 1 hr
**Created:** 2026-04-16
**Updated:** 2026-04-16

---

## Problem

When a new customer (0 RCN balance) reaches the "Apply Discount & Pay" screen, the full RCN discount section is shown as if they can use it:

- "Cross-shop limit: up to 0 RCN (20% of your balance)" — irrelevant and confusing for new users
- "Apply RCN Discount" heading with active input field and MAX button — all interactive but non-functional
- Input accepts typing but caps at 0 — confusing dead-end interaction
- No guidance explaining how to earn RCN

The web handles this correctly by disabling the slider, dimming the section, and showing an encouraging message.

---

## Web Reference (correct behavior)

**File:** `frontend/src/components/customer/ServiceCheckoutModal.tsx` (lines 691-702)

When `customerBalance === 0`:
- Shows message: "Complete services to earn RCN and unlock discounts!"
- Slider is dimmed: `className={customerBalance === 0 ? 'opacity-50 pointer-events-none' : ''}`
- Slider input is disabled: `disabled={customerBalance === 0}`
- Balance text is gray instead of yellow

---

## Current Mobile Behavior

**File:** `mobile/feature/appointment/screens/AppointmentCompleteScreen.tsx` (lines 113-121)

`redemptionMessage` is always set regardless of balance — shows "Cross-shop limit: up to 0 RCN" even for 0 balance.

**File:** `mobile/feature/appointment/screens/AppointmentDiscountScreen.tsx` (lines 40-53)

`redemptionMessage` and `RcnRedeemInput` are always rendered — no guard for 0 balance.

**File:** `mobile/feature/appointment/components/RcnRedeemInput.tsx`

Input field and MAX button are always active — no disabled state.

---

## Implementation

### 1. Suppress cross-shop message when balance is 0

**File:** `mobile/feature/appointment/screens/AppointmentCompleteScreen.tsx`

```typescript
// Replace redemptionMessage logic with:
const redemptionMessage = availableRcn <= 0
  ? null  // No limit message for 0 balance
  : crossShopIsLimiting
  ? `Cross-shop limit: up to ${maxRcnRedeemable} RCN (20% of your balance)`
  : isRestrictedTier
  ? `Due to your booking history, redemption is limited to ${noShowStatus?.maxRcnRedemptionPercent || 100}% of the service price`
  : isHomeShop
  ? "You can redeem up to 100% at this shop (your home shop)"
  : `Cross-shop limit: up to ${maxRcnRedeemable} RCN (20% of your balance)`;
```

### 2. Show guidance message and disable input when balance is 0

**File:** `mobile/feature/appointment/screens/AppointmentDiscountScreen.tsx`

Wrap the discount section with a 0-balance check:

```typescript
{availableRcn > 0 ? (
  <>
    {redemptionMessage && (
      <View className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 flex-row items-start">
        <Ionicons name="information-circle" size={16} color="#3b82f6" />
        <Text className="text-blue-300 text-xs ml-2 flex-1">{redemptionMessage}</Text>
      </View>
    )}
    <RcnRedeemInput
      rcnToRedeem={rcnToRedeem}
      maxRcnRedeemable={maxRcnRedeemable}
      maxRcnLimit={maxRcnLimit}
      onRcnChange={onRcnChange}
      onMaxRcn={onMaxRcn}
    />
  </>
) : (
  <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
    <Text className="text-white text-lg font-semibold mb-1">RCN Discount</Text>
    <Text className="text-gray-400 text-sm">
      Complete services to earn RCN tokens and unlock discounts on future bookings!
    </Text>
  </View>
)}
```

### 3. Add disabled state to RcnRedeemInput (defensive)

**File:** `mobile/feature/appointment/components/RcnRedeemInput.tsx`

Add a `disabled` prop for cases where the component is rendered with 0 balance:

```typescript
interface RcnRedeemInputProps {
  // ...existing
  disabled?: boolean;
}

// In the TextInput:
editable={!disabled}

// In the MAX button:
disabled={disabled}
className={`px-3 py-1 rounded-lg ${disabled ? 'bg-zinc-700' : 'bg-[#FFCC00]/20'}`}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/appointment/screens/AppointmentCompleteScreen.tsx` | Suppress redemption message when balance is 0 |
| `mobile/feature/appointment/screens/AppointmentDiscountScreen.tsx` | Show guidance message instead of discount controls when balance is 0 |
| `mobile/feature/appointment/components/RcnRedeemInput.tsx` | Add `disabled` prop for defensive handling |

---

## Verification Checklist

- [ ] New customer (0 RCN) → no cross-shop message shown
- [ ] New customer (0 RCN) → "Complete services to earn RCN..." message shown instead of input
- [ ] New customer (0 RCN) → no active input field or MAX button
- [ ] Customer with balance > 0, cross-shop → cross-shop message and input shown normally
- [ ] Customer with balance > 0, home shop → home shop message and input shown normally
- [ ] Price summary still shows correct total ($69.00 with no discount)
- [ ] Pay button still works for 0-balance customers (full price checkout)

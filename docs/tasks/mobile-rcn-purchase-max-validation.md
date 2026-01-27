# Mobile RCN Purchase Maximum Validation Bug

## Priority: Medium
## Status: Open
## Assignee: Mobile Developer
## Created: January 21, 2026

## Problem

The mobile app's "Buy RCN Tokens" screen displays the correct purchase limits (Min: 5 RCN, Max: 100,000 RCN) but **does not enforce the maximum limit**. Users can enter amounts exceeding 100,000 RCN and the purchase button remains enabled.

### Current Behavior

1. User opens "Buy RCN Tokens" screen
2. UI shows "Min: 5 RCN • Max: 100,000 RCN"
3. User enters an amount like 28,888,800,880 RCN
4. **Bug**: Purchase button is still enabled
5. Button displays "Buy 30,333,240,924 RCN for $2888880088.00"

### Expected Behavior

1. User enters amount exceeding 100,000 RCN
2. Purchase button should be **disabled**
3. Error message should display "Above maximum" (similar to "Below minimum" for amounts < 5)

## Root Cause

In `mobile/hooks/purchase/usePurchase.ts:75`:

```typescript
isValidAmount: amount >= 5,
```

The validation only checks the **minimum** but ignores the **maximum** (100,000 RCN).

## Backend Protection

The backend **does** enforce the limit in `backend/src/domains/shop/services/ShopPurchaseService.ts`:

```typescript
private static readonly MAXIMUM_PURCHASE = 100000;

private validatePurchaseAmount(amount: number): void {
  // ...
  if (amount > ShopPurchaseService.MAXIMUM_PURCHASE) {
    throw new Error(`Maximum purchase amount is ${ShopPurchaseService.MAXIMUM_PURCHASE} RCN per transaction`);
  }
}
```

However, the mobile UI should prevent invalid submissions for better UX.

## Solution

### 1. Fix Validation in `usePurchase.ts`

```typescript
// mobile/hooks/purchase/usePurchase.ts

const MIN_PURCHASE = 5;
const MAX_PURCHASE = 100000;

const usePurchaseAmount = (initialAmount = MIN_PURCHASE) => {
  const [amount, setAmount] = useState(initialAmount);

  // ... bonus calculations ...

  return {
    amount,
    setAmount,
    bonusAmount,
    totalCost,
    totalTokens,
    effectiveRate,
    isValidAmount: amount >= MIN_PURCHASE && amount <= MAX_PURCHASE,
    isBelowMinimum: amount > 0 && amount < MIN_PURCHASE,
    isAboveMaximum: amount > MAX_PURCHASE,
  };
};
```

### 2. Update UI in `BuyTokenScreen.tsx`

```tsx
<View className="flex-row justify-between mt-3">
  <Text className="text-gray-500 text-xs">
    Min: 5 RCN • Max: 100,000 RCN
  </Text>
  {purchaseAmount < 5 && purchaseAmount > 0 && (
    <Text className="text-red-400 text-xs">Below minimum</Text>
  )}
  {purchaseAmount > 100000 && (
    <Text className="text-red-400 text-xs">Above maximum</Text>
  )}
</View>
```

### 3. Optional: Add Input Validation

Consider limiting the input field to prevent entry of extremely large numbers:

```typescript
const handleInputChange = useCallback(
  (text: string) => {
    // Remove non-numeric characters
    const numericText = text.replace(/[^0-9]/g, '');

    // Limit to reasonable length (7 digits = 9,999,999 max display)
    const limitedText = numericText.slice(0, 7);

    setInputValue(limitedText);
    const value = parseInt(limitedText) || 0;
    setPurchaseAmount(Math.max(0, value));
  },
  [setPurchaseAmount]
);
```

## Files to Modify

| File | Change |
|------|--------|
| `mobile/hooks/purchase/usePurchase.ts` | Add maximum validation to `isValidAmount` |
| `mobile/feature/buy-token/screens/BuyTokenScreen.tsx` | Add "Above maximum" error message |
| `mobile/feature/buy-token/hooks/ui/useBuyTokenUI.ts` | Optional: Add input length limiting |

## Testing Checklist

- [ ] Enter amount < 5 RCN → "Below minimum" shown, button disabled
- [ ] Enter amount = 5 RCN → Button enabled
- [ ] Enter amount = 100,000 RCN → Button enabled
- [ ] Enter amount > 100,000 RCN → "Above maximum" shown, button disabled
- [ ] Enter extremely large amount → Input handled gracefully
- [ ] Quick select buttons (10, 50, 100, 1k, 5k, 10k) all work correctly

## Related Files

- Backend validation: `backend/src/domains/shop/services/ShopPurchaseService.ts:49-50`
- Web validation: Compare with web implementation for consistency

## Notes

- While the backend will reject amounts > 100,000 RCN, the mobile UI should prevent invalid submissions for:
  1. Better user experience
  2. Reduced API calls
  3. Prevention of potential overflow/display issues with extremely large numbers

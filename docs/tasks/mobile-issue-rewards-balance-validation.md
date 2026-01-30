# Mobile Issue Rewards - Missing Balance Validation

## Priority: High
## Status: Open
## Assignee: Mobile Developer
## Created: January 21, 2026

## Problem

The mobile app's "Issue Rewards" screen does **not display the shop's available RCN balance** and **does not validate** that the reward amount is within the shop's available balance before allowing submission.

### Current Behavior (Mobile)

1. Shop owner opens "Issue Rewards" screen
2. Enters customer address and selects reward amount (e.g., 10,055 RCN)
3. **Bug**: No "Available Balance" displayed anywhere
4. **Bug**: "Issue 10,057 RCN" button is enabled even if shop only has 100 RCN
5. User taps button → API returns error "Insufficient shop RCN balance"

### Expected Behavior (Same as Web)

1. Shop owner opens "Issue Rewards" screen
2. **Reward Calculator shows "Available Balance: 100 RCN"**
3. If reward amount > available balance:
   - Available Balance text turns red
   - Issue button is **disabled**
   - User cannot submit invalid request

## Root Cause

### Mobile - Missing Features

**`mobile/app/(dashboard)/shop/reward-token/index.tsx`:**
- No display of shop's available RCN balance
- Button disable condition (lines 541-547) does NOT check balance:
  ```tsx
  disabled={
    isIssuingReward ||
    !customerAddress ||
    !customerInfo ||
    totalReward <= 0 ||
    (repairType === "custom" && (...))
    // ❌ Missing: !hasSufficientBalance
  }
  ```

**`mobile/hooks/useShopRewards.ts`:**
- Does NOT fetch or return `purchasedRcnBalance`
- Does NOT compute `hasSufficientBalance`

### Web - Correct Implementation

**`frontend/src/components/shop/tabs/IssueRewardsTab.tsx`:**

```typescript
// Line 170-171: Balance check
const hasSufficientBalance = (shopData?.purchasedRcnBalance || 0) >= totalReward;

// Line 413-420: Pre-submit validation
if (!hasSufficientBalance) {
  setError(`Insufficient RCN balance. Need ${totalReward} RCN but only have ${shopData?.purchasedRcnBalance || 0} RCN`);
  return;
}

// Lines 1533-1545: UI display
<div className="flex items-center justify-between py-3 border-b border-gray-800">
  <span className="text-gray-400">Available Balance</span>
  <span className={`text-lg font-bold ${
    (shopData?.purchasedRcnBalance || 0) >= totalReward ? "text-[#FFCC00]" : "text-red-500"
  }`}>
    {shopData?.purchasedRcnBalance || 0} RCN
  </span>
</div>

// Line 1600: Button disabled condition
disabled={... || !hasSufficientBalance || ...}
```

## Solution

### 1. Update `useShopRewards.ts` Hook

Add shop balance data to the hook:

```typescript
// mobile/hooks/useShopRewards.ts

export function useShopRewards() {
  const [customerAddress, setCustomerAddress] = useState("");

  // Add: Get shop data including balance
  const shopData = useAuthStore((state) => state.userProfile);
  const shopWalletAddress = useAuthStore((state) => state.account?.address);

  // Add: Query for shop balance (or use existing shop query)
  const shopBalanceQuery = useQuery({
    queryKey: queryKeys.shopByWalletAddress(shopWalletAddress || ""),
    queryFn: () => shopApi.getShopByWalletAddress(shopWalletAddress!),
    enabled: !!shopWalletAddress,
    select: (data) => data.data?.purchasedRcnBalance || 0,
  });

  // ... existing code ...

  const totalReward = baseReward + tierBonus + promoManager.promoBonus;

  // Add: Balance validation
  const availableBalance = shopBalanceQuery.data || 0;
  const hasSufficientBalance = availableBalance >= totalReward;

  return {
    // ... existing returns ...

    // Add these:
    availableBalance,
    hasSufficientBalance,
    isLoadingBalance: shopBalanceQuery.isLoading,
  };
}
```

### 2. Update `reward-token/index.tsx` Screen

**Add Available Balance to Reward Summary:**

```tsx
{/* Inside Reward Summary section */}
<View className="bg-[#1A1A1A] rounded-xl p-4 mb-4">
  <Text className="text-white font-bold text-lg mb-3">
    Reward Summary
  </Text>

  {/* ADD: Available Balance row */}
  <View className="flex-row justify-between mb-3 pb-3 border-b border-gray-700">
    <Text className="text-gray-400">Available Balance</Text>
    <Text className={`font-bold text-lg ${
      hasSufficientBalance ? "text-[#FFCC00]" : "text-red-500"
    }`}>
      {availableBalance} RCN
    </Text>
  </View>

  {/* Existing rows: Base Reward, Tier Bonus, etc. */}
  ...
</View>
```

**Add insufficient balance warning:**

```tsx
{/* After Reward Summary, before Issue button */}
{!hasSufficientBalance && totalReward > 0 && (
  <View className="bg-red-500/10 rounded-xl p-4 mb-4 border border-red-500/30">
    <View className="flex-row items-center">
      <MaterialIcons name="error" size={20} color="#EF4444" />
      <Text className="text-red-400 font-semibold ml-2">
        Insufficient Balance
      </Text>
    </View>
    <Text className="text-red-300/70 text-xs mt-1">
      You need {totalReward} RCN but only have {availableBalance} RCN available.
    </Text>
  </View>
)}
```

**Update button disabled condition:**

```tsx
<TouchableOpacity
  onPress={handleIssueReward}
  disabled={
    isIssuingReward ||
    !customerAddress ||
    !customerInfo ||
    totalReward <= 0 ||
    !hasSufficientBalance ||  // ← ADD THIS
    (repairType === "custom" && (!customAmount || !customRcn || parseFloat(customAmount) <= 0))
  }
  ...
>
```

**Update button text for insufficient balance:**

```tsx
<Text className={...}>
  {!customerAddress
    ? "Enter Customer Address"
    : !customerInfo
    ? "Customer Not Found"
    : totalReward <= 0
    ? "Select Repair Type"
    : !hasSufficientBalance
    ? "Insufficient Balance"  // ← ADD THIS
    : `Issue ${totalReward} RCN`}
</Text>
```

### 3. Add Pre-Submit Validation in `handleIssueReward`

```typescript
const handleIssueReward = () => {
  // ... existing validations ...

  // ADD: Balance validation
  if (!hasSufficientBalance) {
    Alert.alert(
      "Insufficient Balance",
      `You need ${totalReward} RCN but only have ${availableBalance} RCN available. Please purchase more RCN tokens first.`,
      [{ text: "OK" }]
    );
    return;
  }

  // ... rest of function ...
};
```

## Files to Modify

| File | Change |
|------|--------|
| `mobile/hooks/useShopRewards.ts` | Add `availableBalance`, `hasSufficientBalance` |
| `mobile/app/(dashboard)/shop/reward-token/index.tsx` | Add balance display, warning, button validation |

## Testing Checklist

- [ ] Available Balance displays correctly in Reward Summary
- [ ] Balance turns red when totalReward > availableBalance
- [ ] Issue button is disabled when insufficient balance
- [ ] Button text shows "Insufficient Balance" when disabled for this reason
- [ ] Red warning banner appears below Reward Summary
- [ ] Alert shown if user somehow bypasses UI and calls handleIssueReward
- [ ] Works correctly after issuing a reward (balance updates)
- [ ] Works correctly after purchasing more RCN (balance updates)

## Backend Safety Net

The backend already validates at `backend/src/domains/shop/routes/index.ts:2113-2119`:

```javascript
if (available < totalReward) {
  return res.status(400).json({
    success: false,
    error: 'Insufficient shop RCN balance',
    data: {
      required: totalReward,
      available: available,
    }
  });
}
```

However, the mobile UI should prevent invalid submissions for:
1. Better user experience
2. Reduced failed API calls
3. Consistency with web behavior
4. Clear feedback to user about their available balance

## Related Files

- Web implementation: `frontend/src/components/shop/tabs/IssueRewardsTab.tsx` (reference)
- Backend validation: `backend/src/domains/shop/routes/index.ts:2113-2119`

## Priority Justification

**High Priority** because:
1. Shops can attempt to issue rewards they cannot fulfill
2. Creates confusion when API rejects the request
3. Poor UX compared to web version
4. Could lead to support tickets from confused shop owners

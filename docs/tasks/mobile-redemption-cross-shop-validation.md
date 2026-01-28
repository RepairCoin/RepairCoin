# Mobile Redemption Cross-Shop Validation Missing

## Priority: High
## Status: Open
## Assignee: Mobile Developer

## Problem

The mobile app's redemption screen (`Process Redemption`) does not validate or display cross-shop redemption limits. Shops can attempt to process redemptions exceeding the 20% cross-shop limit, which may fail on the backend or cause confusion.

**This validation works correctly on the web frontend - it's missing only in the mobile app.**

### Example Scenario
- Customer has 100 RCN balance
- Customer's home shop is "Shop A" (100% redemption allowed)
- Customer visits "Shop B" which is NOT their home shop (only 20% redemption allowed)
- At Shop B, mobile allows entering 30 RCN when it should be max 20 RCN (20% of 100)

## Root Cause

The mobile app's redemption flow only validates total balance, not the cross-shop redemption limit.

### Code Comparison

| Aspect | Web Frontend | Mobile App |
|--------|-------------|------------|
| Fetches home shop info | Yes - calls verify endpoint | **No** |
| State for cross-shop info | `crossShopInfo` with `isHomeShop`, `maxRedeemable`, `crossShopLimit` | **Missing** |
| Shows 20% limit warning | Yes - purple warning box | **No** |
| Disables button when limit exceeded | Yes | **No** |
| Balance validation | Full balance only | Full balance only |

### Web Implementation (RedeemTabV2.tsx)

The web frontend:
1. **Tracks cross-shop state** (lines 105-109):
   ```typescript
   const [crossShopInfo, setCrossShopInfo] = useState<{
     isHomeShop: boolean;
     maxRedeemable: number;
     crossShopLimit: number;
   } | null>(null);
   ```

2. **Calls verification API** to get home shop info (lines 167-215)

3. **Shows warning when limit exceeded** (lines 1664-1682):
   ```tsx
   {!crossShopInfo.isHomeShop && redeemAmount > crossShopInfo.crossShopLimit && (
     <div className="bg-purple-900...">
       Cross-Shop Limit Exceeded - Maximum redeemable is {crossShopLimit} RCN (20%)
     </div>
   )}
   ```

4. **Disables redemption button** when cross-shop limit exceeded (lines 1696-1716)

### Mobile Implementation (redeem-token/index.tsx)

The mobile app only validates (lines 96-103):
```typescript
// Check if customer has sufficient balance
if (amount > customerData.balance) {
  Alert.alert("Error", `Insufficient balance...`);
  return;
}
```

**Missing:**
- No `crossShopInfo` state
- No API call to get home shop verification
- No UI warning about cross-shop limits
- No validation preventing redemption beyond 20% limit

## Affected Files

### Mobile (needs fix)
- `mobile/app/(dashboard)/shop/redeem-token/index.tsx` - Main redemption screen
- `mobile/hooks/redemption/useRedemption.ts` - Redemption hook (needs cross-shop info)
- `mobile/interfaces/token.interface.ts` - May need interface updates

### Backend API (already exists)
- `POST /api/token/verify-redemption` - Returns `isHomeShop`, `maxRedeemable`, `crossShopLimit`

## Solution

### Step 1: Update useRedemption hook

Add cross-shop verification to `useCustomerLookup()` in `useRedemption.ts`:

```typescript
// Add to CustomerData interface
export interface CustomerData {
  address: string;
  tier: "GOLD" | "SILVER" | "BRONZE";
  balance: number;
  lifetimeEarnings: number;
  // ADD THESE:
  isHomeShop: boolean;
  maxRedeemable: number;
  crossShopLimit: number;
}

// In lookupCustomer function, also call verification endpoint:
const verifyResponse = await tokenApi.verifyRedemption({
  customerAddress: address,
  shopId: shopData.id,
  amount: 1  // Just for verification
});

setCustomerData({
  ...existingData,
  isHomeShop: verifyResponse.data.isHomeShop,
  maxRedeemable: verifyResponse.data.maxRedeemable,
  crossShopLimit: verifyResponse.data.crossShopLimit,
});
```

### Step 2: Update redemption screen UI

Add to `redeem-token/index.tsx`:

1. **Show home shop indicator** in customer info section:
   ```tsx
   {customerData && (
     <View className="bg-purple-500/20 px-2 py-1 rounded-full">
       <Text className="text-purple-400 text-xs">
         {customerData.isHomeShop ? "🏠 Home Shop" : "📍 20% Limit"}
       </Text>
     </View>
   )}
   ```

2. **Show cross-shop limit warning**:
   ```tsx
   {customerData && !customerData.isHomeShop && (
     <View className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/30 mb-4">
       <Text className="text-purple-400 font-semibold">Cross-Shop Redemption</Text>
       <Text className="text-purple-300/70 text-xs mt-1">
         Maximum redeemable: {customerData.crossShopLimit} RCN (20% of balance)
       </Text>
     </View>
   )}
   ```

3. **Add validation** in `handleProcessRedemption`:
   ```typescript
   // Check cross-shop limit
   if (!customerData.isHomeShop && amount > customerData.crossShopLimit) {
     Alert.alert(
       "Cross-Shop Limit Exceeded",
       `This is not the customer's home shop. Maximum redeemable here is ${Math.floor(customerData.crossShopLimit)} RCN (20% of balance). Customer can redeem full balance at their home shop.`
     );
     return;
   }
   ```

4. **Disable button** when limit exceeded:
   ```typescript
   const crossShopLimitExceeded =
     customerData &&
     !customerData.isHomeShop &&
     parseFloat(redemptionAmount) > customerData.crossShopLimit;

   const canProcessRedemption =
     !isCreatingSession &&
     customerAddress &&
     customerData &&
     redemptionAmount &&
     parseFloat(redemptionAmount) > 0 &&
     !hasInsufficientBalance &&
     !crossShopLimitExceeded &&  // ADD THIS
     !isCustomerSelf;
   ```

## Testing Checklist

### Scenario 1: Home Shop Redemption
- [ ] Login as shop that IS the customer's home shop
- [ ] Look up customer with balance (e.g., 100 RCN)
- [ ] Verify shows "Home Shop" indicator
- [ ] Verify can enter full balance amount
- [ ] Verify redemption succeeds

### Scenario 2: Non-Home Shop Redemption (within limit)
- [ ] Login as shop that is NOT the customer's home shop
- [ ] Look up customer with balance (e.g., 100 RCN)
- [ ] Verify shows "20% Limit" indicator
- [ ] Verify shows cross-shop warning with max amount (20 RCN)
- [ ] Enter 15 RCN (within limit)
- [ ] Verify redemption succeeds

### Scenario 3: Non-Home Shop Redemption (exceeds limit)
- [ ] Login as shop that is NOT the customer's home shop
- [ ] Look up customer with balance (e.g., 100 RCN)
- [ ] Enter 30 RCN (exceeds 20% limit)
- [ ] Verify warning appears
- [ ] Verify redemption button is disabled or shows error

### Test Data
- Use any customer with RCN balance
- Test at their home shop (should allow 100% redemption)
- Test at a different shop (should limit to 20% redemption)

## References

- Web implementation: `frontend/src/components/shop/tabs/RedeemTabV2.tsx` lines 105-109, 167-215, 1664-1716
- Backend verification: `backend/src/domains/token/services/VerificationService.ts`
- Mobile redemption: `mobile/app/(dashboard)/shop/redeem-token/index.tsx`
- Mobile hook: `mobile/hooks/redemption/useRedemption.ts`

## Screenshots

Mobile redemption screen currently shows no indication of home shop status or cross-shop limits.

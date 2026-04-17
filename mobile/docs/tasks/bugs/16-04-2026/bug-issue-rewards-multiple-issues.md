# Bug: Issue Rewards Screen — Multiple Issues

**Status:** Open
**Priority:** Medium
**Est. Effort:** 2 hrs
**Created:** 2026-04-16
**Updated:** 2026-04-16

---

## Overview

QA investigation of the shop "Issue Rewards" screen revealed 4 issues. The flow is mostly solid — no critical bugs — but there are UX gaps that can cause confusion or unexpected backend rejections.

---

## Issue 1: No Suspended/Inactive Customer Check

**Priority:** Medium (causes unexpected backend rejection)

**File:** `feature/reward-token/hooks/ui/useRewardToken.ts` (lines 75-105)

The `handleIssueReward` function validates:
- Empty address ✅
- Self-reward ✅
- Customer not found ✅
- Custom amount range ✅
- Insufficient shop balance ✅

**Missing:** No check for suspended or inactive customers. The shop fills in all details, confirms in the modal, then gets a generic backend error. The web Redeem tab shows a clear suspension warning banner in the customer card — Issue Rewards has nothing.

**Fix:** Add a check after customer lookup:

```typescript
// In handleIssueReward, after the customerInfo check:
if (customerInfo?.bookingSuspended || customerInfo?.isActive === false) {
  showError("Cannot issue rewards to a suspended customer");
  return;
}
```

Also show a warning banner in the UI when a suspended customer is selected (similar to the Redeem tab):

**File:** `feature/reward-token/screens/RewardTokenScreen.tsx`

```tsx
{customerInfo?.bookingSuspended && (
  <View className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mx-4 mb-3">
    <Text className="text-red-400 text-sm font-semibold">Customer Suspended</Text>
    <Text className="text-red-300 text-xs">Cannot issue rewards to this customer.</Text>
  </View>
)}
```

---

## Issue 2: `skipTierBonus` Hardcoded to `false`

**Priority:** Low

**File:** `feature/reward-token/hooks/ui/useRewardToken.ts` (line 111)

```typescript
const request = {
  customerAddress,
  repairAmount: getRepairAmount(),
  skipTierBonus: false,  // ← Always false, no UI toggle
  promoCode: promoCode.trim() || undefined,
};
```

The backend supports `skipTierBonus: true` to issue an exact custom amount without adding the tier bonus (+2 Silver, +5 Gold). But the mobile has no toggle for it. If a shop wants to issue exactly 10 RCN to a Gold customer, they can't — it always becomes 15 RCN.

**Fix (optional):** Add a toggle in the Custom amount section:

```tsx
{repairType === "custom" && (
  <View className="flex-row items-center justify-between mt-3">
    <Text className="text-gray-400 text-sm">Include tier bonus</Text>
    <Switch
      value={!skipTierBonus}
      onValueChange={(v) => setSkipTierBonus(!v)}
      trackColor={{ false: "#333", true: "#FFCC00" }}
    />
  </View>
)}
```

This is low priority — most shops won't need it. Can be deferred.

---

## Issue 3: No Remaining Shop Balance Preview in Confirmation

**Priority:** Low

**File:** `feature/reward-token/components/ConfirmRewardModal.tsx`

The confirmation modal shows a clear reward breakdown (base + tier + promo = total) but doesn't show the shop's remaining balance after issuance. The shop has to mentally calculate it.

**Current:**
```
Base Reward        10 RCN
Silver Bonus       +2 RCN
─────────────────────────
Total              12 RCN
```

**Proposed — add a "Your Balance" row at the bottom:**
```
Base Reward        10 RCN
Silver Bonus       +2 RCN
─────────────────────────
Total              12 RCN

Your Balance    500 → 488 RCN
```

**Fix:** Pass `availableBalance` to `ConfirmRewardModal` and add:

```tsx
<View className="mx-6 mb-4 flex-row justify-between items-center">
  <Text className="text-gray-500 text-xs">Your Balance</Text>
  <Text className="text-gray-400 text-xs">
    {availableBalance} → {availableBalance - totalReward} RCN
  </Text>
</View>
```

---

## Issue 4: Promo Percentage Bonus Rounding Unclear

**Priority:** Low

**File:** `feature/reward-token/hooks/useShopRewards.ts` (promo calculation)

For percentage promos, the bonus can be a decimal (e.g., 10% of 12 = 1.2 RCN). The UI shows the decimal, but it's unclear if:
- The backend rounds down (1.2 → 1 RCN)
- The backend rounds to nearest (1.2 → 1 RCN)
- The backend uses the exact decimal (1.2 RCN)

If the UI shows 1.2 but the backend processes 1, the shop sees a different total than expected.

**Fix:** Match the rounding on the frontend to the backend:

```typescript
// Check backend rounding logic, then apply same in frontend:
const promoBonus = Math.floor(prePromoTotal * (percentage / 100) * 100) / 100;
```

Also consider showing the rounded value in the breakdown instead of raw decimal.

---

## Files to Modify

| File | Issues |
|------|--------|
| `feature/reward-token/hooks/ui/useRewardToken.ts` | #1 — Add suspended check, #2 — Add skipTierBonus toggle state |
| `feature/reward-token/screens/RewardTokenScreen.tsx` | #1 — Add suspended customer warning banner |
| `feature/reward-token/components/ConfirmRewardModal.tsx` | #3 — Add remaining balance preview |
| `feature/reward-token/hooks/useShopRewards.ts` | #4 — Match promo rounding to backend |

---

## Verification Checklist

- [ ] Enter suspended customer → warning banner shown, Issue button disabled
- [ ] Enter inactive customer → same warning behavior
- [ ] Confirm modal shows correct breakdown (base + tier + promo = total)
- [ ] (If #2 applied) Custom amount with "skip tier bonus" toggle → issues exact amount
- [ ] (If #3 applied) Confirm modal shows "Your Balance: X → Y RCN"
- [ ] (If #4 applied) Percentage promo bonus matches backend response exactly
- [ ] Active customer → no warning, Issue button works normally
- [ ] Backend rejection for suspended customer → clear error toast (current fallback still works)

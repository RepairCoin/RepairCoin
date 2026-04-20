# Enhancement: Add Home Shop / Cross-Shop Badge to Web Redeem Tab

**Status:** Open
**Priority:** Medium
**Est. Effort:** 1-2 hrs
**Created:** 2026-04-16
**Updated:** 2026-04-16

---

## Problem

The web Redeem tab shows no indication of whether the selected customer is at their home shop or a cross-shop. The shop only discovers the cross-shop limit after entering an amount that exceeds it (purple warning appears). There is no proactive indicator to set expectations before entering an amount.

The mobile app was designed with home/cross-shop badges but they're currently broken (separate bug). The web has never had this indicator at all.

---

## Current Web Behavior

**File:** `frontend/src/components/shop/tabs/RedeemTabV2.tsx`

The Redemption Summary sidebar shows:
1. Customer name
2. Base Reward (tier badge)
3. Balance
4. Redemption Amount + USD Value
5. Purple warning **only** when entered amount exceeds cross-shop limit

The `crossShopInfo` data (`isHomeShop`, `maxRedeemable`, `crossShopLimit`) is already fetched from the backend pre-validation call (line 207-213) — it's just not displayed proactively.

---

## Proposed UX

### Location 1: Redemption Summary sidebar — new "Shop Relationship" row

Add a row after the Balance row in the summary card (lines 1591-1603) that shows:

**Home shop:**
```
┌─────────────────────────────────────────┐
│ Relationship •          🏠 Home Shop    │
│                     100% redeemable     │
└─────────────────────────────────────────┘
```
- Green text/icon
- Shows "100% redeemable" to set clear expectation

**Cross-shop:**
```
┌─────────────────────────────────────────┐
│ Relationship •       🔄 Cross-Shop      │
│                  Max 32 RCN (20%)       │
└─────────────────────────────────────────┘
```
- Amber text/icon
- Shows max redeemable amount upfront — shop knows the limit before entering any amount

**Loading:**
```
┌─────────────────────────────────────────┐
│ Relationship •         Checking...      │
└─────────────────────────────────────────┘
```
- Gray text while `crossShopInfo` is being fetched

### Location 2: Selected customer card — inline badge

Add a small badge next to the customer name in the selected customer card (lines 1237-1271):

**Home shop:**
```
✅ [SILVER TIER]  Qua Ting  [🏠 Home]
   0x6cd036...9993cf
```

**Cross-shop:**
```
✅ [SILVER TIER]  Qua Ting  [🔄 Cross-Shop]
   0x6cd036...9993cf
```

Small pill badge — green for home, amber for cross-shop. Subtle, doesn't clutter the card.

---

## Why This Is Better Than Current Approach

| Aspect | Current (warn on error) | Proposed (proactive badge) |
|--------|------------------------|---------------------------|
| **When shop sees info** | After entering wrong amount | Immediately on customer select |
| **Expectation setting** | None — shop guesses | Max amount shown upfront |
| **Error prevention** | Reactive (fix after mistake) | Proactive (prevent mistake) |
| **Consistency with mobile** | Web has nothing, mobile has badges | Both show same indicator |
| **Shop confidence** | Uncertain about limits | Clear about what's allowed |

---

## Implementation

### Step 1: Add relationship row to Redemption Summary

**File:** `frontend/src/components/shop/tabs/RedeemTabV2.tsx` (after line 1603)

```tsx
{/* Shop Relationship */}
{selectedCustomer && (
  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800/50">
    <span className="text-white text-sm font-medium">Relationship •</span>
    {crossShopInfo ? (
      crossShopInfo.isHomeShop ? (
        <div className="text-right">
          <span className="text-green-400 font-semibold text-sm">🏠 Home Shop</span>
          <p className="text-green-500/70 text-xs">100% redeemable</p>
        </div>
      ) : (
        <div className="text-right">
          <span className="text-amber-400 font-semibold text-sm">🔄 Cross-Shop</span>
          <p className="text-amber-500/70 text-xs">
            Max {Math.floor(crossShopInfo.crossShopLimit)} RCN (20%)
          </p>
        </div>
      )
    ) : validatingRedemption ? (
      <span className="text-gray-500 text-sm">Checking...</span>
    ) : (
      <span className="text-gray-500 text-sm">—</span>
    )}
  </div>
)}
```

### Step 2: Add inline badge to selected customer card

**File:** `frontend/src/components/shop/tabs/RedeemTabV2.tsx` (after the tier badge, ~line 1248)

```tsx
{/* Home/Cross-Shop Badge */}
{crossShopInfo && (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
    crossShopInfo.isHomeShop
      ? "bg-green-500/20 text-green-400 border border-green-500/30"
      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
  }`}>
    {crossShopInfo.isHomeShop ? "🏠 Home" : "🔄 Cross-Shop"}
  </span>
)}
```

### Step 3: Trigger pre-validation earlier

Currently `crossShopInfo` is populated when `redeemAmount > 0` (after the shop enters an amount). To show the badge immediately on customer select, trigger a pre-validation with `amount=0` or `validateOnly=true` as soon as a customer is selected.

**File:** `frontend/src/components/shop/tabs/RedeemTabV2.tsx`

In the customer selection handler (where `setSelectedCustomer` is called), add:

```tsx
// Immediately fetch cross-shop info on customer select
const verifyResponse = await apiClient.post('/tokens/verify-redemption', {
  customerAddress: customer.address,
  shopId: shopId,
  amount: 1,
  validateOnly: true
});
if (verifyResponse?.data?.isHomeShop !== undefined) {
  setCrossShopInfo({
    isHomeShop: verifyResponse.data.isHomeShop,
    maxRedeemable: verifyResponse.data.maxRedeemable || 0,
    crossShopLimit: verifyResponse.data.crossShopLimit || 0
  });
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/shop/tabs/RedeemTabV2.tsx` | Add relationship row in summary, inline badge on customer card, trigger pre-validation on customer select |

---

## Verification Checklist

- [ ] Home shop customer → green "🏠 Home Shop" badge on customer card
- [ ] Home shop customer → green "100% redeemable" in summary row
- [ ] Cross-shop customer → amber "🔄 Cross-Shop" badge on customer card
- [ ] Cross-shop customer → amber "Max X RCN (20%)" in summary row
- [ ] Badge appears immediately on customer select (before entering amount)
- [ ] Switching customer updates badge correctly
- [ ] "Change" button clears badge
- [ ] Loading state shows "Checking..." while fetching
- [ ] Cross-shop limit in summary matches the purple warning threshold
- [ ] Compare with mobile badges (once mobile fix applied) — same relationship for same customer/shop

---

## Notes

- The `crossShopInfo` data is already available from the backend pre-validation call — this enhancement just surfaces it proactively instead of only on error.
- The mobile has the same badges designed (green home / amber cross-shop) but they're currently broken due to `shopData.id` bug. Once both are fixed, web and mobile will show consistent indicators.
- The summary row uses the existing card row pattern (Customer/Tier/Balance rows) for visual consistency.
- No backend changes needed — `POST /tokens/verify-redemption?validateOnly=true` already returns `isHomeShop`, `maxRedeemable`, and `crossShopLimit`.

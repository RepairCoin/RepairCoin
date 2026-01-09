# UX-002: Enhance Buy Credits Button Visibility

## Status: TODO

## Priority: High

## Category: UX Enhancement / Revenue Generation

## Problem Statement

The "Buy Credits" button is currently:
1. **Hidden in sidebar** - Located under "SHOP TOOLS" section in sidebar (`ShopSidebar.tsx:182-192`)
2. **Small header button** - A small text link in the top-right header area (hard to find)
3. **No visual prominence** - Does not stand out as a primary revenue-generating action

This makes it difficult for shops to discover and use the RCN purchasing feature, potentially impacting platform revenue.

## Current Implementation

### Location 1: Sidebar Menu
- File: `frontend/src/components/ui/sidebar/ShopSidebar.tsx`
- Lines: 182-192
- Position: Under "SHOP TOOLS" section, 4th item
- Icon: `BuyRcnIcon`
- Label: "Buy Credits"
- Route: `/shop?tab=purchase`

### Location 2: Header (from screenshot)
- Small text button in top-right corner
- Barely visible among other header elements
- No visual distinction

## Proposed Enhancement

### Option A: Prominent Dashboard Card (Recommended)

Add a visually prominent "Buy Credits" call-to-action card on the Shop Overview tab:

```tsx
// In OverviewTab.tsx - Add after metrics cards

<div className="bg-gradient-to-r from-[#FFCC00]/20 to-[#FFD700]/10 border-2 border-[#FFCC00] rounded-xl p-6 mt-6">
  <div className="flex items-center justify-between">
    <div>
      <h3 className="text-xl font-bold text-white mb-2">
        Need More Credits?
      </h3>
      <p className="text-gray-300 text-sm">
        Purchase RCN credits to issue rewards to your customers
      </p>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[#FFCC00] font-semibold">Current Balance:</span>
        <span className="text-white font-bold">{shopData?.purchasedRcnBalance || 0} RCN</span>
      </div>
    </div>
    <button
      onClick={() => onTabChange?.('purchase')}
      className="bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-bold px-8 py-4 rounded-xl hover:scale-105 transition-transform shadow-lg"
    >
      Buy Credits
    </button>
  </div>
</div>
```

### Option B: Sticky Header Button

Replace small header link with a prominent sticky button:

```tsx
// Persistent button in shop header
<button className="fixed top-4 right-20 z-40 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-bold px-6 py-3 rounded-xl shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
  <CreditCard className="w-5 h-5" />
  Buy Credits
</button>
```

### Option C: Low Balance Alert Banner

Show a banner when RCN balance is low:

```tsx
// In ShopDashboardClient.tsx - Show when balance < 100 RCN
{shopData?.purchasedRcnBalance < 100 && (
  <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 mb-4 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <AlertCircle className="w-6 h-6 text-yellow-500" />
      <div>
        <p className="text-white font-semibold">Low RCN Balance</p>
        <p className="text-gray-400 text-sm">
          You have {shopData.purchasedRcnBalance} RCN remaining
        </p>
      </div>
    </div>
    <button
      onClick={() => setActiveTab('purchase')}
      className="bg-[#FFCC00] text-black font-bold px-6 py-2 rounded-lg hover:bg-[#FFD700]"
    >
      Buy Now
    </button>
  </div>
)}
```

### Option D: Floating Action Button (FAB)

Add a floating action button on shop dashboard:

```tsx
// Floating button in bottom-right corner
<button
  className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black p-4 rounded-full shadow-2xl hover:scale-110 transition-transform"
  onClick={() => setActiveTab('purchase')}
  title="Buy Credits"
>
  <CreditCard className="w-8 h-8" />
</button>
```

## Recommended Implementation

**Combine Options A + C:**

1. **Dashboard CTA Card** - Prominent section on Overview tab encouraging purchases
2. **Low Balance Alert** - Contextual reminder when balance drops below threshold

This approach:
- Makes the feature discoverable without being intrusive
- Provides contextual prompts based on actual need
- Maintains clean UI when balance is healthy
- Drives revenue through strategic placement

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/shop/tabs/OverviewTab.tsx` | Add Buy Credits CTA card |
| `frontend/src/components/shop/ShopDashboardClient.tsx` | Add low balance alert banner |

## Acceptance Criteria

- [ ] Buy Credits option is immediately visible on Shop Overview
- [ ] Visual design matches platform branding (gold/yellow gradient)
- [ ] Button navigates to Purchase tab
- [ ] Low balance alert shows when RCN < 100
- [ ] Dismiss option for low balance alert (persists for 24 hours)
- [ ] Mobile responsive design

## Business Impact

- **Increased RCN purchases** - Better visibility = higher conversion
- **Improved shop experience** - Easy access to essential feature
- **Reduced support tickets** - "Where do I buy credits?" questions eliminated
- **Revenue growth** - Primary revenue action is now prominent

## Design Notes

- Use gold gradient (`from-[#FFCC00] to-[#FFD700]`) to match platform branding
- Add subtle animation/hover effects to draw attention
- Consider A/B testing different placements
- Track click-through rates before and after implementation

## Related Files

- `frontend/src/components/shop/tabs/PurchaseTab.tsx` - Purchase tab component
- `frontend/src/components/ui/sidebar/ShopSidebar.tsx` - Sidebar navigation
- `frontend/src/components/shop/ShopDashboardClient.tsx` - Main shop dashboard

## Estimated Effort

- Small: 2-4 hours

## Tags

`ux` `revenue` `shop-dashboard` `high-priority`

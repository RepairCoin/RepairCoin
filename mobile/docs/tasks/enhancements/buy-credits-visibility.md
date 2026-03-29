# Enhancement: Enhance Buy Credits Visibility

**Status:** Open
**Priority:** Medium
**Est. Effort:** 2-4 hours
**Created:** 2026-03-10
**Updated:** 2026-03-10

---

## Problem

"Buy Credits" button is hidden in sidebar, hard to find.

## Proposed Changes

1. **Dashboard CTA Card** - Prominent section on Overview tab
2. **Low Balance Alert** - Banner when RCN < 100

## Implementation

```tsx
// In OverviewTab.tsx - Add CTA card
<div className="bg-gradient-to-r from-[#FFCC00]/20 to-[#FFD700]/10 border-2 border-[#FFCC00] rounded-xl p-6 mt-6">
  <div className="flex items-center justify-between">
    <div>
      <h3 className="text-xl font-bold text-white mb-2">Need More Credits?</h3>
      <p className="text-gray-300 text-sm">Purchase RCN credits to issue rewards</p>
      <span className="text-[#FFCC00]">Current Balance: {balance} RCN</span>
    </div>
    <button className="bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-bold px-8 py-4 rounded-xl">
      Buy Credits
    </button>
  </div>
</div>
```

## Files to Modify

- `frontend/src/components/shop/tabs/OverviewTab.tsx`
- `frontend/src/components/shop/ShopDashboardClient.tsx`

## Verification Checklist

- [ ] CTA card visible on shop dashboard
- [ ] Low balance alert shows when RCN < 100
- [ ] Click navigates to Buy Credits screen

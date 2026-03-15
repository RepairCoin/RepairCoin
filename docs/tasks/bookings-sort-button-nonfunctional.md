# My Bookings — Sort Button Not Functional

## Overview

The "Sort by: Date" button on the customer My Bookings page (`/customer?tab=orders`) is a non-functional UI element. Clicking it does nothing — no dropdown opens, no sort is applied. The state variable for sorting exists but is never wired up.

**Created**: March 2, 2026
**Status**: Open
**Priority**: Low
**Category**: UX / Missing Functionality

---

## Problem Statement

The sort button appears interactive (has hover styles, a chevron-down icon suggesting a dropdown) but has no `onClick` handler, no dropdown menu, and no sort logic applied to the bookings list. This is misleading to users who expect it to work.

---

## Affected Code

**File**: `frontend/src/components/customer/ServiceOrdersTab.tsx`

### Dead state variable (line 40)
```tsx
const [sortBy, setSortBy] = useState<"date" | "status">("date");
```
`sortBy` and `setSortBy` are declared but never used anywhere in the component.

### Static button with no handler (lines 355-362)
```tsx
{/* Sort Dropdown - Hidden on mobile */}
<div className="hidden sm:flex items-center gap-2">
  <span className="text-sm text-gray-500">Sort by:</span>
  <button className="px-3 py-1.5 bg-transparent border border-gray-700 rounded-lg text-white text-sm hover:border-gray-500 transition-colors flex items-center gap-2">
    Date
    <ChevronDown className="w-4 h-4 text-gray-400" />
  </button>
</div>
```

No `onClick`, no dropdown, no connection to `sortBy` state.

### No sort logic on the orders array (line 386)
```tsx
{orders.map((order) => { ... })}
```
Orders render in API response order (backend returns `ORDER BY created_at DESC`) with no client-side sort applied.

---

## Recommended Fix

### Option A: Implement the sort functionality

1. Wire the button to toggle a dropdown with sort options (Date, Status)
2. Connect `sortBy` state to the button click
3. Sort the `orders` array before rendering:

```tsx
const sortedOrders = [...orders].sort((a, b) => {
  if (sortBy === "date") {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }
  if (sortBy === "status") {
    const statusOrder = { pending: 0, paid: 1, approved: 2, scheduled: 3, completed: 4, cancelled: 5 };
    return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
  }
  return 0;
});
```

4. Add a simple dropdown menu toggled by the button:

```tsx
const [showSortMenu, setShowSortMenu] = useState(false);

<button onClick={() => setShowSortMenu(!showSortMenu)}>
  {sortBy === "date" ? "Date" : "Status"}
  <ChevronDown />
</button>
{showSortMenu && (
  <div className="dropdown-menu">
    <button onClick={() => { setSortBy("date"); setShowSortMenu(false); }}>Date</button>
    <button onClick={() => { setSortBy("status"); setShowSortMenu(false); }}>Status</button>
  </div>
)}
```

### Option B: Remove the button entirely

If sorting isn't needed (backend already returns newest first), remove the dead code:
- Delete `sortBy` / `setSortBy` state (line 40)
- Delete the sort button div (lines 355-362)

---

## Verification Checklist

- [ ] Sort button opens a dropdown with options (Date, Status)
- [ ] Selecting "Date" sorts bookings by date (newest first)
- [ ] Selecting "Status" sorts bookings by status progression
- [ ] Button label updates to reflect current sort selection
- [ ] Dropdown closes when clicking outside or selecting an option
- [ ] Sort persists when switching between filter tabs (All, Pending, Paid, etc.)
- [ ] No dead/unused state variables remain

---

## References

- **Component**: `frontend/src/components/customer/ServiceOrdersTab.tsx`
- **Dead state**: Line 40 (`sortBy`, `setSortBy`)
- **Static button**: Lines 355-362
- **Orders render**: Line 386

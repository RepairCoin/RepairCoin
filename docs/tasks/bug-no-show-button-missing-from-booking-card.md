# Bug: No-Show Button Missing from BookingCard Component

## Status: Open
## Priority: High
## Date: 2026-03-18
## Category: Bug - Missing Feature Integration

---

## Problem

The "No-Show" button is completely absent from the shop bookings tab (`/shop?tab=bookings`). Shop owners cannot mark customers as no-shows, which blocks the entire no-show dispute system from being used.

### Expected Behavior
Bookings in **scheduled** or **approved** status (with payment) should show a "No-Show" button alongside Cancel/Reschedule/Complete actions.

### Actual Behavior
Only Cancel, Reschedule, and Complete/Schedule buttons are rendered. No No-Show option exists anywhere in the booking card.

---

## Root Cause

There are **two separate BookingCard components** in the codebase:

| Component | Location | Has No-Show? | Used By |
|-----------|----------|-------------|---------|
| `BookingCard.tsx` | `frontend/src/components/shop/bookings/BookingCard.tsx` | **NO** | `/shop?tab=bookings` (active) |
| `BookingCard` (inline) | `frontend/src/components/shop/tabs/ShopServiceOrdersTab.tsx` | **YES** (line 284-294) | Older service orders tab (not active) |

The active bookings tab uses `BookingCard.tsx` from the `/bookings/` folder which was built without the No-Show feature. The No-Show button only exists in the older `ShopServiceOrdersTab.tsx` component which is no longer rendered.

### Missing in BookingCard.tsx:
1. **No `onMarkNoShow` prop** in `BookingCardProps` interface (line 7-18)
2. **No No-Show button** in `renderFooterActions()` switch cases (line 212-270)
3. **No No-Show option** in `getDropdownActions()` for mobile dropdown (line 274-294)

---

## Fix Required

### File: `frontend/src/components/shop/bookings/BookingCard.tsx`

**1. Add prop to interface (line 7-18):**
```typescript
interface BookingCardProps {
  // ... existing props
  onMarkNoShow: () => void;  // ADD THIS
}
```

**2. Add No-Show button to `renderFooterActions()` for `scheduled` status (line 250-267):**
The No-Show button should appear between Cancel and Complete for `scheduled` bookings:
```typescript
case 'scheduled':
  return (
    <>
      {cancelButton}
      {noShowButton}     // ADD THIS
      {rescheduleButton}
      {completeButton}
    </>
  );
```

**3. Add No-Show option to `getDropdownActions()` for mobile (line 286-289):**
```typescript
case 'scheduled':
  actions.push({ label: 'Mark No-Show', ... });  // ADD THIS
  actions.push({ label: 'Mark Complete', ... });
  actions.push({ label: 'Reschedule', ... });
  break;
```

### File: `frontend/src/components/shop/bookings/BookingsTabV2.tsx`
- Pass `onMarkNoShow` callback to `BookingCard`
- Import and render `MarkNoShowModal` (from `../MarkNoShowModal`)
- Add state: `noShowOrder` for the selected order

---

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/shop/bookings/BookingCard.tsx` | Add `onMarkNoShow` prop, No-Show button in footer and dropdown |
| `frontend/src/components/shop/bookings/BookingsTabV2.tsx` | Pass `onMarkNoShow` handler, integrate `MarkNoShowModal` |

---

## Verification Checklist

- [ ] No-Show button visible on `scheduled` status bookings
- [ ] No-Show button opens `MarkNoShowModal`
- [ ] After marking no-show, booking status updates
- [ ] No-show record created in `no_show_history` table
- [ ] Customer can see no-show and file dispute from `/customer?tab=orders`
- [ ] No-Show button does NOT appear on completed, cancelled, or requested bookings
- [ ] Mobile dropdown includes No-Show option

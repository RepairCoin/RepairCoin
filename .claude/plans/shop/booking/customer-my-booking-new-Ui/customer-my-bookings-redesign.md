# Customer "My Bookings" Page Redesign

**Created:** 2025-01-15
**Status:** Planning / Awaiting Approval
**Scope:** Frontend UI Update (align with Figma design)
**Reference:** `MY BOOKINGS.png` (Figma screenshot)

---

## Overview

Update the customer "My Bookings" page (`ServiceOrdersTab.tsx`) to match the new Figma design while preserving existing functionality.

---

## Figma Design Analysis

### Page Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Sidebar]    │           My Bookings                    │ Quick    │
│              │           View your booked services...   │ Summary  │
│ - Overview   ├──────────────────────────────────────────┤          │
│ - Marketplace│ [All] [Pending] [Paid] [Completed]       │ Pending  │
│ - My Bookings│ [Cancelled]              Sort by: [Date] │    1     │
│ - My Appts   ├──────────────────────────────────────────┤          │
│ - Referrals  │                                          │ Paid     │
│ - Gift Tokens│  ┌─ Booking Card ─────────────────────┐  │    1     │
│ - Find Shop  │  │ [IMG] Service Name     [STATUS]   │  │          │
│ - Approvals  │  │       Shop Name                    │  │Completed │
│              │  │       Location                     │  │    1     │
│ - Settings   │  ├────────────────────────────────────┤  │          │
│ - Logout     │  │ Date Booked | Service | Time | $$ │  │Cancelled │
│              │  ├────────────────────────────────────┤  │    1     │
│              │  │ Ongoing Status          Step X/5  │  ├──────────┤
│              │  │ ●───●───○───○───○                  │  │ What     │
│              │  │ Req→Paid→Appr→Sched→Complete      │  │ each     │
│              │  ├────────────────────────────────────┤  │ status   │
│              │  │ Next Action                        │  │ means    │
│              │  │ Waiting for shop approval...       │  │ [expand] │
│              │  ├────────────────────────────────────┤  │          │
│              │  │ ID: BK-XXX  [View] [Cancel]       │  │          │
│              │  └────────────────────────────────────┘  │          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Current vs Figma Comparison

| Element | Current Implementation | Figma Design | Changes Needed |
|---------|----------------------|--------------|----------------|
| **Filter Tabs** | All, Pending, Paid, Completed, Cancelled | Same | Minor styling |
| **Sort** | Static "Date" button | Dropdown with "Sort by: Date" | Add dropdown |
| **Booking Card** | 2-column grid + sidebar | Single column list + sidebar | Layout change |
| **Status Badge** | Top-right of card header | Top-right with clearer labels | Update labels |
| **Date Row** | Grid of boxes (Service Date, Time, Cost) | 4-column row: Date Booked, Service Date, Time, Cost | Add Date Booked |
| **Progress Bar** | 5 colored segments | 5 segments with step counter | Add step text |
| **Next Action** | Yellow box with clock icon | Similar but with different wording | Update text |
| **Action Buttons** | View Details, Cancel, Review, Book Again | View Booking Details, Cancel Booking, Receipt, Write Review, View Shop Profile, Book this Service | More options |
| **Quick Summary** | 4 stat cards with icons | Simpler stat boxes | Simplify design |
| **Status Guide** | Expandable accordion | Same concept | Keep as is |

---

## Action Buttons Per Status

| Status | Figma Buttons |
|--------|---------------|
| **Pending** | `View Booking Details`, `Cancel Booking` |
| **Paid/On-going** | `Receipt`, `Write Review` |
| **Completed** | `View Shop Profile`, `Book this Service` |
| **Cancelled** | `Book this Service` |

---

## Status Badge Labels (Figma)

| Status | Badge Label | Color |
|--------|-------------|-------|
| pending | "Waiting for Shop Approval" | Yellow |
| paid | "On-going" or "Paid" | Blue |
| approved | "Approved" | Green |
| scheduled | "Scheduled" | Purple |
| completed | "Completed" | Green |
| cancelled | "Cancelled" | Gray |

---

## Implementation Plan

### Phase 1: BookingCard Component Update
**Files:** `frontend/src/components/customer/BookingCard.tsx`

- [ ] Add "Date Booked" field to the details row
- [ ] Update details row to show 4 columns: Date Booked | Service Date | Time | Cost
- [ ] Update progress bar with step counter ("Step X out of 5")
- [ ] Keep existing flexible structure for status-specific sections

### Phase 2: ServiceOrdersTab Main Updates
**Files:** `frontend/src/components/customer/ServiceOrdersTab.tsx`

- [ ] Update status badge labels to match Figma design
- [ ] Update "Next Action" section text per status
- [ ] Update action buttons based on status:
  - Pending: View Booking Details + Cancel Booking
  - Paid: Receipt + (Write Review if eligible)
  - Completed: Write Review (if eligible) + View Shop Profile + Book this Service
  - Cancelled: Book this Service
- [ ] Add "Receipt" button for paid/completed orders

### Phase 3: Quick Summary Sidebar Update
**Files:** `frontend/src/components/customer/ServiceOrdersTab.tsx`

- [ ] Simplify Quick Summary design (remove large icons)
- [ ] Keep 4 stat rows: Pending, Paid, Completed, Cancelled
- [ ] Keep "What each status means" expandable section

### Phase 4: Filter & Sort UI Polish
**Files:** `frontend/src/components/customer/ServiceOrdersTab.tsx`

- [ ] Update filter tab styling to match Figma
- [ ] Convert sort button to dropdown (currently static)

---

## Backend Integration Check

### Existing API Endpoints (No Changes Needed)

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /api/services/orders/customer` | Get customer orders | EXISTS |
| `POST /api/services/orders/:orderId/cancel` | Cancel order | EXISTS |
| `GET /api/services/orders/:orderId/can-review` | Check review eligibility | EXISTS |

### Data Available in ServiceOrderWithDetails

```typescript
interface ServiceOrderWithDetails {
  orderId: string;
  status: 'pending' | 'paid' | 'completed' | 'cancelled' | 'refunded' | 'no_show';

  // Service Info
  serviceName: string;
  serviceDescription?: string;
  serviceImageUrl?: string;

  // Shop Info
  shopId: string;
  shopName: string;
  shopAddress?: string;
  shopCity?: string;

  // Booking Info
  createdAt: string;           // Date Booked
  bookingDate?: string;        // Service Date
  bookingTime?: string;        // Service Time
  bookingTimeSlot?: string;    // Appointment date/time
  totalAmount: number;         // Cost

  // Approval
  shopApproved?: boolean;
  approvedAt?: string;

  // RCN
  rcnEarned?: number;
  rcnRedeemed?: number;
  rcnDiscountUsd?: number;
}
```

**Conclusion:** All required data is already available from the backend. No backend changes needed.

---

## File Structure

```
frontend/src/components/customer/
├── ServiceOrdersTab.tsx      # Main component (UPDATE)
├── BookingCard.tsx           # Booking card component (UPDATE)
├── BookingDetailsModal.tsx   # Details modal (KEEP)
├── CancelBookingModal.tsx    # Cancel modal (KEEP)
└── WriteReviewModal.tsx      # Review modal (KEEP)
```

---

## Design System Reference

### Colors
- Background: `#0D0D0D`, `#1A1A1A`
- Border: `gray-800`
- Primary: `#FFCC00` (yellow)
- Status: Yellow (pending), Blue (paid), Green (approved/completed), Purple (scheduled), Gray (cancelled)

### Typography
- Headings: White, Bold
- Body: Gray-400
- Labels: Gray-500

### Spacing
- Card padding: `p-6`
- Section gaps: `gap-4` to `gap-6`
- Border radius: `rounded-xl`, `rounded-2xl`

---

## Acceptance Criteria

1. [ ] Booking cards display all 4 date fields in a row
2. [ ] Progress bar shows "Step X out of 5" text
3. [ ] Status badges use new labels from Figma
4. [ ] Action buttons match Figma per status
5. [ ] Quick Summary sidebar is simplified
6. [ ] "Receipt" functionality works for paid/completed orders
7. [ ] Existing functionality preserved (cancel, review, book again)
8. [ ] Mobile responsive layout maintained

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Keep BookingCard flexible with slots |
| Mobile layout issues | Test on multiple screen sizes |
| Status logic changes | Use existing `getEffectiveStatus` function |

---

## Notes

- This is a **frontend-only** update
- No new backend endpoints required
- All existing modals (Details, Cancel, Review) will be preserved
- The sidebar navigation is part of the customer dashboard layout (out of scope)

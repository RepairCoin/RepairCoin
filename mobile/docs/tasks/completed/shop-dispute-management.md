# Feature: Shop Dispute Management Screen

**Status:** Completed
**Priority:** Medium
**Est. Effort:** 4-6 hrs
**Created:** 2026-04-08
**Updated:** 2026-04-09
**Completed:** 2026-04-09

## Overview

The mobile app is missing the shop-side dispute management screen. Shops can mark customers as no-show and customers can submit disputes on mobile, but shops cannot view, approve, or reject dispute requests — they must use the web dashboard for this.

**Affected:** Shop dispute management (mobile only)

## What Already Works on Mobile

| Feature | Status |
|---------|--------|
| Mark customer as no-show | Works |
| Customer submit dispute | Works |
| Customer see no-show warning | Works |
| Shop view disputes | Missing |
| Shop approve/reject disputes | Missing |

## What's Missing

A dedicated screen where shops can:
- View all customer dispute requests (pending, approved, rejected, all)
- See dispute details (customer name, reason, booking info, submission date)
- Approve disputes (with optional resolution notes) — reverses no-show penalty
- Reject disputes (with mandatory rejection reason) — penalty remains
- See pending dispute count badge

---

## Web Reference

**File:** `frontend/src/components/shop/ShopDisputePanel.tsx`

Web implementation includes:
- Filter tabs: Pending, Approved, Rejected, All
- Expandable dispute cards showing:
  - Customer name/email and appointment date
  - Customer's dispute reason
  - Resolution notes (if resolved)
  - Order ID, customer tier at time of no-show
  - Submission and resolution timestamps
- Approve button with optional resolution notes
- Reject button with mandatory rejection reason (min 10 chars)
- Pending count stats bar
- Refresh button

---

## Backend Endpoints (All Exist)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/services/shops/:shopId/disputes` | GET | List shop's disputes (with status filter) |
| `/services/shops/:shopId/disputes/:disputeId/approve` | PUT | Approve a dispute |
| `/services/shops/:shopId/disputes/:disputeId/reject` | PUT | Reject a dispute |

---

## Implementation Plan

### Step 1: Create API service methods

**File:** Create `mobile/feature/booking/services/dispute.services.ts` or add to existing appointment services:

```typescript
async getShopDisputes(shopId: string, status?: string, page?: number): Promise<any> {
  const params = buildQueryString({ status, page, limit: 20 });
  return apiClient.get(`/services/shops/${shopId}/disputes${params}`);
}

async approveDispute(shopId: string, disputeId: string, resolutionNotes?: string): Promise<any> {
  return apiClient.put(`/services/shops/${shopId}/disputes/${disputeId}/approve`, { resolutionNotes });
}

async rejectDispute(shopId: string, disputeId: string, rejectionReason: string): Promise<any> {
  return apiClient.put(`/services/shops/${shopId}/disputes/${disputeId}/reject`, { rejectionReason });
}
```

### Step 2: Create React Query hooks

```typescript
// useShopDisputesQuery(shopId, status)
// useApproveDisputeMutation()
// useRejectDisputeMutation()
```

### Step 3: Create dispute screen

**File:** `mobile/feature/booking/screens/ShopDisputesScreen.tsx`

- Filter tabs: Pending, Approved, Rejected, All
- FlatList of dispute cards with pull-to-refresh
- Each card shows: customer name, reason, date, status badge
- Approve/Reject buttons on pending cards
- Reject modal with reason text input (min 10 chars)

### Step 4: Create route

**File:** `mobile/app/(dashboard)/shop/disputes/index.tsx`

### Step 5: Add navigation entry point

Add a "Disputes" link in the shop's navigation or booking tab header, similar to the web sidebar entry. Include pending count badge.

---

## Dispute Approval/Rejection Effects

### When shop approves:
- Customer's `no_show_count` decremented by 1
- No-show record flagged as `[DISPUTE_REVERSED]`
- Customer tier recalculated (may drop from caution → warning → normal)
- Customer notified via email
- If customer was suspended, suspension may be lifted

### When shop rejects:
- No changes to no-show count or tier
- Customer notified via email with rejection reason
- Dispute marked as rejected (cannot re-submit)

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `mobile/feature/booking/services/dispute.services.ts` | Create API service methods |
| `mobile/feature/booking/hooks/queries/useDisputeQueries.ts` | Create query hooks |
| `mobile/feature/booking/hooks/mutations/useDisputeMutations.ts` | Create mutation hooks |
| `mobile/feature/booking/screens/ShopDisputesScreen.tsx` | Create dispute management screen |
| `mobile/feature/booking/components/DisputeCard.tsx` | Create dispute card component |
| `mobile/app/(dashboard)/shop/disputes/index.tsx` | Create route |
| `mobile/feature/booking/components/BookingShopTab.tsx` | Add disputes navigation button |

---

## QA Test Plan

### Full workflow

1. Login as shop → mark a customer as no-show on a booking
2. Login as customer → see no-show warning → submit dispute with reason
3. Login as shop on mobile → navigate to Disputes screen
4. **Expected:** See pending dispute with customer's reason
5. Approve the dispute → customer's no-show count decremented
6. Login as customer → no-show warning removed or tier reduced

### Reject workflow

1. Submit a dispute as customer
2. Login as shop → Disputes → tap Reject
3. **Expected:** Rejection reason modal appears (min 10 chars)
4. Submit rejection
5. **Expected:** Dispute marked as rejected, customer notified

### Filter tabs

1. Have disputes in various statuses
2. Tap each filter tab (Pending, Approved, Rejected, All)
3. **Expected:** Correct disputes shown per filter

### Edge cases

- No disputes → empty state with message
- Dispute already resolved → no approve/reject buttons shown
- Pull to refresh → data reloads

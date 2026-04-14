# Feature: Add Revenue Sharing Breakdown to Admin Treasury Page

## Status: Open
## Priority: Medium
## Date: 2026-04-14
## Category: Feature - Admin Dashboard / Treasury
## Affects: Admin > Treasury page

---

## Problem

Revenue sharing data (`operations_share`, `stakers_share`, `dao_treasury_share`) is correctly calculated and stored in `shop_rcn_purchases` for every RCN purchase, but there is no UI in the admin dashboard to view this breakdown. Admins cannot verify revenue distribution without querying the database directly.

---

## Current State

- **Database**: Each completed purchase in `shop_rcn_purchases` has `operations_share`, `stakers_share`, `dao_treasury_share` columns with correct values (80/10/10 split)
- **Admin Treasury page** (`/admin?tab=treasury`): Shows aggregated revenue trends chart but no per-purchase revenue split or totals
- **Tabs available**: Overview, RCG Metrics, Analytics, Operations, Pricing — none show the revenue sharing data

---

## Requirements

### 1. Revenue Distribution Summary Card

Add a summary card (on Overview or Analytics tab) showing totals:

| Metric | Value |
|---|---|
| Total Revenue | $X,XXX.XX |
| Operations (80%) | $X,XXX.XX |
| Stakers (10%) | $X,XXX.XX |
| DAO Treasury (10%) | $X,XXX.XX |

With period filters: Last 7 days / 30 days / 90 days / All time

### 2. Per-Purchase Revenue Table

Add a table (on Operations tab or new "Revenue" tab) showing individual purchases with revenue splits:

| Shop | Amount (RCN) | Total Cost | Operations | Stakers | DAO | Tier | Date |
|---|---|---|---|---|---|---|---|
| peanut | 100 | $10.00 | $8.00 | $1.00 | $1.00 | Standard | Apr 14 |
| dc_shopu | 50 | $5.00 | $4.00 | $0.50 | $0.50 | Standard | Apr 13 |

With pagination and filters by shop, date range, and tier.

### 3. Revenue Distribution Chart

Visual breakdown (pie or donut chart) showing the 80/10/10 split for a selected period.

---

## Backend API

### New endpoint or extend existing:

```
GET /api/admin/treasury/revenue-sharing?period=30d
```

**Response:**
```json
{
  "summary": {
    "totalRevenue": 1500.00,
    "operationsTotal": 1200.00,
    "stakersTotal": 150.00,
    "daoTreasuryTotal": 150.00,
    "purchaseCount": 25
  },
  "purchases": [
    {
      "id": 227,
      "shopId": "peanut",
      "shopName": "Peanut",
      "amount": 100,
      "totalCost": 10.00,
      "operationsShare": 8.00,
      "stakersShare": 1.00,
      "daoTreasuryShare": 1.00,
      "shopTier": "STANDARD",
      "completedAt": "2026-04-14T05:49:12Z"
    }
  ]
}
```

---

## Files to Modify

### Backend

| File | Change |
|------|--------|
| `backend/src/domains/admin/routes/treasury.ts` | Add revenue sharing endpoint |
| `backend/src/repositories/ShopRepository.ts` | Add query for aggregated revenue sharing data |

### Frontend

| File | Change |
|------|--------|
| `frontend/src/components/admin/tabs/TreasuryTab.tsx` | Add revenue distribution summary card and per-purchase table |
| `frontend/src/services/api/admin.ts` | Add API call for revenue sharing data |

---

## QA Verification

- [ ] Admin > Treasury shows revenue distribution summary with correct totals
- [ ] Per-purchase table shows operations/stakers/DAO columns with correct values
- [ ] Period filter (7d/30d/90d/all) updates totals correctly
- [ ] New purchases appear in the table after completion
- [ ] Old purchases with zero revenue shares show as $0.00 (not hidden)

# What's Next - Priority Build Guide

**Date:** February 16, 2026
**Last Updated:** February 16, 2026

---

## Recently Completed ✅

| Feature | Time | Status |
|---------|------|--------|
| No-Show Penalty System (4-tier) | ~10 hrs | ✅ Complete |
| Automated No-Show Detection | ~7 hrs | ✅ Complete |
| Manual Appointment Booking | ~9 hrs | ✅ Complete |
| Messaging System | - | ✅ Complete |
| Admin Analytics Dashboard | - | ✅ Complete |
| Shop Service Analytics | - | ✅ Complete |

---

## Current Status of Remaining Features

### 1. No-Show Dispute System ⭐⭐⭐⭐
**Status:** 20-30% Complete (data model only, no workflow)
**Time Estimate:** 10-12 hours
**Priority:** HIGH

**What Exists:**
- ✅ Database columns (disputed, dispute_status, dispute_reason, timestamps)
- ✅ Shop policy settings (allowDisputes, disputeWindowDays, autoApproveFirstOffense)

**What's Missing:**
- ❌ API endpoints (submit, review, approve, reject dispute)
- ❌ Frontend dispute submission form for customers
- ❌ Shop review interface
- ❌ Admin arbitration panel
- ❌ Dispute workflow business logic
- ❌ Notifications for dispute updates

---

### 2. Enhanced No-Show Analytics ⭐⭐⭐⭐
**Status:** 40-50% Complete (basic rate only, no frontend)
**Time Estimate:** 8-10 hours
**Priority:** HIGH

**What Exists:**
- ✅ `getShopAnalytics()` in NoShowPolicyService (returns total, rate, tier breakdown)
- ✅ No-show history table with timestamps and metadata
- ✅ Auto-detection service logs

**What's Missing:**
- ❌ Dedicated analytics API endpoints (trends, time-series, service breakdown)
- ❌ Frontend analytics tab in shop dashboard
- ❌ Time-of-day heatmap
- ❌ Week-over-week comparisons
- ❌ No-show section in admin analytics dashboard

---

### 3. Admin No-Show Analytics ⭐⭐⭐
**Status:** 0% (no no-show section in admin dashboard)
**Time Estimate:** 6-8 hours
**Priority:** MEDIUM

**What Exists:**
- ✅ Admin analytics dashboard with marketplace metrics
- ✅ Shop performance rankings

**What's Missing:**
- ❌ Platform-wide no-show overview
- ❌ Shop comparison (who has best/worst rates)
- ❌ Policy effectiveness metrics
- ❌ No-show economic impact

---

## Recommended Build Order

### Next Up: No-Show Dispute System (10-12 hrs)
**Why First:**
- Database schema already exists — just needs workflow + UI
- Builds directly on completed no-show penalty system
- High fairness impact for customers
- Shortest path to completion given existing foundation

**What to Build:**

**Backend:**
```
POST   /api/services/orders/:orderId/dispute         - Submit dispute
GET    /api/services/orders/:orderId/dispute         - Get dispute status
PUT    /api/shops/:shopId/disputes/:id/approve       - Shop approves
PUT    /api/shops/:shopId/disputes/:id/reject        - Shop rejects
GET    /api/shops/:shopId/disputes                   - List shop disputes
GET    /api/admin/disputes                           - Admin view all
PUT    /api/admin/disputes/:id/resolve               - Admin arbitration
```

**Frontend:**
- `DisputeModal.tsx` - Customer submits dispute with reason
- `ShopDisputePanel.tsx` - Shop reviews and responds
- `AdminDisputeTab.tsx` - Admin arbitration view
- Integration in customer settings (no-show history)
- Integration in shop dashboard

---

### After That: Enhanced No-Show Analytics (8-10 hrs)

**Backend:**
```
GET /api/shops/:shopId/no-show-analytics?days=30     - Overview
GET /api/shops/:shopId/no-show-trends?period=daily   - Time series
GET /api/shops/:shopId/no-show-by-service            - Service breakdown
GET /api/shops/:shopId/no-show-by-time               - Heatmap data
GET /api/admin/no-show-analytics/platform            - Admin overview
```

**Frontend:**
- New analytics tab in shop dashboard
- Time series line chart (30/60/90 days)
- Service breakdown table
- Day/time heatmap
- Admin no-show section

---

## Effort vs Impact

```
High Impact, Low Effort (DO NEXT):
  ⏳ Dispute System           (10-12 hrs) - foundation already exists
  ⏳ No-Show Analytics        (8-10 hrs)  - data already tracked

Medium Impact, Low Effort (AFTER):
  ⏳ Admin No-Show Analytics  (6-8 hrs)   - extends existing admin dashboard

Low Impact, High Effort (SKIP FOR NOW):
  ❌ SMS Notifications        (6-8 hrs)   - low usage currently
  ❌ Mobile App               (200+ hrs)  - too early
  ❌ ML Predictions           (30+ hrs)   - need more data first
```

---

## Quick Summary

| # | Feature | Current | Missing | Est. Time |
|---|---------|---------|---------|-----------|
| 1 | Dispute System | Schema only | Full workflow + UI | 10-12 hrs |
| 2 | No-Show Analytics | Basic rate | Trends + frontend | 8-10 hrs |
| 3 | Admin No-Show Analytics | None | Full section | 6-8 hrs |

**Total remaining:** ~24-30 hours

---

**Document:** What's Next Priority Guide
**Version:** 3.0
**Last Updated:** February 16, 2026

# Service Analytics

## Overview

Service Analytics gives shop owners a performance overview of their service marketplace — revenue, order volumes, conversion rates, group performance, and customer satisfaction — all in one dashboard.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | Fully implemented |
| Backend API | Fully implemented |
| Mobile (React Native) | Not implemented (mobile has basic BookingAnalyticsTab only) |

## Metrics Available

### Summary Cards
- Total revenue
- Total orders
- Average order value
- Active services count
- Average rating
- Total RCN redeemed

### Order Trends
- Revenue and order count over time
- Configurable period: 7 / 30 / 90 days
- Line/bar chart view

### Top 5 Performing Services
- Revenue per service
- Order count and conversion rate
- Average rating

### Category Breakdown
- Revenue and order count by service category
- Percentage share per category

### Group Performance
- Revenue and orders attributed to affiliate group bonuses
- Which groups drive the most bookings

### Customer Satisfaction
- Rating distribution (1–5 stars)
- Review count
- Satisfaction score

## API Endpoints

Base path: `/api/services/analytics`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/shop/summary` | Full analytics summary for current shop |

Query params:
- `trendDays` — number of days for trend charts (7, 30, 90)

## Frontend Location

- Tab: `frontend/src/components/shop/tabs/ServiceAnalyticsTab.tsx`
- Group performance section: `frontend/src/components/shop/GroupPerformanceSection.tsx`
- API service: `frontend/src/services/api/serviceAnalytics.ts`

## Backend Location

- Part of `ShopDomain` service analytics controllers
- Related to `ServiceDomain` order aggregations

## Difference from Booking Analytics

The mobile app already has a `BookingAnalyticsTab` which covers basic booking counts and statuses. Service Analytics is broader — it covers revenue, conversion rates, group performance, and satisfaction scores, which are not in the mobile booking analytics.

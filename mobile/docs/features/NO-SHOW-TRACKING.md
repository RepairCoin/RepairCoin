# No-Show Tracking

## Overview

No-Show Tracking monitors customers who book appointments but do not show up. Repeat no-shows receive warning badges and may face booking restrictions. This protects shops from time wasted on unfulfilled bookings.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | Fully implemented |
| Backend API | Fully implemented |
| Mobile (React Native) | Not implemented |

## How It Works

1. When a customer does not show up for a booking, the shop marks them as a no-show
2. The customer's no-show count increments
3. Based on the count, the customer is assigned a tier/warning level
4. The tier is displayed as a badge on the customer's profile and on booking cards
5. Shops can see the warning before confirming a booking

## No-Show Tiers

| Tier | Condition | Effect |
|------|-----------|--------|
| `normal` | 0–1 no-shows | No badge shown |
| `warning` | 2–3 no-shows | Yellow warning badge |
| `restricted` | 4+ no-shows | Red badge, booking may be restricted |

## Customer-Facing

- Customers see a `NoShowWarningBanner` at the top of their dashboard if they have accumulated no-shows
- The banner explains their current standing and how to improve it
- Customers can dispute a no-show if they believe it was incorrectly marked

## Shop-Facing

- `CustomerNoShowBadge` displayed on customer lookup and booking cards
- Badge shows tier icon + no-show count
- Shops can mark a booking as no-show from the booking management screen

## API

- No-show status: `GET /api/customers/no-show-status`
- Mark no-show: `POST /api/bookings/:orderId/no-show`
- Dispute no-show: `POST /api/bookings/:orderId/dispute-no-show`

## Frontend Location

- Customer badge: `frontend/src/components/customer/CustomerNoShowBadge.tsx`
- Warning banner: `frontend/src/components/customer/NoShowWarningBanner.tsx`
- No-show policy screen (mobile placeholder): `mobile/feature/services/appointment/screens/NoShowPolicyScreen.tsx`
- API service: `frontend/src/services/api/noShow.ts`

## Mobile Notes

The mobile app has a `NoShowPolicyScreen` which shows the policy text but does not implement:
- No-show badge display on customer cards
- Warning banner for customers with no-shows
- Shop-side "Mark No-Show" action in booking management

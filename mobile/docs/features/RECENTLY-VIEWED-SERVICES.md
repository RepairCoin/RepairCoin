# Recently Viewed Services

## Overview

Recently Viewed Services tracks the last services a customer has viewed and displays them on the customer dashboard for quick re-access. It is a convenience feature that improves repeat discovery.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | Fully implemented |
| Backend API | Implemented |
| Mobile (React Native) | Not implemented |

## How It Works

1. When a customer views a service detail page, the service ID is recorded
2. The backend stores the view history per customer
3. On the customer dashboard, a "Recently Viewed" section shows the last 5–10 services viewed
4. Items are sorted by most recently viewed

## UI

- Horizontal scrollable row of service cards
- Each card shows service name, shop name, price, and rating
- Clicking a card navigates to the service detail

## Related Features

- **Trending Services** — most-viewed or most-booked services platform-wide (mobile has `TrendingServicesScreen`)
- **Similar Services** — services similar to one currently being viewed
- **Favorites** — explicitly saved services (already on mobile)

## Frontend Location

- Component: `frontend/src/components/customer/RecentlyViewedServices.tsx`
- Used inside `ServiceMarketplaceClient.tsx` and customer dashboard

## Backend Location

- Tracked in `CustomerDomain` via service view events
- Endpoint: `GET /api/customers/recently-viewed`

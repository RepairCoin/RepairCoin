# Customer Moderation

## Overview

Customer Moderation allows shop owners to block problematic customers and submit issue reports to admins. It is a safety and trust feature for managing abusive or fraudulent customer behavior.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | Fully implemented |
| Backend API | Fully implemented |
| Mobile (React Native) | Partial — customer list screen exists, moderation actions not implemented |

## Features

### Block / Unblock Customers
- Block a customer from booking at the shop
- Provide a reason for blocking
- Unblock at any time
- Search blocked customers by name, wallet address, or reason
- Blocked customers cannot place new bookings at the shop

### Issue Reports (to Admin)
Shops can report customers for admin review:

**Report types:**
- `spam` — sending spam messages or reviews
- `fraud` — fraudulent transactions or behavior
- `harassment` — harassing the shop or staff
- `inappropriate_review` — review that violates guidelines
- `other`

**Report lifecycle:**
- `pending` → `investigating` → `resolved` or `dismissed`
- Shop can track report status
- Admin can add notes visible to the shop

### Review Flagging
Shops can flag specific customer reviews for admin moderation.

## API Endpoints

Base path: `/api/shops/moderation`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/block` | Block a customer |
| POST | `/unblock` | Unblock a customer |
| GET | `/blocked` | List blocked customers |
| POST | `/report` | Submit an issue report |
| GET | `/reports` | List submitted reports |
| POST | `/flag-review` | Flag a customer review |

## Frontend Location

- Customers tab (includes moderation): `frontend/src/components/shop/tabs/CustomersTab.tsx`
- Reports tab: `frontend/src/components/shop/tabs/ReportsTab.tsx` (scheduled email reports — separate feature)
- Moderation modals within customers tab

## Mobile Gap

The mobile `CustomerListScreen` shows the list of customers but does not include:
- Block/unblock actions
- Reason tracking
- Issue report submission
- Review flagging

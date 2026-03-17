# Bug: Customer Search in Book Appointment Exposes All Platform Customers

## Severity: High - Unauthorized Data Exposure

## Status: Open

## Reported: 2026-03-17

## Introduced By
- **Developer:** Zeff01 (jzeffsomera@gmail.com)
- **Commit:** `a3bd004b5` - Manual booking feature (2026-02-16)

## Description

The customer search field in the **Book Appointment** modal (Shop Dashboard > Appointments > + Book) returns **all customers across the entire platform**, not just customers who have a relationship with the requesting shop. This is a data privacy and security vulnerability.

When a shop owner searches for a customer by name, email, phone, or wallet address, the backend query searches the entire `customers` table without any shop-scoping filter.

## Screenshot

See: `c:\dev\sc1.png` - Book Appointment modal with the customer search field highlighted.

## Reproduction Steps

1. Log in as **Shop A** owner
2. Navigate to **Appointments** tab
3. Click **+ Book** to open the "Book Appointment" modal
4. In the **Customer** search field, type a partial name (e.g., "john")
5. Observe that results include customers who have **never** booked at Shop A

## Root Cause

### Backend - Unscoped SQL Query

**File:** `backend/src/domains/ServiceDomain/controllers/ManualBookingController.ts`
**Lines:** 445-471

```sql
SELECT address, wallet_address, email, name, phone, no_show_count, no_show_tier, created_at
FROM customers
WHERE
  LOWER(name) LIKE $1 OR
  LOWER(email) LIKE $1 OR
  LOWER(phone) LIKE $1 OR
  LOWER(address) LIKE $1
ORDER BY ...
LIMIT 20
```

**Problem:** There is no `WHERE shop_id = ...` or `EXISTS (SELECT 1 FROM service_orders ...)` clause to restrict results to customers associated with the requesting shop.

### Affected Endpoint

- **Route:** `GET /api/services/shops/:shopId/customers/search?q=<query>`
- **File:** `backend/src/domains/ServiceDomain/routes.ts` (line ~2531)
- **Middleware:** `authMiddleware`, `requireRole(['shop'])` - authenticates the shop but does not scope data

### Frontend Call

- **File:** `frontend/src/components/shop/ManualBookingModal.tsx` (line 253)
- **API Service:** `frontend/src/services/api/appointments.ts` (lines 384-389)

## Exposed Data

A shop owner can see the following for **any** platform customer:
- Full name
- Email address
- Phone number
- Wallet address
- No-show count and tier
- Account creation date

## Impact

- **Privacy Violation:** Customer PII (email, phone, wallet address) exposed to unrelated shops
- **Competitive Risk:** Shop owners can discover competitor customer lists
- **Compliance Risk:** Potential GDPR/CCPA violation - processing personal data without legitimate purpose
- **Trust Risk:** Customers expect their data is only visible to shops they interact with

## Proposed Fix

Modify the SQL query to scope results to customers who have placed orders at the requesting shop:

```sql
SELECT
  c.address, c.wallet_address, c.email, c.name, c.phone,
  c.no_show_count, c.no_show_tier, c.created_at
FROM customers c
WHERE
  (LOWER(c.name) LIKE $1 OR LOWER(c.email) LIKE $1 OR LOWER(c.phone) LIKE $1 OR LOWER(c.address) LIKE $1)
  AND EXISTS (
    SELECT 1 FROM service_orders so
    WHERE so.customer_address = c.address
    AND so.shop_id = $2
  )
ORDER BY
  CASE
    WHEN LOWER(c.name) LIKE $1 THEN 1
    WHEN LOWER(c.email) LIKE $1 THEN 2
    WHEN LOWER(c.phone) LIKE $1 THEN 3
    ELSE 4
  END,
  c.name ASC
LIMIT 20
```

**Note:** The `+ Create New Customer` button in the modal allows shops to add new customers manually, so restricting search to existing shop customers does not block the booking flow.

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/domains/ServiceDomain/controllers/ManualBookingController.ts` | Add shop-scoped `EXISTS` subquery to `searchCustomers()` SQL |

## Testing Checklist

- [ ] Search returns only customers who have booked at the current shop
- [ ] Search returns empty results for customers with no orders at the shop
- [ ] `+ Create New Customer` still works for booking new customers
- [ ] Search by name, email, phone, and address all work correctly with scoping
- [ ] Performance is acceptable (add index on `service_orders(customer_address, shop_id)` if needed)
- [ ] Verify other customer search endpoints (e.g., in Customers tab) are also scoped

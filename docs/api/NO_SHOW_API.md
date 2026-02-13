# No-Show Penalty System API Documentation

## Overview

The No-Show Penalty System implements a 4-tier progressive penalty framework to manage customers who miss appointments. This document details all API endpoints related to no-show tracking, customer status, and policy management.

---

## Endpoints

###1. Mark Order as No-Show

**Endpoint:** `POST /api/services/orders/:id/mark-no-show`

**Authentication:** Required (Shop only)

**Description:** Marks a paid order as no-show, records the incident in history, updates customer tier, and sends notifications.

**Request:**
```json
{
  "notes": "Customer did not show up for appointment"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order marked as no-show",
  "data": {
    "customerStatus": {
      "tier": "warning",
      "noShowCount": 1,
      "canBook": true,
      "restrictions": []
    }
  }
}
```

**Tier Calculation:**
- 1 no-show → `warning`
- 2 no-shows → `caution`
- 3-4 no-shows → `deposit_required`
- 5+ no-shows → `suspended`

**Side Effects:**
1. Updates order status to `no_show`
2. Records incident in `no_show_history` table
3. Increments customer's `no_show_count`
4. Auto-calculates and updates customer tier (via database trigger)
5. Sends in-app notification to customer
6. Sends tier-appropriate email notification

---

### 2. Get Customer No-Show Status

**Endpoint:** `GET /api/customers/:address/no-show-status?shopId={shopId}`

**Authentication:** Required (Customer, Shop, or Admin)

**Description:** Retrieves a customer's current no-show status, tier, and booking restrictions for a specific shop.

**Query Parameters:**
- `shopId` (required): The shop ID to check restrictions against

**Response:**
```json
{
  "success": true,
  "data": {
    "customerAddress": "0x1234...",
    "noShowCount": 2,
    "tier": "caution",
    "depositRequired": false,
    "lastNoShowAt": "2026-02-09T10:30:00Z",
    "bookingSuspendedUntil": null,
    "successfulAppointmentsSinceTier3": 0,
    "canBook": true,
    "requiresDeposit": false,
    "minimumAdvanceHours": 24,
    "restrictions": [
      "Must book at least 24 hours in advance"
    ]
  }
}
```

**Tier Details:**

| Tier | `noShowCount` | `canBook` | `minimumAdvanceHours` | `requiresDeposit` |
|------|---------------|-----------|----------------------|-------------------|
| `normal` | 0 | true | 0 | false |
| `warning` | 1 | true | 0 | false |
| `caution` | 2 | true | 24 | false |
| `deposit_required` | 3-4 | true | 48 | true |
| `suspended` | 5+ | false | - | - |

---

### 3. Get Customer No-Show History

**Endpoint:** `GET /api/customers/:address/no-show-history?limit=10`

**Authentication:** Required (Customer, Shop, or Admin)

**Description:** Retrieves a customer's no-show incident history with full details.

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "uuid-123",
        "customerAddress": "0x1234...",
        "orderId": "uuid-456",
        "serviceId": "uuid-789",
        "shopId": "shop-001",
        "scheduledTime": "2026-02-08T14:00:00Z",
        "markedNoShowAt": "2026-02-08T14:20:00Z",
        "markedBy": "0xshop...",
        "notes": "Customer did not arrive",
        "gracePeriodMinutes": 15,
        "customerTierAtTime": "warning",
        "disputed": false,
        "disputeStatus": null,
        "disputeReason": null,
        "disputeSubmittedAt": null,
        "disputeResolvedAt": null,
        "createdAt": "2026-02-08T14:20:00Z"
      }
    ],
    "count": 1
  }
}
```

**History Entry Fields:**
- `disputed`: Boolean indicating if customer contested the no-show
- `disputeStatus`: `'pending'` | `'approved'` | `'rejected'` | `null`
- `gracePeriodMinutes`: Minutes late before considered no-show (default: 15)
- `customerTierAtTime`: Customer's tier when incident occurred

---

### 4. Get Shop No-Show Policy

**Endpoint:** `GET /api/services/shops/:shopId/no-show-policy`

**Authentication:** Required (Shop or Admin)

**Description:** Retrieves the shop's no-show policy configuration. Returns default policy if shop hasn't customized.

**Response:**
```json
{
  "success": true,
  "data": {
    "shopId": "shop-001",
    "enabled": true,
    "gracePeriodMinutes": 15,
    "minimumCancellationHours": 4,
    "autoDetectionEnabled": false,
    "autoDetectionDelayHours": 2,
    "cautionThreshold": 2,
    "cautionAdvanceBookingHours": 24,
    "depositThreshold": 3,
    "depositAmount": 25.00,
    "depositAdvanceBookingHours": 48,
    "depositResetAfterSuccessful": 3,
    "maxRcnRedemptionPercent": 80,
    "suspensionThreshold": 5,
    "suspensionDurationDays": 30,
    "sendEmailTier1": true,
    "sendEmailTier2": true,
    "sendEmailTier3": true,
    "sendEmailTier4": true,
    "sendSmsTier2": false,
    "sendSmsTier3": true,
    "sendSmsTier4": true,
    "sendPushNotifications": true,
    "allowDisputes": true,
    "disputeWindowDays": 7,
    "autoApproveFirstOffense": true,
    "requireShopReview": true
  }
}
```

**Policy Configuration Fields:**

**Basic Settings:**
- `enabled`: Whether no-show tracking is active
- `gracePeriodMinutes`: Minutes late before marking as no-show (default: 15)
- `minimumCancellationHours`: Hours notice required to cancel (default: 4)

**Tier Thresholds:**
- `cautionThreshold`: No-shows to reach Tier 2 (default: 2)
- `depositThreshold`: No-shows to require deposit (default: 3)
- `suspensionThreshold`: No-shows for suspension (default: 5)

**Tier 2 - Caution:**
- `cautionAdvanceBookingHours`: Minimum advance booking (default: 24)

**Tier 3 - Deposit Required:**
- `depositAmount`: Refundable deposit in USD (default: $25.00)
- `depositAdvanceBookingHours`: Minimum advance booking (default: 48)
- `maxRcnRedemptionPercent`: Max RCN% allowed (default: 80%)
- `depositResetAfterSuccessful`: Successful appointments to restore (default: 3)

**Tier 4 - Suspended:**
- `suspensionDurationDays`: Days of booking ban (default: 30)

**Notifications:**
- `sendEmailTier1-4`: Send email for each tier
- `sendSmsTier2-4`: Send SMS for tiers 2-4
- `sendPushNotifications`: Send in-app notifications

**Disputes:**
- `allowDisputes`: Enable dispute system
- `disputeWindowDays`: Days to submit dispute (default: 7)
- `autoApproveFirstOffense`: Auto-approve 1st offense disputes
- `requireShopReview`: Require shop review for dispute resolution

---

### 5. Get Shop No-Show Analytics

**Endpoint:** `GET /api/services/shops/:shopId/no-show-analytics?days=30`

**Authentication:** Required (Shop or Admin)

**Description:** Provides no-show statistics and customer tier distribution for analytics dashboards.

**Query Parameters:**
- `days` (optional): Time period for analytics (default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalNoShows": 15,
    "noShowRate": 8.5,
    "tier1Customers": 5,
    "tier2Customers": 3,
    "tier3Customers": 1,
    "tier4Customers": 0
  }
}
```

**Analytics Fields:**
- `totalNoShows`: Total no-show incidents in time period
- `noShowRate`: Percentage of appointments that were no-shows
- `tier1Customers`: Customers with 1 no-show (warning tier)
- `tier2Customers`: Customers at caution tier (2 no-shows)
- `tier3Customers`: Customers requiring deposits (3-4 no-shows)
- `tier4Customers`: Suspended customers (5+ no-shows)

---

## Email Notifications

The system automatically sends tier-appropriate emails when customers are marked as no-show:

### Tier 1 - Warning Email
**Subject:** "Missed Appointment Notice - Please Read"
**Content:** Friendly reminder with tips for future bookings
**Restrictions:** None

### Tier 2 - Caution Email
**Subject:** "⚠️ Important: Account Restrictions Applied - Multiple No-Shows"
**Content:** Advance booking requirement notice
**Restrictions:** 24-hour advance booking required

### Tier 3 - Deposit Required Email
**Subject:** "🚨 Critical: Deposit Now Required - Multiple No-Shows"
**Content:** Refundable deposit details, restoration path
**Restrictions:**
- $25 refundable deposit required
- 48-hour advance booking required
- 80% max RCN redemption

### Tier 4 - Suspension Email
**Subject:** "🛑 Account Suspended - Multiple No-Shows"
**Content:** Suspension details, restoration timeline
**Restrictions:** 30-day booking ban

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Only paid orders can be marked as no-show"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Shop authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Unauthorized to mark this order as no-show"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Order not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to mark order as no-show"
}
```

---

## Database Schema

### Tables

**`customers` table additions:**
```sql
no_show_count INTEGER DEFAULT 0
no_show_tier VARCHAR(20) DEFAULT 'normal'
deposit_required BOOLEAN DEFAULT FALSE
last_no_show_at TIMESTAMP
booking_suspended_until TIMESTAMP
successful_appointments_since_tier3 INTEGER DEFAULT 0
```

**`no_show_history` table:**
- Complete incident tracking
- Dispute management
- Audit trail

**`shop_no_show_policy` table:**
- 20+ configurable settings per shop
- Tier thresholds and penalties
- Notification preferences

**`deposit_transactions` table:**
- Refundable deposit tracking
- Stripe integration
- Status management

---

## Business Logic

### Automatic Tier Calculation

Customer tiers are automatically calculated via database trigger when a no-show is recorded:

1. **Trigger:** INSERT on `no_show_history`
2. **Action:** Update `customers.no_show_tier` based on count
3. **Updates:**
   - `no_show_tier` (normal/warning/caution/deposit_required/suspended)
   - `deposit_required` boolean
   - `booking_suspended_until` timestamp for tier 4
   - `last_no_show_at` timestamp

### Tier Restoration

**From Tier 3 (Deposit Required) → Tier 2 (Caution):**
- Complete 3 successful appointments
- Automatically downgraded via `recordSuccessfulAppointment()` service call
- Resets `successful_appointments_since_tier3` counter

**Suspension Expiry:**
- Automatic after `suspensionDurationDays` (default: 30 days)
- Customer restored to Tier 3 (deposit required) after suspension
- Can rebuild trust through successful appointments

---

## Integration Guide

### Frontend Integration

1. **Check Customer Status Before Booking:**
```typescript
const response = await api.get(`/customers/${customerAddress}/no-show-status?shopId=${shopId}`);
if (!response.data.canBook) {
  // Show suspension message
}
if (response.data.requiresDeposit) {
  // Show deposit payment UI
}
```

2. **Display Tier Badge in Profile:**
```typescript
const tierColors = {
  normal: 'green',
  warning: 'yellow',
  caution: 'orange',
  deposit_required: 'red',
  suspended: 'gray'
};
```

3. **Show Restrictions in Booking Modal:**
```typescript
if (status.restrictions.length > 0) {
  // Display restriction alerts
  status.restrictions.forEach(restriction => {
    showAlert(restriction);
  });
}
```

### Shop Dashboard Integration

1. **Display No-Show Analytics:**
```typescript
const analytics = await api.get(`/services/shops/${shopId}/no-show-analytics?days=30`);
// Show no-show rate, tier distribution
```

2. **Mark Order as No-Show:**
```typescript
await api.post(`/services/orders/${orderId}/mark-no-show`, {
  notes: "Customer did not arrive for scheduled appointment"
});
```

---

## Testing

### Test Scenarios

1. **First Offense (Tier 1):**
   - Mark customer as no-show
   - Verify `no_show_count` = 1
   - Verify `tier` = 'warning'
   - Verify warning email sent
   - Verify customer can still book

2. **Second Offense (Tier 2):**
   - Mark customer as no-show again
   - Verify `tier` = 'caution'
   - Verify `minimumAdvanceHours` = 24
   - Verify caution email sent

3. **Third Offense (Tier 3):**
   - Mark customer as no-show third time
   - Verify `tier` = 'deposit_required'
   - Verify `depositRequired` = true
   - Verify deposit email sent
   - Verify `minimumAdvanceHours` = 48

4. **Fifth Offense (Tier 4):**
   - Mark customer as no-show 5th time
   - Verify `tier` = 'suspended'
   - Verify `canBook` = false
   - Verify `bookingSuspendedUntil` is 30 days in future
   - Verify suspension email sent

5. **Tier Restoration:**
   - Complete 3 successful appointments as Tier 3 customer
   - Verify automatic downgrade to Tier 2
   - Verify `deposit_required` = false

---

## Rate Limits

No specific rate limits for no-show endpoints. Standard API rate limits apply:
- 100 requests per 10 minutes (development)
- 1000 requests per 10 minutes (production)

---

## Changelog

**Version 1.0.0** (2026-02-09)
- Initial implementation of 4-tier penalty system
- Customer no-show status and history endpoints
- Shop policy management
- Email notification system
- Analytics integration

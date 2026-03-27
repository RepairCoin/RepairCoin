# Google Calendar Integration - Complete Implementation Guide

**Status**: Backend Infrastructure Complete ✅ | Auto-Sync Pending ⏳
**Estimated Time**: 2-3 hours
**Last Updated**: March 26, 2026

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 2: Payment Flow Integration](#phase-2-payment-flow-integration-1-15-hours)
4. [Phase 3: Appointment Updates Integration](#phase-3-appointment-updates-integration-45-60-minutes)
5. [Phase 4: Testing & Verification](#phase-4-testing--verification-30-minutes)
6. [Troubleshooting](#troubleshooting)

---

## Overview

This guide will walk you through completing the Google Calendar integration by connecting the calendar service to your booking flow. After completion:

✅ Paid bookings automatically create Google Calendar events
✅ Rescheduled appointments update calendar events
✅ Cancelled appointments delete calendar events
✅ Shop owners see all appointments in Google Calendar mobile app
✅ Automatic reminders via Google Calendar notifications

---

## Prerequisites

Before starting, ensure you have:

- [x] Completed Google Cloud Platform setup (OAuth credentials configured)
- [x] Environment variables set in `backend/.env`:
  ```bash
  GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
  GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
  GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:4000/api/shops/calendar/callback/google
  GOOGLE_CALENDAR_ENCRYPTION_KEY=<32-byte-hex-string>
  ```
- [x] Backend running (`npm run dev` in backend directory)
- [x] Frontend running (`npm run dev` in frontend directory)
- [x] Test shop account with Google Calendar connected

---

## Phase 2: Payment Flow Integration (1-1.5 hours)

### Goal
Automatically create Google Calendar events when customers complete payment for bookings.

### 2.1: Locate PaymentService File

**File**: `backend/src/domains/ServiceDomain/services/PaymentService.ts`

This file handles the payment success logic after Stripe confirms payment.

### 2.2: Add Imports

At the top of `PaymentService.ts`, add these imports:

```typescript
import { GoogleCalendarService } from '../../../services/GoogleCalendarService';
import { CalendarRepository } from '../../../repositories/CalendarRepository';
import { logger } from '../../../utils/logger';
```

**Location**: Add after existing imports, around line 1-10

### 2.3: Find Payment Success Handler

Search for the function that handles successful payments. Look for:
- `handlePaymentSuccess` or similar function name
- Code that updates order status to `'paid'`
- Code that updates `service_orders` table

**Example search terms**:
```
status = 'paid'
UPDATE service_orders
payment_status = 'paid'
```

### 2.4: Add Calendar Sync Logic

**Insert this code AFTER the order status is updated to 'paid', but BEFORE the function returns success:**

```typescript
// ============================================================
// AUTO-SYNC TO GOOGLE CALENDAR
// ============================================================
// If shop has Google Calendar connected, automatically create event
try {
  const calendarRepo = new CalendarRepository();
  const googleCalendarService = new GoogleCalendarService();

  // Check if shop has active calendar connection
  const connections = await calendarRepo.getShopConnections(shopId);
  const googleConnection = connections.find(
    conn => conn.provider === 'google' && conn.isActive
  );

  if (googleConnection) {
    logger.info('Shop has Google Calendar connected, creating event', {
      orderId: order.orderId,
      shopId
    });

    // Only create event if booking has date/time
    if (order.bookingDate && order.bookingTimeSlot && order.bookingEndTime) {
      // Get customer details
      const customerRepo = new (require('../../../repositories/CustomerRepository').CustomerRepository)();
      const customer = await customerRepo.getCustomer(order.customerAddress);

      // Get service details
      const serviceRepo = new (require('../../../repositories/ServiceRepository').ServiceRepository)();
      const service = await serviceRepo.getServiceById(order.serviceId);

      // Get shop details for timezone
      const shopRepo = new (require('../../../repositories/ShopRepository').ShopRepository)();
      const shop = await shopRepo.getShop(shopId);

      // Create calendar event
      const eventResult = await googleCalendarService.createEvent({
        orderId: order.orderId,
        serviceName: service?.serviceName || order.serviceName || 'Service Appointment',
        serviceDescription: service?.serviceDescription || '',
        customerName: customer?.name || 'Customer',
        customerEmail: customer?.email || null,
        customerPhone: customer?.phone || null,
        customerAddress: order.customerAddress,
        bookingDate: order.bookingDate, // YYYY-MM-DD format
        startTime: order.bookingTimeSlot, // HH:MM format
        endTime: order.bookingEndTime, // HH:MM format
        totalAmount: parseFloat(order.totalAmount),
        shopTimezone: shop?.timezone || 'America/New_York'
      });

      if (eventResult.success && eventResult.eventId) {
        // Update order with calendar event ID for future updates/deletes
        await calendarRepo.linkOrderToEvent(
          order.orderId,
          googleConnection.connectionId,
          eventResult.eventId
        );

        logger.info('✅ Calendar event created successfully', {
          orderId: order.orderId,
          eventId: eventResult.eventId,
          shopId
        });
      } else {
        logger.warn('Failed to create calendar event', {
          orderId: order.orderId,
          error: eventResult.error,
          shopId
        });
      }
    } else {
      logger.info('Order has no booking date/time, skipping calendar sync', {
        orderId: order.orderId,
        shopId
      });
    }
  } else {
    logger.debug('Shop does not have Google Calendar connected', {
      shopId
    });
  }
} catch (calendarError) {
  // IMPORTANT: Don't fail the payment if calendar sync fails
  // Just log the error and continue
  logger.error('❌ Calendar sync failed (payment still successful)', {
    error: calendarError instanceof Error ? calendarError.message : 'Unknown error',
    stack: calendarError instanceof Error ? calendarError.stack : undefined,
    orderId: order.orderId,
    shopId
  });
}
// ============================================================
```

### 2.5: Add Missing Repository Method

**File**: `backend/src/repositories/CalendarRepository.ts`

Add this method to link orders to calendar events:

```typescript
/**
 * Link an order to a calendar event for future updates/deletes
 */
async linkOrderToEvent(
  orderId: string,
  connectionId: number,
  eventId: string
): Promise<void> {
  const query = `
    UPDATE service_orders
    SET
      calendar_event_id = $1,
      calendar_connection_id = $2,
      calendar_synced_at = NOW()
    WHERE order_id = $3
  `;

  await this.pool.query(query, [eventId, connectionId, orderId]);

  logger.info('Order linked to calendar event', {
    orderId,
    eventId,
    connectionId
  });
}
```

### 2.6: Database Migration (if needed)

**Check if these columns exist** in `service_orders` table:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'service_orders'
  AND column_name IN ('calendar_event_id', 'calendar_connection_id', 'calendar_synced_at');
```

**If they DON'T exist, create migration:**

**File**: `backend/src/migrations/096_add_calendar_fields_to_orders.sql`

```sql
-- Add calendar sync tracking columns to service_orders
ALTER TABLE service_orders
ADD COLUMN IF NOT EXISTS calendar_event_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS calendar_connection_id INTEGER,
ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMPTZ;

-- Add index for faster calendar lookups
CREATE INDEX IF NOT EXISTS idx_service_orders_calendar_event
ON service_orders(calendar_event_id)
WHERE calendar_event_id IS NOT NULL;

-- Add foreign key to calendar connections
ALTER TABLE service_orders
ADD CONSTRAINT fk_service_orders_calendar_connection
FOREIGN KEY (calendar_connection_id)
REFERENCES shop_calendar_connections(connection_id)
ON DELETE SET NULL;

COMMENT ON COLUMN service_orders.calendar_event_id IS 'Google Calendar event ID for synced appointments';
COMMENT ON COLUMN service_orders.calendar_connection_id IS 'Reference to the calendar connection used';
COMMENT ON COLUMN service_orders.calendar_synced_at IS 'Timestamp when order was synced to calendar';
```

**Run migration:**
```bash
cd backend
psql -U your_db_user -d repaircoin -f src/migrations/096_add_calendar_fields_to_orders.sql
```

### 2.7: Test Payment Flow

1. **Connect Google Calendar** in shop settings
2. **Create a service** with booking enabled
3. **Book the service** as a customer with date/time
4. **Complete payment** via Stripe test card
5. **Check Google Calendar** - event should appear automatically!

**Success Criteria**:
- ✅ Event appears in Google Calendar within 5 seconds
- ✅ Event has correct date, time, customer info
- ✅ Event description includes service details and pricing
- ✅ Payment succeeds even if calendar sync fails (check logs)

---

## Phase 3: Appointment Updates Integration (45-60 minutes)

### Goal
Update or delete Google Calendar events when appointments are rescheduled or cancelled.

### 3.1: Locate Reschedule Approval Logic

**File**: `backend/src/domains/ServiceDomain/controllers/AppointmentController.ts`

Search for the function that approves reschedule requests. Look for:
- `approveReschedule` or similar
- Code that updates `booking_date` and `booking_time_slot`
- Status changes to `'confirmed'` or `'scheduled'`

### 3.2: Add Calendar Update on Reschedule

**Insert this code AFTER the reschedule is approved and order is updated:**

```typescript
// ============================================================
// UPDATE GOOGLE CALENDAR EVENT
// ============================================================
try {
  const calendarRepo = new CalendarRepository();
  const googleCalendarService = new GoogleCalendarService();

  // Check if order was previously synced to calendar
  const orderDetails = await orderRepo.getOrderById(orderId);

  if (orderDetails.calendarEventId && orderDetails.calendarConnectionId) {
    logger.info('Updating calendar event for reschedule', {
      orderId,
      eventId: orderDetails.calendarEventId
    });

    // Get updated order details
    const service = await serviceRepo.getServiceById(orderDetails.serviceId);
    const customer = await customerRepo.getCustomer(orderDetails.customerAddress);

    // Update calendar event with new date/time
    const updateResult = await googleCalendarService.updateEvent(orderId, {
      bookingDate: rescheduleRequest.newDate,
      startTime: rescheduleRequest.newTimeSlot,
      endTime: rescheduleRequest.newEndTime,
      serviceName: service?.serviceName || orderDetails.serviceName,
      serviceDescription: service?.serviceDescription,
      customerName: customer?.name,
      customerEmail: customer?.email,
      customerPhone: customer?.phone,
      customerAddress: orderDetails.customerAddress,
      totalAmount: parseFloat(orderDetails.totalAmount)
    });

    if (updateResult.success) {
      logger.info('✅ Calendar event updated successfully', {
        orderId,
        eventId: orderDetails.calendarEventId
      });

      // Update sync timestamp
      await calendarRepo.updateOrderSyncTimestamp(orderId);
    } else {
      logger.warn('Failed to update calendar event', {
        orderId,
        error: updateResult.error
      });
    }
  }
} catch (calendarError) {
  // Log error but don't fail the reschedule
  logger.error('❌ Failed to update calendar event (reschedule still successful)', {
    error: calendarError instanceof Error ? calendarError.message : 'Unknown error',
    orderId
  });
}
// ============================================================
```

### 3.3: Add Calendar Delete on Cancellation

**File**: Same `AppointmentController.ts`

Find the cancellation logic (status change to `'cancelled'`).

**Insert this code AFTER cancellation is confirmed:**

```typescript
// ============================================================
// DELETE GOOGLE CALENDAR EVENT
// ============================================================
try {
  const calendarRepo = new CalendarRepository();
  const googleCalendarService = new GoogleCalendarService();

  // Check if order was synced to calendar
  const orderDetails = await orderRepo.getOrderById(orderId);

  if (orderDetails.calendarEventId && orderDetails.calendarConnectionId) {
    logger.info('Deleting calendar event for cancellation', {
      orderId,
      eventId: orderDetails.calendarEventId
    });

    const deleteResult = await googleCalendarService.deleteEvent(orderId);

    if (deleteResult.success) {
      logger.info('✅ Calendar event deleted successfully', {
        orderId,
        eventId: orderDetails.calendarEventId
      });

      // Clear calendar fields from order
      await calendarRepo.unlinkOrderFromEvent(orderId);
    } else {
      logger.warn('Failed to delete calendar event', {
        orderId,
        error: deleteResult.error
      });
    }
  }
} catch (calendarError) {
  logger.error('❌ Failed to delete calendar event (cancellation still successful)', {
    error: calendarError instanceof Error ? calendarError.message : 'Unknown error',
    orderId
  });
}
// ============================================================
```

### 3.4: Add Missing Repository Methods

**File**: `backend/src/repositories/CalendarRepository.ts`

```typescript
/**
 * Update order sync timestamp after calendar event is updated
 */
async updateOrderSyncTimestamp(orderId: string): Promise<void> {
  const query = `
    UPDATE service_orders
    SET calendar_synced_at = NOW()
    WHERE order_id = $1
  `;

  await this.pool.query(query, [orderId]);
}

/**
 * Unlink order from calendar event (after deletion)
 */
async unlinkOrderFromEvent(orderId: string): Promise<void> {
  const query = `
    UPDATE service_orders
    SET
      calendar_event_id = NULL,
      calendar_connection_id = NULL,
      calendar_synced_at = NULL
    WHERE order_id = $1
  `;

  await this.pool.query(query, [orderId]);

  logger.info('Order unlinked from calendar event', { orderId });
}

/**
 * Get order's calendar event ID
 */
async getOrderCalendarEventId(orderId: string): Promise<string | null> {
  const query = `
    SELECT calendar_event_id
    FROM service_orders
    WHERE order_id = $1
  `;

  const result = await this.pool.query(query, [orderId]);
  return result.rows[0]?.calendar_event_id || null;
}
```

### 3.5: Test Appointment Updates

#### Test Reschedule:
1. Book appointment with calendar sync enabled
2. Customer requests reschedule
3. Shop approves reschedule
4. **Check Google Calendar** - event should update to new date/time

#### Test Cancellation:
1. Book appointment with calendar sync enabled
2. Cancel the appointment
3. **Check Google Calendar** - event should be deleted

**Success Criteria**:
- ✅ Rescheduled events update in calendar
- ✅ Cancelled events disappear from calendar
- ✅ No errors in backend logs
- ✅ Reschedule/cancel succeeds even if calendar update fails

---

## Phase 4: Testing & Verification (30 minutes)

### 4.1: End-to-End Test Checklist

- [ ] **Connect Calendar**
  - Navigate to Settings > Calendar Integration
  - Click "Connect Google Calendar"
  - Authorize with Google account
  - Verify green "Connected" status

- [ ] **Create Booking**
  - Book service with date/time as customer
  - Complete payment
  - Check Google Calendar shows event within 5 seconds
  - Verify event details (time, customer, service, price)

- [ ] **Reschedule Booking**
  - Request reschedule as customer
  - Approve as shop owner
  - Check Google Calendar event updates

- [ ] **Cancel Booking**
  - Cancel appointment
  - Check Google Calendar event is deleted

- [ ] **Manual Booking** (if implemented)
  - Create manual booking from shop dashboard
  - Verify calendar event created

- [ ] **Mobile Verification**
  - Open Google Calendar mobile app
  - Verify all events appear correctly
  - Test calendar notifications/reminders

### 4.2: Error Handling Test

- [ ] **Disconnect Calendar Mid-Booking**
  - Disconnect Google Calendar
  - Book new appointment
  - Verify payment succeeds (no calendar event created)
  - Reconnect calendar
  - Book another appointment
  - Verify calendar event created

- [ ] **Invalid Token Test**
  - Manually expire access token in database
  - Book appointment
  - Verify automatic token refresh works
  - Check calendar event created

### 4.3: Performance Test

- [ ] **Bulk Bookings**
  - Create 10 bookings rapidly
  - Verify all appear in Google Calendar
  - Check backend logs for errors

---

## Troubleshooting

### Issue: Calendar events not creating

**Possible causes**:

1. **No active connection**
   ```bash
   # Check database
   SELECT * FROM shop_calendar_connections WHERE shop_id = 'your-shop-id';
   ```
   - Verify `is_active = true`
   - Verify `access_token_expires_at` is in future

2. **Missing booking date/time**
   ```bash
   # Check order
   SELECT booking_date, booking_time_slot, booking_end_time
   FROM service_orders WHERE order_id = 'order-id';
   ```
   - All three fields must be non-null

3. **Token expired**
   - Check backend logs for "Token expired"
   - Service should auto-refresh, if not check `refresh_token` is stored

**Solution**:
```bash
# Force token refresh
curl -X POST http://localhost:4000/api/shops/calendar/refresh-token \
  -H "Authorization: Bearer your-jwt-token"
```

### Issue: Calendar events creating with wrong timezone

**Cause**: Shop timezone not set correctly

**Solution**:
```sql
-- Check shop timezone
SELECT timezone FROM shops WHERE shop_id = 'your-shop-id';

-- Update if wrong
UPDATE shops SET timezone = 'America/New_York' WHERE shop_id = 'your-shop-id';
```

### Issue: "Insufficient permissions" error

**Cause**: Missing OAuth scopes

**Solution**:
1. Go to Google Cloud Console
2. OAuth consent screen
3. Add these scopes:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
4. Disconnect and reconnect calendar in RepairCoin

### Issue: Events not updating/deleting

**Possible causes**:

1. **Order not linked to event**
   ```sql
   SELECT calendar_event_id, calendar_connection_id
   FROM service_orders WHERE order_id = 'order-id';
   ```
   - Should have non-null values

2. **Event already deleted in Google Calendar**
   - Check Google Calendar API logs
   - Event may have been manually deleted

**Solution**:
```typescript
// Gracefully handle missing events in GoogleCalendarService.ts
if (error.code === 404) {
  logger.warn('Event not found, may have been deleted', { orderId });
  // Clean up database reference
  await calendarRepo.unlinkOrderFromEvent(orderId);
}
```

### Issue: Payment succeeds but calendar fails

**This is EXPECTED behavior** - payments should never fail due to calendar issues.

**Verify**:
1. Check backend logs for calendar error
2. Verify payment completed successfully
3. Check order status is 'paid'
4. Calendar event can be created manually later

---

## Next Steps

After completing all phases:

1. **Deploy to production**
   - Update `GOOGLE_CALENDAR_REDIRECT_URI` to production URL
   - Add production redirect URI in Google Cloud Console
   - Test OAuth flow in production

2. **Monitor calendar sync**
   - Set up logging alerts for calendar errors
   - Track sync success rate
   - Monitor token refresh failures

3. **User documentation**
   - Create shop owner guide for connecting calendar
   - Document benefits of calendar integration
   - Add FAQ section

---

## Summary

**Completed Features**:
- ✅ Automatic calendar event creation on payment
- ✅ Calendar event updates on reschedule
- ✅ Calendar event deletion on cancellation
- ✅ Graceful error handling (payments never fail)
- ✅ Mobile notifications via Google Calendar
- ✅ Cross-device sync

**Estimated Total Time**: 2-3 hours
**Difficulty**: Moderate
**Impact**: High - significantly improves shop owner experience

---

**Questions or issues?** Check backend logs at `backend/logs/` or contact support.

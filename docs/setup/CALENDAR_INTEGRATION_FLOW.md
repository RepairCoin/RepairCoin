# Google Calendar Integration - System Flow Diagram

This document visualizes how the Google Calendar integration works across different scenarios.

---

## 📅 Scenario 1: New Booking with Payment

```
┌─────────────┐
│  Customer   │
│  Books      │
│  Service    │
└──────┬──────┘
       │
       │ 1. Select date/time
       │ 2. Enter details
       │ 3. Proceed to payment
       ▼
┌─────────────────┐
│  Stripe         │
│  Payment        │
│  Gateway        │
└──────┬──────────┘
       │
       │ 4. Payment Success
       ▼
┌─────────────────────────────────────────────────────┐
│  PaymentService.ts                                  │
│  ┌────────────────────────────────────────────┐   │
│  │ 1. Update order status to 'paid'           │   │
│  │ 2. Update payment_status                    │   │
│  │ 3. Record transaction                       │   │
│  └─────────────────┬───────────────────────────┘   │
│                    │                                │
│  ┌─────────────────▼───────────────────────────┐   │
│  │ CALENDAR SYNC BLOCK                         │   │
│  │ ┌─────────────────────────────────────────┐ │   │
│  │ │ 1. Check if shop has Google Calendar   │ │   │
│  │ │ 2. Fetch customer, service, shop data  │ │   │
│  │ │ 3. Call GoogleCalendarService          │ │   │
│  │ │ 4. Link order to event (event_id)      │ │   │
│  │ └─────────────────────────────────────────┘ │   │
│  └─────────────────┬───────────────────────────┘   │
└────────────────────┼───────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ GoogleCalendarService  │
        │  .createEvent()        │
        └────────┬───────────────┘
                 │
                 │ API Call
                 ▼
        ┌──────────────────┐
        │  Google          │
        │  Calendar API    │
        └────────┬─────────┘
                 │
                 │ Event Created
                 ▼
        ┌──────────────────┐
        │  Shop's Google   │
        │  Calendar        │
        │                  │
        │  📅 Event shows  │
        │  on mobile app   │
        └──────────────────┘
```

**Key Points**:
- ✅ Payment NEVER fails if calendar sync fails
- ✅ Calendar sync happens AFTER payment success
- ✅ Event ID stored in `service_orders` table for future updates
- ✅ Shop sees appointment on phone immediately

---

## 🔄 Scenario 2: Rescheduling Appointment

```
┌─────────────┐
│  Customer   │
│  Requests   │
│  Reschedule │
└──────┬──────┘
       │
       │ 1. Submit new date/time
       ▼
┌──────────────┐
│  Creates     │
│  Reschedule  │
│  Request     │
└──────┬───────┘
       │
       │ Status: pending
       ▼
┌──────────────┐
│  Shop Owner  │
│  Reviews     │
│  Request     │
└──────┬───────┘
       │
       │ 2. Clicks "Approve"
       ▼
┌─────────────────────────────────────────────────────┐
│  AppointmentController.ts                           │
│  ┌────────────────────────────────────────────┐   │
│  │ 1. Update order with new date/time         │   │
│  │ 2. Update reschedule request status        │   │
│  └─────────────────┬───────────────────────────┘   │
│                    │                                │
│  ┌─────────────────▼───────────────────────────┐   │
│  │ CALENDAR UPDATE BLOCK                       │   │
│  │ ┌─────────────────────────────────────────┐ │   │
│  │ │ 1. Get event_id from order              │ │   │
│  │ │ 2. Fetch updated service/customer data │ │   │
│  │ │ 3. Call GoogleCalendarService.update() │ │   │
│  │ │ 4. Update sync timestamp               │ │   │
│  │ └─────────────────────────────────────────┘ │   │
│  └─────────────────┬───────────────────────────┘   │
└────────────────────┼───────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ GoogleCalendarService  │
        │  .updateEvent()        │
        └────────┬───────────────┘
                 │
                 │ PATCH API Call
                 ▼
        ┌──────────────────┐
        │  Google          │
        │  Calendar API    │
        └────────┬─────────┘
                 │
                 │ Event Updated
                 ▼
        ┌──────────────────┐
        │  Shop's Google   │
        │  Calendar        │
        │                  │
        │  📅 Event time   │
        │  changed         │
        └──────────────────┘
```

**Key Points**:
- ✅ Uses existing `event_id` from order
- ✅ Updates event in-place (same event, new time)
- ✅ Reschedule succeeds even if calendar update fails
- ✅ Shop sees updated time on mobile calendar

---

## ❌ Scenario 3: Cancelling Appointment

```
┌─────────────┐
│  Customer   │
│  or Shop    │
│  Cancels    │
└──────┬──────┘
       │
       │ 1. Click "Cancel Appointment"
       ▼
┌─────────────────────────────────────────────────────┐
│  AppointmentController.ts / OrderController.ts      │
│  ┌────────────────────────────────────────────┐   │
│  │ 1. Update order status to 'cancelled'      │   │
│  │ 2. Process refund (if applicable)          │   │
│  └─────────────────┬───────────────────────────┘   │
│                    │                                │
│  ┌─────────────────▼───────────────────────────┐   │
│  │ CALENDAR DELETE BLOCK                       │   │
│  │ ┌─────────────────────────────────────────┐ │   │
│  │ │ 1. Get event_id from order              │ │   │
│  │ │ 2. Call GoogleCalendarService.delete() │ │   │
│  │ │ 3. Clear event_id from order            │ │   │
│  │ └─────────────────────────────────────────┘ │   │
│  └─────────────────┬───────────────────────────┘   │
└────────────────────┼───────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ GoogleCalendarService  │
        │  .deleteEvent()        │
        └────────┬───────────────┘
                 │
                 │ DELETE API Call
                 ▼
        ┌──────────────────┐
        │  Google          │
        │  Calendar API    │
        └────────┬─────────┘
                 │
                 │ Event Deleted
                 ▼
        ┌──────────────────┐
        │  Shop's Google   │
        │  Calendar        │
        │                  │
        │  ❌ Event        │
        │  removed         │
        └──────────────────┘
```

**Key Points**:
- ✅ Deletes event from calendar
- ✅ Clears event tracking from database
- ✅ Cancellation succeeds even if delete fails
- ✅ Event disappears from mobile calendar

---

## 🔒 Database Schema Integration

### service_orders table (NEW COLUMNS)
```sql
┌─────────────────────┬──────────────────┬─────────────────────┐
│ order_id            │ VARCHAR(255) PK  │ Existing            │
├─────────────────────┼──────────────────┼─────────────────────┤
│ shop_id             │ VARCHAR(255)     │ Existing            │
│ customer_address    │ VARCHAR(255)     │ Existing            │
│ booking_date        │ DATE             │ Existing            │
│ booking_time_slot   │ VARCHAR(10)      │ Existing            │
│ booking_end_time    │ VARCHAR(10)      │ Existing            │
│ status              │ VARCHAR(50)      │ Existing            │
├─────────────────────┼──────────────────┼─────────────────────┤
│ calendar_event_id   │ VARCHAR(255)     │ ⭐ NEW - Event ID   │
│ calendar_conn_id    │ INTEGER FK       │ ⭐ NEW - Connection │
│ calendar_synced_at  │ TIMESTAMPTZ      │ ⭐ NEW - Timestamp  │
└─────────────────────┴──────────────────┴─────────────────────┘
```

### shop_calendar_connections table (EXISTING)
```sql
┌─────────────────────┬──────────────────┬─────────────────────┐
│ connection_id       │ SERIAL PK        │ Auto-increment ID   │
│ shop_id             │ VARCHAR(255) FK  │ Shop reference      │
│ provider            │ VARCHAR(50)      │ 'google'            │
│ access_token        │ TEXT ENCRYPTED   │ OAuth access token  │
│ refresh_token       │ TEXT ENCRYPTED   │ OAuth refresh token │
│ expires_at          │ TIMESTAMPTZ      │ Token expiry        │
│ calendar_id         │ VARCHAR(255)     │ 'primary'           │
│ google_email        │ VARCHAR(255)     │ User's Gmail        │
│ is_active           │ BOOLEAN          │ Connection active   │
└─────────────────────┴──────────────────┴─────────────────────┘
```

---

## 🔐 Token Refresh Flow

```
┌──────────────────┐
│  Calendar API    │
│  Request         │
└────────┬─────────┘
         │
         │ Try to create/update event
         ▼
┌─────────────────────┐
│  Access Token       │
│  Expired?           │
└────┬───────────┬────┘
     │ No        │ Yes
     │           │
     │           ▼
     │    ┌──────────────────┐
     │    │ Refresh Token    │
     │    │ Exchange         │
     │    └────────┬─────────┘
     │             │
     │             │ POST to Google
     │             ▼
     │    ┌──────────────────┐
     │    │ New Access Token │
     │    │ + Refresh Token  │
     │    └────────┬─────────┘
     │             │
     │             │ Update database
     │             ▼
     │    ┌──────────────────┐
     │    │ Retry original   │
     │    │ API call         │
     │    └────────┬─────────┘
     │             │
     ▼             ▼
┌──────────────────────┐
│  Calendar Event      │
│  Created/Updated     │
└──────────────────────┘
```

**Key Points**:
- ✅ Automatic token refresh (transparent to user)
- ✅ Refresh tokens stored encrypted
- ✅ Token expiry checked before each API call
- ✅ Failed requests retried after refresh

---

## 🎯 Error Handling Strategy

```
┌──────────────────┐
│  Calendar Sync   │
│  Attempt         │
└────────┬─────────┘
         │
         ▼
    ┌─────────┐
    │ Try     │
    │ Block   │
    └────┬────┘
         │
    ┌────▼─────────────────────┐
    │ Calendar operation       │
    │ (create/update/delete)   │
    └────┬─────────────────────┘
         │
    ┌────▼────────┐
    │  Success?   │
    └─┬─────────┬─┘
      │ Yes     │ No
      │         │
      │         ▼
      │    ┌─────────────────┐
      │    │ Catch Block     │
      │    │ ┌─────────────┐ │
      │    │ │ Log error   │ │
      │    │ │ Don't throw │ │
      │    │ └─────────────┘ │
      │    └─────────────────┘
      │              │
      ▼              ▼
┌────────────────────────────┐
│ Continue execution         │
│ (Payment/Reschedule/Cancel │
│  succeeds regardless)      │
└────────────────────────────┘
```

**Philosophy**:
- 🎯 **Calendar is enhancement, not requirement**
- 🎯 **Core operations (payment, booking) must succeed**
- 🎯 **Log all calendar errors for monitoring**
- 🎯 **User never sees calendar failure**

---

## 📊 Monitoring Points

### Success Metrics
```
Calendar Event Created     ✅ → Log at INFO level
Calendar Event Updated     ✅ → Log at INFO level
Calendar Event Deleted     ✅ → Log at INFO level
Token Auto-Refreshed       ✅ → Log at INFO level
```

### Failure Metrics
```
Calendar Event Failed      ❌ → Log at ERROR level
Token Refresh Failed       ❌ → Log at ERROR level
Connection Inactive        ⚠️  → Log at DEBUG level
Missing Booking Date/Time  ⚠️  → Log at INFO level
```

### Alert Triggers
```
Calendar Failure Rate > 10%        → Alert DevOps
Token Refresh Failures > 5/hour    → Alert DevOps
Disconnections > 10/day            → Review UX flow
```

---

## 🚀 Performance Considerations

### API Call Timing
```
Payment Flow:
├─ Payment Processing: ~2-3 seconds
└─ Calendar Sync: ~0.5-1 second (async, non-blocking)

Total User Wait: ~2-3 seconds (calendar happens in background)
```

### Rate Limits
```
Google Calendar API:
├─ Requests per day: 1,000,000
├─ Requests per 100 seconds: 10,000
└─ Requests per user per 100 seconds: 500

RepairCoin Typical Usage:
├─ Peak bookings: ~100/hour
├─ API calls: ~300/hour (create + updates)
└─ Well within limits ✅
```

---

## 📱 Mobile Calendar Integration

```
┌──────────────────────┐
│  Google Calendar     │
│  Mobile App          │
└──────┬───────────────┘
       │
       │ Syncs automatically
       │ (every 15 minutes or instant with push)
       ▼
┌──────────────────────┐
│  Phone Calendar      │
│  ┌────────────────┐  │
│  │ 10:00 AM      │  │
│  │ John Smith    │  │
│  │ Oil Change    │  │
│  │ $45.00        │  │
│  └────────────────┘  │
│                      │
│  🔔 Reminder:        │
│  15 min before       │
└──────────────────────┘
```

**Benefits**:
- ✅ Shop owner sees bookings on phone
- ✅ Automatic reminders before appointments
- ✅ Works offline (syncs when online)
- ✅ Integrates with other calendars (personal/work)

---

## 🎨 Summary

This integration creates a seamless experience where:

1. **Customer books** → Event appears in shop's calendar
2. **Customer reschedules** → Event updates automatically
3. **Appointment cancelled** → Event removed from calendar
4. **Shop owner gets** → Mobile notifications, reminders, cross-device sync

All while ensuring core business operations (payments, bookings) **never fail** due to calendar issues.

**Result**: Professional appointment management with zero manual calendar entry! 🎉

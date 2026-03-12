# Email Preferences Integration Guide

## Overview

The email preferences system allows shops to control which types of email notifications they receive from the platform. This document explains how to use the system.

## Architecture

### Components

1. **EmailPreferencesService** (`backend/src/services/EmailPreferencesService.ts`)
   - Manages shop email preferences in the database
   - Provides methods to check if a notification should be sent
   - Automatically creates default preferences for new shops

2. **EmailService** (`backend/src/services/EmailService.ts`)
   - Enhanced with preference checking before sending emails
   - New methods that automatically check preferences
   - Logs when emails are skipped due to preferences

3. **EmailPreferencesController** (`backend/src/domains/ServiceDomain/controllers/EmailPreferencesController.ts`)
   - API endpoints for managing preferences

## Available Notification Types

### Booking & Appointment Notifications
- `newBooking` - New service bookings
- `bookingCancellation` - Booking cancellations
- `bookingReschedule` - Booking reschedule requests
- `appointmentReminder` - Upcoming appointment reminders (24h before)
- `noShowAlert` - Customer no-show alerts

### Customer Activity
- `newCustomer` - New customer signups
- `customerReview` - Customer reviews and ratings
- `customerMessage` - Direct messages from customers

### Financial Notifications
- `paymentReceived` - Payment confirmations
- `refundProcessed` - Refund notifications
- `subscriptionRenewal` - Subscription renewal confirmations
- `subscriptionExpiring` - Subscription expiration warnings

### Marketing & Promotions
- `marketingUpdates` - Marketing campaigns and promotions
- `featureAnnouncements` - New platform features
- `platformNews` - Platform news and updates

### Digest Settings
- `dailyDigest` - Daily summary emails
- `weeklyReport` - Weekly performance reports
- `monthlyReport` - Monthly analytics reports

## Usage Examples

### 1. Sending Shop Notifications with Preference Check

**New Method (Recommended):**
```typescript
import { EmailService } from './EmailService';

const emailService = new EmailService();

// Send new booking notification (automatically checks preferences)
await emailService.sendNewBookingNotification(
  shopEmail,
  shopId,
  {
    shopName: 'Bob\'s Auto Repair',
    customerName: 'John Doe',
    serviceName: 'Oil Change',
    bookingDate: '2026-03-15',
    bookingTime: '10:00 AM'
  }
);
```

**Old Method (For reference - avoid using):**
```typescript
// DON'T DO THIS - bypasses preference checking
await emailService.sendEmail(shopEmail, subject, html);
```

### 2. Available Pre-built Notification Methods

```typescript
// New booking notification
await emailService.sendNewBookingNotification(shopEmail, shopId, data);

// Customer review notification
await emailService.sendCustomerReviewNotification(shopEmail, shopId, {
  shopName: 'Bob\'s Auto Repair',
  customerName: 'John Doe',
  serviceName: 'Oil Change',
  rating: 5,
  comment: 'Great service!'
});

// Payment received notification
await emailService.sendPaymentReceivedNotification(shopEmail, shopId, {
  shopName: 'Bob\'s Auto Repair',
  customerName: 'John Doe',
  serviceName: 'Oil Change',
  amount: 49.99,
  rcnRedeemed: 10
});
```

### 3. Manually Checking Preferences

```typescript
import { EmailPreferencesService } from './EmailPreferencesService';

const prefsService = new EmailPreferencesService();

// Check if a specific notification type is enabled
const shouldSend = await prefsService.shouldSendNotification(
  shopId,
  'newBooking'
);

if (shouldSend) {
  // Send the email
}
```

### 4. Getting Shop Preferences

```typescript
// Get all preferences for a shop
const prefs = await prefsService.getShopPreferences(shopId);

console.log(prefs.newBooking); // true/false
console.log(prefs.customerReview); // true/false
```

### 5. Updating Preferences

```typescript
// Update specific preferences
await prefsService.updateShopPreferences(shopId, {
  newBooking: false,
  customerReview: true,
  dailyDigest: true,
  digestTime: 'morning'
});
```

## Default Preferences

When a shop is created, the following defaults are applied:

**Enabled by Default:**
- All booking & appointment notifications
- All customer activity notifications
- All financial notifications
- Feature announcements
- Weekly reports

**Disabled by Default:**
- Marketing updates
- Platform news
- Daily digests
- Monthly reports

## API Endpoints

### GET `/api/services/email-preferences`
Get current shop's email preferences

**Response:**
```json
{
  "shopId": "shop_123",
  "newBooking": true,
  "customerReview": true,
  "dailyDigest": false,
  "digestTime": "morning",
  "weeklyReportDay": "monday",
  "monthlyReportDay": 1
}
```

### PUT `/api/services/email-preferences`
Update shop's email preferences

**Request Body:**
```json
{
  "newBooking": false,
  "customerReview": true,
  "dailyDigest": true,
  "digestTime": "afternoon"
}
```

## Migration

Migration `072_create_shop_no_show_policy_and_email_preferences.sql` creates:
- `shop_email_preferences` table
- Default values for all notification types
- Indexes for performance

## Best Practices

### 1. Always Use Preference-Aware Methods
```typescript
// ✅ Good - respects preferences
await emailService.sendNewBookingNotification(shopEmail, shopId, data);

// ❌ Bad - bypasses preferences
await emailService.sendEmail(shopEmail, subject, html);
```

### 2. Log When Emails Are Skipped
The system automatically logs when emails are skipped:
```
Email skipped due to shop preferences {
  shopId: "shop_123",
  notificationType: "newBooking",
  to: "shop@example.com",
  subject: "New Booking Received"
}
```

### 3. Handle Digest Settings Separately
Daily/weekly/monthly reports should be scheduled separately and check:
- `dailyDigest`, `weeklyReport`, `monthlyReport` flags
- `digestTime` (morning/afternoon/evening)
- `weeklyReportDay` (monday/friday)
- `monthlyReportDay` (1-28)

### 4. Customer Emails Are NOT Affected
Email preferences only apply to **shop** notifications. Customer emails (confirmations, receipts, etc.) are always sent.

## Future Enhancements

The system is designed to support:
1. **Digest Scheduler** - Automated daily/weekly/monthly report generation
2. **Quiet Hours** - Time-based email suppression
3. **Channel Preferences** - Email vs SMS vs Push notifications
4. **Preference Templates** - Pre-configured preference sets

## Troubleshooting

### Emails Not Being Sent

1. **Check preferences:**
   ```sql
   SELECT * FROM shop_email_preferences WHERE shop_id = 'shop_123';
   ```

2. **Check logs:**
   ```
   grep "Email skipped due to shop preferences" logs/app.log
   ```

3. **Verify email configuration:**
   - `EMAIL_USER` and `EMAIL_PASS` environment variables
   - Email service initialization logs

### Preferences Not Saving

1. **Check migration ran:**
   ```sql
   SELECT * FROM migrations WHERE name LIKE '%072%';
   ```

2. **Check for unique constraint violations:**
   ```sql
   SELECT shop_id, COUNT(*) FROM shop_email_preferences GROUP BY shop_id HAVING COUNT(*) > 1;
   ```

## Database Schema

```sql
CREATE TABLE shop_email_preferences (
  shop_id UUID PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,

  -- Booking & Appointment Notifications
  new_booking BOOLEAN DEFAULT TRUE,
  booking_cancellation BOOLEAN DEFAULT TRUE,
  booking_reschedule BOOLEAN DEFAULT TRUE,
  appointment_reminder BOOLEAN DEFAULT TRUE,
  no_show_alert BOOLEAN DEFAULT TRUE,

  -- Customer Activity
  new_customer BOOLEAN DEFAULT TRUE,
  customer_review BOOLEAN DEFAULT TRUE,
  customer_message BOOLEAN DEFAULT TRUE,

  -- Financial Notifications
  payment_received BOOLEAN DEFAULT TRUE,
  refund_processed BOOLEAN DEFAULT TRUE,
  subscription_renewal BOOLEAN DEFAULT TRUE,
  subscription_expiring BOOLEAN DEFAULT TRUE,

  -- Marketing & Promotions
  marketing_updates BOOLEAN DEFAULT FALSE,
  feature_announcements BOOLEAN DEFAULT TRUE,
  platform_news BOOLEAN DEFAULT FALSE,

  -- Digest Settings
  daily_digest BOOLEAN DEFAULT FALSE,
  weekly_report BOOLEAN DEFAULT TRUE,
  monthly_report BOOLEAN DEFAULT FALSE,

  -- Frequency Settings
  digest_time VARCHAR(20) DEFAULT 'morning',
  weekly_report_day VARCHAR(20) DEFAULT 'monday',
  monthly_report_day INTEGER DEFAULT 1,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Implementation Checklist

When adding a new email notification type:

- [ ] Add field to `shop_email_preferences` table (via migration)
- [ ] Add field to `EmailPreferences` interface
- [ ] Add field to field map in `EmailPreferencesService`
- [ ] Add field to SQL queries in service methods
- [ ] Create dedicated send method in `EmailService` (if needed)
- [ ] Update frontend `EmailSettings.tsx` component
- [ ] Update API TypeScript client
- [ ] Test preference toggle
- [ ] Update this documentation

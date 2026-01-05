# Booking Reminders - SMS/Email Before Appointment

## Overview

This document outlines the implementation plan for enhanced booking reminders via SMS and email. The goal is to reduce no-shows and improve customer experience with timely appointment notifications.

---

## Current Implementation Analysis

### Existing Reminder System

The `AppointmentReminderService` (`backend/src/services/AppointmentReminderService.ts`) already provides:

| Feature | Status | Details |
|---------|--------|---------|
| 24-hour email reminder | Implemented | Runs every 2 hours, checks 23-25hr window |
| In-app notification | Implemented | Customer and shop notifications |
| Booking confirmation | Implemented | Email + in-app on payment success |
| SMS reminders | NOT Implemented | Twilio integration pending |
| Customer preferences | NOT Implemented | No opt-in/opt-out settings |
| Multiple reminder times | NOT Implemented | Only 24-hour reminder exists |

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CURRENT REMINDER FLOW                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   app.ts (startup)                                                       │
│       │                                                                  │
│       ▼                                                                  │
│   appointmentReminderService.scheduleReminders(2)  ← Every 2 hours      │
│       │                                                                  │
│       ▼                                                                  │
│   processReminders()                                                     │
│       │                                                                  │
│       ├── getAppointmentsNeedingReminders()  ← 23-25 hours before       │
│       │                                                                  │
│       ├── sendCustomerReminderEmail()  ← HTML email via nodemailer      │
│       │                                                                  │
│       ├── sendCustomerInAppNotification()  ← In-app notification        │
│       │                                                                  │
│       ├── sendShopNotification()  ← Shop in-app alert                   │
│       │                                                                  │
│       └── markReminderSent()  ← Updates reminder_sent = true            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Current Database Schema

**service_orders table:**
```sql
reminder_sent BOOLEAN DEFAULT false  -- Single reminder flag
```

**customers table:**
```sql
phone VARCHAR(50)  -- Already exists for SMS
email VARCHAR(255) -- Already exists for email
```

---

## Proposed Reminder Buffer Times

### Recommended Reminder Schedule

| Reminder Type | Time Before Appointment | Channel | Priority | Rationale |
|--------------|------------------------|---------|----------|-----------|
| **Primary** | 24 hours | Email + In-App | HIGH | Main reminder - allows rescheduling |
| **Secondary** | 2 hours | SMS + In-App | HIGH | Final reminder - reduces no-shows |
| **Tertiary** | 30 minutes | SMS only | MEDIUM | Last-minute reminder for forgetful users |

### Buffer Time Justification

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    REMINDER TIMELINE                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   -24h          -2h           -30min         Appointment                 │
│     │            │               │               │                       │
│     ▼            ▼               ▼               ▼                       │
│   ┌────┐      ┌────┐          ┌────┐         ┌────┐                     │
│   │Email│      │SMS │          │SMS │         │APPT│                     │
│   │+App │      │+App│          │only│         │    │                     │
│   └────┘      └────┘          └────┘         └────┘                     │
│                                                                          │
│   Purpose:     Purpose:        Purpose:                                  │
│   - Plan day   - Final check   - En route                               │
│   - Reschedule - Leave home    - Last chance                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why 24 hours:**
- Gives customer time to reschedule if needed
- Shop can fill cancelled slots
- Standard industry practice

**Why 2 hours:**
- Enough time for travel
- Not too early to forget
- Best time for action-oriented reminder

**Why 30 minutes (optional):**
- Useful for customers already traveling
- Reduces "I forgot" no-shows
- Can be disabled per customer preference

---

## Phase 1: Enhanced Email Reminders (Priority)

### Database Schema Changes

```sql
-- Add multi-reminder tracking to service_orders
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT false;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMP;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS reminder_2h_sent BOOLEAN DEFAULT false;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS reminder_2h_sent_at TIMESTAMP;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS reminder_30m_sent BOOLEAN DEFAULT false;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS reminder_30m_sent_at TIMESTAMP;

-- Drop old single reminder column (after migration)
-- ALTER TABLE service_orders DROP COLUMN IF EXISTS reminder_sent;
```

### Customer Notification Preferences

```sql
-- New table for customer notification preferences
CREATE TABLE customer_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_address VARCHAR(255) NOT NULL REFERENCES customers(address),

  -- Channel preferences
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,  -- Opt-in for SMS
  in_app_enabled BOOLEAN DEFAULT true,

  -- Reminder time preferences
  reminder_24h_enabled BOOLEAN DEFAULT true,
  reminder_2h_enabled BOOLEAN DEFAULT true,
  reminder_30m_enabled BOOLEAN DEFAULT false,  -- Opt-in for 30min

  -- Quiet hours (optional)
  quiet_hours_start TIME DEFAULT NULL,  -- e.g., '22:00'
  quiet_hours_end TIME DEFAULT NULL,    -- e.g., '08:00'

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(customer_address)
);
```

### Enhanced AppointmentReminderService

```typescript
// backend/src/services/AppointmentReminderService.ts

interface ReminderConfig {
  type: '24h' | '2h' | '30m';
  hoursBeforeMin: number;
  hoursBeforeMax: number;
  channels: ('email' | 'sms' | 'in_app')[];
  flagColumn: string;
}

const REMINDER_CONFIGS: ReminderConfig[] = [
  {
    type: '24h',
    hoursBeforeMin: 23,
    hoursBeforeMax: 25,
    channels: ['email', 'in_app'],
    flagColumn: 'reminder_24h_sent'
  },
  {
    type: '2h',
    hoursBeforeMin: 1.5,
    hoursBeforeMax: 2.5,
    channels: ['sms', 'in_app'],
    flagColumn: 'reminder_2h_sent'
  },
  {
    type: '30m',
    hoursBeforeMin: 0.4,  // 24 minutes
    hoursBeforeMax: 0.6,  // 36 minutes
    channels: ['sms'],
    flagColumn: 'reminder_30m_sent'
  }
];

export class AppointmentReminderService {

  /**
   * Process all reminder types
   */
  async processReminders(): Promise<ReminderReport> {
    const report: ReminderReport = {
      timestamp: new Date(),
      reminders: {}
    };

    for (const config of REMINDER_CONFIGS) {
      const appointments = await this.getAppointmentsForReminder(config);

      for (const appointment of appointments) {
        const prefs = await this.getCustomerPreferences(appointment.customerAddress);

        // Check if this reminder type is enabled
        if (!this.isReminderEnabled(config.type, prefs)) continue;

        // Check quiet hours
        if (this.isQuietHours(prefs)) continue;

        // Send through enabled channels
        for (const channel of config.channels) {
          if (this.isChannelEnabled(channel, prefs)) {
            await this.sendReminder(appointment, channel, config.type);
          }
        }

        await this.markReminderSent(appointment.orderId, config.flagColumn);
      }
    }

    return report;
  }

  /**
   * Get appointments needing specific reminder
   */
  async getAppointmentsForReminder(config: ReminderConfig): Promise<AppointmentReminderData[]> {
    const query = `
      SELECT
        so.order_id as "orderId",
        so.customer_address as "customerAddress",
        c.email as "customerEmail",
        c.phone as "customerPhone",
        c.name as "customerName",
        so.shop_id as "shopId",
        s.name as "shopName",
        s.email as "shopEmail",
        ss.service_name as "serviceName",
        so.booking_date as "bookingDate",
        COALESCE(so.booking_time_slot, so.booking_time) as "bookingTimeSlot",
        so.total_amount as "totalAmount"
      FROM service_orders so
      JOIN customers c ON c.wallet_address = so.customer_address
      JOIN shops s ON s.shop_id = so.shop_id
      JOIN shop_services ss ON ss.service_id = so.service_id
      WHERE so.status IN ('paid', 'confirmed')
        AND so.booking_date IS NOT NULL
        AND COALESCE(so.booking_time_slot, so.booking_time) IS NOT NULL
        AND so.${config.flagColumn} IS NOT TRUE
        AND (
          so.booking_date + COALESCE(so.booking_time_slot, so.booking_time)::time
          BETWEEN NOW() + INTERVAL '${config.hoursBeforeMin} hours'
          AND NOW() + INTERVAL '${config.hoursBeforeMax} hours'
        )
      ORDER BY so.booking_date, so.booking_time_slot
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }
}
```

### Email Templates

#### 24-Hour Reminder Email

```typescript
async send24HourReminderEmail(data: AppointmentReminderData): Promise<boolean> {
  const subject = `Reminder: Your appointment tomorrow at ${data.shopName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #FFCC00; padding: 20px; text-align: center;">
        <h1 style="color: #000; margin: 0;">Appointment Tomorrow!</h1>
      </div>

      <div style="padding: 20px;">
        <p>Hi ${data.customerName || 'there'},</p>

        <p>This is a friendly reminder about your upcoming appointment:</p>

        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FFCC00;">
          <p style="margin: 5px 0;"><strong>Service:</strong> ${data.serviceName}</p>
          <p style="margin: 5px 0;"><strong>Shop:</strong> ${data.shopName}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${this.formatDate(data.bookingDate)}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${this.formatTime(data.bookingTimeSlot)}</p>
        </div>

        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Tips for tomorrow:</strong></p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px;">
            <li>Arrive 5-10 minutes early</li>
            <li>Bring any relevant documents</li>
            <li>Save the shop's contact info</li>
          </ul>
        </div>

        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #856404;">
            <strong>Need to cancel or reschedule?</strong><br>
            Please do so at least 24 hours in advance to avoid any fees.
          </p>
        </div>
      </div>

      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        <p>Order ID: ${data.orderId}</p>
        <p>This is an automated reminder from RepairCoin.</p>
      </div>
    </div>
  `;

  return await this.emailService.sendEmail(data.customerEmail, subject, html);
}
```

#### 2-Hour Reminder Email

```typescript
async send2HourReminderEmail(data: AppointmentReminderData): Promise<boolean> {
  const subject = `Starting soon: ${data.serviceName} at ${data.shopName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #4CAF50; padding: 20px; text-align: center;">
        <h1 style="color: #fff; margin: 0;">Your Appointment Starts Soon!</h1>
      </div>

      <div style="padding: 20px;">
        <p>Hi ${data.customerName || 'there'},</p>

        <p><strong>Your appointment starts in about 2 hours.</strong></p>

        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
          <p style="margin: 5px 0; font-size: 18px;"><strong>${data.shopName}</strong></p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${this.formatTime(data.bookingTimeSlot)}</p>
          <p style="margin: 5px 0;"><strong>Service:</strong> ${data.serviceName}</p>
        </div>

        <p style="text-align: center; font-size: 16px;">
          Please start making your way to the shop!
        </p>
      </div>
    </div>
  `;

  return await this.emailService.sendEmail(data.customerEmail, subject, html);
}
```

---

## Phase 2: SMS Integration with Twilio (Future)

### Twilio Service Implementation

```typescript
// backend/src/services/SmsService.ts

import twilio from 'twilio';
import { logger } from '../utils/logger';

export interface SmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class SmsService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string;
  private isConfigured: boolean = false;

  constructor(config?: SmsConfig) {
    this.initializeClient(config || this.loadConfigFromEnv());
  }

  private loadConfigFromEnv(): SmsConfig {
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_PHONE_NUMBER || ''
    };
  }

  private initializeClient(config: SmsConfig) {
    if (!config.accountSid || !config.authToken || !config.fromNumber) {
      logger.warn('SMS service not configured - messages will be logged only');
      this.isConfigured = false;
      return;
    }

    try {
      this.client = twilio(config.accountSid, config.authToken);
      this.fromNumber = config.fromNumber;
      this.isConfigured = true;
      logger.info('SMS service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SMS service:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Send SMS message
   */
  async sendSms(to: string, message: string): Promise<boolean> {
    if (!this.isConfigured || !this.client) {
      logger.info('SMS Service - Mock Send:', { to, message });
      return true;
    }

    try {
      // Validate and format phone number
      const formattedNumber = this.formatPhoneNumber(to);
      if (!formattedNumber) {
        logger.warn('Invalid phone number format:', { to });
        return false;
      }

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedNumber
      });

      logger.info('SMS sent successfully:', {
        sid: result.sid,
        to: formattedNumber,
        status: result.status
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to send SMS:', {
        to,
        errorCode: error.code,
        errorMessage: error.message
      });
      return false;
    }
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phone: string): string | null {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // US number handling (10 digits)
    if (digits.length === 10) {
      return `+1${digits}`;
    }

    // Already has country code (11+ digits starting with 1)
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }

    // International format (starts with +)
    if (phone.startsWith('+')) {
      return phone;
    }

    return null;
  }
}
```

### SMS Message Templates

```typescript
// SMS templates (max 160 characters for single segment)

const SMS_TEMPLATES = {
  reminder_24h: (data) =>
    `RepairCoin: Reminder! Appointment at ${data.shopName} tomorrow at ${data.time}. ` +
    `Service: ${data.serviceName}. Reply HELP for support.`,

  reminder_2h: (data) =>
    `RepairCoin: Your ${data.serviceName} appointment at ${data.shopName} ` +
    `starts in 2 hours at ${data.time}. See you soon!`,

  reminder_30m: (data) =>
    `RepairCoin: ${data.shopName} appointment in 30 mins at ${data.time}. ` +
    `On your way? Reply HELP for directions.`,

  booking_confirmed: (data) =>
    `RepairCoin: Booking confirmed! ${data.serviceName} at ${data.shopName} on ` +
    `${data.date} at ${data.time}. Order: ${data.orderId.slice(-8)}`
};
```

### Environment Variables

```env
# Twilio Configuration (Phase 2)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890
```

---

## Phase 3: Customer Preferences UI

### Frontend Component

```typescript
// frontend/src/components/customer/NotificationPreferences.tsx

const NotificationPreferences: React.FC = () => {
  const [preferences, setPreferences] = useState({
    emailEnabled: true,
    smsEnabled: false,
    inAppEnabled: true,
    reminder24hEnabled: true,
    reminder2hEnabled: true,
    reminder30mEnabled: false
  });

  return (
    <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
      <h3 className="text-lg font-bold text-white mb-4">Notification Preferences</h3>

      {/* Channel Preferences */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-400 mb-3">Notification Channels</h4>

        <ToggleSwitch
          label="Email notifications"
          description="Receive appointment reminders via email"
          checked={preferences.emailEnabled}
          onChange={(v) => setPreferences(p => ({...p, emailEnabled: v}))}
        />

        <ToggleSwitch
          label="SMS notifications"
          description="Receive text message reminders (data rates may apply)"
          checked={preferences.smsEnabled}
          onChange={(v) => setPreferences(p => ({...p, smsEnabled: v}))}
        />

        <ToggleSwitch
          label="In-app notifications"
          description="See reminders in the RepairCoin app"
          checked={preferences.inAppEnabled}
          onChange={(v) => setPreferences(p => ({...p, inAppEnabled: v}))}
        />
      </div>

      {/* Reminder Timing */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 mb-3">Reminder Timing</h4>

        <ToggleSwitch
          label="24-hour reminder"
          description="One day before your appointment"
          checked={preferences.reminder24hEnabled}
          onChange={(v) => setPreferences(p => ({...p, reminder24hEnabled: v}))}
        />

        <ToggleSwitch
          label="2-hour reminder"
          description="Two hours before your appointment"
          checked={preferences.reminder2hEnabled}
          onChange={(v) => setPreferences(p => ({...p, reminder2hEnabled: v}))}
        />

        <ToggleSwitch
          label="30-minute reminder"
          description="Final reminder before your appointment"
          checked={preferences.reminder30mEnabled}
          onChange={(v) => setPreferences(p => ({...p, reminder30mEnabled: v}))}
        />
      </div>
    </div>
  );
};
```

---

## API Endpoints

### Customer Notification Preferences

```typescript
// GET /api/customers/notification-preferences
// Returns customer's current notification preferences

// PUT /api/customers/notification-preferences
// Body: {
//   emailEnabled: boolean,
//   smsEnabled: boolean,
//   inAppEnabled: boolean,
//   reminder24hEnabled: boolean,
//   reminder2hEnabled: boolean,
//   reminder30mEnabled: boolean,
//   quietHoursStart?: string,  // "22:00"
//   quietHoursEnd?: string     // "08:00"
// }

// POST /api/customers/verify-phone
// Body: { phone: string }
// Sends verification code via SMS

// POST /api/customers/confirm-phone
// Body: { phone: string, code: string }
// Confirms phone number for SMS
```

---

## Implementation Phases

### Phase 1: Enhanced Email Reminders (Priority - Week 1-2)

1. **Database Migration**
   - Add multi-reminder tracking columns
   - Create notification preferences table

2. **Update AppointmentReminderService**
   - Support multiple reminder intervals
   - Add 2-hour and 30-minute reminders
   - Respect customer preferences

3. **Email Templates**
   - Create distinct templates for each reminder type
   - Test email delivery

### Phase 2: Customer Preferences (Week 2-3)

1. **Backend API**
   - CRUD for notification preferences
   - Preference loading in reminder service

2. **Frontend UI**
   - Notification preferences component
   - Integration with customer settings

### Phase 3: SMS Integration (When Twilio Ready)

1. **Twilio Setup**
   - Account configuration
   - Phone number provisioning

2. **SmsService Implementation**
   - Message sending
   - Error handling
   - Delivery status tracking

3. **Phone Verification**
   - OTP verification flow
   - Phone number formatting

---

## Cost Considerations

### Twilio SMS Pricing (Approximate)

| Item | Cost |
|------|------|
| US Local Number | $1.15/month |
| Outbound SMS (US) | $0.0079/message |
| Outbound SMS (International) | $0.05-0.15/message |

**Estimated Monthly Cost (1000 bookings/month):**
- 3 reminders per booking = 3000 SMS
- Cost: ~$25-30/month for US-only

### Email (Current - Free with Gmail SMTP)
- Already implemented
- No additional cost
- May need upgrade to SendGrid/Mailgun at scale

---

## Testing Checklist

### Phase 1: Email
- [ ] 24-hour reminder sends correctly
- [ ] 2-hour reminder sends correctly
- [ ] Reminder flags prevent duplicate sends
- [ ] Email templates render properly
- [ ] Links in emails work correctly

### Phase 2: Preferences
- [ ] Preferences save correctly
- [ ] Preferences load on page
- [ ] Reminders respect preferences
- [ ] Quiet hours work correctly

### Phase 3: SMS
- [ ] Twilio integration works
- [ ] Phone validation works
- [ ] SMS delivery succeeds
- [ ] Phone verification flow works
- [ ] International numbers supported

---

## Summary

### Current State
- 24-hour email reminder exists
- In-app notifications work
- SMS not implemented
- Single reminder interval only

### Target State
- Multiple reminder intervals (24h, 2h, 30m)
- Email + SMS + In-app channels
- Customer-configurable preferences
- Quiet hours support

### Priority Order
1. **Phase 1**: Enhanced email reminders (immediate value)
2. **Phase 2**: Customer preferences UI
3. **Phase 3**: Twilio SMS integration (when approved)

---

*Document created: January 2, 2026*
*Status: Ready for implementation*

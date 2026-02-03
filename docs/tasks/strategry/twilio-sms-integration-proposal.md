# Twilio SMS Integration Proposal

## Overview

This document outlines the proposal for integrating Twilio SMS into RepairCoin for system notifications and booking communications.

**Last Updated**: December 30, 2024

---

## Use Cases

### 1. System Notifications
- Subscription status changes (paused, cancelled, resumed, approved)
- Payment confirmations and failures
- Account verification (future)

### 2. Booking Notifications
- Booking confirmation (immediately after payment)
- 24-hour appointment reminder
- Booking cancellation alerts
- Rescheduling notifications

### 3. Reward Notifications (Optional)
- RCN reward received
- Redemption approval requests
- Token transfer confirmations

---

## Recommended Plan: Pay-As-You-Go

Twilio offers a **pay-as-you-go** model with no monthly minimums, making it ideal for starting small and scaling as needed.

### US SMS Pricing

| Type | Cost |
|------|------|
| Outbound SMS | $0.0079/message |
| Inbound SMS | $0.0079/message |
| Outbound MMS | $0.0200/message |
| Inbound MMS | $0.0100/message |

### Phone Number Costs

| Number Type | Monthly Cost |
|-------------|--------------|
| Local Number | $1.00/month |
| Toll-Free Number | $2.00/month |
| Short Code (high-volume) | ~$1,000/month |

**Recommendation**: Start with a **local number** at $1.00/month

### Additional Fees

| Fee Type | Cost |
|----------|------|
| Failed message processing | $0.001/message |
| Carrier pass-through fees | Varies by carrier |

---

## Cost Estimation

### Scenario: 100 Active Shops, 500 Bookings/Month

| Notification Type | Messages/Month | Cost/Message | Total |
|-------------------|----------------|--------------|-------|
| Booking confirmations | 500 | $0.0079 | $3.95 |
| 24-hour reminders | 500 | $0.0079 | $3.95 |
| Shop notifications | 500 | $0.0079 | $3.95 |
| Subscription alerts | 50 | $0.0079 | $0.40 |
| **Subtotal (Messages)** | **1,550** | | **$12.25** |
| Phone number (local) | 1 | $1.00 | $1.00 |
| **Monthly Total** | | | **$13.25** |

### Scaling Estimates

| Scale | Bookings/Month | Est. Messages | Est. Monthly Cost |
|-------|----------------|---------------|-------------------|
| Starter | 100 | 300 | ~$3.50 |
| Growth | 500 | 1,500 | ~$13 |
| Scale | 2,000 | 6,000 | ~$48 |
| Enterprise | 10,000 | 30,000 | ~$240 |

**Note**: Volume discounts available at $500+/month spend (5-20% off)

---

## Implementation Phases

### Phase 1: Basic Setup (MVP)
1. Create Twilio account (free trial with $15 credit)
2. Purchase local phone number ($1/month)
3. Implement booking confirmation SMS
4. Implement 24-hour reminder SMS

### Phase 2: Full Notifications
1. Subscription status notifications
2. Payment failure alerts
3. Reward notifications
4. Shop notifications for new bookings

### Phase 3: Two-Way SMS (Future)
1. Reply to confirm/cancel appointments
2. SMS-based customer support
3. Automated responses

---

## Technical Integration

### Backend Changes Required

```typescript
// New service: backend/src/services/SmsService.ts
import twilio from 'twilio';

export class SmsService {
  private client: twilio.Twilio;

  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async sendBookingConfirmation(phone: string, data: BookingData) {
    return this.client.messages.create({
      body: `Your appointment at ${data.shopName} is confirmed for ${data.date} at ${data.time}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
  }

  async sendAppointmentReminder(phone: string, data: ReminderData) {
    return this.client.messages.create({
      body: `Reminder: You have an appointment tomorrow at ${data.shopName} for ${data.service} at ${data.time}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
  }
}
```

### Environment Variables

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

### Database Changes

```sql
-- Add phone number to customers table
ALTER TABLE customers ADD COLUMN phone_number VARCHAR(20);
ALTER TABLE customers ADD COLUMN sms_notifications_enabled BOOLEAN DEFAULT true;

-- Add phone number to shops table (if not exists)
ALTER TABLE shops ADD COLUMN phone_number VARCHAR(20);
ALTER TABLE shops ADD COLUMN sms_notifications_enabled BOOLEAN DEFAULT true;
```

---

## Comparison with Alternatives

### SMS Providers

| Provider | US SMS Cost | Pros | Cons |
|----------|-------------|------|------|
| **Twilio** | $0.0079 | Industry leader, great docs, reliable | Slightly higher cost |
| Plivo | $0.0055 | Lower cost | Less features |
| Vonage | $0.0076 | Good API | Less popular |
| AWS SNS | $0.00645 | AWS integration | Complex setup |

### WhatsApp Business API (Alternative)

| Feature | SMS | WhatsApp |
|---------|-----|----------|
| Cost per message | $0.0079 | $0.005 + Meta fee |
| Delivery rate | 95%+ | 98%+ |
| Rich media | MMS ($0.02) | Free |
| Read receipts | No | Yes |
| Interactive buttons | No | Yes |
| User reach | Universal | Requires app |

**Recommendation**: Start with SMS, add WhatsApp later for users who prefer it.

---

## Twilio Account Setup

### Step 1: Create Account
1. Go to [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up (free trial includes $15 credit)
3. Verify phone number

### Step 2: Get Credentials
1. Go to Console Dashboard
2. Copy **Account SID** and **Auth Token**
3. Add to environment variables

### Step 3: Purchase Phone Number
1. Go to Phone Numbers → Buy a Number
2. Select country: United States
3. Enable SMS capability
4. Purchase ($1.00/month)

### Step 4: Upgrade Account (When Ready)
1. Go to Billing → Upgrade
2. Add payment method
3. Trial restrictions removed

---

## Regulatory Compliance

### US SMS Requirements

1. **A2P 10DLC Registration** (Required for business messaging)
   - Brand registration: ~$4 one-time
   - Campaign registration: ~$15 one-time + $10/month
   - Required for sending SMS to US numbers at scale

2. **Opt-in/Opt-out**
   - Must obtain consent before sending SMS
   - Must support STOP to unsubscribe
   - Twilio handles STOP automatically

3. **Message Content**
   - No promotional content without consent
   - Include business name in messages
   - Provide opt-out instructions periodically

---

## Startup Costs Summary

### Minimum Viable Setup

| Item | One-Time | Monthly |
|------|----------|---------|
| Twilio account | Free | - |
| Local phone number | - | $1.00 |
| A2P 10DLC Brand | $4.00 | - |
| A2P 10DLC Campaign | $15.00 | $10.00 |
| **Total** | **$19.00** | **$11.00** |

### First Month Estimate (100 bookings)

| Item | Cost |
|------|------|
| Setup fees | $19.00 |
| Phone number | $1.00 |
| Campaign fee | $10.00 |
| ~300 SMS messages | $2.37 |
| **First Month Total** | **$32.37** |

### Ongoing Monthly (100 bookings)

| Item | Cost |
|------|------|
| Phone number | $1.00 |
| Campaign fee | $10.00 |
| ~300 SMS messages | $2.37 |
| **Monthly Total** | **$13.37** |

---

## Implementation Checklist

### Account Setup
- [ ] Create Twilio account
- [ ] Verify phone number
- [ ] Get Account SID and Auth Token
- [ ] Purchase local phone number
- [ ] Complete A2P 10DLC registration

### Backend Development
- [ ] Create SmsService class
- [ ] Add environment variables
- [ ] Integrate with booking confirmation flow
- [ ] Integrate with reminder scheduler
- [ ] Add phone number fields to database
- [ ] Create SMS preferences endpoint

### Frontend Development
- [ ] Add phone number input to customer registration
- [ ] Add SMS notification toggle in settings
- [ ] Display SMS status in booking confirmation

### Testing
- [ ] Test booking confirmation SMS
- [ ] Test reminder SMS
- [ ] Test opt-out (STOP keyword)
- [ ] Verify message delivery rates

---

## Sources

- [Twilio SMS Pricing (US)](https://www.twilio.com/en-us/sms/pricing/us)
- [Twilio Messaging Pricing](https://www.twilio.com/en-us/pricing/messaging)
- [Twilio Phone Number Costs](https://help.twilio.com/articles/223182908-How-much-does-a-phone-number-cost-)
- [Twilio WhatsApp Pricing](https://www.twilio.com/en-us/whatsapp/pricing)
- [WhatsApp Pricing Changes July 2025](https://help.twilio.com/articles/30304057900699-Notice-Changes-to-WhatsApp-s-Pricing-July-2025)

---

## Recommendation

**Start with Pay-As-You-Go** using the lowest tier:

1. **Initial Investment**: ~$32 (includes setup fees)
2. **Ongoing Cost**: ~$13-15/month for ~100 bookings
3. **Scale**: Upgrade to volume discounts at $500+/month

This approach allows RepairCoin to:
- Test SMS functionality with minimal investment
- Validate user engagement before scaling
- Upgrade to higher tiers as volume grows

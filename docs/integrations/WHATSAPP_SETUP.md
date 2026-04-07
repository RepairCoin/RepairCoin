# WhatsApp Business API Setup Guide

This guide explains how to integrate WhatsApp Business API with RepairCoin to send booking confirmations, appointment reminders, and order updates to customers.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Setup Options](#setup-options)
- [Facebook WhatsApp Business API Setup](#facebook-whatsapp-business-api-setup)
- [Twilio WhatsApp Setup (Alternative)](#twilio-whatsapp-setup-alternative)
- [Environment Configuration](#environment-configuration)
- [Testing](#testing)
- [Features](#features)
- [Troubleshooting](#troubleshooting)

---

## Overview

RepairCoin integrates with WhatsApp Business API to send automated notifications to customers via WhatsApp, including:
- ✅ Booking confirmations
- ⏰ 24-hour appointment reminders
- ✅ Service completion notifications
- ❌ Cancellation & refund notifications

---

## Prerequisites

1. **WhatsApp Business Account**: You need a verified WhatsApp Business account
2. **Phone Number**: A dedicated phone number (cannot be used for personal WhatsApp)
3. **Facebook Business Manager**: Required for official WhatsApp Business API

---

## Setup Options

### Option 1: Facebook WhatsApp Business API (Official)
- **Cost**: Free for first 1,000 conversations/month, then pay-per-conversation
- **Setup Time**: 2-3 days (requires Facebook review)
- **Best For**: Official businesses with verified Facebook Business Manager

### Option 2: Twilio WhatsApp API (Recommended for Quick Start)
- **Cost**: $0.005 per message + Twilio fees
- **Setup Time**: 15-30 minutes
- **Best For**: Rapid deployment, no Facebook verification needed

### Option 3: 360Dialog / MessageBird
- **Cost**: Varies by provider
- **Setup Time**: 1-2 hours
- **Best For**: Businesses wanting more control

---

## Facebook WhatsApp Business API Setup

### Step 1: Create Facebook Business Manager Account
1. Go to [Facebook Business Manager](https://business.facebook.com/)
2. Click "Create Account"
3. Enter your business details
4. Verify your business (may require documents)

### Step 2: Set Up WhatsApp Business API
1. In Facebook Business Manager, go to **Business Settings**
2. Click **WhatsApp Accounts** → **Add**
3. Follow the setup wizard:
   - Verify your phone number
   - Accept WhatsApp Business API Terms
   - Configure display name and profile

### Step 3: Get API Credentials
1. Go to **Meta for Developers**: https://developers.facebook.com/
2. Create a new app or select existing app
3. Add **WhatsApp** product to your app
4. Navigate to **WhatsApp** → **API Setup**
5. Copy these credentials:
   - **Phone Number ID**
   - **WhatsApp Business Account ID**
   - **Access Token** (generate permanent token)

### Step 4: Configure Webhook (Optional for Two-Way Chat)
1. In your app dashboard, go to **WhatsApp** → **Configuration**
2. Set **Callback URL**: `https://your-domain.com/api/webhooks/whatsapp`
3. Set **Verify Token**: Generate a random string (save for env vars)
4. Subscribe to webhook fields: `messages`, `message_status`

---

## Twilio WhatsApp Setup (Alternative)

### Step 1: Create Twilio Account
1. Go to [Twilio Console](https://www.twilio.com/console)
2. Sign up for free account (get $15 credit)
3. Complete phone verification

### Step 2: Enable WhatsApp Sandbox (Testing)
1. Go to **Messaging** → **Try it Out** → **Send a WhatsApp message**
2. Follow instructions to join WhatsApp sandbox
3. Copy **WhatsApp-enabled phone number**

### Step 3: Get Production WhatsApp Number
1. Go to **Messaging** → **WhatsApp** → **Senders**
2. Click **Buy a Number** or **Request Access** for WhatsApp Business Profile
3. Complete Facebook verification (required for production)

### Step 4: Get API Credentials
1. Go to **Account Dashboard**
2. Copy:
   - **Account SID**
   - **Auth Token**
   - **WhatsApp Phone Number** (format: `whatsapp:+14155238886`)

---

## Environment Configuration

### Add to `.env` file:

#### For Facebook WhatsApp Business API:
```env
# WhatsApp Business API (Facebook)
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_API_VERSION=v18.0
```

#### For Twilio WhatsApp API:
```env
# Twilio WhatsApp API
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### Optional Environment Variables:
```env
# WhatsApp Webhook Configuration (for two-way chat)
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_secure_random_string_here

# Feature Toggles
WHATSAPP_ENABLED=true
WHATSAPP_SEND_BOOKING_CONFIRMATIONS=true
WHATSAPP_SEND_APPOINTMENT_REMINDERS=true
WHATSAPP_SEND_COMPLETION_NOTIFICATIONS=true
```

---

## Testing

### 1. Test WhatsApp Service
```bash
cd backend
npm run test:whatsapp
```

### 2. Send Test Message (Node.js)
```javascript
import WhatsAppService from './services/WhatsAppService';

// Test booking confirmation
await WhatsAppService.sendBookingConfirmation({
  customerPhone: '+1234567890',
  customerName: 'John Doe',
  shopName: 'AutoFix Garage',
  serviceName: 'Oil Change',
  bookingDate: '2024-04-10',
  bookingTime: '2:00 PM',
  totalAmount: 49.99,
  bookingId: 'ORD-12345',
});
```

### 3. Test via curl (Facebook API)
```bash
curl -X POST \
  "https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "1234567890",
    "type": "text",
    "text": {
      "body": "Hello from RepairCoin!"
    }
  }'
```

---

## Features

### 1. Booking Confirmations
Sent immediately after successful payment:
```
🎉 Booking Confirmed!

Hi John,

Your booking has been confirmed:

📍 Shop: AutoFix Garage
🔧 Service: Oil Change
📅 Date: April 10, 2024
⏰ Time: 2:00 PM
💰 Total: $49.99

📝 Booking ID: ORD-12345

We look forward to seeing you!

_Powered by RepairCoin_
```

### 2. Appointment Reminders
Sent 24 hours before scheduled time:
```
⏰ Appointment Reminder

Hi John,

This is a friendly reminder about your upcoming appointment:

📍 Shop: AutoFix Garage
🔧 Service: Oil Change
📅 Date: April 10, 2024
⏰ Time: 2:00 PM

💡 Tip: Please arrive 5-10 minutes early.

See you soon!

_Powered by RepairCoin_
```

### 3. Service Completion
Sent when shop marks order as completed:
```
✅ Service Completed!

Hi John,

Thank you for using our service!

📍 Shop: AutoFix Garage
🔧 Service: Oil Change

🪙 You earned: 50 RCN tokens!

We'd love to hear your feedback. Please rate your experience on RepairCoin.

_Powered by RepairCoin_
```

### 4. Cancellation Notifications
Sent when booking is cancelled:
```
❌ Booking Cancelled

Hi John,

Your booking has been cancelled:

📍 Shop: AutoFix Garage
🔧 Service: Oil Change

💰 Refund: $49.99

Your refund will be processed within 5-10 business days.

We hope to see you again soon!

_Powered by RepairCoin_
```

---

## Troubleshooting

### Issue: "Phone number not registered"
**Solution**: Ensure phone number is in E.164 format (+1234567890)

### Issue: "Invalid access token"
**Solution**:
1. Generate new permanent access token
2. Ensure no extra spaces in `.env` file

### Issue: "Message not delivered"
**Solution**:
1. Verify recipient has WhatsApp installed
2. Check recipient phone number is correct
3. Ensure account has active WhatsApp Business API access

### Issue: "Webhook not receiving messages"
**Solution**:
1. Verify webhook URL is publicly accessible (HTTPS required)
2. Check verify token matches
3. Ensure webhook is subscribed to correct events

### Issue: "Rate limit exceeded"
**Solution**:
- Facebook: 1,000 messages/day for new accounts
- Request rate limit increase in Business Manager

---

## Cost Estimates

### Facebook WhatsApp Business API:
- **Free Tier**: 1,000 user-initiated conversations/month
- **Business-initiated**: $0.005-$0.05 per conversation (varies by country)
- **Service conversations**: Free within 24-hour window

### Twilio WhatsApp:
- **Sandbox (Testing)**: Free
- **Production**: $0.005 per message + Twilio fees
- **Template messages**: $0.007 per message

---

## Next Steps

1. ✅ Choose provider (Facebook or Twilio)
2. ✅ Get API credentials
3. ✅ Add credentials to `.env`
4. ✅ Test with your phone number
5. ✅ Deploy to production
6. 📊 Monitor message delivery in dashboard

---

## Support Resources

- **Facebook WhatsApp Docs**: https://developers.facebook.com/docs/whatsapp
- **Twilio WhatsApp Docs**: https://www.twilio.com/docs/whatsapp
- **RepairCoin Support**: support@repaircoin.ai

---

**Last Updated**: April 6, 2026

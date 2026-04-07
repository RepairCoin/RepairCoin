# Next Session: WhatsApp & Messenger Integration - Action Items

**Date Created**: April 6, 2026
**Status**: Frontend Complete ✅ | Backend Integration Pending ⏳

---

## What Was Completed Today

### ✅ Frontend Implementation (100% Complete)
1. **Chat Now Buttons on Service Cards**
   - Created `ChatButton.tsx` component with dropdown for WhatsApp/Messenger
   - Integrated into `ServiceCard.tsx` - shows above Book Now button
   - Pre-filled messages with shop name and service name
   - Smart display (only shows if shop has WhatsApp/Messenger configured)

2. **Shop Settings UI**
   - Added WhatsApp and Messenger fields to Social Media Settings
   - Shop owners can add links like:
     - WhatsApp: `https://wa.me/1234567890`
     - Messenger: `https://m.me/yourshop`

3. **Admin Settings**
   - Fixed missing admin settings tab
   - Added comprehensive roadmap (25+ features planned)

4. **WhatsApp API Service Created**
   - Built `WhatsAppService.ts` with 4 notification methods
   - Created complete setup documentation

---

## What Needs to Be Done Next Session

### 🔴 CRITICAL: Backend Integration (Required for WhatsApp/Messenger to work)

#### 1. **Update Backend Service Endpoints to Return WhatsApp/Messenger** (30 min)

**Problem**: Frontend expects `shopWhatsapp` and `shopMessenger` fields, but backend doesn't return them yet.

**Files to Modify:**
- `backend/src/services/ShopService.ts` (or wherever services are fetched)
- `backend/src/repositories/ShopRepository.ts`

**What to Do:**
```typescript
// In ShopRepository.ts - Add to SELECT query
const query = `
  SELECT
    s.shop_id,
    s.company_name,
    s.phone,
    s.email,
    s.whatsapp,      -- ADD THIS
    s.messenger,     -- ADD THIS
    -- ... other fields
  FROM shops s
  -- ... rest of query
`;

// Map snake_case to camelCase in transformation
{
  shopWhatsapp: row.whatsapp,
  shopMessenger: row.messenger,
}
```

**Affected Endpoints:**
- `GET /api/services/active` - Returns all services with shop info
- `GET /api/services/:id` - Returns single service with shop info
- `GET /api/services/shop/:shopId` - Returns services for specific shop
- `GET /api/services/favorites` - Returns favorited services
- `GET /api/services/trending` - Returns trending services
- `GET /api/services/similar/:serviceId` - Returns similar services

**Test:**
```bash
# After changes, test that WhatsApp/Messenger fields are returned
curl http://localhost:4000/api/services/active | jq '.[0].shopWhatsapp'
# Should return the WhatsApp URL or null
```

---

#### 2. **Integrate WhatsApp Notifications into PaymentService** (45 min)

**File**: `backend/src/services/PaymentService.ts`

**What to Do:**
```typescript
// At top of file
import WhatsAppService from './WhatsAppService';

// In the payment success handler (after order is created)
async handlePaymentSuccess(orderId: string) {
  // ... existing payment logic ...

  // Send WhatsApp booking confirmation
  if (customerPhone) {
    await WhatsAppService.sendBookingConfirmation({
      customerPhone: customerPhone,
      customerName: customerName,
      shopName: shopName,
      serviceName: serviceName,
      bookingDate: bookingDate,
      bookingTime: bookingTime,
      totalAmount: totalAmount,
      bookingId: orderId,
    });
  }

  // ... rest of code ...
}
```

**Where to Add:**
- **Booking Confirmation**: After successful Stripe payment
- **Cancellation Notification**: In cancellation handler
- **Order Completion**: When shop marks order as completed

---

#### 3. **Integrate WhatsApp into Appointment Reminder Service** (30 min)

**File**: `backend/src/services/AppointmentReminderService.ts`

**What to Do:**
```typescript
import WhatsAppService from './WhatsAppService';

// In the sendReminder() method
async sendReminder(booking: Booking) {
  // ... existing email reminder code ...

  // Send WhatsApp reminder
  if (booking.customerPhone) {
    await WhatsAppService.sendAppointmentReminder({
      customerPhone: booking.customerPhone,
      customerName: booking.customerName,
      shopName: booking.shopName,
      serviceName: booking.serviceName,
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime,
      totalAmount: booking.totalAmount,
      bookingId: booking.orderId,
    });
  }
}
```

---

#### 4. **Database Schema Check** (10 min)

**Verify these columns exist in `shops` table:**
```sql
-- Check if columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'shops'
  AND column_name IN ('whatsapp', 'messenger');
```

**If columns don't exist, create migration:**
```sql
-- Migration: add_whatsapp_messenger_to_shops.sql
ALTER TABLE shops
ADD COLUMN whatsapp VARCHAR(255),
ADD COLUMN messenger VARCHAR(255);

COMMENT ON COLUMN shops.whatsapp IS 'WhatsApp link (e.g., https://wa.me/1234567890)';
COMMENT ON COLUMN shops.messenger IS 'Facebook Messenger link (e.g., https://m.me/shopname)';
```

---

### 🟡 OPTIONAL: WhatsApp API Setup (For Production)

**Only do this when ready to send real WhatsApp messages.**

#### Option A: Facebook WhatsApp Business API (Official - Recommended)
**Time**: 2-3 days (requires Facebook verification)

1. **Create Facebook Business Manager**
   - Go to https://business.facebook.com/
   - Create account and verify business

2. **Set Up WhatsApp Business API**
   - In Business Manager → WhatsApp Accounts → Add
   - Verify phone number
   - Get API credentials

3. **Get Credentials**
   - Phone Number ID
   - Access Token (permanent)
   - API Version (v18.0)

4. **Add to `.env`**
   ```env
   WHATSAPP_PHONE_NUMBER_ID=123456789012345
   WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxx
   WHATSAPP_API_VERSION=v18.0
   ```

**Full Guide**: `docs/integrations/WHATSAPP_SETUP.md`

---

#### Option B: Twilio WhatsApp (Faster - For Testing)
**Time**: 15-30 minutes

1. **Sign up at Twilio**: https://www.twilio.com/try-twilio
2. **Enable WhatsApp Sandbox** (for testing)
3. **Get credentials**:
   - Account SID
   - Auth Token
   - WhatsApp Number

4. **Modify WhatsAppService.ts** to use Twilio SDK:
   ```typescript
   // Install: npm install twilio
   import twilio from 'twilio';

   const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

   await client.messages.create({
     from: 'whatsapp:+14155238886',
     to: `whatsapp:${customerPhone}`,
     body: messageText,
   });
   ```

---

### 🟢 TESTING CHECKLIST

After backend integration, test these flows:

#### 1. **Chat Button Display Test**
- [ ] Navigate to service marketplace as customer
- [ ] Find a shop that has WhatsApp/Messenger configured
- [ ] Verify "Chat Now" button appears on service card
- [ ] Click button → WhatsApp/Messenger opens with pre-filled message
- [ ] Verify message includes shop name and service name

#### 2. **Shop Settings Test**
- [ ] Login as shop owner
- [ ] Go to Settings → Social Media
- [ ] Add WhatsApp link: `https://wa.me/1234567890`
- [ ] Add Messenger link: `https://m.me/yourshop`
- [ ] Save changes
- [ ] View your services as customer → Chat button should appear

#### 3. **WhatsApp Notifications Test** (if API configured)
- [ ] Book a service
- [ ] Check phone → Should receive booking confirmation
- [ ] Wait 24 hours (or manually trigger) → Should receive reminder
- [ ] Complete service → Should receive completion notification
- [ ] Cancel booking → Should receive cancellation notification

---

## Quick Start Commands for Next Session

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies (if WhatsApp packages added)
cd backend && npm install
cd frontend && npm install

# 3. Check database for whatsapp/messenger columns
psql -U your_user -d repaircoin -c "SELECT column_name FROM information_schema.columns WHERE table_name='shops' AND column_name IN ('whatsapp', 'messenger');"

# 4. Start development servers
npm run dev  # From root (starts both frontend & backend)

# 5. Test backend endpoint returns WhatsApp/Messenger
curl http://localhost:4000/api/services/active | jq '.[0] | {shopWhatsapp, shopMessenger}'
```

---

## Files to Review Next Session

### Priority 1 (Must Review):
1. `backend/src/repositories/ShopRepository.ts` - Add whatsapp/messenger to SELECT queries
2. `backend/src/services/PaymentService.ts` - Integrate WhatsApp notifications
3. `backend/src/services/AppointmentReminderService.ts` - Add WhatsApp reminders

### Priority 2 (Nice to Have):
4. `backend/src/services/WhatsAppService.ts` - Review and customize message templates
5. `docs/integrations/WHATSAPP_SETUP.md` - Read setup guide if deploying WhatsApp API

---

## Estimated Time to Complete

| Task | Time | Difficulty |
|------|------|------------|
| Backend service endpoints update | 30 min | Easy |
| Database column check/migration | 10 min | Easy |
| PaymentService integration | 45 min | Medium |
| AppointmentReminderService integration | 30 min | Easy |
| Testing | 30 min | Easy |
| **TOTAL (Backend Integration)** | **2-3 hours** | **Medium** |
| WhatsApp API Setup (Optional) | 2-3 days | Hard |

---

## Current Status Summary

```
✅ COMPLETE:
- Frontend ChatButton component
- ServiceCard integration
- Shop Social Media Settings UI
- WhatsAppService backend service
- Admin Settings page
- Documentation

⏳ PENDING:
- Backend endpoints returning whatsapp/messenger fields
- PaymentService WhatsApp integration
- AppointmentReminderService WhatsApp integration
- Database columns verification
- End-to-end testing

🔮 FUTURE:
- WhatsApp Business API setup (production)
- Two-way WhatsApp chat support
- WhatsApp analytics dashboard
```

---

## Questions to Answer Next Session

1. **Do shops already have `whatsapp` and `messenger` columns in database?**
   - If NO → Create migration
   - If YES → Just update queries

2. **Should WhatsApp notifications be opt-in or automatic?**
   - Current: Automatic (graceful fallback if not configured)
   - Alternative: Add toggle in shop settings

3. **Which WhatsApp provider to use?**
   - Facebook (official, free tier, requires verification)
   - Twilio (paid, faster setup, $0.005/message)
   - Other (360Dialog, MessageBird)

---

## Support & References

- **WhatsApp Setup Guide**: `docs/integrations/WHATSAPP_SETUP.md`
- **ChatButton Component**: `frontend/src/components/customer/ChatButton.tsx`
- **WhatsApp Service**: `backend/src/services/WhatsAppService.ts`
- **Facebook WhatsApp API**: https://developers.facebook.com/docs/whatsapp
- **Twilio WhatsApp API**: https://www.twilio.com/docs/whatsapp

---

**Remember**: All WhatsApp integration has graceful fallbacks. If API not configured, features won't break - they just won't send messages. The Chat Now buttons work immediately without any API setup!

---

**Created by**: Claude Code
**Last Updated**: April 6, 2026
**Next Review**: Next development session

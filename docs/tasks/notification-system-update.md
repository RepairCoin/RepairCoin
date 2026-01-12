# Notification System Update

## Overview

This document outlines the current state of subscription-related notifications, identifies gaps, and provides a strategy for implementing missing notifications including SMS via Twilio.

**Last Updated**: January 09, 2026

---

## Implementation Progress

### Completed ✅

| Date | Item | Type | Files Modified |
|------|------|------|----------------|
| Dec 25, 2024 | Admin Cancel Email | Email | `EmailService.ts`, `admin/routes/subscription.ts` |
| Dec 26, 2024 | Admin Pause Email | Email | `EmailService.ts`, `admin/routes/subscription.ts` |
| Dec 26, 2024 | Admin Resume Email | Email | `EmailService.ts`, `admin/routes/subscription.ts` |
| Dec 26, 2024 | Admin Reactivate Email | Email | `EmailService.ts`, `admin/routes/subscription.ts` |
| Dec 26, 2024 | Real-time WebSocket for subscriptions | In-App | `NotificationDomain.ts`, `admin/routes/subscription.ts` |
| Dec 26, 2024 | Notification Details UI | Frontend | `NotificationBell.tsx` |
| Dec 26, 2024 | Warning Banner Real-time | Frontend | `ShopDashboardClient.tsx` |
| Dec 26, 2024 | Subscription Tab Real-time | Frontend | `SubscriptionManagement.tsx` |
| Dec 26, 2024 | Admin Cancel Modal UI Update | Frontend | `SubscriptionManagementTab.tsx` |
| Dec 26, 2024 | Days Remaining Bug Fix | Backend | `shop/routes/subscription.ts` |
| Dec 29, 2024 | Shop Self-Cancel Email | Email | `EmailService.ts`, `shop/routes/subscription.ts` |
| Dec 29, 2024 | Shop Self-Cancel In-App | In-App | `NotificationService.ts`, `NotificationDomain.ts`, `shop/routes/subscription.ts` |
| Jan 09, 2026 | Shop Suspend In-App + WebSocket | In-App | `NotificationService.ts`, `NotificationDomain.ts`, `ShopManagementService.ts` |
| Jan 09, 2026 | Shop Suspend Email | Email | `EmailService.ts`, `ShopManagementService.ts` |
| Jan 09, 2026 | Shop Unsuspend In-App + WebSocket | In-App | `NotificationService.ts`, `NotificationDomain.ts`, `ShopManagementService.ts` |
| Jan 09, 2026 | Shop Unsuspend Email | Email | `EmailService.ts`, `ShopManagementService.ts` |

### In Progress 🔄

| Item | Type | Status |
|------|------|--------|
| - | - | - |

### Pending ⏳

| Item | Type | Priority |
|------|------|----------|
| Auto-Cancel In-App | In-App | High |
| SMS Integration (Twilio) | SMS | Low |

---

## Current State Analysis

### In-App Notifications (NotificationService)

| Status Change | Implemented | Triggered By | Location |
|--------------|-------------|--------------|----------|
| Subscription Approved | ✅ Yes | Stripe webhook (on activation) | `shop/routes/webhooks.ts:282` |
| Admin Cancel | ✅ Yes | Admin action | `admin/routes/subscription.ts:282` |
| Admin Pause | ✅ Yes | Admin action | `admin/routes/subscription.ts:420` |
| Admin Resume | ✅ Yes | Admin action | `admin/routes/subscription.ts:588` |
| Admin Reactivate | ✅ Yes | Admin action | `admin/routes/subscription.ts:936` |
| Shop Self-Cancel | ✅ Yes | Shop action | `shop/routes/subscription.ts:975` |
| Shop Self-Reactivate | ❌ No | - | Not implemented |
| Auto-Cancel (Grace Period) | ❌ No | - | Only email sent |
| Admin Suspend Shop | ✅ Yes | Admin action | `ShopManagementService.ts` |
| Admin Unsuspend Shop | ✅ Yes | Admin action | `ShopManagementService.ts` |

### Email Notifications (EmailService)

| Status Change | Implemented | Method | Notes |
|--------------|-------------|--------|-------|
| Payment Reminder | ✅ Yes | `sendPaymentReminder()` | Upcoming payment reminder |
| Payment Overdue | ✅ Yes | `sendPaymentOverdue()` | Sent during 14-day grace period |
| Auto-Cancel (Non-Payment) | ✅ Yes | `sendSubscriptionDefaulted()` | Sent when grace period expires |
| Subscription Reactivated | ✅ Yes | `sendSubscriptionReactivated()` | Admin or shop reactivation |
| Trial Welcome | ✅ Yes | `sendTrialWelcome()` | New trial started |
| Admin Cancel | ✅ Yes | `sendSubscriptionCancelledByAdmin()` | **Added Dec 25, 2024** |
| Admin Pause | ✅ Yes | `sendSubscriptionPausedByAdmin()` | **Added Dec 26, 2024** |
| Admin Resume | ✅ Yes | `sendSubscriptionResumedByAdmin()` | **Added Dec 26, 2024** |
| Admin Reactivate | ✅ Yes | `sendSubscriptionReactivatedByAdmin()` | **Added Dec 26, 2024** |
| Shop Self-Cancel | ✅ Yes | `sendSubscriptionCancelledByShop()` | **Added Dec 29, 2024** |
| Admin Suspend Shop | ✅ Yes | `sendShopSuspendedByAdmin()` | **Added Jan 09, 2026** |
| Admin Unsuspend Shop | ✅ Yes | `sendShopUnsuspendedByAdmin()` | **Added Jan 09, 2026** |
| Subscription Activated | ❌ No | - | Only in-app (no email) |

### SMS Notifications

| Status Change | Implemented |
|--------------|-------------|
| All Events | ❌ Not implemented |

---

## Identified Gaps

### High Priority

| Gap | Impact | Current Behavior |
|-----|--------|------------------|
| ~~Shop self-cancel notifications~~ | ~~Shop receives no confirmation when they cancel~~ | ✅ **FIXED Dec 29** - Email + In-App notification |
| Auto-cancel in-app notification | Shop only gets email, may miss it | No dashboard alert |

### Medium Priority

| Gap | Impact | Current Behavior |
|-----|--------|------------------|
| ~~Admin cancel email~~ | ~~Shop may not check dashboard regularly~~ | ✅ **FIXED Dec 25** - Now sends email |
| ~~Admin pause email~~ | ~~Important status change not emailed~~ | ✅ **FIXED Dec 26** - Now sends email |
| ~~Admin resume email~~ | ~~Shop may not know they're active again~~ | ✅ **FIXED Dec 26** - Now sends email |
| ~~Admin reactivate email~~ | ~~Shop may not know cancellation was reversed~~ | ✅ **FIXED Dec 26** - Now sends email |
| Subscription activated email | No welcome/confirmation email | Only in-app notification |

### Low Priority (Future Enhancement)

| Gap | Impact | Current Behavior |
|-----|--------|------------------|
| SMS notifications | No urgent alerts via text | Email/in-app only |

---

## Implementation Strategy

### Phase 1: Complete Email & In-App Coverage

**Objective**: Ensure all subscription status changes trigger both email and in-app notifications.

#### Tasks

1. **Add missing in-app notifications**
   - ~~Shop self-cancel confirmation~~ ✅ Done (Dec 29, 2024)
   - Shop self-reactivate confirmation
   - Auto-cancel notification (in addition to email)

2. **Add missing email notifications**
   - ~~Admin cancel email (`sendSubscriptionCancelledByAdmin()`)~~ ✅ Done
   - ~~Admin pause email (`sendSubscriptionPausedByAdmin()`)~~ ✅ Done
   - ~~Admin resume email (`sendSubscriptionResumedByAdmin()`)~~ ✅ Done
   - ~~Admin reactivate email (`sendSubscriptionReactivatedByAdmin()`)~~ ✅ Done
   - ~~Shop self-cancel confirmation email (`sendSubscriptionCancelledByShop()`)~~ ✅ Done (Dec 29, 2024)
   - Subscription activated welcome email (`sendSubscriptionActivated()`)

#### Files to Modify

```
backend/src/services/EmailService.ts
  - ✅ Added: sendSubscriptionCancelledByAdmin()
  - ✅ Added: sendSubscriptionPausedByAdmin()
  - ✅ Added: sendSubscriptionResumedByAdmin()
  - ✅ Added: sendSubscriptionReactivatedByAdmin()
  - ✅ Added: sendSubscriptionCancelledByShop() (Dec 29, 2024)
  - Add: sendSubscriptionActivated()

backend/src/domains/shop/routes/subscription.ts
  - ✅ Added notifications to self-cancel endpoint (Dec 29, 2024)
  - Add notifications to self-reactivate endpoint

backend/src/domains/notification/services/NotificationService.ts
  - ✅ Added: subscription_self_cancelled message template (Dec 29, 2024)
  - ✅ Added: createSubscriptionSelfCancelledNotification() (Dec 29, 2024)

backend/src/domains/notification/NotificationDomain.ts
  - ✅ Added: subscription:self_cancelled event subscription (Dec 29, 2024)
  - ✅ Added: handleSubscriptionSelfCancelled() handler (Dec 29, 2024)

backend/src/domains/admin/routes/subscription.ts
  - ✅ Added email calls alongside existing in-app notifications

backend/src/domains/notification/NotificationDomain.ts
  - ✅ Added subscription event handlers with WebSocket delivery

frontend/src/components/shop/SubscriptionManagement.tsx
  - ✅ Added WebSocket listener for real-time updates

frontend/src/components/shop/ShopDashboardClient.tsx
  - ✅ Added WebSocket listener for warning banner updates

frontend/src/components/notifications/NotificationBell.tsx
  - ✅ Added dynamic content for subscription notifications

backend/src/services/SubscriptionEnforcementService.ts
  - Add in-app notification for auto-cancel

backend/src/domains/admin/services/management/ShopManagementService.ts
  - ✅ Added: shop:suspended event emission (Jan 09, 2026)
  - ✅ Added: shop:unsuspended event emission (Jan 09, 2026)
  - ✅ Added: Email notification calls for suspend/unsuspend (Jan 09, 2026)

backend/src/services/EmailService.ts
  - ✅ Added: sendShopSuspendedByAdmin() (Jan 09, 2026)
  - ✅ Added: sendShopUnsuspendedByAdmin() (Jan 09, 2026)

backend/src/domains/notification/services/NotificationService.ts
  - ✅ Added: shop_suspended message template (Jan 09, 2026)
  - ✅ Added: shop_unsuspended message template (Jan 09, 2026)
  - ✅ Added: createShopSuspendedNotification() (Jan 09, 2026)
  - ✅ Added: createShopUnsuspendedNotification() (Jan 09, 2026)

backend/src/domains/notification/NotificationDomain.ts
  - ✅ Added: shop:suspended event subscription (Jan 09, 2026)
  - ✅ Added: shop:unsuspended event subscription (Jan 09, 2026)
  - ✅ Added: handleShopSuspended() handler (Jan 09, 2026)
  - ✅ Added: handleShopUnsuspended() handler (Jan 09, 2026)

frontend/src/hooks/useNotifications.ts
  - ✅ Added: shop_status_changed WebSocket handler (Jan 09, 2026)

frontend/src/components/shop/ShopDashboardClient.tsx
  - ✅ Added: shop_suspended, shop_unsuspended to notification refresh types (Jan 09, 2026)
```

### Phase 2: SMS Integration with Twilio

**Objective**: Add SMS notifications for critical subscription events.

#### Prerequisites

1. Twilio account setup
2. Environment variables:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```
3. Shop phone number field in database (if not exists)

#### SMS Service Architecture

```
backend/src/services/SmsService.ts
  - TwilioClient wrapper
  - sendSms(to, message)
  - SMS templates for each notification type
  - Rate limiting (prevent spam)
  - Opt-out handling
```

#### SMS-Eligible Events (Critical Only)

| Event | SMS Message |
|-------|-------------|
| Payment Overdue | "RepairCoin: Your payment is overdue. Update payment method to avoid service interruption." |
| Auto-Cancel Warning (Day 10) | "RepairCoin: Your subscription will be cancelled in 4 days. Please update payment." |
| Auto-Cancel | "RepairCoin: Your subscription has been cancelled due to non-payment." |
| Admin Cancel | "RepairCoin: Your subscription has been cancelled by admin. Check dashboard for details." |
| Admin Pause | "RepairCoin: Your subscription has been paused. Check dashboard for details." |

#### Database Changes

```sql
-- Add phone number and SMS preferences to shops table
ALTER TABLE shops ADD COLUMN phone_number VARCHAR(20);
ALTER TABLE shops ADD COLUMN sms_notifications_enabled BOOLEAN DEFAULT false;
ALTER TABLE shops ADD COLUMN sms_opt_out_at TIMESTAMP;
```

#### Implementation Steps

1. **Create SmsService**
   ```typescript
   // backend/src/services/SmsService.ts
   import twilio from 'twilio';

   export class SmsService {
     private client: twilio.Twilio;

     constructor() {
       this.client = twilio(
         process.env.TWILIO_ACCOUNT_SID,
         process.env.TWILIO_AUTH_TOKEN
       );
     }

     async sendSms(to: string, message: string): Promise<boolean> {
       // Implementation
     }

     async sendPaymentOverdueSms(phoneNumber: string, shopName: string): Promise<boolean> {
       // Template implementation
     }
   }
   ```

2. **Add SMS triggers to existing notification points**
   - Modify `SubscriptionEnforcementService` to call SMS service
   - Modify admin subscription routes to call SMS service

3. **Add SMS preferences UI**
   - Shop settings page: Enable/disable SMS
   - Phone number input with verification

### Phase 3: Notification Preferences

**Objective**: Allow shops to customize which notifications they receive and via which channels.

#### Features

1. **Notification Preferences Table**
   ```sql
   CREATE TABLE notification_preferences (
     id SERIAL PRIMARY KEY,
     shop_id VARCHAR(50) REFERENCES shops(shop_id),
     notification_type VARCHAR(50),
     email_enabled BOOLEAN DEFAULT true,
     sms_enabled BOOLEAN DEFAULT false,
     in_app_enabled BOOLEAN DEFAULT true,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **Preferences UI in Shop Dashboard**
   - Toggle email/SMS/in-app per notification type
   - Quiet hours setting (no SMS during certain hours)

3. **Unified Notification Service**
   ```typescript
   // backend/src/services/UnifiedNotificationService.ts
   export class UnifiedNotificationService {
     async notify(shopId: string, type: NotificationType, data: any) {
       const preferences = await this.getPreferences(shopId);

       if (preferences.email_enabled) {
         await this.emailService.send(type, data);
       }
       if (preferences.sms_enabled) {
         await this.smsService.send(type, data);
       }
       if (preferences.in_app_enabled) {
         await this.notificationService.create(type, data);
       }
     }
   }
   ```

---

## Notification Matrix (Target State)

| Event | In-App | Email | SMS |
|-------|--------|-------|-----|
| Subscription Activated | ✅ | ✅ | ❌ |
| Payment Reminder | ✅ | ✅ | ❌ |
| Payment Overdue | ✅ | ✅ | ✅ |
| Auto-Cancel Warning | ✅ | ✅ | ✅ |
| Auto-Cancel | ✅ | ✅ | ✅ |
| Admin Cancel | ✅ | ✅ | ✅ |
| Admin Pause | ✅ | ✅ | ✅ |
| Admin Resume | ✅ | ✅ | ❌ |
| Admin Reactivate | ✅ | ✅ | ❌ |
| Shop Self-Cancel | ✅ | ✅ | ❌ |
| Shop Self-Reactivate | ✅ | ✅ | ❌ |
| Admin Suspend Shop | ✅ | ✅ | ✅ |
| Admin Unsuspend Shop | ✅ | ✅ | ❌ |
| Trial Welcome | ✅ | ✅ | ❌ |
| Trial Ending | ✅ | ✅ | ✅ |

---

## Timeline Estimate

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Email & In-App completion | 2-3 days |
| Phase 2 | Twilio SMS integration | 3-4 days |
| Phase 3 | Notification preferences | 2-3 days |

---

## Related Files

### Current Implementation
- `backend/src/services/EmailService.ts` - Email sending
- `backend/src/domains/notification/services/NotificationService.ts` - In-app notifications
- `backend/src/domains/notification/NotificationDomain.ts` - Event subscriptions and WebSocket delivery
- `backend/src/services/SubscriptionEnforcementService.ts` - Grace period enforcement
- `backend/src/domains/admin/routes/subscription.ts` - Admin subscription actions
- `backend/src/domains/admin/services/management/ShopManagementService.ts` - Shop suspend/unsuspend actions
- `backend/src/domains/shop/routes/subscription.ts` - Shop subscription actions
- `frontend/src/hooks/useNotifications.ts` - WebSocket notification handler
- `frontend/src/components/shop/ShopDashboardClient.tsx` - Real-time UI updates

### To Be Created (Phase 2)
- `backend/src/services/SmsService.ts` - Twilio SMS service
- `backend/src/services/UnifiedNotificationService.ts` - Unified notification dispatcher

---

## Dependencies

### Phase 2 (Twilio)
```bash
npm install twilio
```

### Environment Variables (Phase 2)
```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SMS_ENABLED=true
```

# No-Show Penalty System - Proposal

**Date**: 2026-02-09
**Status**: Proposal / Design Document

---

## 🎯 Core Philosophy

**Balance fairness with business protection**
- Give customers benefit of the doubt for first offense
- Progressive penalties that escalate gradually
- Shop-configurable policies for flexibility
- Grace periods to account for emergencies
- Dispute mechanism for unfair marks

---

## 📊 Proposed 4-Tier Penalty System

### **Tier 1: First Offense** (1 no-show)
**Status**: `warning`

**What Happens:**
- ✉️ Automated email: "We missed you! Here's our no-show policy"
- 🔔 In-app notification with friendly reminder
- 📊 Counter visible in customer profile: "1 no-show"
- ⚠️ Yellow warning badge next to booking history

**No Restrictions**: Customer can book freely

**Email Template:**
```
Subject: We Missed You at [Shop Name]

Hi [Customer Name],

We noticed you didn't make it to your appointment for [Service Name]
on [Date] at [Time].

We understand that unexpected things happen! However, to help us serve
all customers fairly, we track no-show appointments.

Your No-Show Count: 1
Status: No restrictions

Tips to avoid future no-shows:
• Set calendar reminders 24 hours and 1 hour before
• Cancel at least 4 hours in advance if plans change
• Save our contact info to reach us easily

Thanks for your understanding!
[Shop Name]
```

---

### **Tier 2: Second Offense** (2 no-shows)
**Status**: `caution`

**What Happens:**
- 🚨 Persistent banner in customer dashboard (orange)
- ✉️ Warning email: "One more no-show = deposit requirement"
- 📊 Counter shows: "2 no-shows - Caution"
- 🔴 Orange caution badge in booking history
- 📱 SMS notification (optional, if phone provided)

**Restrictions:**
- ⏰ 24-hour advance booking requirement (no same-day bookings)
- 📅 Calendar shows warning when selecting dates

**Banner Text:**
```
⚠️ CAUTION: You have 2 no-shows on record.
One more no-show will require a $25 deposit for future bookings.
Please cancel appointments at least 4 hours in advance.
```

**Email Template:**
```
Subject: Important: No-Show Policy Reminder - [Shop Name]

Hi [Customer Name],

This is your second no-show appointment. We want to work with you,
but we need to protect our ability to serve all customers.

Your No-Show Count: 2
Status: Caution

New Restrictions:
• You must book at least 24 hours in advance
• Same-day bookings are temporarily unavailable

⚠️ IMPORTANT: One more no-show will require a $25 refundable deposit
for all future bookings.

How to avoid restrictions:
• Cancel at least 4 hours before your appointment
• Contact us if you have an emergency

Need help? Reply to this email or call us at [Phone]

[Shop Name]
```

---

### **Tier 3: Third Offense** (3+ no-shows)
**Status**: `deposit_required`

**What Happens:**
- 🔴 Red banner in customer dashboard (persistent)
- 💳 **$25 refundable deposit required** for ALL future bookings
- ✉️ Email explaining deposit policy
- 📊 Counter shows: "3 no-shows - Deposit Required"
- 🔒 Cannot book without paying deposit
- 📱 SMS + Email notification

**Restrictions:**
- 💰 Must pay $25 deposit during checkout
- ⏰ 48-hour advance booking requirement
- 📅 Calendar blocks dates within 48 hours
- 🚫 Cannot use 100% RCN redemption (max 80%)

**Deposit Mechanics:**
- Charged during checkout (separate from service payment)
- **Refunded automatically** if customer shows up
- **Forfeited** if customer no-shows again
- Refund processed within 24 hours of completed appointment
- Deposit status resets after 3 successful appointments

**Banner Text:**
```
🔴 DEPOSIT REQUIRED: You have 3 no-shows on record.
A $25 refundable deposit is now required for all bookings.
Show up to 3 appointments to restore normal booking privileges.
```

**Email Template:**
```
Subject: Deposit Required for Future Bookings - [Shop Name]

Hi [Customer Name],

Due to 3 no-show appointments, we now require a refundable deposit
for your future bookings.

Your No-Show Count: 3
Status: Deposit Required

New Requirements:
• $25 refundable deposit for each booking
• Book at least 48 hours in advance
• Deposits are refunded within 24 hours if you attend

How Deposits Work:
✓ Pay $25 deposit during checkout
✓ Attend your appointment
✓ Get full $25 refund automatically

❌ Miss appointment = Deposit forfeited

How to Restore Normal Booking:
Complete 3 appointments successfully (with deposits) and your account
will return to normal status.

Dispute a No-Show:
If you believe a no-show was marked unfairly, reply to this email with
details and we'll review.

[Shop Name]
```

---

### **Tier 4: Extreme Repeat Offender** (5+ no-shows)
**Status**: `restricted`

**What Happens:**
- 🚫 Temporary booking suspension (30 days)
- ✉️ Email explaining suspension
- 📊 Counter shows: "5 no-shows - Temporarily Suspended"
- 🔴 Red restriction banner with countdown
- 📅 Calendar disabled for 30 days

**After 30-Day Suspension:**
- Return to Tier 3 (deposit required)
- 3 successful appointments to restore to Tier 2
- 6 successful appointments to restore to Tier 1

**Banner Text:**
```
🚫 BOOKING SUSPENDED: Due to repeated no-shows (5+), you cannot book
appointments for 30 days. Suspension ends on [Date].
Contact support if you believe this is an error.
```

**Email Template:**
```
Subject: Temporary Booking Suspension - [Shop Name]

Hi [Customer Name],

Due to 5 or more no-show appointments, we have temporarily suspended
your booking privileges.

Your No-Show Count: 5
Status: Suspended until [Date + 30 days]

Why This Happened:
Repeated no-shows prevent other customers from getting appointments
and hurt our business operations.

What Happens Next:
• Booking privileges suspended for 30 days
• After suspension: $25 deposit required for bookings
• Complete 6 successful appointments to restore normal status

Dispute This Suspension:
If you believe this suspension is unfair or have extenuating
circumstances, reply to this email and we'll review your case.

We want to work with you, but we must protect our ability to serve
all customers fairly.

[Shop Name]
```

---

## ⚙️ Shop Configuration Options

Shops can customize these settings in their dashboard:

### **Basic Settings**
```typescript
interface NoShowPolicyConfig {
  // Enable/disable the penalty system
  enabled: boolean; // default: true

  // Grace period before marking no-show
  gracePeriodMinutes: number; // default: 15

  // Minimum cancellation notice required
  minimumCancellationHours: number; // default: 4

  // Automatic detection after appointment time
  autoDetectionEnabled: boolean; // default: false
  autoDetectionDelayHours: number; // default: 2
}
```

### **Penalty Tier Settings**
```typescript
interface PenaltyTierConfig {
  // Tier 2 - Caution
  cautionThreshold: number; // default: 2 no-shows
  cautionAdvanceBookingHours: number; // default: 24

  // Tier 3 - Deposit Required
  depositThreshold: number; // default: 3 no-shows
  depositAmount: number; // default: 25 (USD)
  depositAdvanceBookingHours: number; // default: 48
  depositResetAfterSuccessful: number; // default: 3 appointments
  maxRcnRedemptionPercent: number; // default: 80%

  // Tier 4 - Suspension
  suspensionThreshold: number; // default: 5 no-shows
  suspensionDurationDays: number; // default: 30
}
```

### **Notification Settings**
```typescript
interface NotificationConfig {
  // Email notifications
  sendEmailTier1: boolean; // default: true
  sendEmailTier2: boolean; // default: true
  sendEmailTier3: boolean; // default: true
  sendEmailTier4: boolean; // default: true

  // SMS notifications (requires phone number)
  sendSmsTier2: boolean; // default: false
  sendSmsTier3: boolean; // default: true
  sendSmsTier4: boolean; // default: true

  // In-app notifications
  sendPushNotifications: boolean; // default: true
}
```

### **Dispute Settings**
```typescript
interface DisputeConfig {
  // Allow customers to dispute no-shows
  allowDisputes: boolean; // default: true

  // How many days customer can dispute
  disputeWindowDays: number; // default: 7

  // Auto-approve disputes from first-time offenders
  autoApproveFirstOffense: boolean; // default: true

  // Require shop review for all disputes
  requireShopReview: boolean; // default: true
}
```

---

## 🛡️ Dispute System

### **Customer Can Dispute If:**
- ✅ They arrived but shop was closed
- ✅ Emergency situation (medical, family, etc.)
- ✅ They cancelled with proper notice
- ✅ System error or technical issue
- ✅ Shop error (wrong date/time communicated)

### **Dispute Process:**

1. **Customer Initiates**
   - Click "Dispute" button on no-show order
   - Fill out dispute form with reason
   - Provide evidence (photos, screenshots, etc.)
   - Submit for review

2. **Shop Review** (48 hours)
   - Shop receives notification
   - Reviews customer's claim and evidence
   - Can approve, reject, or request more info
   - Decision recorded in system

3. **If Approved:**
   - No-show mark removed
   - Customer counter decremented
   - Tier status adjusted if needed
   - Customer notified via email + in-app

4. **If Rejected:**
   - No-show mark remains
   - Customer can appeal to admin
   - Detailed rejection reason provided

5. **Admin Escalation** (optional)
   - Customer can appeal to platform admin
   - Admin has final say
   - Decision is binding

### **Automatic Approvals:**
- First-time offenders (Tier 1) - Auto-approved
- If shop doesn't respond in 48 hours - Auto-approved
- If customer provides strong evidence (photos, etc.) - Flagged for quick review

---

## 📈 Analytics & Insights

### **Shop Dashboard Metrics:**
```typescript
interface NoShowAnalytics {
  // Current Period (Last 30 days)
  totalNoShows: number;
  noShowRate: number; // percentage
  totalDepositRevenue: number; // from forfeited deposits
  totalDepositsRefunded: number;

  // Customer Breakdown
  tier1Customers: number; // warning
  tier2Customers: number; // caution
  tier3Customers: number; // deposit required
  tier4Customers: number; // suspended

  // Trends
  noShowTrend: 'increasing' | 'decreasing' | 'stable';
  mostProblematicTimeSlots: TimeSlot[];
  mostProblematicServices: Service[];

  // Success Metrics
  customersRestored: number; // moved back to lower tier
  disputesReceived: number;
  disputesApproved: number;
  disputesRejected: number;
}
```

### **Admin Dashboard Metrics:**
```typescript
interface PlatformNoShowAnalytics {
  // Platform-wide
  totalNoShows: number;
  platformNoShowRate: number;

  // By Shop Tier
  standardShopsNoShowRate: number;
  premiumShopsNoShowRate: number;
  eliteShopsNoShowRate: number;

  // Policy Effectiveness
  averageDepositCollected: number;
  averageDepositsRefunded: number;
  suspensionRate: number;
  restorationRate: number; // customers who improved

  // Dispute Insights
  totalDisputes: number;
  averageDisputeResolutionTime: number; // hours
  disputeApprovalRate: number; // percentage
}
```

---

## 💾 Database Schema Changes

### **1. Add to `customers` table:**
```sql
ALTER TABLE customers
  ADD COLUMN no_show_count INTEGER DEFAULT 0,
  ADD COLUMN no_show_tier VARCHAR(20) DEFAULT 'normal',
  ADD COLUMN deposit_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN last_no_show_at TIMESTAMP,
  ADD COLUMN booking_suspended_until TIMESTAMP,
  ADD COLUMN successful_appointments_since_tier3 INTEGER DEFAULT 0;

-- Index for performance
CREATE INDEX idx_customers_no_show_tier ON customers(no_show_tier);
CREATE INDEX idx_customers_suspended ON customers(booking_suspended_until)
  WHERE booking_suspended_until IS NOT NULL;

-- Check constraint for tier values
ALTER TABLE customers
  ADD CONSTRAINT chk_no_show_tier
  CHECK (no_show_tier IN ('normal', 'warning', 'caution', 'deposit_required', 'suspended'));
```

### **2. Create `no_show_history` table:**
```sql
CREATE TABLE no_show_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_address VARCHAR(42) NOT NULL,
  order_id UUID NOT NULL,
  service_id UUID NOT NULL,
  shop_id VARCHAR(255) NOT NULL,

  -- Appointment Details
  scheduled_time TIMESTAMP NOT NULL,
  marked_no_show_at TIMESTAMP NOT NULL DEFAULT NOW(),
  marked_by VARCHAR(42), -- shop admin address

  -- Context
  notes TEXT,
  grace_period_minutes INTEGER DEFAULT 15,
  customer_tier_at_time VARCHAR(20),

  -- Status
  disputed BOOLEAN DEFAULT FALSE,
  dispute_status VARCHAR(20), -- 'pending', 'approved', 'rejected'
  dispute_resolved_at TIMESTAMP,
  dispute_notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (customer_address) REFERENCES customers(address),
  FOREIGN KEY (order_id) REFERENCES service_orders(id),
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- Indexes
CREATE INDEX idx_no_show_history_customer ON no_show_history(customer_address, marked_no_show_at DESC);
CREATE INDEX idx_no_show_history_shop ON no_show_history(shop_id, marked_no_show_at DESC);
CREATE INDEX idx_no_show_history_disputed ON no_show_history(disputed, dispute_status);
```

### **3. Create `shop_no_show_policy` table:**
```sql
CREATE TABLE shop_no_show_policy (
  shop_id VARCHAR(255) PRIMARY KEY,

  -- Basic Settings
  enabled BOOLEAN DEFAULT TRUE,
  grace_period_minutes INTEGER DEFAULT 15,
  minimum_cancellation_hours INTEGER DEFAULT 4,
  auto_detection_enabled BOOLEAN DEFAULT FALSE,
  auto_detection_delay_hours INTEGER DEFAULT 2,

  -- Penalty Tiers
  caution_threshold INTEGER DEFAULT 2,
  caution_advance_booking_hours INTEGER DEFAULT 24,
  deposit_threshold INTEGER DEFAULT 3,
  deposit_amount DECIMAL(10,2) DEFAULT 25.00,
  deposit_advance_booking_hours INTEGER DEFAULT 48,
  deposit_reset_after_successful INTEGER DEFAULT 3,
  max_rcn_redemption_percent INTEGER DEFAULT 80,
  suspension_threshold INTEGER DEFAULT 5,
  suspension_duration_days INTEGER DEFAULT 30,

  -- Notifications
  send_email_tier1 BOOLEAN DEFAULT TRUE,
  send_email_tier2 BOOLEAN DEFAULT TRUE,
  send_email_tier3 BOOLEAN DEFAULT TRUE,
  send_email_tier4 BOOLEAN DEFAULT TRUE,
  send_sms_tier2 BOOLEAN DEFAULT FALSE,
  send_sms_tier3 BOOLEAN DEFAULT TRUE,
  send_sms_tier4 BOOLEAN DEFAULT TRUE,
  send_push_notifications BOOLEAN DEFAULT TRUE,

  -- Disputes
  allow_disputes BOOLEAN DEFAULT TRUE,
  dispute_window_days INTEGER DEFAULT 7,
  auto_approve_first_offense BOOLEAN DEFAULT TRUE,
  require_shop_review BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (shop_id) REFERENCES shops(id)
);
```

### **4. Create `deposit_transactions` table:**
```sql
CREATE TABLE deposit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  customer_address VARCHAR(42) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,

  -- Deposit Details
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'held', 'refunded', 'forfeited'

  -- Stripe Details
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  stripe_refund_id VARCHAR(255),

  -- Timestamps
  charged_at TIMESTAMP NOT NULL DEFAULT NOW(),
  refunded_at TIMESTAMP,
  forfeited_at TIMESTAMP,

  -- Metadata
  reason TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (order_id) REFERENCES service_orders(id),
  FOREIGN KEY (customer_address) REFERENCES customers(address),
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- Indexes
CREATE INDEX idx_deposit_transactions_customer ON deposit_transactions(customer_address, created_at DESC);
CREATE INDEX idx_deposit_transactions_shop ON deposit_transactions(shop_id, created_at DESC);
CREATE INDEX idx_deposit_transactions_status ON deposit_transactions(status);
```

---

## 🚀 Implementation Phases

### **Phase 1: Core Tracking (2-3 hours)**
- [x] Database migrations (all 4 tables)
- [x] Customer counter increment on no-show
- [x] Tier assignment logic
- [x] Basic tier display in customer profile

### **Phase 2: Warning System (2-3 hours)**
- [x] Email templates for Tier 1-4
- [x] Automated email sending
- [x] In-app notification integration
- [x] Dashboard banners (Tier 2, 3, 4)

### **Phase 3: Booking Restrictions (3-4 hours)**
- [x] Tier 2: 24-hour advance booking enforcement
- [x] Tier 3: Deposit requirement in checkout
- [x] Tier 3: 48-hour advance booking enforcement
- [x] Tier 4: Booking suspension enforcement
- [x] Calendar UI updates to show restrictions

### **Phase 4: Deposit System (4-5 hours)**
- [x] Stripe deposit payment integration
- [x] Automatic refund after successful appointment
- [x] Forfeit deposit on no-show
- [x] Deposit transaction tracking
- [x] Tier reset after X successful appointments

### **Phase 5: Dispute System (3-4 hours)**
- [x] Dispute form UI
- [x] Shop review interface
- [x] Admin escalation interface
- [x] Automatic approvals
- [x] Email notifications for disputes

### **Phase 6: Analytics & Polish (2-3 hours)**
- [x] Shop analytics dashboard
- [x] Admin analytics dashboard
- [x] Policy configuration UI
- [x] Documentation

**Total Estimated Time: 16-22 hours**

---

## 🎨 UI/UX Mockups

### **Customer Dashboard - Tier 2 Banner:**
```
╔════════════════════════════════════════════════════════════════╗
║ ⚠️  CAUTION: 2 No-Shows on Record                              ║
║                                                                ║
║ One more no-show will require a $25 deposit for bookings.    ║
║ Please cancel at least 4 hours in advance.                   ║
║                                                                ║
║ [View No-Show Policy]  [Dispute a No-Show]                   ║
╚════════════════════════════════════════════════════════════════╝
```

### **Customer Dashboard - Tier 3 Banner:**
```
╔════════════════════════════════════════════════════════════════╗
║ 🔴  DEPOSIT REQUIRED: 3 No-Shows on Record                     ║
║                                                                ║
║ A $25 refundable deposit is now required for all bookings.   ║
║ Show up to 3 appointments to restore normal booking.         ║
║                                                                ║
║ Current Status: 0/3 successful appointments                  ║
║                                                                ║
║ [Learn More]  [View No-Show History]  [Dispute a No-Show]   ║
╚════════════════════════════════════════════════════════════════╝
```

### **Checkout Modal - Deposit Required:**
```
╔════════════════════════════════════════════════════════════════╗
║                    Complete Your Booking                       ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║ Service: iPhone Screen Repair                                 ║
║ Date: Feb 15, 2026 at 2:00 PM                                ║
║                                                                ║
║ ─────────────────────────────────────────────────────────────  ║
║                                                                ║
║ Service Fee:              $89.00                              ║
║ RCN Redemption:          -$10.00                              ║
║ 💳 Refundable Deposit:    $25.00  ℹ️                          ║
║ ─────────────────────────────────────────────────────────────  ║
║ Total Due Today:          $104.00                             ║
║                                                                ║
║ ℹ️ Why am I paying a deposit?                                 ║
║    You have 3 no-shows on record. The $25 deposit will be    ║
║    refunded within 24 hours if you attend your appointment.  ║
║                                                                ║
║ [Cancel]                              [Pay & Book]            ║
╚════════════════════════════════════════════════════════════════╝
```

---

## 📝 Key Design Decisions

### **Why Progressive Penalties?**
- Gives customers chance to improve
- Not everyone who misses once is a bad actor
- Escalation shows fairness
- Deposit is last resort, not first

### **Why $25 Deposit?**
- High enough to deter no-shows
- Low enough to not exclude lower-income customers
- Refundable keeps it fair
- Industry standard for appointment deposits

### **Why 3 Successful Appointments to Reset?**
- Proves consistent good behavior
- Not too long (6 would be excessive)
- Not too short (1 could be lucky)
- Common practice in credit repair systems

### **Why Allow Disputes?**
- Mistakes happen (system errors, emergencies)
- Builds customer trust
- Shop can still reject frivolous disputes
- Admin escalation provides final fairness check

### **Why Shop-Configurable?**
- Different businesses have different needs
- Luxury services may want stricter policies
- Quick repair shops may be more lenient
- Gives shops control while providing good defaults

---

## ✅ Success Metrics

After implementing this system, we should see:

### **For Shops:**
- 📉 20-40% reduction in no-show rate
- 💰 Revenue recovery from forfeited deposits
- ⏰ Better time slot utilization
- 😊 Improved customer quality over time

### **For Customers:**
- 🎯 Clear expectations and fair warnings
- 💡 Behavior improvement through education
- 🛡️ Dispute mechanism for fairness
- 📊 Transparency in tracking

### **For Platform:**
- 📈 Increased booking completion rate
- 💼 Higher merchant satisfaction
- ⚖️ Fair and consistent policy enforcement
- 🏆 Industry-leading no-show management

---

**Ready to implement?** Let me know if you'd like me to start with Phase 1!

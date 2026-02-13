# No-Show Penalty System - Complete Flow Diagram

**Last Updated:** February 11, 2026

---

## 📊 Customer Journey Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TIER 0: NORMAL (NEW CUSTOMER)                   │
│                                                                          │
│  No-Show Count: 0                                                        │
│  Status: ✅ Good Standing                                               │
│  Restrictions: None                                                      │
│  Can Book: ✅ Yes, anytime                                              │
│  RCN Redemption: 100% at earning shop, 20% elsewhere                    │
│  Deposit: Not required                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ ❌ 1st No-Show
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      TIER 1: WARNING (FIRST OFFENSE)                     │
│                                                                          │
│  No-Show Count: 1                                                        │
│  Status: ⚠️ Warning                                                     │
│  Restrictions: None                                                      │
│  Can Book: ✅ Yes, anytime                                              │
│  RCN Redemption: 100% at earning shop, 20% elsewhere                    │
│  Deposit: Not required                                                   │
│                                                                          │
│  📧 Email Sent: "Friendly Reminder" (Educational tone)                  │
│  📱 In-App Notification: Warning issued                                 │
│                                                                          │
│  Recovery: Auto-recovery over time (future implementation)              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ ❌ 2nd No-Show
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                   TIER 2: CAUTION (SECOND OFFENSE)                       │
│                                                                          │
│  No-Show Count: 2                                                        │
│  Status: 🟠 Caution - Account Restricted                                │
│  Restrictions:                                                           │
│    • Must book at least 24 hours in advance                             │
│    • Limited to 80% RCN redemption per booking                          │
│  Can Book: ✅ Yes (with advance notice)                                 │
│  RCN Redemption: Max 80% per booking                                    │
│  Deposit: Not required                                                   │
│                                                                          │
│  📧 Email Sent: "Account Restriction Notice"                            │
│  📱 In-App Notification: Restrictions applied                           │
│  🚨 Dashboard Banner: Warning banner displayed                          │
│                                                                          │
│  Recovery: Auto-recovery over time (future implementation)              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ ❌ 3rd No-Show
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                TIER 3: DEPOSIT REQUIRED (THIRD OFFENSE)                  │
│                                                                          │
│  No-Show Count: 3-4                                                      │
│  Status: 🔴 Deposit Required - Severe Restriction                       │
│  Restrictions:                                                           │
│    • $25 refundable deposit required for ALL bookings                   │
│    • Must book at least 48 hours in advance                             │
│    • Limited to 80% RCN redemption per booking                          │
│  Can Book: ✅ Yes (with deposit + advance notice)                       │
│  RCN Redemption: Max 80% per booking                                    │
│  Deposit: 💰 $25 USD (refunded if customer shows up)                    │
│                                                                          │
│  📧 Email Sent: "Deposit Required Notice" (critical alert)              │
│  📱 In-App Notification: Deposit requirement active                     │
│  🚨 Dashboard Banner: Red banner with deposit info                      │
│  💳 Booking Flow: Deposit payment modal appears before booking          │
│                                                                          │
│  Recovery Path:                                                          │
│  ✅ Complete 3 successful appointments (show up on time)                │
│     → Progress tracked in successful_appointments_since_tier3           │
│     → After 3rd successful appointment: Auto-downgrade to Tier 2        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ ❌ 4th or 5th No-Show
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                 TIER 4: SUSPENDED (FIFTH OFFENSE)                        │
│                                                                          │
│  No-Show Count: 5+                                                       │
│  Status: ⛔ SUSPENDED - Booking Banned                                  │
│  Restrictions:                                                           │
│    • Booking privileges suspended for 30 days                           │
│    • Cannot make any new bookings                                       │
│  Can Book: ❌ NO - Account suspended                                    │
│  RCN Redemption: N/A (cannot book)                                      │
│  Deposit: N/A (cannot book)                                             │
│  Suspension End Date: booking_suspended_until (30 days from last)       │
│                                                                          │
│  📧 Email Sent: "Account Suspended" (30-day ban details)                │
│  📱 In-App Notification: Suspension notice                              │
│  🚨 Dashboard Banner: Red banner - "Account Suspended Until [DATE]"     │
│  🚫 Booking Flow: All booking buttons disabled                          │
│                                                                          │
│  Recovery Path:                                                          │
│  ⏰ Wait 30 days → Suspension expires automatically                      │
│     → Auto-downgrade to Tier 3 (Deposit Required)                       │
│     → Must follow Tier 3 rules to continue recovery                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Recovery Flow (Bottom to Top)

```
TIER 4: SUSPENDED (5+ no-shows)
    │
    │ ⏰ TIME: Wait 30 days
    │    - System checks: bookingSuspendedUntil < current_date
    │    - Automatic: No manual action needed
    │    - canBook changes from false → true
    │
    ↓
TIER 3: DEPOSIT REQUIRED (Still 5+ no-shows in history)
    │
    │ ✅ SUCCESS: Complete 3 successful appointments
    │    - After each completed order: successful_appointments_since_tier3++
    │    - Progress: 1/3... 2/3... 3/3 ✓
    │    - Automatic trigger: checkTierReset() downgrades to Tier 2
    │    - deposit_required = false
    │
    ↓
TIER 2: CAUTION (Still 5+ no-shows in history)
    │
    │ ⏰ TIME: Auto-recovery over time (future implementation)
    │    - OR: Dispute system (if wrongly marked)
    │    - OR: Manual admin override
    │
    ↓
TIER 1: WARNING (Still 5+ no-shows in history)
    │
    │ ⏰ TIME: Auto-recovery over time (future implementation)
    │
    ↓
TIER 0: NORMAL (Fully restored)
```

---

## 🎯 Key Trigger Events

### Downward Triggers (Penalties)

| Event | Trigger | Database Action | System Response |
|-------|---------|----------------|-----------------|
| **1st No-Show** | Shop marks order as no-show | `no_show_count = 1`<br>`no_show_tier = 'warning'` | • Email: Friendly warning<br>• In-app notification<br>• History record created |
| **2nd No-Show** | Shop marks order as no-show | `no_show_count = 2`<br>`no_show_tier = 'caution'` | • Email: Restriction notice<br>• Dashboard banner appears<br>• 24hr booking rule enforced |
| **3rd No-Show** | Shop marks order as no-show | `no_show_count = 3`<br>`no_show_tier = 'deposit_required'`<br>`deposit_required = true` | • Email: Deposit requirement<br>• $25 deposit modal in booking flow<br>• 48hr booking rule enforced<br>• 80% RCN cap enforced |
| **5th No-Show** | Shop marks order as no-show | `no_show_count = 5`<br>`no_show_tier = 'suspended'`<br>`booking_suspended_until = NOW() + 30 days` | • Email: Suspension notice<br>• All booking buttons disabled<br>• Suspension countdown starts |

### Upward Triggers (Recovery)

| Event | Condition Check | Database Action | System Response |
|-------|----------------|-----------------|-----------------|
| **Suspension Expires** | `bookingSuspendedUntil < NOW()` | `canBook = true` (tier stays 'suspended' until reset) | • Customer can book again<br>• Still requires Tier 3 restrictions |
| **Successful Appointment** | Order status = 'completed'<br>Customer at Tier 3 | `successful_appointments_since_tier3++` | • Progress counter increments<br>• Dashboard shows progress |
| **Tier 3 → Tier 2 Reset** | `successful_appointments_since_tier3 >= 3` | `no_show_tier = 'caution'`<br>`deposit_required = false`<br>`successful_appointments_since_tier3 = 0` | • Deposit requirement removed<br>• 24hr booking rule remains<br>• Email: Congratulations |

---

## 📧 Email Notification Flow

```
┌────────────────┐
│  No-Show       │
│  Marked by     │
│  Shop          │
└────────┬───────┘
         │
         ↓
┌────────────────────────────────────────────┐
│  OrderController.markNoShow()              │
│  • Records history                         │
│  • Increments no_show_count               │
│  • Database trigger updates tier          │
└────────┬───────────────────────────────────┘
         │
         ↓
┌────────────────────────────────────────────┐
│  NoShowPolicyService.recordNoShowHistory() │
│  • Inserts into no_show_history           │
│  • Trigger calculates new tier            │
└────────┬───────────────────────────────────┘
         │
         ↓
┌────────────────────────────────────────────┐
│  Get Updated Customer Status               │
│  • Fetch new tier from database           │
│  • Get shop policy settings               │
└────────┬───────────────────────────────────┘
         │
         ├─────── Tier 1 (Warning) ────────┐
         │                                  │
         │                                  ↓
         │                    ┌─────────────────────────┐
         │                    │ EmailService            │
         │                    │ .sendNoShowTier1Warning │
         │                    │                         │
         │                    │ Subject: Important      │
         │                    │ Reminder About Your     │
         │                    │ Missed Appointment      │
         │                    │                         │
         │                    │ Tone: Educational,      │
         │                    │ friendly reminder       │
         │                    └─────────────────────────┘
         │
         ├─────── Tier 2 (Caution) ─────────┐
         │                                   │
         │                                   ↓
         │                    ┌─────────────────────────┐
         │                    │ EmailService            │
         │                    │ .sendNoShowTier2Caution │
         │                    │                         │
         │                    │ Subject: Account        │
         │                    │ Restrictions Applied    │
         │                    │                         │
         │                    │ Content:                │
         │                    │ • 24hr booking rule     │
         │                    │ • How to avoid Tier 3   │
         │                    └─────────────────────────┘
         │
         ├─────── Tier 3 (Deposit) ─────────┐
         │                                   │
         │                                   ↓
         │                    ┌─────────────────────────────┐
         │                    │ EmailService                │
         │                    │ .sendNoShowTier3Deposit     │
         │                    │ Required                    │
         │                    │                             │
         │                    │ Subject: Deposit Required   │
         │                    │ for Future Bookings         │
         │                    │                             │
         │                    │ Content:                    │
         │                    │ • $25 refundable deposit    │
         │                    │ • 48hr booking rule         │
         │                    │ • 80% RCN limit             │
         │                    │ • How to restore (3 appts)  │
         │                    └─────────────────────────────┘
         │
         └─────── Tier 4 (Suspended) ───────┐
                                             │
                                             ↓
                              ┌────────────────────────────┐
                              │ EmailService               │
                              │ .sendNoShowTier4Suspended  │
                              │                            │
                              │ Subject: Account Suspended │
                              │ - 30 Day Booking Ban       │
                              │                            │
                              │ Content:                   │
                              │ • 30-day suspension        │
                              │ • Exact end date           │
                              │ • After suspension rules   │
                              │ • How to rebuild trust     │
                              └────────────────────────────┘
```

---

## 🎬 Complete User Journey Examples

### Example 1: Perfect Customer (Never Escalates)

```
Day 1:  Customer books appointment ✅
Day 2:  Customer shows up on time ✅
        → Stays at Tier 0 (Normal)
        → No restrictions
        → Full RCN redemption
```

---

### Example 2: One-Time Offender (Tier 1 → Recovery)

```
Week 1: Customer books appointment
        Customer no-shows ❌
        → System: no_show_count = 1, tier = 'warning'
        → Email: Friendly reminder sent
        → Customer can still book normally

Week 2: Customer books again
        Customer shows up ✅
        → Stays at Tier 1 (Warning)

Week 4: (Future implementation)
        → Auto-recovery to Tier 0 (Normal)
```

---

### Example 3: Repeat Offender → Full Recovery

```
Month 1, Week 1:
  Appointment 1 → No-show ❌
  → Tier 1 (Warning)
  → Email: "Important reminder"
  → No restrictions yet

Month 1, Week 2:
  Appointment 2 → No-show ❌
  → Tier 2 (Caution)
  → Email: "Account restrictions applied"
  → Must book 24hr in advance
  → Dashboard banner appears

Month 1, Week 3:
  Appointment 3 → No-show ❌
  → Tier 3 (Deposit Required)
  → Email: "Deposit required"
  → Must pay $25 deposit for ALL future bookings
  → Must book 48hr in advance
  → Max 80% RCN redemption

Month 1, Week 4:
  Appointment 4 → No-show ❌
  → Still Tier 3 (no_show_count = 4)

Month 2, Week 1:
  Appointment 5 → No-show ❌
  → Tier 4 (SUSPENDED)
  → Email: "Account suspended for 30 days"
  → booking_suspended_until = 30 days from now
  → All booking buttons disabled
  → Red banner: "Suspended until March 15, 2026"

Month 2, Weeks 2-5:
  → Customer cannot book (suspension active)
  → Dashboard shows countdown

Month 3, Week 1: (Day 31)
  → Suspension expires automatically
  → canBook = true
  → Customer returns at Tier 3 (Deposit Required)
  → Must pay $25 deposit to book

Month 3, Week 2:
  Appointment 6 → Books with $25 deposit
  Appointment 6 → Shows up! ✅
  → System: successful_appointments_since_tier3 = 1/3
  → Deposit refunded immediately
  → Dashboard shows progress: "2 more successful appointments to restore account"

Month 3, Week 3:
  Appointment 7 → Books with $25 deposit
  Appointment 7 → Shows up! ✅
  → System: successful_appointments_since_tier3 = 2/3
  → Deposit refunded
  → Dashboard: "1 more successful appointment to restore account"

Month 3, Week 4:
  Appointment 8 → Books with $25 deposit
  Appointment 8 → Shows up! ✅
  → System: successful_appointments_since_tier3 = 3/3
  → Deposit refunded
  → AUTO-DOWNGRADE TRIGGERED ⚡
  → Tier 3 → Tier 2 (Caution)
  → deposit_required = false
  → Email: "Congratulations! Deposit no longer required"
  → Dashboard banner: Green success message

Month 4:
  → Customer at Tier 2 (Caution)
  → Must book 24hr in advance (no deposit)
  → 80% RCN redemption limit

Month 5-6: (Future implementation)
  → Consistent good behavior
  → Auto-recovery: Tier 2 → Tier 1 → Tier 0
  → Fully restored to normal standing
```

---

### Example 4: Disputed No-Show (Future Feature)

```
Day 1:  Customer books appointment for 2:00 PM
Day 2:  Customer arrives at 1:55 PM (5 min early) ✅
        BUT shop marks as no-show ❌ (mistake)
        → no_show_count = 1
        → Email sent

Day 3:  Customer disputes in dashboard
        → Opens dispute form
        → Provides reason: "I arrived 5 minutes early"
        → Status: dispute_status = 'pending'

Day 4:  Shop reviews dispute
        → Shop admits error
        → Approves dispute
        → Status: dispute_status = 'approved'
        → System reverses no-show:
          • no_show_count = 0
          • no_show_tier = 'normal'
          • History record marked as disputed
        → Customer notified: "Dispute approved"
```

---

## 🛠️ Technical Flow (Behind the Scenes)

### No-Show Recording Flow

```
1. Shop Dashboard → Click "Mark as No-Show" button
   ↓
2. MarkNoShowModal → Enter notes (optional)
   ↓
3. POST /api/services/orders/:id/mark-no-show
   ↓
4. OrderController.markNoShow()
   ├─→ Validate: Order exists, status = 'paid'
   ├─→ Validate: User is shop owner
   ├─→ Update order: status = 'no_show', no_show = true
   ├─→ Call: NoShowPolicyService.recordNoShowHistory()
   │   ├─→ Insert into no_show_history table
   │   │   ↓
   │   │   DATABASE TRIGGER FIRES ⚡
   │   │   ├─→ Increment customers.no_show_count
   │   │   ├─→ Calculate new tier based on count:
   │   │   │   • 1 = 'warning'
   │   │   │   • 2 = 'caution'
   │   │   │   • 3-4 = 'deposit_required'
   │   │   │   • 5+ = 'suspended'
   │   │   ├─→ Update customers.no_show_tier
   │   │   ├─→ Set customers.last_no_show_at = NOW()
   │   │   ├─→ If tier 3: deposit_required = true
   │   │   ├─→ If tier 4: booking_suspended_until = NOW() + 30 days
   │   ↓
   ├─→ Get updated customer status
   ├─→ Send in-app notification (NotificationService)
   ├─→ Send tier-appropriate email (EmailService)
   │   ├─→ Tier 1: sendNoShowTier1Warning()
   │   ├─→ Tier 2: sendNoShowTier2Caution()
   │   ├─→ Tier 3: sendNoShowTier3DepositRequired()
   │   └─→ Tier 4: sendNoShowTier4Suspended()
   ↓
5. Return updated customer status to frontend
   ↓
6. Shop Dashboard → Modal shows success
   Customer Dashboard → Notification appears
   Customer Email → Notification email arrives
```

### Booking Flow with Tier Checks

```
1. Customer clicks "Book Service"
   ↓
2. Frontend: Call GET /api/customers/:address/no-show-status?shopId=xxx
   ↓
3. Backend: NoShowPolicyService.getCustomerStatus()
   ├─→ Query customer tier from database
   ├─→ Check if suspended: bookingSuspendedUntil > NOW()
   ├─→ Calculate restrictions based on tier
   ├─→ Return: { tier, canBook, requiresDeposit, minimumAdvanceHours, restrictions }
   ↓
4. Frontend: Check response
   ├─→ If canBook = false (Tier 4 - Suspended)
   │   └─→ Show error modal: "Account suspended until [date]"
   │       └─→ Block booking completely
   │
   ├─→ If requiresDeposit = true (Tier 3)
   │   └─→ Open ServiceCheckoutModal
   │       ├─→ Show deposit warning: "$25 refundable deposit required"
   │       ├─→ Validate: Selected date/time >= 48 hours from now
   │       │   └─→ If too soon: Show error "Must book at least 48 hours in advance"
   │       ├─→ Show RCN redemption: Max 80%
   │       └─→ Proceed to Stripe payment (service + deposit)
   │
   ├─→ If tier = 'caution' (Tier 2)
   │   └─→ Open ServiceCheckoutModal
   │       ├─→ Show warning banner: "Must book 24 hours in advance"
   │       ├─→ Validate: Selected date/time >= 24 hours from now
   │       └─→ Show RCN redemption: Max 80%
   │
   └─→ If tier = 'normal' or 'warning' (Tier 0-1)
       └─→ Open ServiceCheckoutModal
           └─→ No restrictions
```

### Order Completion → Successful Appointment Recording

```
1. Customer shows up for appointment
   ↓
2. Shop clicks "Mark as Complete"
   ↓
3. POST /api/services/orders/:id/complete
   ↓
4. OrderController.markOrderComplete()
   ├─→ Update order: status = 'completed'
   ├─→ Check customer tier: Is it 'deposit_required'?
   │   ↓ YES
   │   └─→ Call: NoShowPolicyService.recordSuccessfulAppointment()
   │       ├─→ Increment: successful_appointments_since_tier3++
   │       ├─→ Call: checkTierReset()
   │       │   └─→ Check: successful_appointments_since_tier3 >= 3?
   │       │       ↓ YES
   │       │       └─→ AUTO-DOWNGRADE ⚡
   │       │           ├─→ no_show_tier = 'caution'
   │       │           ├─→ deposit_required = false
   │       │           ├─→ successful_appointments_since_tier3 = 0
   │       │           └─→ Send email: "Congratulations! Account restored"
   │       │
   │       └─→ If deposit was collected:
   │           └─→ Trigger Stripe refund
   │               └─→ Update deposit_transactions: status = 'refunded'
   ↓
5. Return success to frontend
```

---

## 📊 Database State Transitions

### customers Table Changes

```sql
-- Starting state: Normal customer
no_show_count: 0
no_show_tier: 'normal'
deposit_required: false
last_no_show_at: NULL
booking_suspended_until: NULL
successful_appointments_since_tier3: 0

-- After 1st no-show
no_show_count: 1
no_show_tier: 'warning'
deposit_required: false
last_no_show_at: '2026-02-11 14:30:00'
booking_suspended_until: NULL
successful_appointments_since_tier3: 0

-- After 2nd no-show
no_show_count: 2
no_show_tier: 'caution'
deposit_required: false
last_no_show_at: '2026-02-15 10:00:00'
booking_suspended_until: NULL
successful_appointments_since_tier3: 0

-- After 3rd no-show
no_show_count: 3
no_show_tier: 'deposit_required'
deposit_required: true ← Changed
last_no_show_at: '2026-02-20 16:45:00'
booking_suspended_until: NULL
successful_appointments_since_tier3: 0

-- After 5th no-show
no_show_count: 5
no_show_tier: 'suspended'
deposit_required: true
last_no_show_at: '2026-02-28 11:20:00'
booking_suspended_until: '2026-03-30 11:20:00' ← Changed (30 days)
successful_appointments_since_tier3: 0

-- After suspension expires (Day 31)
no_show_count: 5
no_show_tier: 'suspended' (still, until successful appointments)
deposit_required: true
last_no_show_at: '2026-02-28 11:20:00'
booking_suspended_until: '2026-03-30 11:20:00' ← Past date, so canBook = true
successful_appointments_since_tier3: 0

-- After 1st successful appointment at Tier 3
no_show_count: 5
no_show_tier: 'suspended'
deposit_required: true
last_no_show_at: '2026-02-28 11:20:00'
booking_suspended_until: '2026-03-30 11:20:00'
successful_appointments_since_tier3: 1 ← Incremented

-- After 3rd successful appointment
no_show_count: 5
no_show_tier: 'caution' ← AUTO-DOWNGRADED
deposit_required: false ← Changed
last_no_show_at: '2026-02-28 11:20:00'
booking_suspended_until: '2026-03-30 11:20:00'
successful_appointments_since_tier3: 0 ← Reset
```

---

## 🎯 Summary

### Penalty Escalation (Fast)
- **1 no-show** → Tier 1 (Warning) - Instant
- **2 no-shows** → Tier 2 (Caution) - Instant
- **3 no-shows** → Tier 3 (Deposit) - Instant
- **5 no-shows** → Tier 4 (Suspended) - Instant

### Recovery Path (Gradual)
- **Tier 4 → Tier 3**: 30 days waiting period
- **Tier 3 → Tier 2**: 3 successful appointments
- **Tier 2 → Tier 1**: Auto over time (future)
- **Tier 1 → Tier 0**: Auto over time (future)

### Key Principles
✅ **Automatic** - No manual intervention needed
✅ **Fair** - Deposits are refundable, not punitive
✅ **Progressive** - Warnings before severe penalties
✅ **Recoverable** - Always a path back to good standing
✅ **Transparent** - Customers see their status and restrictions
✅ **Educational** - Email tone teaches better behavior

---

**File:** `/docs/features/NO_SHOW_PENALTY_FLOW.md`
**Version:** 1.0
**Last Updated:** February 11, 2026

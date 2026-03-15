# Strategy: Shop Scheduled Auto-Messages

## Owner Request

> "Let's have auto responses... so to send a message every 24hr, every month, so on... in-app."

## Prerequisites

- **Quick Replies (Feature A)** — ✅ Completed. See `docs/tasks/strategy/quick-replies-edit-feature.md`

## Overview

Shops configure automated in-app messages sent to customers on a recurring schedule (e.g., every 24 hours, weekly, monthly). Use cases:

- Follow-up after a completed booking ("How was your service?")
- Re-engagement for inactive customers ("We miss you! Book again for 10% off")
- Loyalty reminders ("You have 50 RCN — redeem for $5 off!")
- Monthly promotions ("This month's special: 20% off brake service")

---

## Implementation

### Concept

Shops create "auto-message rules" that automatically send in-app messages to customers matching certain criteria on a recurring schedule.

```
Example rule:
  Name: "Post-Service Follow-Up"
  Message: "Hi {customerName}! How was your recent service? Leave a review and earn 5 bonus RCN!"
  Trigger: After booking completed
  Delay: 24 hours after completion
  Frequency: Once per booking
  Target: Customer who completed the booking
```

```
Example rule:
  Name: "Monthly Loyalty Reminder"
  Message: "You have {rcnBalance} RCN available! Visit us to redeem for discounts."
  Schedule: 1st of every month
  Frequency: Monthly
  Target: All customers with RCN balance > 0 at this shop
```

### Database

New tables:

```sql
-- Auto-message rule configuration
CREATE TABLE shop_auto_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(100) NOT NULL REFERENCES shops(shop_id),
  name VARCHAR(200) NOT NULL,             -- "Post-Service Follow-Up"
  message_template TEXT NOT NULL,          -- "Hi {{customerName}}! ..."

  -- Trigger type
  trigger_type VARCHAR(50) NOT NULL,       -- 'schedule' | 'event'

  -- For schedule-based triggers
  schedule_type VARCHAR(20),               -- 'daily' | 'weekly' | 'monthly'
  schedule_day_of_week INTEGER,            -- 0-6 for weekly (0=Sunday)
  schedule_day_of_month INTEGER,           -- 1-31 for monthly
  schedule_hour INTEGER DEFAULT 10,        -- Hour to send (0-23, shop's local time)

  -- For event-based triggers
  event_type VARCHAR(50),                  -- 'booking_completed' | 'booking_cancelled' | 'first_visit' | 'inactive_30_days'
  delay_hours INTEGER DEFAULT 0,           -- Hours after event to send

  -- Targeting
  target_audience VARCHAR(50) DEFAULT 'all', -- 'all' | 'active' | 'inactive_30d' | 'has_balance' | 'completed_booking'

  -- Template variables supported: {{customerName}}, {{rcnBalance}}, {{shopName}}, {{lastServiceName}}, {{lastVisitDate}}

  is_active BOOLEAN DEFAULT true,
  max_sends_per_customer INTEGER DEFAULT 1, -- For event-based: max times to send per customer (null = unlimited for recurring)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track what's been sent to prevent duplicates
CREATE TABLE auto_message_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_message_id UUID NOT NULL REFERENCES shop_auto_messages(id),
  shop_id VARCHAR(100) NOT NULL,
  customer_address VARCHAR(255) NOT NULL,
  conversation_id VARCHAR(100),            -- The conversation the message was sent in
  message_id VARCHAR(100),                 -- The actual message ID
  trigger_reference VARCHAR(255),          -- For event-based: the order_id or event that triggered it
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auto_messages_shop ON shop_auto_messages(shop_id, is_active);
CREATE INDEX idx_auto_sends_lookup ON auto_message_sends(auto_message_id, customer_address);
CREATE INDEX idx_auto_sends_shop ON auto_message_sends(shop_id, sent_at);
```

### Backend Architecture

#### Scheduler Service — `AutoMessageSchedulerService.ts`

Reuse the `AppointmentReminderService` pattern (runs on a timer, queries for due messages, sends them, tracks what's been sent).

```
┌─────────────────────────────────────────────────────┐
│              AutoMessageSchedulerService             │
│                                                      │
│  Runs every 1 hour (via setInterval in app.ts)       │
│                                                      │
│  1. Query all active auto_messages                   │
│  2. For each rule:                                   │
│     a. Check if it's time to send (schedule match)   │
│     b. Find target customers                         │
│     c. Skip already-sent (check auto_message_sends)  │
│     d. Resolve template variables                    │
│     e. Send via MessageService.sendMessage()         │
│     f. Log to auto_message_sends                     │
│                                                      │
│  Uses existing:                                      │
│  - MessageRepository.getOrCreateConversation()       │
│  - MessageService.sendMessage()                      │
│  - CustomerRepository for audience targeting         │
└─────────────────────────────────────────────────────┘
```

#### Event-Based Triggers — EventBus Integration

For event-based auto-messages (e.g., "24h after booking completed"):

```typescript
// In AutoMessageSchedulerService constructor or init:
eventBus.subscribe("order:completed", async (data) => {
  // Find active event-based auto-messages for this shop
  // with event_type = 'booking_completed'
  // Schedule delayed send (delay_hours from rule config)
});
```

For delayed sends, either:

- **Option A**: Store a `scheduled_send_at` timestamp in `auto_message_sends` with status `pending`, and the hourly scheduler picks them up when due
- **Option B**: Use `setTimeout` (simpler but lost on server restart)

**Recommendation**: Option A — more reliable, survives restarts.

#### Template Variable Resolution

```typescript
function resolveTemplate(
  template: string,
  context: {
    customerName?: string;
    rcnBalance?: number;
    shopName?: string;
    lastServiceName?: string;
    lastVisitDate?: string;
  },
): string {
  return template
    .replace(/\{\{customerName\}\}/g, context.customerName || "Valued Customer")
    .replace(/\{\{rcnBalance\}\}/g, String(context.rcnBalance || 0))
    .replace(/\{\{shopName\}\}/g, context.shopName || "our shop")
    .replace(
      /\{\{lastServiceName\}\}/g,
      context.lastServiceName || "your last service",
    )
    .replace(/\{\{lastVisitDate\}\}/g, context.lastVisitDate || "recently");
}
```

#### API Endpoints

```
GET    /api/messages/auto-messages              — List shop's auto-message rules
POST   /api/messages/auto-messages              — Create new rule
PUT    /api/messages/auto-messages/:id          — Update rule
DELETE /api/messages/auto-messages/:id          — Delete rule
PATCH  /api/messages/auto-messages/:id/toggle   — Enable/disable rule
GET    /api/messages/auto-messages/:id/history  — View send history
```

### Frontend

#### Auto-Messages Management Page — `AutoMessagesManager.tsx`

A new section in the Messages tab (or a sub-tab) with:

**Rule List View:**

- Cards showing each auto-message rule
- Toggle switch to enable/disable
- Last sent date and total sends count
- Edit/delete buttons

**Create/Edit Rule Modal:**

- Name field
- Message template textarea with variable helper buttons (click to insert `{{customerName}}` etc.)
- Trigger type selector:
  - **Schedule**: Daily / Weekly (pick day) / Monthly (pick date) + time picker
  - **Event**: Booking completed / Booking cancelled / First visit / Inactive 30 days + delay hours
- Target audience dropdown: All customers / Active / Inactive 30d / Has RCN balance
- Preview section showing resolved template with sample data
- Max sends per customer (for event-based)

**Send History View:**

- Table of sent messages: customer, date, message preview, conversation link

### Files to Create/Modify

| File                                                                 | Action                                                         |
| -------------------------------------------------------------------- | -------------------------------------------------------------- |
| `backend/migrations/XXX_create_auto_messages.sql`                    | **NEW** — Create tables                                        |
| `backend/src/repositories/AutoMessageRepository.ts`                  | **NEW** — CRUD + send tracking                                 |
| `backend/src/services/AutoMessageSchedulerService.ts`                | **NEW** — Scheduler (reuse AppointmentReminderService pattern) |
| `backend/src/domains/messaging/controllers/AutoMessageController.ts` | **NEW** — API handlers                                         |
| `backend/src/domains/messaging/routes.ts`                            | Add auto-message routes                                        |
| `backend/src/domains/messaging/index.ts`                             | Register EventBus subscriptions                                |
| `backend/src/app.ts`                                                 | Initialize AutoMessageSchedulerService                         |
| `frontend/src/services/api/messaging.ts`                             | Add auto-message API methods                                   |
| `frontend/src/components/messaging/AutoMessagesManager.tsx`          | **NEW** — Rule management UI                                   |
| `frontend/src/components/messaging/AutoMessageRuleModal.tsx`         | **NEW** — Create/edit modal                                    |
| `frontend/src/components/shop/tabs/MessagesTab.tsx`                  | Add "Auto-Messages" sub-tab                                    |

**Effort:** ~6-8 hours

---

## Recommended Execution Order

| Phase | Feature                                     | Effort     | Description                                           |
| ----- | ------------------------------------------- | ---------- | ----------------------------------------------------- |
| 1     | Scheduled Auto-Messages (schedule triggers) | ~4-5 hours | Table + scheduler + UI for daily/weekly/monthly rules |
| 2     | Event-Based Auto-Messages (event triggers)  | ~2-3 hours | EventBus integration + delayed sends                  |

## Edge Cases to Handle

- **Duplicate prevention**: `auto_message_sends` table tracks sent messages; scheduler checks before sending
- **Unsubscribed customers**: Respect blocked conversations — skip if `isBlocked = true`
- **Shop subscription expired**: Don't send auto-messages for inactive/expired shops
- **Rate limiting**: Max 50 auto-messages per shop per day to prevent spam
- **Template validation**: Ensure message_template is non-empty and under 2000 chars (existing message limit)
- **Timezone**: Use shop's configured timezone for schedule_hour (from `shop_availability` table)
- **Server restart**: Pending scheduled sends stored in DB, not in memory — survives restarts

## Testing Checklist

### Scheduled Auto-Messages

- [ ] Create daily/weekly/monthly rule
- [ ] Scheduler sends at correct time
- [ ] Template variables resolve correctly
- [ ] Duplicate sends prevented
- [ ] Blocked conversations skipped
- [ ] Toggle enable/disable works
- [ ] Send history tracks all sends
- [ ] Expired shop subscriptions skipped
- [ ] Message appears in customer's conversation

---
### Completed Tasks

All implementation tasks are complete:

1. ~~Frontend API client~~ — ✅ `frontend/src/services/api/messaging.ts` (types + 6 API methods)
2. ~~AutoMessagesManager.tsx~~ — ✅ Rule list UI with toggle, edit/delete, last sent, send count
3. ~~AutoMessageRuleModal.tsx~~ — ✅ Create/edit modal with trigger type selector, schedule config, audience dropdown, template variables, preview
4. ~~Wire into shop dashboard~~ — ✅ Messages item in ShopSidebar → MessagesTab → Auto-Messages sub-tab
5. ~~Event-based triggers (Phase 2)~~ — ✅ EventBus subscriptions for `service.order_completed` → `booking_completed` and `service.order_cancelled` → `booking_cancelled`, with delayed send support via pending DB records

### Pending: `first_visit` & `inactive_30_days` Event Sources

These event types are defined in the UI and supported by the auto-message rule engine, but **do not yet have EventBus triggers**. Implementation will be done after automated and manual testing of the current feature.

**`first_visit`** — ✅ Implemented. Detects when a customer completes their first-ever order at a shop:
- Where: Inside the existing `service.order_completed` handler in `MessagingDomain.setupEventSubscriptions()`
- Logic: After firing `booking_completed`, queries `service_orders` for completed count at that shop. If count === 1, also fires `handleEventTrigger('first_visit', ...)`
- Case-insensitive address comparison, wrapped in try/catch so failures don't block the main booking_completed flow

**`inactive_30_days`** — ✅ Implemented. Detects customers who haven't visited a shop in 30+ days:
- Where: `AutoMessageSchedulerService.processInactiveCustomers()`, called from within the hourly `processScheduledMessages()` run
- Logic: Queries all active `inactive_30_days` rules across shops, finds customers with last completed order 30+ days ago, sends auto-messages
- Dedup: Uses `hasSentWithinDays(ruleId, customer, 30)` — won't re-send to the same customer within 30 days
- Also respects `max_sends_per_customer`, blocked conversations, and inactive shop checks
- New repo methods: `getAllActiveEventRulesByType()`, `hasSentWithinDays()`

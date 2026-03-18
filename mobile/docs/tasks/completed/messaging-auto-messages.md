# Auto-Messages for Shop (Automated Messaging Rules)

## Overview
Allow shop owners to set up automated messaging rules that send messages to customers based on schedules or events.

## Backend Endpoints (Already Implemented)
- `GET /api/messages/auto-messages` - Get all auto-message rules
- `POST /api/messages/auto-messages` - Create new rule
- `PUT /api/messages/auto-messages/:id` - Update rule
- `DELETE /api/messages/auto-messages/:id` - Delete rule
- `PATCH /api/messages/auto-messages/:id/toggle` - Enable/disable rule
- `GET /api/messages/auto-messages/:id/history` - Get send history

## Rule Configuration Options
- **Trigger Type**: `schedule` or `event`
- **Schedule Types**: daily, weekly, monthly
- **Event Types**: booking_completed, booking_cancelled, first_visit, inactive_30_days
- **Target Audience**: all, active, inactive_30d, has_balance, completed_booking
- **Delay Hours**: Hours after event to send
- **Max Sends Per Customer**: Limit repeat sends

## Mobile Implementation Required

### 1. API Service Methods
Add to `message.services.ts`:
- `getAutoMessages()` - Fetch all rules
- `createAutoMessage(params)` - Create rule
- `updateAutoMessage(id, params)` - Update rule
- `deleteAutoMessage(id)` - Delete rule
- `toggleAutoMessage(id)` - Enable/disable
- `getAutoMessageHistory(id, page, limit)` - Get send history

### 2. Auto-Messages Management Screen
Create `feature/messages/screens/AutoMessagesScreen.tsx`:
- List all auto-message rules
- Toggle switch for enable/disable
- Status indicators (active, paused, scheduled)
- Add new rule button

### 3. Auto-Message Editor Screen
Create `feature/messages/screens/AutoMessageEditorScreen.tsx`:
- Rule name input
- Trigger type selector (schedule vs event)
- Schedule configuration (day, time)
- Event configuration (event type, delay)
- Target audience selector
- Message template editor with variables
- Max sends per customer input

### 4. Send History Modal
Create `feature/messages/components/AutoMessageHistoryModal.tsx`:
- List of sent messages with timestamps
- Customer names and delivery status
- Pagination

## UI Design
```
Auto-Messages List:
┌─────────────────────────────────────┐
│  Auto-Messages            [+ New]   │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ [●] Booking Confirmation   │    │
│  │ Trigger: booking_completed │    │
│  │ Sent: 156 times   [Toggle] │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ [○] Weekly Promo           │    │
│  │ Schedule: Every Monday 10AM│    │
│  │ Sent: 42 times    [Toggle] │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘

Editor Screen:
┌─────────────────────────────────────┐
│  ← Create Auto-Message              │
├─────────────────────────────────────┤
│  Rule Name: [                    ]  │
│                                     │
│  Trigger Type:                      │
│  [Schedule ▾]                       │
│                                     │
│  When: [Every Monday] at [10:00 AM] │
│                                     │
│  Target: [All Customers ▾]          │
│                                     │
│  Message:                           │
│  ┌─────────────────────────────┐    │
│  │ Hi {{customer_name}},      │    │
│  │ Check out our weekly...    │    │
│  └─────────────────────────────┘    │
│                                     │
│  Variables: {{customer_name}},      │
│  {{shop_name}}, {{balance}}         │
│                                     │
│  [Save Rule]                        │
└─────────────────────────────────────┘
```

## Effort Estimate
- API methods: 30 min
- Management screen: 1.5 hrs
- Editor screen: 1.5 hrs
- History modal: 30 min
- **Total: 3-4 hrs**

## Priority
LOW - Advanced feature for power users

## Status
**✅ Completed**
**Completed:** 2026-03-17

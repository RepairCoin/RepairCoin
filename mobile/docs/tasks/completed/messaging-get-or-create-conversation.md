# Get or Create Conversation (Shop Initiates Chat)

## Overview
Allow shop owners to initiate a conversation with a customer directly from the customer list or booking details, without waiting for the customer to message first.

## Backend Endpoint (Already Implemented)
- `POST /api/messages/conversations/get-or-create`
  - Body: `{ customerAddress: string }`
  - Returns existing conversation or creates new one

## Mobile Implementation Required

### 1. API Service Method
Add to `message.services.ts`:
```typescript
async getOrCreateConversation(customerAddress: string): Promise<Conversation>
```

### 2. Integration Points

#### A. Customer List Screen (Shop Dashboard)
Add "Message" button to each customer row:
- Tap to create/open conversation
- Navigate to ChatScreen

#### B. Booking Details Screen
Add "Message Customer" button:
- Creates conversation with booking customer
- Navigate to ChatScreen

#### C. Customer Details Modal
Add "Send Message" action:
- Creates conversation
- Navigate to ChatScreen

### 3. Flow
```
Shop taps "Message" on customer
        ↓
Call getOrCreateConversation(customerAddress)
        ↓
    Returns conversation
        ↓
Navigate to ChatScreen with conversationId
```

## UI Design
```
Customer List:
┌─────────────────────────────────────┐
│  John Doe                           │
│  Last visit: Mar 15    [💬 Message] │
├─────────────────────────────────────┤
│  Jane Smith                         │
│  Last visit: Mar 12    [💬 Message] │
└─────────────────────────────────────┘

Booking Details:
┌─────────────────────────────────────┐
│  Booking #1234                      │
│  Customer: John Doe                 │
│  Service: Oil Change                │
│                                     │
│  [💬 Message Customer]              │
└─────────────────────────────────────┘
```

## Effort Estimate
- API method: 10 min
- Customer list integration: 10 min
- Booking details integration: 10 min
- **Total: 30 min**

## Priority
LOW - Nice to have for shop convenience

## Status
**✅ Completed**
**Completed:** 2026-03-17

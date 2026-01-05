# Shop Bookings Management System Redesign

**Created:** 2025-01-05
**Updated:** 2025-01-05
**Branch:** feature/86d179hc1-Shop-&-Customer-Booking-Problem
**Status:** Ready for Implementation
**Scope:** Frontend Only (Mock Data)

---

## Feature Overview

A comprehensive redesign of the Shop Bookings page with a modern dashboard layout featuring:
- Stats cards for quick overview
- Split-panel layout (booking list + details)
- Three-tab booking details panel (Overview, Message, Timeline)
- New booking workflow with shop approval
- Unified messaging system (mock implementation)

---

## UI Components from Mockups

### 1. Dashboard Header Stats

| Stat | Icon | Color |
|------|------|-------|
| Pending Booking | Clock | Yellow |
| Paid | Checkmark | Yellow |
| Completed | Double-check | Yellow |
| Total Revenue | Dollar | Yellow |

### 2. Tabs Navigation
- **Bookings** (primary)
- **Messages** (with unread notification dot)

### 3. Filter Pills
- All (5)
- Pending (1)
- Paid (1)
- Completed (1)
- Cancelled (1)

### 4. Search Bar
- Search booking ID, Customer Name

### 5. Booking Card (Left Panel)
```
┌─────────────────────────────────────────────────┐
│ [Image]  iPhone Screen Repair                   │
│          John Doe • 0x3498...JAAA              │
│          ⏳ Waiting for Shop Approval  ✓ Paid  │
├─────────────────────────────────────────────────┤
│ Booked        Service Date    Time      Cost   │
│ Dec 18, 2025  Dec 18, 2025   11:00 AM  $150   │
├─────────────────────────────────────────────────┤
│ ●───●───○───○───○                              │
│ Requested→Paid→Approved→Scheduled→Completed    │
├─────────────────────────────────────────────────┤
│ ℹ️ The customer has requested this service...   │
├─────────────────────────────────────────────────┤
│ Booking ID: BK-9F21AB                          │
│           [Reschedule]  [✓ Approve]            │
└─────────────────────────────────────────────────┘
```

### 6. Booking Details Panel (Right Panel)

#### Header
- Booking ID: BK-9F21AB
- Status Badge: ⏳ Waiting for Shop Approval

#### Tabs: Overview | Message | Timeline

#### Overview Tab
```
┌─────────────────────────────────────────────────┐
│ [Image] iPhone Screen Repair                    │
│         Phone Repair • iPhone                   │
│         [Earns +25 RCN] [Running Promo +20 RCN]│
├─────────────────────────────────────────────────┤
│ 👤 Customer Details                             │
│ 👤 John Doe                    [GOLD]           │
│ 📍 Mission, Texas, USA                          │
│ 📞 555-5555-5555                                │
│ Wallet: 0x3a82322fbd79c86...  [Copy]           │
├─────────────────────────────────────────────────┤
│ 📅 Booking Details                              │
│ Date Booked    Service Date                     │
│ Dec 18, 2025   Dec 26, 2025                    │
│ Time           Amount                           │
│ 11:00 AM       $150.00                         │
├─────────────────────────────────────────────────┤
│ 💫 Payment and Rewards                          │
│ Method         Card ••••4242                   │
│ RCN Earned     +12 RCN                         │
│ RCN Promo      +20 RCN                         │
│ RCN Redeemed   +20 RCN                         │
├─────────────────────────────────────────────────┤
│ 📝 Internal Notes (from customer)              │
│ "I would like to request an add-on..."         │
└─────────────────────────────────────────────────┘
```

#### Message Tab
```
┌─────────────────────────────────────────────────┐
│ 💬 Unified Messages                             │
│ Last message: Dec 21, 2025 • 9:12 AM           │
│ ────────────────────────────────────────────── │
│ ℹ️ Channel-agnostic thread. FB/IG/WhatsApp...   │
├─────────────────────────────────────────────────┤
│ [Customer] Hi, I will be running late...       │
│            John Doe • Dec 26, 2025 • 📷        │
├─────────────────────────────────────────────────┤
│            [Shop] Hi John, Are you willing...  │
│                   Dec 26, 2025 • 07:32 AM      │
├─────────────────────────────────────────────────┤
│ [Customer] Thanks! Is the 2pm schedule open?   │
├─────────────────────────────────────────────────┤
│ 📋 Quick Replies                        [Edit] │
│ ┌───────────────────────────────────────────┐  │
│ │Your booking is now scheduled for Dec 26..│  │
│ ├───────────────────────────────────────────┤  │
│ │Quick reply 2                              │  │
│ ├───────────────────────────────────────────┤  │
│ │Quick reply 3                              │  │
│ └───────────────────────────────────────────┘  │
├─────────────────────────────────────────────────┤
│ [Message input...                     ] [Send] │
└─────────────────────────────────────────────────┘
```

#### Timeline Tab
```
┌─────────────────────────────────────────────────┐
│ 🗓️ Timeline                                     │
├─────────────────────────────────────────────────┤
│ ✓ Booking Submitted                            │
│   December 18, 2025 • 5:14 PM                  │
├─────────────────────────────────────────────────┤
│ ✓ Paid                                         │
│   December 18, 2025 • 5:15 PM                  │
│   Via Stripe (View Transaction)                │
├─────────────────────────────────────────────────┤
│ ● Approval                                     │
│   This booking is waiting for your approval.   │
│   Review details and respond to notify...      │
├─────────────────────────────────────────────────┤
│ ○ Scheduled                                    │
│   Service is scheduled — keep customer updated │
├─────────────────────────────────────────────────┤
│ ○ Completed                                    │
│   Service is done — receipts and RCN issued   │
└─────────────────────────────────────────────────┘
```

---

## New Status Workflow

```
REQUESTED → PAID → APPROVED → SCHEDULED → COMPLETED
     │        │        │          │           │
     │        │        │          │           └─ Service done, RCN issued
     │        │        │          └─ Shop confirmed time
     │        │        └─ Shop approved booking
     │        └─ Customer paid via Stripe
     └─ Customer submitted booking request
```

**New Statuses to Add:**
- `requested` - Initial state (was `pending`)
- `approved` - Shop approved (NEW)
- `scheduled` - Time confirmed (NEW)

---

## File Structure

```
frontend/src/components/shop/bookings/
├── BookingsTabV2.tsx           # Main container (replaces ShopServiceOrdersTab)
├── BookingStatsCards.tsx       # 4 stat cards header
├── BookingFilters.tsx          # Filter pills + search
├── BookingCard.tsx             # Left panel booking card
├── BookingDetailsPanel.tsx     # Right panel container
├── tabs/
│   ├── BookingOverviewTab.tsx  # Overview details
│   ├── BookingMessageTab.tsx   # Chat interface
│   └── BookingTimelineTab.tsx  # Timeline view
├── modals/
│   └── ApproveBookingModal.tsx # Approval confirmation
└── mockData.ts                 # Mock booking data
```

---

## Mock Data Structure

```typescript
interface MockBooking {
  bookingId: string;           // "BK-9F21AB"
  status: 'requested' | 'paid' | 'approved' | 'scheduled' | 'completed' | 'cancelled';

  // Service Info
  serviceName: string;
  serviceCategory: string;
  serviceSubcategory: string;
  serviceImageUrl: string;

  // Customer Info
  customerName: string;
  customerTier: 'bronze' | 'silver' | 'gold';
  customerAddress: string;     // wallet address
  customerPhone: string;
  customerLocation: string;

  // Booking Info
  bookedAt: string;           // when customer booked
  serviceDate: string;        // scheduled service date
  serviceTime: string;        // "11:00 AM"
  amount: number;             // $150.00

  // Payment & Rewards
  paymentMethod: string;      // "Card ••••4242"
  rcnEarned: number;
  rcnPromo: number;
  rcnRedeemed: number;

  // Customer Notes
  customerNotes?: string;

  // Messages
  messages: Message[];
  unreadCount: number;

  // Timeline Events
  timeline: TimelineEvent[];
}

interface Message {
  id: string;
  sender: 'customer' | 'shop';
  content: string;
  timestamp: string;
  channel?: 'instagram' | 'whatsapp' | 'sms' | 'facebook';
}

interface TimelineEvent {
  id: string;
  type: 'submitted' | 'paid' | 'approved' | 'scheduled' | 'completed';
  timestamp: string;
  description: string;
  metadata?: {
    paymentMethod?: string;
    transactionId?: string;
  };
}
```

---

## Implementation Plan

### Phase 1: Setup & Mock Data
- [ ] Create mock data file with 5 sample bookings
- [ ] Create TypeScript interfaces

### Phase 2: Main Components
- [ ] BookingsTabV2.tsx - Main container with state
- [ ] BookingStatsCards.tsx - 4 stat cards
- [ ] BookingFilters.tsx - Filter pills + search

### Phase 3: Booking Card
- [ ] BookingCard.tsx - Left panel card design
- [ ] Progress bar component
- [ ] Action buttons (Reschedule, Approve)

### Phase 4: Details Panel
- [ ] BookingDetailsPanel.tsx - Right panel container
- [ ] Tab navigation

### Phase 5: Tab Contents
- [ ] BookingOverviewTab.tsx - Customer details, booking info, rewards
- [ ] BookingMessageTab.tsx - Chat UI with quick replies
- [ ] BookingTimelineTab.tsx - Visual timeline

### Phase 6: Integration
- [ ] Replace `bookings` tab in ShopDashboardClient
- [ ] Test all interactions

---

## Design System

### Colors
- Background: `#0D0D0D`, `#1A1A1A`
- Border: `gray-800`
- Primary: `#FFCC00` (yellow)
- Status colors:
  - Pending/Requested: Yellow (`yellow-400`)
  - Paid: Green (`green-400`)
  - Approved: Blue (`blue-400`)
  - Completed: Green with checkmark
  - Cancelled: Gray

### Typography
- Headings: White, Bold
- Body: Gray-400
- Labels: Gray-500

### Spacing
- Card padding: `p-4` to `p-6`
- Section gaps: `gap-4` to `gap-6`
- Border radius: `rounded-xl`, `rounded-2xl`

---

## Quick Replies (Mock Data)

```typescript
const quickReplies = [
  "Your booking is now scheduled for {date} at {time}.",
  "Thank you for your patience. We're ready for your appointment!",
  "We need to reschedule your appointment. What times work for you?",
];
```

---

## Progress Tracking

### Phase 1: Setup & Mock Data
- [ ] Create `mockData.ts` with interfaces and sample data
- [ ] **Agent: refactoring-expert**

### Phase 2: Main Components (Parallel)
- [ ] BookingsTabV2.tsx
- [ ] BookingStatsCards.tsx
- [ ] BookingFilters.tsx
- [ ] **Agent: frontend-architect**

### Phase 3: Booking Card
- [ ] BookingCard.tsx with progress bar
- [ ] **Agent: frontend-architect**

### Phase 4: Details Panel
- [ ] BookingDetailsPanel.tsx
- [ ] **Agent: frontend-architect**

### Phase 5: Tab Contents (Parallel)
- [ ] BookingOverviewTab.tsx
- [ ] BookingMessageTab.tsx
- [ ] BookingTimelineTab.tsx
- [ ] **Agent: frontend-architect**

### Phase 6: Integration
- [ ] Update ShopDashboardClient.tsx
- [ ] Final testing

---

## Notes

- This is a **frontend-only** implementation with mock data
- No backend changes required at this stage
- The messaging system is mock/demo only (channel-agnostic note is informational)
- Quick replies are stored locally (no persistence)
- Future: Backend API integration can replace mock data

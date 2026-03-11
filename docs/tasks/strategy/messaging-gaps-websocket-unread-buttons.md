# Strategy: Booking Detail Panel Chat — Connect to Real Messaging with Rich Booking Cards

## Problem Statement

The "Message" tab on the booking details panel (`BookingsTabV2` → `BookingDetailsPanel` → `BookingMessageTab`) does NOT send real messages. It updates local React state only — customer never receives anything.

When connecting this to the real messaging system, messages should include **rich booking cards** (service name, cost, date/time, image) so the customer knows exactly which booking the shop is referencing — the same pattern already used on the customer side with `service_link` cards.

## Existing Pattern: Customer → Shop (Already Works)

The customer side already sends rich service cards via the "Message Shop" button in the Service Details modal:

**`ServiceDetailsModal.tsx` lines 64-78:**

```typescript
await messagingApi.sendMessage({
  customerAddress: address,
  shopId: service.shopId,
  messageText: `Hi! I'm interested in your service "${service.serviceName}".\n...`,
  messageType: "service_link",
  metadata: {
    serviceId: service.serviceId,
    serviceName: service.serviceName,
    serviceImage: service.imageUrl,
    servicePrice: service.priceUsd,
    serviceCategory: service.category,
    shopName: service.companyName,
  },
});
```

**`ConversationThread.tsx` lines 271-308** renders this as a rich card:

```
┌─────────────────────────────────┐
│  [Service Image - 32px height]  │
├─────────────────────────────────┤
│  Service Name (bold)            │
│  Category           $Price      │
└─────────────────────────────────┘
```

The **same pattern** needs to be replicated for shop → customer with booking details.

## What's Missing

1. **`booking_link` card renderer** — `ConversationThread.tsx` only renders `service_link` cards. No `booking_link` renderer exists yet, even though the DB supports the `booking_link` message type.
2. **Booking detail panel uses mock data** — `BookingMessageTab.tsx` imports from `mockData.ts`, sends nothing to the API.
3. **No shop-initiated booking message flow** — Shop has no way to send a message with booking context attached.

## Rollback Plan

Before making any changes, preserve the current frontend state for easy rollback.

### Files to Back Up (Do NOT Delete)

| File | Reason to Keep |
|------|----------------|
| `frontend/src/components/shop/bookings/tabs/BookingMessageTab.tsx` | **Keep** — Contains Quick Replies UI that will be updated in the next strategy (`shop-auto-responses-scheduled-messages.md`) |
| `frontend/src/components/shop/bookings/mockData.ts` | **Keep** — Contains mock quick replies data needed for reference |
| `frontend/src/components/shop/bookings/BookingDetailsPanel.tsx` | Back up original before modifying |
| `frontend/src/components/shop/bookings/BookingsTabV2.tsx` | Back up original before modifying |

### How to Rollback

If something goes wrong, revert with:

```bash
# Revert all changes to the booking panel files
git checkout -- \
  frontend/src/components/shop/bookings/BookingDetailsPanel.tsx \
  frontend/src/components/shop/bookings/BookingsTabV2.tsx \
  frontend/src/components/messaging/ConversationThread.tsx
```

The `booking_link` renderer in `ConversationThread.tsx` is additive (doesn't change existing `service_link` behavior), so reverting it is safe — any `booking_link` messages already sent will just render as plain text fallback.

## Implementation Plan

### Step 1: Add `booking_link` Card Renderer to ConversationThread

In `ConversationThread.tsx`, add a `booking_link` card renderer after the existing `service_link` block (line 308). This renders for both shop and customer views since they share the same component.

```tsx
{/* Booking Link Card */}
{message.messageType === "booking_link" && message.metadata && (
  <div className="mb-2">
    <div
      className={`rounded-lg overflow-hidden border ${
        isOwnMessage
          ? "border-black/20 bg-black/10"
          : "border-gray-700 bg-[#0A0A0A]"
      }`}
    >
      {/* Service Image */}
      {message.metadata.serviceImage && (
        <img
          src={message.metadata.serviceImage}
          alt={message.metadata.serviceName}
          className="w-full h-32 object-cover"
        />
      )}
      {/* Booking Details */}
      <div className="p-3">
        <h4
          className={`font-semibold text-sm mb-1 ${
            isOwnMessage ? "text-black" : "text-white"
          }`}
        >
          {message.metadata.shopName || message.metadata.serviceName}
        </h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-1">
            <span>{isOwnMessage ? "text-black/70" : "text-gray-400"}</span>
            <span>Service: {message.metadata.serviceName}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Price: ${message.metadata.servicePrice}</span>
          </div>
          {message.metadata.serviceCategory && (
            <div className="flex items-center gap-1">
              <span>Category: {message.metadata.serviceCategory}</span>
            </div>
          )}
          {message.metadata.bookingDate && (
            <div className="flex items-center gap-1">
              <span>{message.metadata.bookingDate}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
)}
```

### Step 2: Wire BookingDetailsPanel to Real Messaging (Keep Existing UI)

In `BookingDetailsPanel.tsx`, keep the current UI structure but connect the "Message" tab to the real messaging system:

1. When "Message" tab is selected, call `getOrCreateConversation(booking.customerAddress)` to get the real conversation
2. Render the real `ConversationThread` component with the conversation ID
3. On first open, auto-send a `booking_link` message with booking details if no prior booking message exists for this order

**Keep `BookingMessageTab.tsx` as-is** — the Quick Replies UI and Edit button will be updated in the next strategy (`shop-auto-responses-scheduled-messages.md`). Do not delete or modify it.

**Updated props for BookingDetailsPanel:**

- Remove `onSendMessage` prop (ConversationThread handles sending)
- Add `shopId` prop (needed for getOrCreateConversation)
- Booking data already available via existing `booking` prop

**Booking metadata to include:**

```typescript
metadata: {
  bookingId: booking.orderId,
  serviceName: booking.serviceName,
  serviceImage: booking.serviceImage,       // if available
  servicePrice: booking.totalPrice,
  serviceCategory: booking.serviceCategory,
  shopName: booking.shopName,
  bookingDate: booking.bookingTimeSlot,     // "Dec 26, 2025 at 2:00 PM"
  bookingEndTime: booking.bookingEndTime,
}
```

### Step 3: Update BookingsTabV2.tsx

- Remove the fake `handleSendMessage` function (lines 294-311) that only updates local state
- Pass `shopId` to `BookingDetailsPanel`

### Step 4: Customer Service Details "Message Shop" Already Works

The customer side (`ServiceDetailsModal.tsx`) already sends `service_link` messages with rich cards. No changes needed — this flow is already functional per sc1.png and sc2.png.

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/messaging/ConversationThread.tsx` | Add `booking_link` card renderer (after line 308) |
| `frontend/src/components/shop/bookings/BookingDetailsPanel.tsx` | Replace `BookingMessageTab` render with real `ConversationThread`, call `getOrCreateConversation`, auto-send `booking_link` on first open |
| `frontend/src/components/shop/bookings/BookingsTabV2.tsx` | Remove fake `handleSendMessage`, pass `shopId` |

## Files to Keep (Do NOT Delete or Modify)

| File | Reason |
|------|--------|
| `frontend/src/components/shop/bookings/tabs/BookingMessageTab.tsx` | Quick Replies UI — will be updated in auto-responses strategy |
| `frontend/src/components/shop/bookings/mockData.ts` | Mock data reference — needed for Quick Replies migration |

## Message Flow

```
Shop clicks booking → Booking Detail Panel → "Message" tab
    ↓
getOrCreateConversation(customerAddress)
    ↓
Auto-send booking_link message (if first time for this booking):
  messageType: "booking_link"
  messageText: "Regarding your booking for Hand Wraps on Dec 26, 2025 at 2:00 PM"
  metadata: { serviceName, servicePrice, bookingDate, serviceImage, ... }
    ↓
ConversationThread renders booking card in chat:
  ┌─────────────────────────────────┐
  │  [Service Image]                │
  ├─────────────────────────────────┤
  │  MBG.life                       │
  │  Service: Hand Wraps            │
  │  Price: $129.98                 │
  │  Category: Fitness & Gyms       │
  │  Dec 26, 2025 at 2:00 PM       │
  └─────────────────────────────────┘
    ↓
Customer sees rich booking card in /customer?tab=messages
Shop can continue chatting in same thread
```

## Impact

- Messages sent from booking details actually reach the customer
- Customer sees a rich card with booking context (service, price, date/time)
- Same conversation visible in both booking detail panel AND `/shop?tab=messages`
- No new backend work needed — `booking_link` message type already supported in DB
- Mirrors the existing customer → shop `service_link` pattern
- Quick Replies UI preserved for next strategy update

**Effort:** ~2-3 hours

## Testing Checklist

- [ ] Send message from booking detail panel → customer receives it with rich booking card
- [ ] Booking card shows: service name, price, category, date/time, image
- [ ] Customer can reply and shop sees it in booking detail panel
- [ ] Same conversation appears in `/shop?tab=messages`
- [ ] Multiple bookings for same customer use same conversation (not new ones)
- [ ] Customer-side "Message Shop" from Service Details still works (no regression)
- [ ] `service_link` cards still render correctly
- [ ] `booking_link` cards render correctly for both sender and receiver
- [ ] Rollback works: `git checkout` reverts cleanly to previous state

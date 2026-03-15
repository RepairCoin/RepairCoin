# Real-Time Payment Status Update for Manual Booking Modal

## Status: PENDING

**Priority:** Medium
**Area:** Frontend (ManualBookingModal) + Backend (Webhook)
**Created:** March 5, 2026

---

## Problem Statement

When a shop admin creates a manual booking with `qr_code` or `send_link` payment, a modal shows the QR code / confirmation with the text "Appointment will auto-confirm when payment is complete." However, the modal is **static** — it does not update when the customer actually pays. The shop admin must close the modal and reload to see the updated status.

**Current behavior:**
1. Shop admin creates manual booking with QR code payment
2. QR modal opens showing payment details
3. Customer scans QR and pays via Stripe
4. Stripe webhook fires → DB updated to `paid` → notification sent via WebSocket
5. **Modal stays unchanged** — still shows QR code with no payment confirmation
6. Shop admin clicks "Done", reloads appointments to see payment status

**Expected behavior:**
- Modal should automatically transition to a "Payment Successful" state when the webhook confirms payment

---

## Existing Infrastructure (What We Already Have)

| Component | Status | Details |
|-----------|--------|---------|
| WebSocket server | Active | `WebSocketManager.ts` — wallet-based routing, JWT auth |
| WebSocket client | Active | `useNotifications.ts` — auto-reconnect, message handling |
| Notification store | Active | `notificationStore.ts` — Zustand store with `addNotification()` |
| Payment webhook | Active | `webhooks.ts:1160` — updates order to `paid`, sends `payment_received` notification |
| Payment polling hook | Active | `usePaymentPolling.ts` — 2.5s polling with tab visibility support (used by customer checkout, not manual booking) |
| DOM custom events | Active | Pattern exists for `subscription-status-changed` and `shop-status-changed` events |

---

## Recommended Approach: WebSocket Event + Polling Fallback

Use the existing WebSocket notification system as the **primary** channel (instant, zero extra load), with polling as a **fallback** for cases where WebSocket is disconnected.

### Why This Approach

- **WebSocket already delivers `payment_received` notifications** to the shop owner in real-time — we just need to listen for it in the modal
- **No new backend endpoints needed** — the webhook already updates the DB and sends the notification
- **Polling fallback** ensures reliability if WebSocket drops (reuses existing `usePaymentPolling` pattern)
- **Minimal code changes** — ~100 lines frontend, ~5 lines backend

---

## Implementation Plan

### Phase 1: Backend — Add `orderId` to WebSocket Payload (Already Done)

The webhook at `webhooks.ts:1214-1225` already sends a `payment_received` notification with `metadata.orderId`. This is sufficient — no backend changes needed for the WebSocket path.

**Optional enhancement:** Add a dedicated WebSocket message type for faster routing:

```typescript
// In webhooks.ts, after creating the notification (line 1225):
// Send a targeted WebSocket event for real-time modal update
if (this.wsManager) {
  this.wsManager.sendToAddresses([shopResult.rows[0].wallet_address], {
    type: 'manual_booking_payment_completed',
    payload: {
      orderId,
      paymentStatus: 'paid',
      customerName: order.customer_name,
      serviceName: order.service_name,
      amount: order.total_amount
    }
  });
}
```

**File:** `backend/src/domains/shop/routes/webhooks.ts` (~1225)

### Phase 2: Backend — Add Order Status Check Endpoint

Add a lightweight endpoint for polling fallback — checks single order payment status:

```
GET /api/shops/:shopId/appointments/:orderId/payment-status
```

Returns: `{ orderId, status, paymentStatus, paidAt }`

This can be added to `ManualBookingController.ts` or reuse the existing order query.

**File:** `backend/src/domains/ServiceDomain/controllers/ManualBookingController.ts`

### Phase 3: Frontend — Listen for Payment in QR/Send-Link Modal

#### 3a. Add WebSocket Listener via DOM Custom Event

In `useNotifications.ts`, add a handler for `payment_received` notifications (or the new `manual_booking_payment_completed` message type):

```typescript
// Inside ws.onmessage switch:
case 'manual_booking_payment_completed':
  console.log('Manual booking payment completed:', message.payload);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('manual-booking-paid', {
      detail: message.payload  // { orderId, paymentStatus, customerName, ... }
    }));
  }
  break;
```

**File:** `frontend/src/hooks/useNotifications.ts`

#### 3b. Alternative: Listen to Existing Notifications

Instead of a new message type, we can listen for `payment_received` notifications from the notification store. When the QR modal is open, watch `notificationStore.notifications` for a new notification with `metadata.orderId` matching the current booking.

**Trade-off:** Simpler (no backend changes), but slightly less explicit.

#### 3c. Update ManualBookingModal to React to Payment

Add state and event listener to the QR modal section:

```typescript
// New state in ManualBookingModal
const [paymentConfirmed, setPaymentConfirmed] = useState(false);
const [paymentData, setPaymentData] = useState<any>(null);

// Listen for WebSocket payment event while QR modal is open
useEffect(() => {
  if (!showQRModal || !qrBookingDetails?.orderId) return;

  const handlePaymentComplete = (event: CustomEvent) => {
    if (event.detail.orderId === qrBookingDetails.orderId) {
      setPaymentConfirmed(true);
      setPaymentData(event.detail);
    }
  };

  window.addEventListener('manual-booking-paid', handlePaymentComplete as EventListener);
  return () => {
    window.removeEventListener('manual-booking-paid', handlePaymentComplete as EventListener);
  };
}, [showQRModal, qrBookingDetails?.orderId]);
```

**File:** `frontend/src/components/shop/ManualBookingModal.tsx`

#### 3d. Add Polling Fallback

Reuse the `usePaymentPolling` pattern for when WebSocket is unavailable:

```typescript
// Poll order status as fallback (every 5 seconds, 10-minute timeout)
useEffect(() => {
  if (!showQRModal || !qrBookingDetails?.orderId || paymentConfirmed) return;

  const pollInterval = setInterval(async () => {
    try {
      const result = await apiClient.get(
        `/shops/${shopId}/appointments/${qrBookingDetails.orderId}/payment-status`
      );
      if (result.data?.paymentStatus === 'paid') {
        setPaymentConfirmed(true);
        setPaymentData(result.data);
        clearInterval(pollInterval);
      }
    } catch (err) {
      // Silent — WebSocket is primary, this is just a fallback
    }
  }, 5000);

  return () => clearInterval(pollInterval);
}, [showQRModal, qrBookingDetails?.orderId, paymentConfirmed]);
```

### Phase 4: Frontend — Payment Success UI Transition

Transform the QR modal into a success state when payment is confirmed:

**Before payment (current):**
```
┌─────────────────────────┐
│    📱 Scan to Pay       │
│                         │
│    ┌─────────────┐      │
│    │  QR CODE    │      │
│    └─────────────┘      │
│                         │
│    $59.00               │
│    Service: Hair Cut    │
│    Date: 2026-03-09     │
│    Time: 2:00 PM        │
│                         │
│  ⏰ Expires in 24 hours │
│                         │
│  Auto-confirm on pay    │
│                         │
│      [ Done ]           │
└─────────────────────────┘
```

**After payment (new):**
```
┌─────────────────────────┐
│    ✅ Payment Received  │
│                         │
│    ┌─────────────┐      │
│    │  ✓ PAID     │      │
│    │  checkmark  │      │
│    └─────────────┘      │
│                         │
│    $59.00               │
│    Service: Hair Cut    │
│    Customer: John Doe   │
│    Date: 2026-03-09     │
│    Time: 2:00 PM        │
│                         │
│  ✅ Appointment         │
│     confirmed           │
│                         │
│    [ View Booking ]     │
└─────────────────────────┘
```

**UI changes:**
- Purple phone icon → Green checkmark icon
- "Scan to Pay" → "Payment Received"
- QR code → Large green checkmark animation
- Expiry warning → "Appointment confirmed" success message
- "Done" button → "View Booking" button (navigates to booking details)
- Smooth CSS transition between states
- Optional: subtle confetti or pulse animation on success

**File:** `frontend/src/components/shop/ManualBookingModal.tsx` (QR modal section, lines 782-856)

---

## Applies To Both Payment Types

The same mechanism works for both `qr_code` and `send_link` payment flows:

| Payment Type | Modal Shown | Real-Time Update |
|-------------|-------------|-----------------|
| `qr_code` | QR code modal (stays open while customer scans) | WebSocket + poll |
| `send_link` | Success toast "Payment link sent" (modal closes) | Appointment calendar auto-refreshes via notification |

For `send_link`, the modal typically closes after sending the email. The update would show on the **Appointments calendar/list** instead. We can use the same `manual-booking-paid` DOM event to trigger a refresh of the appointments list.

---

## Files to Change

| File | Change | Lines |
|------|--------|-------|
| `backend/src/domains/shop/routes/webhooks.ts` | Add `manual_booking_payment_completed` WebSocket event after notification | ~5 lines after line 1225 |
| `backend/src/domains/ServiceDomain/controllers/ManualBookingController.ts` | Add `getOrderPaymentStatus` endpoint for polling fallback | ~25 lines |
| `backend/src/domains/ServiceDomain/routes.ts` | Register new endpoint route | ~1 line |
| `frontend/src/hooks/useNotifications.ts` | Handle `manual_booking_payment_completed` → dispatch DOM event | ~10 lines |
| `frontend/src/components/shop/ManualBookingModal.tsx` | WebSocket listener, polling fallback, success UI state | ~80 lines |

**Total:** ~120 lines across 5 files

---

## Sequence Diagram

```
Shop Admin          Frontend Modal         WebSocket         Backend           Stripe
    │                    │                    │                 │                 │
    ├─ Create booking ──►│                    │                 │                 │
    │                    ├─ POST /manual ────►│                 │                 │
    │                    │                    │                 ├─ Create order   │
    │                    │                    │                 ├─ Create session─►│
    │                    │◄─ { orderId, paymentLink } ─────────┤                 │
    │                    │                    │                 │                 │
    │  ◄── QR Modal ─────┤                    │                 │                 │
    │  (watching orderId) │                    │                 │                 │
    │                    ├─ Poll /status ─────►                 │                 │
    │                    │  (every 5s)        │                 │                 │
    │                    │                    │                 │                 │
    │                    │                    │     Customer pays via Stripe ─────►│
    │                    │                    │                 │◄─ webhook ──────┤
    │                    │                    │                 ├─ Update order   │
    │                    │                    │                 ├─ Send notif     │
    │                    │                    │◄── WS: payment_completed ────────┤
    │                    │◄── DOM event ──────┤                 │                 │
    │                    │                    │                 │                 │
    │  ◄── ✅ Paid! ─────┤                    │                 │                 │
    │  (success state)   │                    │                 │                 │
```

---

## Edge Cases

| Case | Handling |
|------|---------|
| WebSocket disconnected | Polling fallback checks every 5 seconds |
| Customer pays after modal closed | Notification appears in bell icon; appointment list refreshes on next load |
| Payment link expires (24h) | No update — order stays `pending`; `UnpaidBookingCleanupService` cancels after 24h |
| Multiple QR modals opened | Event listener filters by `orderId` — only matching modal updates |
| Shop admin on different device | Polling works independently of WebSocket |
| Social login (no MetaMask wallet) | WebSocket uses wallet from JWT — same as notification system |
| Slow network | Polling retries silently; WebSocket reconnects with backoff |

---

## Testing

1. Create manual booking with QR code → keep modal open → pay via Stripe test card → modal should transition to success
2. Create manual booking with send_link → customer pays via email link → appointment list should show "paid" on next refresh
3. Disconnect WebSocket (disable network briefly) → pay → modal should still update via polling
4. Open QR modal → close it before payment → pay → no modal update (expected), notification in bell icon
5. Create two QR bookings → pay for one → only the correct modal updates

# Strategy — AI Booking Confirmation Message ("Your appointment is confirmed")

**Status:** Draft — for review
**Created:** 2026-05-18
**Track:** AI Sales Agent
**Author:** Deo + Claude

---

## 1. Problem

When a customer books a service straight from the AI Sales Agent chat, the
experience ends abruptly:

1. AI proposes a slot → renders a **booking card** in the chat.
2. Customer taps the card → app navigates them **out of the chat** to
   `/service/{serviceId}` (the checkout page).
3. Customer pays via Stripe → app redirects them to
   `/customer/orders?success=true`.
4. **The chat thread is never updated.** The AI never acknowledges the
   booking. If the customer goes back to Messages, the last thing the AI
   "said" is still the slot proposal — as if nothing happened.

The customer expects a closing beat: *"Great — your appointment is confirmed
for Thursday, May 22 at 2:30 PM. See you then!"* — posted by the AI, in the
same thread, so the conversation feels complete and trustworthy.

---

## 2. Current behaviour (verified in code)

| Step | File | Notes |
|------|------|-------|
| Booking card click | `frontend/src/components/messaging/BookingSuggestionCard.tsx:63-73` | `router.push('/service/{serviceId}?suggestedSlotIso=...&suggestedDeposit=...')` — **no conversationId carried** |
| Checkout success | `frontend/src/components/service/ServiceCheckoutClient.tsx:83-86` | `handleCheckoutSuccess()` → redirect to `/customer/orders?success=true` |
| Stripe checkout endpoint | `backend/.../ServiceDomain/routes.ts:671-720` → `OrderController.createStripeCheckout` | Creates Stripe session only; no order row yet |
| Order row created | `backend/.../ServiceDomain/services/PaymentService.ts:607-625` | Inside the Stripe **webhook** handler on payment success — `status: 'paid'`, `shopApproved: true`. **No EventBus event emitted here.** |
| `service.order_completed` event | `OrderController.ts:353-367` | Fires only when the shop **manually** flips an order `paid → completed` (service actually rendered) — NOT at payment time |
| `OrderConfirmationHandler` | `backend/.../AIAgentDomain/services/OrderConfirmationHandler.ts` | Subscribes to `service.order_completed`. Posts a Haiku "thanks for visiting" message. Past-tense, wrong lifecycle moment for our need. |

**Conclusion:** there is no hook at the "customer just paid / booking
confirmed" moment, and no chat message is ever posted then.

---

## 3. Goal

When a customer completes payment for an AI-suggested booking:

1. The AI posts a confirmation message into the **same chat thread**, e.g.
   *"You're all set, Qua Ting! Your appointment is confirmed for Thursday,
   May 22 at 2:30 PM. See you then 🎉"*
2. The customer is **redirected back into the chat thread** (Messages tab,
   conversation open) instead of the generic orders page — so they actually
   see the confirmation.
3. It works reliably even though the order is created server-side in an
   async Stripe webhook (the customer's redirect may beat the webhook).

Non-goals: reschedule/cancel confirmations, deposit-vs-full-payment wording
nuance, multi-service cart bookings. Out of scope for this pass.

---

## 4. Design decisions (each has options — pick before building)

### Decision A — What event triggers the confirmation?

The order is created in the Stripe webhook (`PaymentService.ts:607-625`)
with `status: 'paid'`. That is the "booking completed" moment.

→ **Add a new EventBus event** emitted right after the order row is created
in that webhook: `service.order_paid` (payload: `orderId, customerAddress,
shopId, serviceId, bookingDate, bookingTime, totalAmount`).

This is additive — `service.order_completed` keeps its current meaning
(service rendered). The two confirmations are distinct lifecycle beats and
**both can fire** for the same order (one at booking, one after the visit).

### Decision B — AI-generated vs templated message

| Option | Pros | Cons |
|--------|------|------|
| **B1. Claude Haiku-generated** (like `OrderConfirmationHandler`) | Warm, varied, on-brand voice | Token cost on *every* booking; ~1-3s latency; customer may land in chat before it generates; small chance of a wrong/hallucinated detail on a *transactional* message |
| **B2. Templated, deterministic** | Instant, $0, 100% accurate slot/date, no race window | Fixed wording |
| **B3. Hybrid** — templated posts instantly, Haiku not used | Same as B2 | — |

**Recommendation: B2 (templated).** A booking confirmation is a
*transactional receipt*, not a sales reply — accuracy and immediacy beat
personality. Still **stamp it `metadata.generated_by: 'ai_agent'`** so it
renders with the AI bubble/badge styling — to the customer it reads as "the
AI confirming the booking", which is exactly the ask. Template:

> `You're all set, {firstName}! Your appointment at {shopName} is confirmed for {slotLabel}. See you then 🎉`

(Reuse `OrderConfirmationHandler.formatSlot()` for `{slotLabel}`.)

### Decision C — Scope the message AND the redirect to the same signal

The message and the redirect must answer the same question — *"was this order
booked from an AI chat?"* — or they drift apart.

A naive backend lookup (`findExistingConversation(customer, shop)`) is too
loose: a customer who once chatted with a shop, then later books a *different*
service from the **marketplace**, would still get a confirmation dropped into
that old, unrelated chat. That is not "booked using the AI sales agent".

→ **Thread the `conversationId` end-to-end** and store it on the order row
(`service_orders.conversation_id`, nullable). One signal governs both:

| `order.conversation_id` | Chat message | Redirect after payment |
|---|---|---|
| set (booked from AI chat card) | post to **that exact conversation** | `/customer?tab=messages&conversation={id}` |
| null (marketplace / direct booking) | none | `/customer/orders?success=true` (unchanged) |

This guarantees the message lands in the *right* thread (not just "a" thread),
and that normal bookings are completely unaffected.

### Decision D — Should the AI kill-switch gate the confirmation?

`OrderConfirmationHandler` skips when the shop's AI is globally off (so a
human's own thank-you isn't doubled). For *this* message:

- It is transactional, zero-token, zero-cost (templated).
- A booking receipt is *expected* by the customer regardless of AI settings.

**Recommendation:** post the templated confirmation **regardless of the AI
kill-switch**, as long as the order has a `conversation_id` (it was booked
from an AI chat). It is a receipt, not an AI sales turn.
*(Alternative if we want to be conservative: gate on the kill-switch like the
existing handler — flag for decision.)*

---

## 5. Recommended approach

**Thread `conversationId` from the booking card all the way to the order
row.** When the customer taps an AI booking card, the `conversationId` rides
through: card URL → checkout endpoint → Stripe session `metadata` → stored on
the new `service_orders.conversation_id` column when the webhook creates the
order. Marketplace/direct bookings simply leave it `null`.

A new **`BookingConfirmationHandler`** in `AIAgentDomain`, modelled on the
existing `OrderConfirmationHandler` but:

- subscribes to the **new `service.order_paid`** event,
- posts a **templated** future-tense confirmation (no Claude call),
- reads `order.conversation_id` directly — **if it is `null`, skip** (the
  booking did not come from an AI chat; do nothing). No `findExistingConversation`
  lookup — that was too loose (see Decision C). The message lands in the exact
  conversation the booking card came from,
- is **idempotent**: before posting, check no message with
  `metadata.source = 'booking_confirmed' AND metadata.order_id = {orderId}`
  already exists (Stripe webhooks can deliver more than once),
- WS-broadcasts `message:new` to customer + shop (reuse the existing
  pattern; the 30s poll fallback we already shipped covers a dropped WS),
- swallows all errors — a confirmation hiccup must never affect payment.

The same `conversation_id` also drives the post-payment redirect (Decision C),
so the message and the redirect are always scoped to the exact same booking.

---

## 6. Implementation phases

### Phase 1 — Schema + thread `conversationId` to the order row
- **Migration**: add `service_orders.conversation_id TEXT NULL` (nullable —
  marketplace bookings leave it empty). No FK needed; treat as a soft link.
- `BookingSuggestionCard.tsx` — append `&conversationId={conversationId}` to
  the `/service/{serviceId}` URL (the card already has the conversation in
  props/context).
- `ServiceCheckoutClient` + the `POST /api/services/orders/stripe-checkout`
  endpoint (`OrderController.createStripeCheckout`) — accept `conversationId`
  and put it into the Stripe session `metadata`.
- Stripe webhook order-creation (`PaymentService.ts:607-625`) — read
  `metadata.conversationId` and persist it onto the new `conversation_id`
  column. Null when absent.

### Phase 2 — Backend: emit `service.order_paid`
- In `PaymentService.ts` (~line 625, right after the order row is created in
  the webhook), `eventBus.publish('service.order_paid', { orderId,
  customerAddress, shopId, serviceId, conversationId, bookingDate,
  bookingTime, totalAmount })` — include `conversationId` from the order.
- Emit **after** the DB commit so subscribers can read the order.

### Phase 3 — Backend: `BookingConfirmationHandler`
- New file `AIAgentDomain/services/BookingConfirmationHandler.ts`
  (copy `OrderConfirmationHandler` structure; drop the Claude call).
- Register the subscription in `AIAgentDomain/index.ts` alongside the
  existing `service.order_completed` wiring.
- **If `order.conversation_id` is null → skip** (marketplace booking).
- Templated message posted to `order.conversation_id`, `metadata:
  { generated_by: 'ai_agent', source: 'booking_confirmed', order_id }`.
  Idempotency guard on that metadata.
- WS broadcast to customer + shop.

### Phase 4 — Frontend: redirect back into the chat
- The checkout `success_url` carries `conversationId` (already in Stripe
  metadata from Phase 1; also append to the `success_url` query string).
- `handleCheckoutSuccess()` — if `conversationId` is present, redirect to
  `/customer?tab=messages&conversation={conversationId}`; else keep
  `/customer/orders?success=true`.
- The Messages page should auto-open the conversation from the
  `?conversation=` param (verify `useConversations` / `MessagesLayout`
  already supports deep-linking; add it if not).

### Phase 5 — Tests
- `BookingConfirmationHandler` unit tests: posts once, idempotent on repeat
  event, **skips when `conversation_id` is null**, correct slot label,
  error-swallowing.
- Verify `npx tsc --noEmit` + `npm run test` (ai-agent suite).
- Manual: book via AI chat on staging → confirm message lands in the right
  thread + redirect opens it; book from the marketplace → no message, lands
  on `/customer/orders`.

---

## 7. Edge cases & failure modes

| Case | Handling |
|------|----------|
| Booking made from the **marketplace** / direct (not via a chat card) | `order.conversation_id` is null → handler skips silently; frontend keeps the `/customer/orders?success=true` redirect. Completely unaffected. |
| Customer chatted with a shop, then booked a **different** service from the marketplace | That order's `conversation_id` is null (booked outside the card) → no message dropped into the old chat. This is the looseness the `conversation_id` column was added to prevent. |
| **Webhook race** — customer lands in chat before the webhook posts the message | Message is posted server-side (guaranteed); WS broadcast + the existing 30s poll surface it within seconds. Optionally show a lightweight "Confirming your booking…" placeholder until it arrives |
| **Stripe webhook fires twice** | Idempotency guard on `metadata.source + order_id` — second delivery is a no-op |
| **Payment abandoned / fails** | No `order_paid` event → no message. Correct. |
| Customer booked from a chat that was a **human takeover** (AI paused) | The card still came from that conversation, so `conversation_id` is set → confirmation still posts. It is a transactional receipt, not an AI sales turn, so this is fine. |
| AI **globally disabled** for the shop | Per Decision D — recommend still post (templated, $0). Flag if we want it gated. |
| Slot date/time missing on the order | `formatSlot` returns null → fall back to "Your booking is confirmed!" without the slot line |
| Order **completed** later by the shop | `OrderConfirmationHandler` still fires its own "thanks for visiting" message — intentional, separate beat |

---

## 8. Rollback

- Phases 1-3 are additive: the `service_orders.conversation_id` column is
  nullable and ignored by all existing code; removing the `service.order_paid`
  subscription (or not emitting the event) fully disables the feature with
  zero effect on the payment flow.
- Phase 4: `handleCheckoutSuccess` falls back to `/customer/orders?success=true`
  whenever `conversationId` is absent — reverting that one branch restores old
  behaviour.
- Recommend a config/env flag (`AI_BOOKING_CONFIRMATION_ENABLED`) so it can
  be toggled without a deploy.

---

## 9. Open questions for review

1. Decision B — templated (recommended) or Haiku-generated?
2. Decision D — post regardless of the AI kill-switch, or gate on it?
3. Should the redirect-into-chat (Phase 4) ship together with the message
   (Phases 1-3), or is the chat message alone enough for v1 (customer sees it
   next time they open Messages)?
4. Deposit bookings — should the wording differ ("deposit received, balance
   due at the shop")? Currently out of scope; confirm.

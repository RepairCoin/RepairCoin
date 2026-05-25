# AI Sales Agent — Reschedule & Cancel via Chat (Scope)

**Status:** Strategy locked — ready for implementation plan.
All five open questions resolved 2026-05-25 (see §9).
**Created:** 2026-05-25.
**Owner:** Deo.

---

## 1. Goal

Extend the AI Sales Agent so a customer can, from inside the shop's
chat thread:

- **Reschedule** an existing upcoming booking.
- **Cancel** an existing upcoming booking.

Today the agent can only **book** new appointments — it has the
`propose_booking_slot` tool which renders a tap-to-book card. Once
the customer has a confirmed booking, the chat has no further role
in its lifecycle; the customer must navigate to the customer
dashboard to reschedule or cancel.

This scope adds two new lifecycle actions to the chat surface so
the customer can stay in-thread.

---

## 2. Current architecture summary (from investigation 2026-05-25)

### How booking works today

1. Customer chats with the shop's AI agent (`/api/ai-agent/...`).
2. When intent is "book a slot," Claude calls `propose_booking_slot`
   with `(service_id, slot_iso, reply_text)`. Tool emits a
   `BookingSuggestion` saved to `messages.metadata.booking_suggestions`.
3. Frontend renders a `BookingSuggestionCard` below the AI bubble.
4. Customer taps the card → router navigates to
   `/service/{serviceId}?suggestedSlotIso=...&conversationId=...`.
5. Existing service-checkout flow runs (`ServiceCheckoutClient` +
   `ServiceCheckoutModal`) with the slot pre-filled.
6. Customer confirms + pays → real order/appointment created in
   `service_orders` (paid/scheduled state).

**Key property:** Claude **proposes**, customer **confirms** via
tap. The AI never directly mutates the booking. Same pattern should
extend to reschedule + cancel.

### Existing customer-facing endpoints (ready to reuse)

The `ServiceDomain` already has a complete customer-side surface:

| Endpoint | Role | Purpose |
|---|---|---|
| `GET /api/services/appointments/my-appointments?startDate=&endDate=` | customer | List the customer's upcoming + past appointments |
| `POST /api/services/appointments/cancel/:orderId` | customer | Direct cancel. Server enforces "≥24h before booking time." |
| `POST /api/services/appointments/reschedule-request` | customer | Create a reschedule-request; shop must approve |
| `GET /api/services/appointments/reschedule-request/order/:orderId` | customer | Check if a pending reschedule-request already exists for an order |
| `DELETE /api/services/appointments/reschedule-request/:requestId` | customer | Cancel a pending reschedule-request before shop responds |

**No new backend endpoints needed for the customer side.** Reschedule
is a **request → approval** workflow (asymmetric from booking, which
is immediate). Cancel is a direct action with a 24h window guard.

### What the AI Sales Agent currently knows

The orchestrator receives `customerAddress`, `shopId`, `serviceId`,
`conversationId` per turn (see `AgentOrchestrator.ts:117`). It can
therefore look up the customer's appointments without needing them
to re-authenticate.

---

## 3. Proposed new tools

Two new Claude tools, modeled on `propose_booking_slot`. Both follow
the propose-then-tap pattern — Claude doesn't mutate state, it
surfaces a confirmable card.

### 3.1 `lookup_my_appointments` (read-only helper)

Pre-tool used by Claude to find the customer's appointment before
proposing a reschedule or cancel. Reads server-side via
`appointmentRepo.getCustomerAppointmentsInRange()`.

**Input schema:**
```ts
{
  // Optional date hints from the customer message
  service_name_hint?: string; // e.g. "Newly Baker"
  day_hint?: string;          // e.g. "thursday", "tomorrow"
  status_filter?: "upcoming" | "all"; // default "upcoming"
}
```

**Output (returned to Claude in the tool_result):**
```ts
{
  appointments: Array<{
    orderId: string;
    serviceId: string;
    serviceName: string;
    bookingDate: string;      // ISO date
    bookingTime: string;      // "14:00"
    status: "paid" | "completed" | "cancelled" | ...;
    pendingRescheduleRequestId?: string; // if one already exists
  }>;
}
```

Claude then uses this to **pick the right appointment** before
proposing the action. If multiple match the hint, Claude asks the
customer to disambiguate in plain text — no card.

### 3.2 `propose_cancellation`

Emits a tap-to-cancel card under the AI's bubble. Card carries the
appointment context; tapping opens a confirmation flow.

**Input schema:**
```ts
{
  order_id: string;              // from lookup_my_appointments
  reply_text: string;            // ≤130 chars, conversational
}
```

**Server-side validation:**
- `order_id` belongs to `customerAddress`.
- Order is in cancellable status (paid, not completed/cancelled/no-show).
- Booking time is ≥24h away (preview only — actual enforcement happens
  on the cancel endpoint when the tap fires, so we surface "can't
  cancel — within 24h, please contact the shop" in the prose if the
  guard would block).

**Frontend card:**
- `CancellationConfirmCard` (new) under AI bubble.
- Shows service name, date/time, "Tap to cancel" CTA.
- Tap → opens a `CancellationConfirmModal` (new, shadcn `Dialog`)
  with one Confirm button + Reason field (optional).
- Confirm → `POST /api/services/appointments/cancel/:orderId` with
  customer auth.
- On success → close modal, AI posts a confirmation message into
  the chat thread ("Your Newly Baker on Thursday 2 PM is cancelled.").

### 3.3 `propose_reschedule_request`

Emits a tap-to-request-reschedule card.

**Input schema:**
```ts
{
  order_id: string;
  requested_date: string;        // YYYY-MM-DD
  requested_time_slot: string;   // "14:00"
  reply_text: string;            // ≤130 chars
}
```

**Server-side validation:**
- Slot is on the shop's available list (same availability
  fetcher already used for booking proposals).
- Same shop as the original order.
- No pending reschedule-request already exists for this order
  (or, if it does, Claude is told to cancel the prior one first;
  see edge cases §5).

**Frontend card:**
- `RescheduleRequestCard` (new) — shows current slot, proposed
  new slot, "Tap to request" CTA.
- Tap → `RescheduleConfirmModal` with reason field + final
  Confirm button.
- Confirm → `POST /api/services/appointments/reschedule-request`.
- On success → AI posts "Reschedule request submitted. The shop
  will approve it shortly." into the chat.
- Shop dashboard already has approve/reject UX (existing).

---

## 4. Conversation flows

### 4.1 Cancellation — happy path

```
Customer: "I need to cancel my newly baker session"
AI: [calls lookup_my_appointments(service_name_hint="newly baker")]
AI: "I see your Newly Baker session on Thursday at 2 PM. Want me
     to cancel it?"
     [CancellationConfirmCard]
Customer: [taps card → modal → Confirm]
→ POST /api/services/appointments/cancel/<orderId>
AI (auto-message): "Done — your Newly Baker on Thursday at 2 PM is
                    cancelled."
```

### 4.2 Reschedule — happy path

```
Customer: "Can I move my Thursday appointment to Friday?"
AI: [calls lookup_my_appointments(day_hint="thursday")]
AI: [calls availability for Friday on that service]
AI: "Your Newly Baker is on Thursday at 2 PM. Friday's open slots
     are 10 AM, 1 PM, and 4 PM. Which works?"
Customer: "1 PM"
AI: [calls propose_reschedule_request(orderId, "2026-05-29", "13:00")]
AI: "Requesting Friday at 1 PM for your Newly Baker. Tap to submit."
     [RescheduleRequestCard]
Customer: [taps → modal → optional reason → Confirm]
→ POST /api/services/appointments/reschedule-request
AI (auto-message): "Reschedule request submitted. The shop will
                    approve it shortly — you'll get a notification."
```

### 4.3 Cancel inside the 24h window

```
Customer: "Cancel my appointment tomorrow at 10 AM"
AI: [calls lookup_my_appointments]
AI: (sees booking_time is 18 hours away, < 24h)
AI: "Your Newly Baker tomorrow at 10 AM is within 24 hours, so I
     can't cancel it directly. Want me to send the shop a quick
     reschedule request instead, or let them know you can't make it?"
```

Don't render a `CancellationConfirmCard` — the tap would 400 at the
endpoint. Offer the alternative path in prose.

### 4.4 Multiple appointments — disambiguation

```
Customer: "I want to cancel my appointment"
AI: [calls lookup_my_appointments(status_filter="upcoming")]
AI: (sees 2 upcoming bookings)
AI: "You have two upcoming sessions — Newly Baker on Thursday 2 PM
     and AQua Tech on Saturday 9 AM. Which one do you want to cancel?"
Customer: "the saturday one"
AI: [picks the right orderId from the previous lookup result, then
     calls propose_cancellation]
AI: "Cancelling AQua Tech on Saturday at 9 AM. Tap to confirm."
     [CancellationConfirmCard]
```

### 4.5 Pending reschedule already exists

```
Customer: "Move my Thursday appointment to next week"
AI: [calls lookup_my_appointments — sees pendingRescheduleRequestId]
AI: "You already have a pending reschedule request for that booking
     — the shop hasn't responded yet. Want me to cancel that request
     and submit a new one for next week?"
Customer: "yes"
AI: [renders two cards in sequence OR one combined card — TBD]
```

This is a TBD edge case for the impl plan. The simpler v1 path is
to refuse and tell the customer to wait or cancel the existing
request via the dashboard.

### 4.6 Already-cancelled or completed

```
Customer: "Cancel my newly baker session"
AI: [calls lookup_my_appointments — finds it but status="cancelled"]
AI: "Your Newly Baker on Thursday is already cancelled. Want to book
     a new session instead?"
```

Same for `status="completed"` — explain, redirect.

---

## 5. Prompt rule additions

Append to the system prompt (currently built in
`PromptTemplates.ts`):

1. **"You can also help with reschedule and cancellation."** —
   high-level capability statement so Claude knows it has these
   tools.
2. **"For reschedule or cancel, always call
   `lookup_my_appointments` FIRST."** Never propose a cancellation
   or reschedule from memory of a prior turn — appointments can
   change between turns, the lookup is the source of truth.
3. **"If the customer's request is ambiguous (multiple matching
   appointments), ask for disambiguation in plain text — do NOT
   guess and propose."** Wrong cancellation is high-cost.
4. **"Surface the 24h cancellation guard pre-emptively"** — if the
   lookup returns an appointment within 24h, do NOT call
   `propose_cancellation` (the endpoint would reject); offer
   reschedule-request as an alternative.
5. **"Honor pending reschedule requests"** — if `lookup_my_appointments`
   returns a `pendingRescheduleRequestId`, mention it; for v1, refuse
   to submit a second request and route the customer to the dashboard.

---

## 6. Frontend surface

New components, mirroring `BookingSuggestionCard`:

| Component | When rendered | Action on tap |
|---|---|---|
| `CancellationConfirmCard` | When AI's turn contains `cancellation_proposals[0]` in metadata | Opens `CancellationConfirmModal` |
| `RescheduleRequestCard` | When AI's turn contains `reschedule_proposals[0]` | Opens `RescheduleConfirmModal` |
| `CancellationConfirmModal` | Triggered by card tap | Calls `POST /appointments/cancel/:orderId` on Confirm |
| `RescheduleConfirmModal` | Triggered by card tap | Calls `POST /appointments/reschedule-request` on Confirm; optional reason field |

Storage on the message:
- `messages.metadata.cancellation_proposals: CancellationProposal[]`
- `messages.metadata.reschedule_proposals: RescheduleProposal[]`

Mirrors the existing `messages.metadata.booking_suggestions` shape.
Read-only audit view for shop-side rendering (same as
`BookingSuggestionCard.readOnly`).

---

## 7. Security model

- **Authorization** stays customer-side: the actual mutating call
  (`POST /cancel/:orderId`, `POST /reschedule-request`) runs from
  the customer's authenticated browser session, NOT from the AI
  agent's server context. This keeps the existing auth surface
  intact — no new ambient-authority APIs.
- **Server validation** of `orderId` ownership (against
  `customerAddress`) is already enforced by the existing endpoints.
- **AI server-side lookups** (`lookup_my_appointments`) use the
  orchestrator's known `customerAddress` — Claude never sees other
  customers' data.
- **Tool input validation** at the orchestrator boundary, same as
  `propose_booking_slot`: `order_id` must belong to this
  customer; `requested_date`/`requested_time_slot` must be on the
  availability list. Reject before Claude's tool call reaches the
  frontend.

---

## 8. Out of scope (v1)

- **Direct reschedule** (skipping the request-approval workflow).
  Existing shop-side `POST /orders/:id/reschedule` is shop-only;
  we are NOT exposing it to customers via chat. v1 only does
  reschedule-**request** which preserves shop control.
- **Group/recurring appointments.** Single-order operations only.
- **No-show disputes** — separate surface, separate scope.
- **Multi-step or partial cancellations** (e.g. cancelling one
  service in a multi-service order) — v1 cancels the whole order.
- **Auto-rebook on cancel** — v1 just cancels; the customer can
  start a new booking turn after if they want to rebook.

---

## 9. Resolved decisions (2026-05-25)

All five open questions resolved before implementation planning.

| # | Decision | Locked |
|---|---|---|
| Q1 | **Cancel reason — optional.** Add optional `reason?: string` to the cancel endpoint; persist via new `cancellation_reason` column on `service_orders`. Surfaces to shop dashboard as "Cancelled — '<reason>'" and enables a future Insights tool to answer "why are people cancelling?" | ✅ |
| Q2 | **Pending reschedule-request collision — refuse + route to dashboard.** When `lookup_my_appointments` returns a `pendingRescheduleRequestId`, AI tells the customer a request is already pending and points them at the dashboard. No in-chat resubmit for v1; revisit only if real usage shows it matters. | ✅ |
| Q3 | **Auto-confirmation message — event-bus subscriber.** `AISalesFollowUpHandler` subscribes to `service.order_cancelled` (already published at `AppointmentController.ts:612-624`) and emits an in-chat confirmation. Adds same coverage for `service.order_rescheduled` if/when that event exists. Same code path regardless of which surface the cancel came from. | ✅ |
| Q4 | **Tap-to-confirm — modal for cancel, inline for reschedule.** Cancel is destructive (mistap loses the slot) → modal with explicit Confirm button. Reschedule-request is non-destructive (shop must still approve, customer can withdraw) → single-tap commit, no modal. | ✅ |
| Q5 | **Voice input — defer.** Stays out of scope for v1. If Phase 7.4 of Business-Data Insights ships voice via Web Speech API, the same component can be added to the customer-shop chat input. Note in the impl doc as a "stretch tie-in." | ✅ |

### Implications for the impl plan

- **Schema change required** for Q1 — needs a migration adding
  `cancellation_reason TEXT` to `service_orders`. Small.
- **Subscriber wiring** for Q3 — verify
  `AISalesFollowUpHandler`'s event-bus subscription pattern can
  add the new event handler (it already handles other events,
  so this is mechanical).
- **No new ambient-auth APIs needed** — confirmed in §7. The
  modal/inline confirm both run as customer-authenticated fetches.
- **No new backend endpoints needed** — all customer-side
  endpoints already exist (see §2.2). Implementation is
  primarily orchestrator + tools + frontend.

---

## 10. Effort estimate (rough)

| Phase | Work | Est. |
|---|---|---|
| 1 | New tools (`lookup_my_appointments`, `propose_cancellation`, `propose_reschedule_request`) + orchestrator wiring + tool descriptions | 2-3d |
| 2 | Prompt rule additions + 15-20 unit tests covering happy paths + 4.3-4.6 edge cases | 1d |
| 3 | Frontend: 2 cards + 2 modals + read-only audit views | 2d |
| 4 | Message metadata plumbing (cancellation_proposals + reschedule_proposals JSONB columns or extension of existing metadata) | 0.5d |
| 5 | Smoke test on staging + QA fixtures (mirror the Business-Insights pattern) | 1d |

**Total v1:** ~6-8 days.

Followups (resolve from §9 + post-deploy data): another 1-2 days.

---

## 11. Next step

✅ Decisions locked in §9 (2026-05-25). Next: write
`reschedule-cancel-implementation.md` as a sibling doc — per-task
checkboxes following the Business-Data Insights phase pattern,
with explicit phasing (probably 5 phases: schema migration → tools
→ orchestrator wiring → frontend cards/modals → tests + QA
fixtures), and per-task checkpoint notes so a crash mid-session
doesn't lose state.

# Implementation Plan — AI Sales Agent Reschedule & Cancel

**Status:** Plan only — code not started.
**Companion to:** `reschedule-cancel-scope.md` (read first).
**Base branch:** off latest `main`. Suggested new branch name:
`deo/ai-sales-reschedule-cancel`.
**Created:** 2026-05-25.

---

## 1. Decisions carried in (from scope doc §9)

| # | Decision | Locked |
|---|---|---|
| Q1 | Cancel reason — **optional**, persisted to new `cancellation_reason` column on `service_orders` | ✅ |
| Q2 | Pending reschedule-request collision — **refuse + route to dashboard** | ✅ |
| Q3 | Auto-confirmation — **event-bus subscriber** in AIAgentDomain (pattern already used for `service.order_completed` + `service.order_paid`) | ✅ |
| Q4 | Tap-to-confirm — **modal for cancel, inline for reschedule** | ✅ |
| Q5 | Voice input — **defer**; tie-in to Phase 7.4 of Business-Data Insights if/when that ships | ✅ |

---

## 2. Reusable infrastructure (do not rebuild)

- **Customer-side endpoints already exist** (see scope §2.2):
  - `GET /api/services/appointments/my-appointments?startDate=&endDate=`
  - `POST /api/services/appointments/cancel/:orderId` (24h guard server-side)
  - `POST /api/services/appointments/reschedule-request`
  - `GET /api/services/appointments/reschedule-request/order/:orderId`
  - `DELETE /api/services/appointments/reschedule-request/:requestId`
- **Booking propose-then-tap pattern** is the template. Mirror
  `propose_booking_slot` + `BookingSuggestionCard` end-to-end.
- **Event-bus subscription pattern** in
  `AIAgentDomain/index.ts:68-90` is the template for the
  cancel/reschedule confirmation handlers (mirror
  `bookingConfirmationHandler.handleOrderPaid`).
- **`service.order_cancelled` event** already published from
  `AppointmentController.ts:612-624` — subscriber side is new work,
  publisher side is done.
- **AvailabilityFetcher** for reschedule's "what slots are open?"
  step — same one used by `propose_booking_slot`.
- **Tool input validation pattern** at the orchestrator boundary —
  mirror the `(service_id, slot_iso)` pair-consistency check in
  `AgentOrchestrator.ts`.

---

## 3. New events to publish

One new event needs adding (Q3 implication — see scope §9 notes).

| Event | Publish from | Payload |
|---|---|---|
| `service.reschedule_request_created` | `RescheduleService.createRescheduleRequest` (new emit) | `{ orderId, customerAddress, shopId, serviceId, requestedDate, requestedTime, reason? }` |

Note: `service.order_rescheduled` (fired when shop **approves** the
request) is a future concern — Phase 8 if a customer-side
notification is desired. For v1, the auto-message says "request
submitted" not "rescheduled."

---

## 4. Type extensions (gather before coding)

### 4.1 BookingSuggestion analog for cancel

```ts
// backend types.ts + frontend messaging types
export interface CancellationProposal {
  orderId: string;
  serviceId: string;
  serviceName: string;
  bookingDate: string;     // YYYY-MM-DD
  bookingTime: string;     // "14:00"
  /**
   * True iff the booking time is ≥24h away. Pre-computed
   * server-side so the frontend can render the card differently
   * (or refuse to render it) if a stale client tries to commit
   * a now-too-late cancellation.
   */
  withinCancellationWindow: boolean;
}
```

### 4.2 BookingSuggestion analog for reschedule

```ts
export interface ReschedulePropoosal {
  orderId: string;
  serviceId: string;
  serviceName: string;
  currentBookingDate: string;
  currentBookingTime: string;
  requestedDate: string;
  requestedTime: string;
  /**
   * Server-resolved human label so the card doesn't have to
   * locale-render the timestamp client-side. e.g. "Friday at 1:00 PM"
   */
  requestedLabel: string;
}
```

### 4.3 Message metadata extension

```ts
// messages.metadata JSONB now carries (in addition to existing keys):
//   cancellation_proposals?: CancellationProposal[]
//   reschedule_proposals?: ReschedulePropoosal[]
//
// Same convention as booking_suggestions — array-shaped to support
// multi-card responses if Claude ever proposes multiple in one turn.
```

No new DB columns needed for the metadata — it's a JSONB blob.

---

## 5. Phase 1 — Schema migration (½ day)

- [ ] **1.1** Migration `127_add_cancellation_reason_to_service_orders.sql`:
  ```sql
  ALTER TABLE service_orders
    ADD COLUMN cancellation_reason TEXT NULL;
  ```
  No backfill needed — historical cancellations stay NULL.
- [ ] **1.2** Apply on DO via the standard
  `scripts/record-and-verify-migration-NNN.ts` pattern.
- [ ] **1.3** Add `cancellationReason: string | null` to the
  `ServiceOrder` interface in
  `backend/src/repositories/OrderRepository.ts` (or wherever the
  type lives — verify).
- [ ] **1.4** Update `OrderRepository.cancelOrder` /
  `AppointmentRepository.cancelAppointment` to accept an optional
  `reason: string | null` argument; persist via UPDATE.

**Acceptance:** column exists on DO, `cancelAppointment(orderId,
customerAddress, reason)` round-trips a reason cleanly.

---

## 6. Phase 2 — New tools + orchestrator wiring (2-3 days)

### 6.1 `lookup_my_appointments` tool

- [ ] **2.1** Define tool in `AgentOrchestrator.ts` next to
  `BOOKING_TOOL_NAME`. Input schema per scope §3.1.
- [ ] **2.2** Execute against
  `appointmentRepo.getCustomerAppointmentsInRange(customerAddress,
  startDate, endDate)`. Default range = today through
  +30 days when `status_filter="upcoming"`.
- [ ] **2.3** Enrich each row with
  `pendingRescheduleRequestId` (one query to
  `reschedule_requests` table filtered by `customer_address` +
  `status='pending'`).
- [ ] **2.4** Apply optional hints (`service_name_hint`,
  `day_hint`) as a server-side filter so Claude gets a narrowed
  set. Day-hint accepts loose strings ("thursday", "tomorrow") —
  use a small parser; unknown hints fall through (no filter).
- [ ] **2.5** Tool result shape per scope §3.1. Hard cap at 10
  rows returned to keep prompt size bounded.

### 6.2 `propose_cancellation` tool

- [ ] **2.6** Define tool. Input schema per scope §3.2.
- [ ] **2.7** Server-side validation in
  `AgentOrchestrator.handlePropoaseCancellationCall`:
  - `order_id` owned by `customerAddress` (lookup).
  - Order status in `{paid, scheduled}` — not completed,
    cancelled, or no-show.
  - Compute `withinCancellationWindow` (≥24h ahead).
  - Reject the tool_use with a structured error if the order
    is invalid; Claude phrases the failure.
- [ ] **2.8** Emit `CancellationProposal` to
  `messages.metadata.cancellation_proposals[]`.

### 6.3 `propose_reschedule_request` tool

- [ ] **2.9** Define tool. Input schema per scope §3.3.
- [ ] **2.10** Server-side validation:
  - `order_id` owned + cancellable status.
  - `requested_date` / `requested_time_slot` pair must be on
    the availability set the prompt sent Claude.
  - No `pendingRescheduleRequestId` on this order (Q2 refuse
    path — return structured error, prompt the model to point
    customer at the dashboard).
- [ ] **2.11** Emit `ReschedulePropoosal` to
  `messages.metadata.reschedule_proposals[]`.

### 6.4 Multi-call + ordering safety

- [ ] **2.12** Reject mixed cancel + book in the same turn at the
  validator. Combining destructive + non-destructive actions in one
  reply is too confusing; force separate turns.
- [ ] **2.13** Allow `lookup_my_appointments` + `propose_*` in the
  same turn (lookup first, propose second) — mirrors how Claude
  uses availability fetch + booking in one turn today.

**Acceptance:** unit-tested orchestrator can dispatch all three
tools end-to-end; reject paths return structured errors; metadata
emits the right shape.

---

## 7. Phase 3 — Prompt rules + tests (1 day)

### 7.1 Prompt additions in `PromptTemplates.ts`

Append to the system prompt under a new "Lifecycle actions"
section. Five rules from scope §5:

- [ ] **3.1** Capability statement: "You can also help with
  rescheduling and cancelling existing bookings."
- [ ] **3.2** Lookup-first rule: "For reschedule or cancel, always
  call `lookup_my_appointments` FIRST. Never propose a cancel or
  reschedule from memory."
- [ ] **3.3** Disambiguation rule: "If multiple appointments match,
  ASK in plain text — do not guess."
- [ ] **3.4** 24h guard rule: "If the matched booking is within
  24h, do NOT call `propose_cancellation` (endpoint rejects);
  offer reschedule-request as an alternative."
- [ ] **3.5** Pending-request rule: "If lookup returns a
  `pendingRescheduleRequestId`, mention it and route the customer
  to the dashboard. Do NOT submit a second request."

### 7.2 Tests

- [ ] **3.6** `AgentOrchestrator.test.ts` — 6 new tests:
  - cancellation happy path (lookup → propose → metadata emit)
  - reschedule happy path
  - cancellation within 24h → tool rejected with structured error
  - reschedule when pending request exists → tool rejected
  - lookup with day-hint resolves correctly
  - multi-appointment lookup result narrowing
- [ ] **3.7** `PromptTemplates.test.ts` — 4 new tests:
  - capability section appears
  - lookup-first rule appears
  - 24h guard rule appears
  - pending-request rule appears
- [ ] **3.8** Full ai-agent suite must stay green
  (currently ~417 passing).

**Acceptance:** all new tests pass + suite intact.

---

## 8. Phase 4 — Frontend (2 days)

### 8.1 Components — new

- [ ] **4.1** `frontend/src/components/messaging/CancellationConfirmCard.tsx`
  — mirrors `BookingSuggestionCard` shape, red-ish accent, "Tap
  to cancel" CTA. Read-only audit variant for shop-side rendering.
- [ ] **4.2** `frontend/src/components/messaging/CancellationConfirmModal.tsx`
  — shadcn `Dialog` per Q4. Appointment summary + optional reason
  textarea + "Cancel appointment" destructive-styled Confirm
  button. Closing the modal abandons the action.
- [ ] **4.3** `frontend/src/components/messaging/RescheduleRequestCard.tsx`
  — inline-confirm variant per Q4. Single tap commits. Shows
  current slot + requested slot. Optimistic state pattern matching
  the `PinButton` 1.5s green-check.
- [ ] **4.4** Read-only audit variants for both cards (shop-side
  dashboard rendering, no click handlers).

### 8.2 ConversationThread wiring

- [ ] **4.5** Read `message.metadata.cancellation_proposals` and
  `reschedule_proposals` in `ConversationThread.tsx`; render the
  matching card under the AI bubble (just like
  `BookingSuggestionCard` rendering does today).

### 8.3 API client

- [ ] **4.6** Add `cancelAppointment(orderId, reason?)` and
  `requestReschedule(orderId, requestedDate, requestedTimeSlot,
  reason?)` to `frontend/src/services/api/appointments.ts` (create
  this file if not present — verify first).

### 8.4 Confirmation flow

- [ ] **4.7** Modal Confirm → POST `/cancel/:orderId` with optional
  reason → on success, close modal; the event-bus subscriber from
  Phase 5 will deliver the in-chat confirmation message.
- [ ] **4.8** Inline tap → POST `/reschedule-request` →
  optimistic UI update (card becomes "Request submitted ✓");
  event-bus subscriber from Phase 5 posts the chat message.

**Acceptance:** click-through of both flows shows the right
confirmation message in the chat thread after the tap.

---

## 9. Phase 5 — Event-bus subscribers + new event (1 day)

### 9.1 Publish `service.reschedule_request_created`

- [ ] **5.1** Emit from `RescheduleService.createRescheduleRequest`
  after successful insert. Payload per §3 above.
- [ ] **5.2** Confirm `AppointmentController.createRescheduleRequest`
  doesn't already publish a competing event.

### 9.2 New handler classes in AIAgentDomain

- [ ] **5.3** `services/CancellationConfirmationHandler.ts` —
  mirrors `BookingConfirmationHandler`. On
  `service.order_cancelled` for orders that originated from an AI
  booking card OR were proposed by the AI (detect via
  `conversation_id` linkage on the order), post a chat message
  ("Your X on Y is cancelled.") into the originating conversation.
- [ ] **5.4** `services/RescheduleRequestConfirmationHandler.ts` —
  on `service.reschedule_request_created`, post "Reschedule
  request submitted. The shop will approve it shortly." into the
  conversation.

### 9.3 Subscribe in domain init

- [ ] **5.5** `AIAgentDomain/index.ts` — add two more
  `eventBus.subscribe(...)` calls following the existing
  `service.order_completed` + `service.order_paid` pattern.
- [ ] **5.6** Guard: skip the auto-message if the cancellation
  source wasn't AI-initiated. Look at the
  `event.payload.cancelledBy` field (already set —
  `AppointmentController.ts:620`). Only post if the order
  originated from a chat conversation that's still alive.

### 9.4 QA fixtures

- [ ] **5.7** `docs/tasks/strategy/ai-sales-agent/qa-fixtures/`
  — mirror the Business-Data Insights pattern:
  - `setup-cancellable-appointment.ts` — creates an upcoming order
    24h+ out for the test customer + shop
  - `setup-within-window-appointment.ts` — creates an order <24h
    out to verify the guard path
  - `setup-pending-reschedule-request.ts` — creates a pending
    request to test the Q2 refuse path
  - `cleanup.ts` — hard-deletes test orders/requests by marker
- [ ] **5.8** Mirror the `tsconfig.json` + `README.md` pattern
  from the Business-Insights qa-fixtures so the scripts run
  via `cd backend && npx ts-node ...`.

**Acceptance:** end-to-end smoke test on staging — book a fixture,
cancel via AI chat, see confirmation message; reschedule-request
via AI chat, see confirmation message.

---

## 10. Out of scope for v1

- Direct customer-side reschedule (skipping request-approval).
- Group/recurring appointments.
- No-show disputes (separate surface).
- Partial multi-service cancellations.
- Auto-rebook on cancel.
- Voice input (Phase 7.4 tie-in if it ships).
- Shop-side AI reschedule/cancel (only customers have an AI
  Sales Agent chat; shops use the dashboard).
- `service.order_rescheduled` event (fired on shop approval) —
  add when a customer-side notification is wanted.

---

## 11. Risk checklist

- **Wrong appointment cancelled** — the highest-cost failure mode.
  Mitigation: server-side `customerAddress` ownership check at
  `propose_cancellation`; Q4 modal confirm; lookup-first prompt
  rule.
- **Stale `withinCancellationWindow`** — customer keeps the panel
  open past the 24h mark; clicks Confirm; endpoint rejects.
  Frontend should re-check on Confirm click and show "this is
  now within 24h, please contact the shop directly" instead of
  silently 400ing.
- **Disambiguation regression** — if Claude picks the wrong
  appointment from multiple matches without asking. Tested via
  Phase 3.6 unit test.
- **Event-bus subscriber timing** — confirmation message arriving
  before the modal close completes could look weird. Mitigation:
  the existing booking-confirmation handler already handles this
  with a small post-event delay; mirror its timing.
- **Reschedule request quota / abuse** — a customer could in
  theory ask Claude to submit many reschedule-requests. The
  Q2 refuse path (single pending request) caps this naturally.
- **Cancellation reason persistence** — if Q1's reason is
  exposed to shop dashboard, sensitive text could land there.
  Mitigation: same content moderation as message content; no
  raw HTML rendering.

---

## 12. Rough effort recap

| Phase | Effort | Cumulative |
|---|---|---|
| 1 — Schema migration | 0.5d | 0.5d |
| 2 — New tools + orchestrator wiring | 2.5d | 3d |
| 3 — Prompt rules + tests | 1d | 4d |
| 4 — Frontend | 2d | 6d |
| 5 — Event-bus + QA fixtures | 1d | 7d |

**Total v1:** ~6-8 days. Matches the scope-doc estimate.

---

## 13. Day-one starting point (when code work begins)

1. Create branch off latest `main`:
   ```bash
   git checkout main && git pull && git checkout -b deo/ai-sales-reschedule-cancel
   ```
2. Phase 1 — write + apply migration 127. Small, isolated, gates
   nothing else.
3. Phase 2.1-2.5 — `lookup_my_appointments` first. It's read-only,
   no mutation paths, easiest to test in isolation. Both other
   tools depend on it logically (Claude reads its output before
   proposing actions).
4. Then Phase 2.6-2.11 in either order. Cancel is slightly simpler
   (no availability check); reschedule has the pending-request
   collision logic to test.
5. Phase 3 tests as each tool lands.
6. Phase 4 frontend after Phase 2/3 stabilize.
7. Phase 5 last — confirmation messages depend on the rest working.

Per-task checkpoint notes (`> Done YYYY-MM-DD. <one-paragraph
summary of what shipped, including any deviations from this
plan>`) belong inline under each `[x]` checkbox, mirroring the
Business-Data Insights `phase-7-implementation.md` style. That
way a crash mid-session loses at most one task's progress.

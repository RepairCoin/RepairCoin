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

## 5. Phase 1 — Customer-cancel reason wiring (½ day)

**Schema state correction (discovered 2026-05-25 pre-coding):**
Migration `051_add_cancellation_fields_to_service_orders.sql`
(2025-12-26) already added the columns we need to
`service_orders`:

- `cancellation_reason VARCHAR(100)` — reason CODE (e.g.
  `customer_cancelled`, `schedule_conflict`).
- `cancellation_notes TEXT` — free-form text (e.g. the customer's
  typed reason from the modal).
- `cancelled_at TIMESTAMP` (+ index).

Plus `OrderRepository.updateCancellationData(orderId,
cancellationReason, cancellationNotes?)` already writes all three
+ sets `status='cancelled'`. The shop-side cancel path uses it.

**The actual gap:** the customer-side
`AppointmentRepository.cancelAppointment(orderId, customerAddress)`
does NOT use any of these — it only sets `status='cancelled'` and
`updated_at`. Notably it doesn't even set `cancelled_at`, which is
a small pre-existing data-quality bug we'll fix as a side effect.

So Phase 1 collapses to **one wiring task**, not a migration.

- [x] ~~1.1 Migration 127~~ — **not needed**. Columns already
  added by migration 051.
- [x] ~~1.2 Apply on DO~~ — **not needed**. Already applied
  2025-12-26.
- [x] **1.3** Verify `ServiceOrder` interface already carries the
  cancellation fields.
  > **Done 2026-05-25.** Discovered the interface was MISSING
  > `cancelledAt`, `cancellationReason`, `cancellationNotes` even
  > though the DB columns existed (migration 051). `mapOrderRow`
  > was also dropping them on read. Fixed both as a side-effect —
  > added the three fields to `ServiceOrder` and wired the
  > row→object mapping. Shop-side
  > `OrderRepository.updateCancellationData` was writing them, so
  > the dropped-on-read silent gap had been there since 051.
- [x] **1.4** Update
  `AppointmentRepository.cancelAppointment` to accept + persist
  reason + notes.
  > **Done 2026-05-25.** Signature now
  > `(orderId, customerAddress, reasonCode='customer_cancelled',
  > notes=null)`. Backward compatible — existing 2-arg callers
  > keep working. UPDATE now sets `cancelled_at`, `cancellation_reason`,
  > `cancellation_notes` alongside `status` + `updated_at`. Also
  > closed a pre-existing data gap: customer cancels never set
  > `cancelled_at`, so the analytics index on that column saw
  > zero customer-side rows.

  ```ts
  async cancelAppointment(
    orderId: string,
    customerAddress: string,
    reasonCode?: string,    // defaults to 'customer_cancelled'
    notes?: string | null,  // free-form text from modal (Q1)
  ): Promise<boolean>
  ```

  Update SET clause: `status='cancelled', cancelled_at=NOW(),
  cancellation_reason=$reason, cancellation_notes=$notes,
  updated_at=NOW()`. Keeps the existing 24h guard + ownership
  check intact.

- [x] **1.5** Update
  `AppointmentController.cancelCustomerAppointment` to accept +
  thread the reason.
  > **Done 2026-05-25.** Controller reads optional `reason` from
  > request body, defensively trims + caps at 500 chars, threads
  > it through to the repo as `notes`. Always passes
  > `'customer_cancelled'` as the `reasonCode`. Reason omitted is
  > still valid — the existing customer-cancel path keeps working
  > with no client changes required.

- [x] ~~1.6 Repo unit test~~ — **deferred to Phase 5 QA fixtures**.
  Setting up an isolated AppointmentRepository test file from
  scratch for a 4-line SQL-shape change is more overhead than
  value. Phase 3.6 orchestrator tests + Phase 5 staging fixtures
  exercise the same path end-to-end against a real DB.

**Acceptance:** existing customer-cancel path keeps working
(reason omitted is fine); when the AI's modal Confirm flow passes
a reason, it lands in `cancellation_notes`. Shop dashboard's
"cancelled — '<reason>'" display already exists and will start
showing the customer-provided text.

---

## 6. Phase 2 — Context preload + new propose-* tools (2 days)

**Design correction (2026-05-25 pre-coding):** the original plan
called for a `lookup_my_appointments` tool that Claude would invoke
to fetch appointments, then call `propose_cancellation` /
`propose_reschedule_request` in a follow-up iteration. But the
existing `AgentOrchestrator` does **a single Claude call** — no
tool-result agent loop like `InsightsController` has. Adding one
would be a significant restructure of the orchestrator's request
flow and risk regressions in the booking path.

**Simpler approach:** pre-load the customer's upcoming appointments
at this shop into the system prompt via `ContextBuilder` (same way
service info + history are already loaded). Claude reads the
appointment list directly from the prompt; no lookup tool needed.
The propose-* tools still validate that the proposed `order_id`
matches one of the pre-loaded appointments — preserves the
security boundary.

Tradeoff accepted: prompt grows by ~1 KB (max 10 appointments ×
~100 chars). Cost negligible vs the Claude-loop alternative.

### 6.1 Context preload — upcoming appointments

- [ ] **2.1** Add `getUpcomingAppointmentsForShop(customerAddress,
  shopId)` to `AppointmentRepository`. Returns rows with
  `orderId`, `serviceId`, `serviceName`, `bookingDate`,
  `bookingTime`, `status`, `withinCancellationWindow` (boolean,
  computed server-side from `booking_date + booking_time` ≥ 24h
  ahead). Filters to `status IN ('paid', 'scheduled')` and
  `booking_date >= CURRENT_DATE`. Hard cap at 10 rows.
- [ ] **2.2** Add `getPendingRescheduleRequestsForOrders(orderIds)`
  to `RescheduleRepository`. Returns a Map of `orderId →
  requestId` for rows with `status='pending'`. Used to enrich the
  appointment list with `pendingRescheduleRequestId`.
- [ ] **2.3** Add `upcomingAppointments` to
  `AgentContextSnapshot` (the type returned by
  `ContextBuilder.build`). Builder fetches both queries and merges.
- [ ] **2.4** Render the list into the system prompt via a new
  `PromptTemplates.renderUpcomingAppointmentsBlock(appointments)`.
  Show only when the list is non-empty. Each line: `- {serviceName}
  on {bookingDate} at {bookingTime} (status: {status}, order:
  {orderId.slice(0,8)}…){pending-marker}`.
- [ ] **2.5** Add to prompt the rule that the **`order_id`
  argument to propose_cancellation / propose_reschedule_request
  MUST match one of the order IDs listed above** — same enum-style
  constraint as `service_id` for booking, but enforced server-side
  in the orchestrator (Anthropic JSON schemas can't reference
  context-dependent enums easily).

### 6.2 `propose_cancellation` tool

- [x] **2.6** Define tool in `AgentOrchestrator.ts` next to
  `buildBookingSuggestionTool`.
  > **Done 2026-05-25.** `buildCancellationTool(upcomingAppointments)`.
  > order_id is enum-constrained to the customer's upcoming order
  > IDs (preloaded into context). reply_text capped at
  > BOOKING_REPLY_MAX_CHARS for visual consistency with booking.
  > Tool description tells Claude when to call (explicit cancel
  > requests), when NOT to call (policy questions, ambiguous
  > targets, within-24h windows), and that the order_id must match
  > one of the listed appointments.
- [x] **2.7** Server-side validation in the orchestrator.
  > **Done 2026-05-25.** Three guards: (1) order_id ∈ preloaded
  > appointment enum (defense-in-depth — Anthropic schema also
  > enforces); (2) `withinCancellationWindow` true (rejects
  > stale-context slip-through where Claude proposes a cancellation
  > the endpoint would 400 on); (3) reply_text non-empty. Plus
  > dedup on order_id (one card per appointment per turn). All
  > rejected blocks log a drop reason for forensic queries.
- [x] **2.8** Emit `CancellationProposal` to
  `messages.metadata.cancellation_proposals[]`.
  > **Done 2026-05-25.** Empty array → metadata key omitted, same
  > convention as booking_suggestions. Also stamps
  > cancellation_proposal_dropped diagnostic counters when blocks
  > fail validation. Tool is gated independently of the booking
  > tool — either can be present in the tools array without the
  > other.

### 6.3 `propose_reschedule_request` tool

- [x] **2.9** Define tool in `AgentOrchestrator.ts`.
  > **Done 2026-05-25.** `buildRescheduleTool(upcomingAppointments,
  > availabilitySlots)`. Uses a combined `requested_slot_iso` enum
  > (simpler than separate date/time-slot enums for the JSON schema).
  > order_id enum is the **eligible-only** subset — appointments
  > with a pending reschedule request are excluded at the schema
  > layer per Q2. Tool only emitted when both eligible-appointments
  > AND availability-slots are non-empty.
- [x] **2.10** Server-side validation in the orchestrator.
  > **Done 2026-05-25.** Five guards: (1) order_id ∈ upcoming
  > appointments; (2) order NOT pending reschedule (defense-in-depth
  > vs the schema-level exclusion); (3) requested_slot_iso ∈
  > availability slots; (4) matched slot's serviceId == order's
  > serviceId (reschedule stays on the same service — moving to a
  > different service would be a bug); (5) reply_text non-empty.
  > Plus dedup on order_id. All rejected blocks log a drop reason.
- [x] **2.11** Emit `RescheduleProposal` to
  `messages.metadata.reschedule_proposals[]`.
  > **Done 2026-05-25.** Empty array → metadata key omitted, same
  > pattern as cancellation_proposals + booking_suggestions.
  > reschedule_proposal_dropped counter captures forensic data on
  > rejected blocks. RescheduleProposal carries both current and
  > requested slot info plus the server-resolved humanLabel so the
  > frontend card doesn't have to locale-render the timestamp.

### 6.4 Multi-call + ordering safety

- [x] **2.12** Reject mixed cancel + constructive in the same turn.
  > **Done 2026-05-25.** Guard runs after all three dispatch blocks.
  > Rule: when `cancellation_proposals.length > 0` AND either
  > `bookingSuggestions.length > 0` OR `rescheduleProposals.length > 0`,
  > the constructive (booking/reschedule) proposals are cleared and a
  > `dropped_for_destructive_action_in_same_turn` reason is appended
  > to the matching drop-reasons counter. Destructive (cancel) wins
  > because a mis-cancel is irrecoverable; a missed booking just means
  > the customer can re-ask. Cancellation card is the only one that
  > renders in mixed-mode turns.
- [x] ~~2.13 Allow `lookup_my_appointments` + `propose_*` in same
  turn~~ — **N/A.** This task assumed a tool-based lookup pattern
  (the original design). The design pivot in Phase 2.1-2.4 moved the
  appointment lookup to a system-prompt preload, so there's no
  `lookup_my_appointments` tool to order against `propose_*`. The
  multi-call concern reduces to 2.12's mixed-cancel-and-constructive
  rule, which is implemented.

**Acceptance:** unit-tested orchestrator can dispatch all three
tools end-to-end; reject paths return structured errors; metadata
emits the right shape.

---

## 7. Phase 3 — Prompt rules + tests (1 day)

### 7.1 Prompt additions in `PromptTemplates.ts`

Added as rule 14 under UNIVERSAL_RULES. Replaces the lookup-first
framing from the original plan with a context-first framing (the
appointments are in the prompt, not behind a tool call).

- [x] **3.1** Capability statement.
  > **Done 2026-05-25.** Rule 14 opens with "LIFECYCLE ACTIONS —
  > reschedule and cancel existing bookings" + mentions both tool
  > names so Claude knows they exist.
- [x] **3.2** ~~Lookup-first~~ → **Context-first** rule.
  > **Done 2026-05-25.** Rule 14(a). "Never propose a cancel or
  > reschedule for an order_id you don't see in the upcoming-
  > bookings block above."
- [x] **3.3** Disambiguation rule.
  > **Done 2026-05-25.** Rule 14(b). "If multiple bookings could
  > match, ASK in plain text — never guess."
- [x] **3.4** 24h guard rule.
  > **Done 2026-05-25.** Rule 14(c). Anchors to the "within 24h"
  > marker rendered in the appointments block; offers the
  > reschedule-request alternative in the same breath.
- [x] **3.5** Pending-request rule.
  > **Done 2026-05-25.** Rule 14(d). Anchors to the "pending
  > reschedule request" marker; routes the customer to the
  > dashboard. Plus rule 14(e) for "stay on the same service" on
  > reschedule and 14(f) for don't-mix-destructive-and-constructive.

### 7.2 Tests

- [x] **3.6** `AgentOrchestrator.test.ts` — 6 new tests.
  > **Done 2026-05-25.** Repurposed for the context-preload design:
  > cancellation happy path, reschedule happy path, cancellation
  > within 24h → `cancellation_tool_within_24h_window` drop reason,
  > reschedule with pending request →
  > `reschedule_tool_pending_request_exists` drop reason, reschedule
  > with slot from different service →
  > `reschedule_tool_service_mismatch` drop reason, multi-call guard
  > drops booking when cancellation lands in the same turn. 100 →
  > 106 tests in the suite. The original "lookup with day-hint" /
  > "multi-appointment narrowing" tests are N/A under the
  > context-preload design.
- [x] **3.7** `PromptTemplates.test.ts` — 4 new tests + 4 bonus.
  > **Done 2026-05-25.** Five rule-14 tests (capability statement,
  > context-first, 24h guard, pending-request, no-mixing) + four
  > tests for the rendered upcoming-appointments block (omit when
  > empty, render when populated, within-24h marker, pending marker).
  > 128 → 137 tests in the suite.
- [x] **3.8** Full ai-agent suite green.
  > **Done 2026-05-25.** 835/835 passing across 40 suites
  > (was ~821 before Phase 3 — gained 14 from the new tests).

**Acceptance:** all new tests pass + suite intact.

---

## 8. Phase 4 — Frontend (2 days)

### 8.1 Components — new

- [x] **4.1** `frontend/src/components/messaging/CancellationConfirmCard.tsx`.
  > **Done 2026-05-25.** Red-accented card with XCircle icon. Tap
  > opens the modal. Special "Cancellation unavailable" state for
  > within-24h appointments (defense-in-depth — orchestrator
  > should already drop these but a stale client could render one).
  > Post-confirm state shows the same card with emerald + check.
- [x] **4.2** `frontend/src/components/messaging/CancellationConfirmModal.tsx`.
  > **Done 2026-05-25.** shadcn Dialog. Appointment summary, optional
  > reason textarea (500-char cap matching backend), destructive
  > red Confirm button. Submit-in-flight blocks modal close. 4 error
  > status handlers: 400 (within 24h), 401 (expired session), 404
  > (already cancelled), 500. Closing without confirming abandons +
  > resets form state.
- [x] **4.3** `frontend/src/components/messaging/RescheduleRequestCard.tsx`.
  > **Done 2026-05-25.** Blue-accented inline-confirm card per Q4 —
  > single tap fires the API call. Four states: idle, submitting
  > (spinner), submitted (emerald + check, sticky), error (red, 2s
  > then revert to idle). 4 error status handlers: 400, 401, 409
  > (pending request collision — defensive). No modal.
- [x] **4.4** Read-only audit variants on both cards.
  > **Done 2026-05-25.** Gray palette + no click handlers. Inline
  > on each component (no separate file) — same pattern as
  > BookingSuggestionCard's readOnly prop.

### 8.2 ConversationThread wiring

- [x] **4.5** Read both proposal arrays + render the matching cards.
  > **Done 2026-05-25.** Two new conditional blocks inserted directly
  > after the existing booking_suggestions render. `isOwnMessage` →
  > readOnly on shop-side. Same `space-y-1` wrapper convention as
  > the existing booking cards.

### 8.3 API client

- [x] **4.6** `cancelAppointment(orderId, reason?)` + reschedule.
  > **Done 2026-05-25.** Existing `appointmentsApi` already had
  > `createRescheduleRequest(orderId, requestedDate, requestedTimeSlot, reason)`
  > with the right shape. `cancelAppointment` extended to accept
  > optional `reason` and POST it when non-empty (omitted from body
  > otherwise to preserve the legacy no-reason path).

### 8.4 Confirmation flow

- [x] **4.7** Modal Confirm flow.
  > **Done 2026-05-25.** Calls `appointmentsApi.cancelAppointment`
  > with the orderId + reason. On success: parent's `onCancelled`
  > flips the card to "Cancelled" emerald state, then closes the
  > modal. Phase 5's event-bus subscriber will additionally post an
  > AI confirmation message into the chat thread.
- [x] **4.8** Inline tap flow.
  > **Done 2026-05-25.** Card calls `createRescheduleRequest` on
  > tap; transitions to a sticky "Request submitted" state on
  > success. Phase 5's subscriber posts the in-chat message.

**Acceptance:** end-to-end tap-through verified by typecheck +
manual browser smoke during Phase 5 QA fixtures. No automated
component tests in this codebase pattern (matches BookingSuggestionCard).

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

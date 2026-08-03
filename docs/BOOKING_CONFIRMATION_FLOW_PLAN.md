# Booking Confirmation Flow — Implementation Plan

**Status:** All three phases implemented and tested, **uncommitted**. Migrations 259 + 260 **applied and verified** on 2026-08-03.
**Branch:** `main` (uncommitted — check `git status`)
**Started:** 2026-07-31 · **Updated:** 2026-08-03

> **Migration numbers moved twice.** This work was originally written as 256/257 (and the
> related shop-favorites migration as 255). By the time the database was reachable, other
> branches had claimed 255 (`create_shop_terminal_tables`), 256 (`create_pos_sales`) and 257
> (`create_shop_tax_rates`) — none of which were visible from local files. Final numbers:
> **258** shop favorites, **259** order confirmation flow, **260** nudges + backstop.
> Always re-check `schema_migrations` immediately before applying.

Replaces "auto-expire and refund after 24h" with a flow where refunds are driven by the
**customer** saying the service didn't happen, not by the shop forgetting to press a button.

---

## The problem

`ExpiredOrderService` swept every order still sitting in `paid` **24 hours** after its
appointment, marked it `expired`, and **immediately refunded** RCN + Stripe. The only
trigger was that the shop never pressed "Complete".

Production data as of 2026-07-31:

| status | orders | value |
|---|---|---|
| cancelled | 313 | $51,012 |
| completed | 275 | $49,473 |
| **expired** | **238** | **$37,738** |
| no_show | 37 | $3,373 |
| paid | 8 | $988 |
| scheduled | 1 | $99 |

**152 of the 238 expired orders were both `shop_approved = true` and `payment_status = 'paid'`**
— real, confirmed, paid-for bookings auto-refunded solely because nobody clicked a button.
Every Zwiftech booking back to April 2026 is in this bucket; not one has ever been completed.

Compounding it: `OrderController.updateOrderStatus` and `ExpiredOrderService.canCompleteOrder`
**blocked** a shop from completing anything more than 24h past the appointment, telling it to
"contact support". A shop that noticed late could not fix its own booking — a significant
reason bookings went uncompleted in the first place.

The premise was wrong. A missing button-press is not evidence the service never happened.

---

## Decisions (confirmed)

| Decision | Choice | Consequence |
|---|---|---|
| Grace window | **7 days** (was 24h) | Covers weekends, holidays, an owner away from the dashboard |
| On window elapsing | **No refund, no settle** | Booking parks in `awaiting_confirmation`; only a human resolves it |
| Who can trigger a refund | **Customer only**, explicitly | Shop inactivity can never move money again |
| Report window | **14 days** after a booking reaches `completed` | Customer can still report it never happened |
| Never-ending limbo | **Escalate to admin at day 90** | No auto-settle, but a human is guaranteed to eventually decide |
| Late completion | **Always allowed** | Removing the block is the single highest-value fix |

Grace and report windows are per-shop configurable via `shop_no_show_policy` (Phase 2).

### Flow

```
appointment passes
  ↓  shop presses Complete at any point ──────────────> completed
  ↓  (7-day grace; shop nudged at +24h, +72h, +6d)
day 7: status → awaiting_confirmation     [NO refund, NO settle]
  ├─ shop completes ─────────────────────────────────> completed
  ├─ customer confirms "yes, this happened" ─────────> completed
  ├─ customer reports "this didn't happen" ──────────> refunded
  └─ nobody acts → customer reminders → admin queue at day 90

completed → customer may report within 14 days → refunded
```

---

## Phase 1 — Stop the bleeding ✅ IMPLEMENTED

No migration, no new status, no UI. Two files. Stops the revenue leak on its own.

**`backend/src/services/ExpiredOrderService.ts`**
- `EXPIRY_WINDOW_HOURS = 24` → `DEFAULT_COMPLETION_GRACE_DAYS = 7`, used by the sweep query
  and by `isPastGraceWindow` (renamed from `isOrderExpired` — it no longer means expired).
- **`processExpiredOrder` moves no money.** RCN refund, Stripe refund and `markAsExpired`
  removed. Returns zero refunds; the booking stays `paid` and remains completable.
  Logged at `debug` — the sweep runs every 30 min and these orders persist, so per-order
  `info` logging would repeat forever. `runExpiryDetection` still logs the aggregate count.
- **Refund logic preserved intact as `refundOrder(order, reason)`** — keeps the `cs_`
  checkout-session → PaymentIntent lookup and the `service_redemption_refund` transaction
  record. Currently unreachable; Phase 2's report endpoint calls it. It no longer sets the
  order's status: the caller owns that, so it cannot wrongly expire an order.
- **`canCompleteOrder` no longer refuses.** Kept as a method because `OrderController` calls
  it and Phase 2 reintroduces real guards there.

**`backend/src/domains/ServiceDomain/controllers/OrderController.ts`**
- Removed both completion blocks: the hard reject on `status === 'expired'` and the 24h cutoff.

**Tests:** `backend/tests/unit/CompletionGraceWindow.test.ts` — 7 passing. Covers the grace
boundary (day 1 / 6 / 8), asserts a past-window booking calls **none** of the refund paths,
asserts a 45-day-old booking is still completable, and asserts `refundOrder` still works when
deliberately invoked.

After Phase 1 an unconfirmed booking stays `paid` rather than being wrongly refunded.
Customers see it as "Scheduled" — imprecise, which Phase 2 fixes, but nobody loses money.

---

## Phase 2 — The confirmation state ✅ IMPLEMENTED

Proceeded without resolving the open decision below: it only governs a **data backfill of
historical rows**, which is separate from the schema and code. The migration deliberately
does **not** touch existing `expired` rows — they were already refunded, so moving them to
`awaiting_confirmation` would invite a second refund. That default is reversible.

> ✅ **Applied and verified 2026-08-03.** Confirmed live: the CHECK constraint accepts
> `awaiting_confirmation` (proven with a real UPDATE inside a rolled-back transaction), all
> 11 new columns exist, both policy columns exist, and all three indexes were created.

**Migration `backend/migrations/259_order_confirmation_flow.sql`** ✅ applied 2026-08-03

> **The detail that will break this if missed:** `service_orders.status` is guarded by CHECK
> constraint `service_orders_status_check`, pinned to nine values. It **must** be dropped and
> recreated or every write of the new status fails.

```sql
ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_status_check;
ALTER TABLE service_orders ADD CONSTRAINT service_orders_status_check
  CHECK (status IN (...existing nine..., 'awaiting_confirmation'));
```

Columns on `service_orders`: `awaiting_confirmation_at`, `customer_confirmed_at`,
`completion_reported_at`, `completion_report_reason`.
Columns on `shop_no_show_policy` (already owns appointment-outcome policy incl.
`dispute_window_days`): `completion_grace_days INTEGER DEFAULT 7`,
`completion_report_window_days INTEGER DEFAULT 14`.
Partial index on `status = 'awaiting_confirmation'` — these get listed by age.

Migration number: **256** was free as of 2026-07-31. Verify before writing — 253 and 254 were
already claimed in the database by other branches and were invisible from the local files.

**Backend**
- `OrderStatus` gains `'awaiting_confirmation'` in `backend/src/repositories/OrderRepository.ts`
  and `frontend/src/services/api/services.ts`.
- New `OrderRepository` methods: `markAwaitingConfirmation` (guard on `status = 'paid'` so a
  completion racing the sweep isn't dragged backwards), `markCustomerConfirmed`,
  `markCompletionReported` (guard so a double-submit can't refund twice).
- Sweep calls `markAwaitingConfirmation` instead of being notify-only.
- Endpoints in `backend/src/domains/ServiceDomain/routes.ts` + `OrderController.ts`, modelled
  on the existing dispute routes (`routes.ts:3946–4010`):
  - `POST /orders/:orderId/confirm` — **must** route through `OrderRepository.completeOrder()`
    so the `service.order_completed` event still fires and RCN rewards + team commission
    behave exactly as a shop completion.
  - `POST /orders/:orderId/report-not-completed` — valid from `awaiting_confirmation`, or from
    `completed` inside the report window. Calls `refundOrder()`.
- Registry entry `booking_awaiting_confirmation` in `notificationRegistry.ts`, dispatched via
  `getNotificationGateway()` per CLAUDE.md. `service_appointment_expired` uses the legacy
  `notificationService.createNotification` directly — **do not copy that**. Push bodies build
  from **metadata only** (push builders never receive the in-app `message`).

**Frontend**
- `frontend/src/components/customer/ServiceOrdersTab.tsx`: add `awaiting_confirmation` to the
  three status switches (`getStatusInfo`, `getProgressPercentage`, `getCurrentStep`) exactly as
  `expired` was added — step 3 of 5, amber bars — plus an action card with **"Yes, this
  happened"** / **"This didn't happen"**. Confirm dialog + toast, never `confirm()`. Add to the
  status help legend.
- Surface "Report a problem" on `completed` orders inside the 14-day window.
- `frontend/src/components/shop/bookings/BookingsTabV2.tsx` + `BookingFilters.tsx`: an
  `awaiting_confirmation` filter, visually urgent — these are unpaid-out bookings — with
  Complete enabled.

---

## Phase 3 — Nudges and the no-limbo backstop ✅ IMPLEMENTED

**Migration 260** adds the nudge/reminder flag columns and `needs_admin_review_at` (+ a partial
index). Depends on 259. ✅ applied 2026-08-03.

**Deviation from the original plan:** the nudges do **not** live in
`AppointmentReminderService`. Its `REMINDER_CONFIGS` are all shaped as "the appointment is N
hours in the **future**" and are customer-facing; these are past-appointment and shop-facing, so
folding them in would have meant adding a direction concept to every config and branching the
query. `ExpiredOrderService` already owns exactly the right query shape (paid + past appointment
+ joined shop/customer/service), so they went there as `sendCompletionNudges()` and
`sendConfirmationRemindersAndEscalate()`. Both are wired into the existing 30-minute sweep in
`AutoNoShowDetectionService.runExpiryDetection()`, in a `try` that cannot fail the expiry pass.

- **Shop nudges** at +24h / +72h / +6d while still `paid` (`booking_completion_nudge`).
- **Customer reminders** at day 7 / 21 / 45 in `awaiting_confirmation`
  (`booking_confirmation_reminder`).
- Each stage stamps its flag column **only after a successful dispatch**, so a transient
  notification failure retries next pass rather than silently skipping that nudge forever.
- Stages run **latest-first**, and firing one stamps every earlier stage. A booking already
  past +6d matches all three stages at once — true of anything in flight at first deploy, or
  after any sweep downtime — and without this the shop got three notifications in one pass for
  a single booking. Found by running the real SQL against production data (2 bookings would
  have produced 6 notifications); pinned by regression tests in `CompletionGraceWindow.test.ts`.
- **Day 90** sets `needs_admin_review_at` — a flag, *not* a status change.

**Admin backstop** — `GET /api/admin/stale-bookings` (oldest first) and
`POST /api/admin/stale-bookings/:orderId/resolve` with `action: 'complete' | 'refund'`.
`complete` routes through `completeOrder()` and emits `service.order_completed`, so RCN rewards
fire as normal; `refund` flips status first via the guarded `markCompletionReported` then calls
`refundOrder()`. Surfaced by `frontend/src/components/admin/StaleBookingsPanel.tsx`, rendered at
the top of `AdminDisputeTab` and **self-hiding when the queue is empty**.

Day 90 is deliberate: card networks generally stop accepting refunds around 120–180 days, so
this leaves headroom to still refund. Without it, an ignored booking becomes permanently
unrefundable and the customer is the one who loses.

---

## Open decision — no longer blocking

**What to do with the 152 existing expired orders.** Currently taking the first option below
(leave them), which is what Phase 2 shipped. They were already refunded, so they cannot simply
be moved to the new status. Either:

- **Leave them.** They keep the improved `expired` UI (shipped 2026-07-30) which now shows real
  progress — Requested → Paid → Approved — in amber, and explains the refund. Simplest, honest.
- **Migrate selectively.** Move only those whose refund demonstrably failed (check
  `stripe_payment_intent_id` against Stripe, and the RCN transaction record).

`expired` becomes legacy either way: no new order enters it, and its UI stays for history.

---

## Known loose end

`OrderRepository.markAsExpired` is now **dead code** — nothing calls it after Phase 1. Left in
place because `expired` remains a legacy status with historical rows, but it is a method that can
still expire an order. Worth deleting if nothing needs it by the end of Phase 2.

---

## Verification

**Done 2026-08-03:** every new query was executed against the live schema — the sweep, all
three nudge stages, the reminder stages and the admin list as reads; the four state
transitions inside a rolled-back transaction. Both concurrency guards were confirmed to match
0 rows on a second attempt (re-park, double-refund), and the day-90 escalation was confirmed
to flag. No production data changed. This is what surfaced the nudge duplication bug — mocked
pools cannot catch it.

**Still not done:** no HTTP request has hit the four new endpoints, and no booking has moved
through the flow on a running server.

1. `cd backend && npx tsc --noEmit` — clean. `cd frontend && npx tsc --noEmit` — baseline is
   **213 pre-existing errors**; the count must not rise.
2. **Phase 1 regression (the main fix):** a shop completing a booking 1 day *and* 5 days after
   the appointment must succeed — both were blocked before.
3. **Phase 1:** back-date a `paid` order 8 days, run `runExpiryDetection()`, assert the status is
   still `paid` and **no Stripe refund was issued**. ✅ covered by `CompletionGraceWindow.test.ts`
4. **Phase 2:** same setup → assert `awaiting_confirmation`, no refund, both parties notified.
   Then shop completes → `completed` with RCN rewards issued. Separately, customer reports →
   `refunded`, RCN returned, transaction recorded.
5. Boundary tests: grace day 6 vs day 8 (✅ done); report window day 13 vs day 15.
6. Notification tests in `backend/tests/unit/NotificationGateway.test.ts`, following the
   `shop_new_service` block — channel fan-out plus push bodies built from metadata.
7. Confirm the CHECK constraint accepts the value:
   `UPDATE service_orders SET status='awaiting_confirmation' WHERE order_id='<test>'`.

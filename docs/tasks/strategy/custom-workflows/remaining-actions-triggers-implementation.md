# Custom Workflows — the last action and the last three triggers

**Written 2026-08-05.** Implementation plan for the items in `scope.md` §9.0 list B: one action
(*create a task / flag*) and three triggers (*booking created*, *repair ready for pickup*,
*subscription lapsed*).

---

## The headline: only one of these four is actually small

`scope.md` §9.2 says a new action "costs one `register()` call plus its config UI". That was true of
`run_campaign`, `ai_step` and `draft_reorder` — **because the thing each of them acts on already
existed.** There were campaigns to send, a model to call, a `purchase_order_suggestions` table with a
card already rendering it.

That is not true of what is left. I checked each one against the code rather than the scope doc, and
three of the four are blocked on something that does not exist yet:

| Item | The part nobody costed | Real size |
|---|---|---|
| ✅ **Booking created** | The event exists but **the main booking path never publishes it.** | **S** — done 2026-08-05 |
| **Create a task / flag** | **No task table exists anywhere in the platform.** And a task list nobody can see is worse than no task list. | **L** — migration + repo + action + a UI surface |
| **Subscription lapsed** | The engine **skips shops that are not entitled** — i.e. exactly the shops this fires for. Dead on arrival without a deliberate carve-out. | **M** — event + an entitlement exception |
| **Repair ready for pickup** | **No such status exists** on `service_orders`. It is a new lifecycle state, not a trigger. | **XL** — hand back, see §4 |

**Recommended order: ~~Booking created~~ → Create a task → Subscription lapsed → Repair ready.**
That is cheapest-first *and* value-first, which is unusual and worth taking advantage of. Repair-ready is
last because it is not really a workflow feature at all; see §4.

**Before starting the next one:** the two blockers named below are questions for a person, not code.
`create_task` needs **task list or flag?** answered, and `subscription_lapsed` needs the **entitlement
carve-out** decided. Both change what gets built, so neither should be started on an assumption.

---

## 1. Trigger: `booking_created` — S — ✅ **DONE 2026-08-05** (`f0a70bb32`, `67584cdc1`)

Shipped and verified on staging. The plan below was right about the trap, and building it surfaced a
second one nobody had predicted — see the note at the end of this section and §9.7 of `scope.md`.

### What exists

`service.order_created` is already published, with the right payload shape
(`{ orderId, customerAddress, shopId, serviceId, status }`):

- `src/domains/AdsDomain/services/LeadBookingService.ts:199` — bookings made from an ad lead
- `src/domains/ServiceDomain/controllers/ManualBookingController.ts:307` — bookings a shop enters by hand

### The trap

**The main path does not publish it.** Customer self-service bookings are created in
`ServiceDomain/services/PaymentService.ts:771` (`createOrderFromPayment`), and that call site publishes
nothing. `OrderRepository.createOrder` — the only place rows are inserted for that path — has no event.

So subscribing to `service.order_created` as-is gives a trigger that fires for **manual and ad-lead
bookings only** and silently ignores the ones customers make themselves. The rule would look active, the
metrics would look plausible, and the majority of bookings would never fire it. This is the same failure
shape as `d95feeb07` and BUG-010: not an error, an absence.

### Steps

1. **Publish from the main path first.** In `PaymentService.createOrderFromPayment`, after
   `createOrder` succeeds, publish `service.order_created` with the same payload the other two use
   (`status: 'paid'` there — `adsEventListeners.ts:67` already reads `status` to decide `booked` vs
   `paid`, so this is the shape it expects). Non-blocking `.catch()`, matching `LeadBookingService:201`
   — a booking must never fail because an event did not go out.
2. **Verify no double-fire.** `ManualBookingController` and `LeadBookingService` insert directly, so they
   do not route through `createOrder`; confirm that holds before shipping, or a manual booking fires
   twice.
3. Add `'booking_created'` to `VALID_EVENT_TYPES` (`AutoMessageController.ts:26`). Customer-scoped, so it
   does **not** go in `SHOP_SCOPED_EVENTS`, and `triggerProvides` returns `'customer'` — every existing
   action pairs with it.
4. Subscribe in `MessagingDomain.setupEventSubscriptions`, calling
   `autoMessageSchedulerService.handleEventTrigger('booking_created', {...})` — same shape as
   `booking_completed` at `messaging/index.ts:43`.
5. Frontend: one entry in the trigger list, plus a template ("thanks for booking — here's what to
   expect").

### What to be careful about

- **A booking confirmation already exists.** Check what the platform sends on booking today before adding
  a trigger that lets shops send a second one. If a confirmation already goes out, the honest framing for
  this trigger is *"send something extra when a booking is made"*, and the template copy must not
  duplicate the confirmation.
- **Cancellation flows.** A booking created then cancelled 30 seconds later still fired. That is correct
  but surprising; `stop_on_booking`-style exit conditions do not apply here.

### Tests

Unit: the pairing guard accepts `booking_created` with every action. Integration: publish the event and
assert one send. Manual: a real Stripe-paid booking on peanut fires it — **that is the one that matters**,
because it is the path that is currently silent.

### What actually happened

Both concerns above were real. The confirmation **does** already exist (`booking_confirmed` in the
notification registry), so the template was written to carry what it can't — what to bring, where to
park — rather than to repeat it.

**The "manual" test did not need a real card.** Stripe runs in test mode on staging, so a test-mode
PaymentIntent confirmed with `pm_card_visa` and POSTed to `/api/services/orders/confirm` reaches
`handlePaymentSuccess` by exactly the production route, on the **deployed** server rather than a laptop.
That is `_qa_booking_created_stripe_test.ts`, and it is the technique to reuse for any
payment-adjacent trigger. The trigger fired 83ms after the order.

**It found a second bug the plan did not predict**, and a better one: `hasSendForTriggerReference` — the
"same order shouldn't trigger twice" guard — had never worked for immediate sends, engine-wide, because
the reference was never recorded. Written up in `scope.md` §9.7. The relevant lesson for the triggers
still to build is there too: **assert on what gets written to the row, not on what gets called**, and
never let a send cap stand in for a dedup guard — a green produced by the wrong mechanism is worse than
a red.

---

## 2. Action: `create_task` — L (bigger than it sounds)

### What exists

**Nothing.** There is no tasks table, no to-do list, no "assigned to me" surface. `flagged_reviews`
(`migrations/092_create_moderation_system.sql:82`) is review-moderation-specific and not a general task
store. `notify_staff` sends a notification, which is the closest thing today — and it is exactly what
this action is meant to improve on, because a notification is read once and gone.

### Why it is L, not S

The action itself is genuinely one `register()` call. The cost is everything around it:

- a table and migration
- a repository
- **a surface where the shop can see and complete the tasks**

Skip the third and this action writes rows into a void. That is worse than not shipping it: the workflow
reports success, the shop believes something was queued, and nothing is ever actioned. If we are not
willing to build the surface, **do not build the action** — `notify_staff` already covers "tell me", and
the honest answer is that "remind me until it's done" is a to-do feature the platform does not have.

### Steps

1. **Migration** — `shop_tasks`: `id`, `shop_id`, `title`, `body`, `source` (`workflow` | `manual`),
   `source_rule_id`, `customer_address` (nullable), `order_id` (nullable), `status`
   (`open`/`done`/`dismissed`), `due_at`, `created_at`, `completed_at`, `completed_by_member_id`.
   Check the next free migration number **across all branches and remotes** before writing it — duplicate
   integers silently skip the SQL.
2. **Dedup, like `draft_reorder`.** A recurring trigger must not stack ten copies of the same task. Key on
   `(shop_id, source_rule_id, customer_address/order_id)` where a matching `open` task exists.
3. **Action** — `createTaskAction.ts`. Register it; add to `AUTO_MESSAGE_ACTION_TYPES`,
   `NO_TEMPLATE_ACTIONS` (it composes no message), and `ACTION_NEEDS`.
   **`needs: 'nobody'`** and put it in `SHOP_SCOPED_ACTIONS` — the task belongs to the shop, so it must
   fire **once per run, not once per customer in the audience**. Getting this wrong turns Target Audience
   into a multiplier and buries the shop in 200 identical tasks; `AutoMessageShopScopedFanout.test.ts`
   exists precisely because that bug already happened once.
   Note it can still *reference* a customer when the trigger provides one — reference is not scope.
4. **Surface** — a Tasks card on the shop dashboard: open tasks, complete/dismiss, filter by source.
   Reuse the `POSuggestionsCard` shape; it solves the same problem (a queue of machine-proposed items a
   human approves).
5. **Notify on create** — via the notification gateway (`getNotificationGateway().dispatch(...)` plus a
   `notificationRegistry` row), never hand-wired. Otherwise tasks are only discovered by visiting the tab.

### Open question for management

Is this a *task list* (persistent, completable, has a home) or a *flag* (a marker on a customer/booking
that shows up when you open that record)? The scope line says "or", and they are different features. The
plan above builds the first. The second is cheaper but only useful if someone opens the record.

---

## 3. Trigger: `subscription_lapsed` — M, with a trap that invalidates the naive build

### What exists

- Events: `subscription:cancelled`, `subscription:paused`, `subscription:reactivated`,
  `subscription:resumed` — published from `admin/routes/subscription.ts:317,499,696,1128`, i.e. **admin
  actions**, not Stripe.
- Stripe states are tracked (`past_due`, `unpaid`, `canceled`) and read in
  `shop/routes/subscription.ts:126,297`, but a payment lapse does not publish a domain event today.

### The trap — read this before estimating

`AutoMessageSchedulerService.isShopEntitled()` (line ~182) skips every shop that is not entitled to
`aiCampaignsAdvanced`, and `processScheduledMessages` additionally skips any shop where `shop.active` is
false (line ~770). **A subscription lapse is precisely the event that makes both of those false.**

So the naive implementation — publish an event, subscribe to it — produces a trigger that can never fire.
It would pass a unit test with a mocked registry and do nothing in production, which is the worst
possible failure mode: invisible.

Three ways out, and this needs a decision before any code:

- **(a) A transactional carve-out.** Let this one trigger bypass `isShopEntitled`, the way the
  notification gateway lets `transactional` bypass preferences. Narrow and explicit: one event type,
  documented at the gate. **Recommended.**
- **(b) Fire on the way down.** Publish the event *before* the entitlement flips, from inside the
  lapse-handling code path. Fragile — it depends on ordering that nothing enforces.
- **(c) Scope it to warning states only** (`past_due`, i.e. payment failed but not yet cut off) and
  explicitly do not support fired-after-cancellation. Cheapest, honest, and covers the actual use case:
  "tell me when a shop is about to lose access", not "after".

### Steps (assuming (a))

1. Publish `subscription:lapsed` where Stripe status transitions to `past_due`/`unpaid`/`canceled`, plus
   the existing admin cancel path. One event, one payload: `{ shopId, reason, previousStatus, at }`.
2. Add `'subscription_lapsed'` to `VALID_EVENT_TYPES` **and to `SHOP_SCOPED_EVENTS`** — it happens to the
   shop, with no customer attached, so it may only pair with actions that need no recipient
   (`notify_staff`, `create_task`, `draft_reorder`). `actionTriggerError` already enforces this once the
   event is in the set.
3. Add the entitlement carve-out at `isShopEntitled`'s call site for this event type, with a comment
   explaining why — otherwise someone will "tidy it up" later and silently kill the trigger.
4. Template: "your subscription needs attention" → `notify_staff`.

### What this is actually for

Note the audience: this fires for the **shop**, about the **shop's own** billing. It is an internal alert,
not customer messaging. Worth confirming that is what was wanted — if the intent was *"a customer's*
subscription lapsed", that is a different feature and the platform has no customer subscriptions.

---

## 4. Trigger: `repair_ready` — XL, and probably mis-scoped

### What exists

Nothing usable. `service_orders.status` is constrained to
`pending | paid | approved | scheduled | completed | cancelled | refunded | no_show | expired`
(`migrations/210_allow_scheduled_approved_order_status.sql:10`). **There is no "ready for pickup" state,
and no way for a shop to set one.**

### Why this is not a trigger task

A trigger fires on something that happens. Nothing happens today — no one can mark a repair ready, so
there is no event to subscribe to. Building this means:

1. a migration extending the status CHECK constraint (the fourth such migration on this column),
2. deciding where `ready` sits in the lifecycle and what it does to every existing status query —
   including the metrics filters we split only last week (`REVENUE_STATUSES` is an **allow-list**, so a
   new status is correctly excluded from revenue by default, but `NON_BOOKING_STATUSES` and every
   dashboard count need auditing),
3. shop UI to set it — on the order detail, the bookings list, and probably the mobile app,
4. *then* the event and the trigger, which is the small part.

Steps 1–3 are an order-lifecycle feature that happens to enable a trigger. It should be scoped, estimated
and prioritised as that, by whoever owns the booking flow — not absorbed into workflow automation because
one line in §9.3 made it look like a peer of the other three.

### The cheap alternative, if the goal is "tell the customer their repair is ready"

A **`notify_customer_ready` action** on the existing `booking_completed` trigger, or a manual "notify
ready" button that publishes the event without a persisted status. Gets the customer-facing outcome
without touching the order lifecycle. **Worth asking which outcome was actually wanted** before anyone
builds a status column.

---

## Sequencing and what each unlocks

1. ~~**`booking_created`**~~ ✅ **shipped.** It did fix the silent gap in `service.order_created` that ads
   attribution was also missing — self-service bookings never advanced the lead Kanban, and now do.
2. **`create_task`** — the only item that adds a genuinely new capability, but do not start it until
   the task-vs-flag question is answered and the surface is agreed.
3. **`subscription_lapsed`** — needs the entitlement decision first. Cheap after that.
4. **`repair_ready`** — hand back for proper scoping as an order-lifecycle change.

## Cross-cutting checklist for every item here

- Add to `VALID_EVENT_TYPES` / `AUTO_MESSAGE_ACTION_TYPES` **and** to the guard tables
  (`SHOP_SCOPED_EVENTS`, `ACTION_NEEDS`, `SHOP_SCOPED_ACTIONS`, `triggerProvides`, `actionFitsTrigger`) —
  the guard is only as complete as its tables, and a missing entry fails open.
- Mirror the same rules in the builder's `ACTIONS` table so the UI filters to what the API will accept.
  A trigger the API rejects but the form offers is a worse bug than one that does not exist.
- Shop-scoped means **once per run**. Re-read `AutoMessageShopScopedFanout.test.ts` before writing any
  new action.
- Dedup anything a recurring trigger can produce more than one of.
- **Verify in a browser and against real data**, not just `npm run test:unit`. Every bug found in the
  2026-08-03 pass was invisible to 2,656 passing tests and a clean typecheck.
- **Assert on what gets written, not on what gets called.** The dedup guard (`scope.md` §9.7) was tested
  by checking it ran; what it needed was the value on the send row, and nothing looked there for months.
- **Never let one mechanism cover for another in a test.** A dedup check with a send cap of 1 passes on
  the cap alone. Pair every "it didn't happen twice" assertion with an "it still happens for a genuinely
  new input" one, or a rule that never fires at all will look like a working guard.
- **Prove a new test fails without the fix.** Two of this batch's five did; the other three were meant to
  keep passing, and confirming which is which is the whole value of the exercise.

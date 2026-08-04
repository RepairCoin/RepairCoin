# FixFlow POS + Stripe Terminal — Implementation Plan

**Status:** Planning · decisions locked, no code written
**Date:** 2026-08-03
**Scope:** Backend + web frontend. No `mobile/` work.

---

## 1. Strategic framing

The goal is not to build another Square. It is to build the operating system for
service businesses, where payments are one step in a workflow that FixFlow already
owns end to end — booking, inventory, CRM, loyalty, marketing, automation.

Stripe handles the money. FixFlow owns everything before and after it. That is the
competitive position: we do not try to beat Square at being a terminal, we make the
terminal the least interesting part of the product.

**Architecture:**

```
FixFlow POS (web, tablet)
      ↓
Stripe Terminal SDK
      ↓
Merchant's own Stripe account (direct charges)
      ↓
Stripe Reader
```

Payments settle directly into the merchant's Stripe account. FixFlow receives webhooks
and updates bookings, tickets, inventory, CRM, loyalty, reports and commissions.

---

## 2. Codebase audit — what already exists

This was verified against the repo, not assumed. The leverage is high.

| Roadmap need | Status | Where |
|---|---|---|
| Shop's Stripe account connected | **Done** — both OAuth-adopted Standard and platform-created Express | `backend/src/services/StripeConnectService.ts` |
| Charging on the shop's account | **Done** — direct charges with `stripeAccount` + `application_fee_amount` | `backend/src/domains/ServiceDomain/services/PaymentService.ts` ~661-671 |
| Platform commission | **Done** — tier-based bps, refund claw-back handled | `backend/src/utils/platformCommission.ts`, `PaymentsDomain/services/RefundIssuer.ts` |
| Fiat ledger + refunds | **Done** | `backend/src/domains/PaymentsDomain/`, `repositories/PaymentRepository.ts` |
| Inventory | **Deep** — per-location stock, `reserved_quantity`, `service_inventory_items` parts links, auto-deduction on `service:completed`, POs, vendors, low-stock alerts, analytics | `backend/src/domains/InventoryDomain/`, `repositories/InventoryRepository.ts` |
| Sellable products | **Done** — items carry `price`, `cost`, `sku`, `barcode` | `repositories/InventoryRepository.ts:10-30` |
| Locations | **Done** — `locationId` already on orders | `repositories/ShopLocationRepository.ts` |
| Loyalty / reviews / receipts / reminders | **Done** — RCN issuance, `RcnRedemptionService`, review requests, notification gateway, Resend email | various |
| Staff commissions | **Done** — shipped | `CommissionsTab.tsx` |

**Phase 5 (Inventory Integration) is roughly 80% built.** The machinery exists; it just
needs a POS sale to fire into it.

---

## 3. The actual blocker

**FixFlow has no multi-line sale.**

`ServiceOrder` is one order = one `serviceId` — a singular column, no line-items table
(`backend/src/repositories/OrderRepository.ts:8-55`). A POS cart is inherently
multi-line: two services, a screen protector, a discount, tax, split across card and cash.

Everything from Phase 2 onward hangs off a sale model that does not exist. This is the
keystone and it is more work than the Terminal integration itself.

### Secondary gaps

- ~~**No tax engine anywhere.**~~ Built in S3 for POS sales; online bookings still
  charge no tax (see Open questions).
- **No gift card concept.** Fully greenfield.
- **No device / warranty model.** Phase 6's "devices owned, warranty" is greenfield.
- **No repair ticket model.** Phase 4 is greenfield; existing "ticket" references are
  support-chat tickets, unrelated.

### Stripe-side gap — none (corrected 2026-08-03)

An earlier draft of this plan claimed `card_present` was a missing account capability that
the platform had to request, and that Standard vs Express split into two onboarding paths.
**Both claims were wrong.** Verified against Stripe's docs and the installed SDK:

- **`card_payments` is the only capability Terminal needs**, and
  `getOrCreateExpressAccount` already requests it (`StripeConnectService.ts:421`).
  Stripe's Terminal-with-Connect docs state it plainly: *"Terminal connected accounts must
  have the `card_payments` capability to perform transactions."*
- **`card_present` is a PaymentIntent `payment_method_types` value, not an account
  capability.** This is confirmable in the SDK: stripe-node 18.5.0's
  `Stripe.Account.Capabilities` has no `card_present` member (only `card_issuing`,
  `card_payments`, `kr_card_payments`), while `card_present` appears throughout
  `PaymentIntents.d.ts` and `PaymentMethods.d.ts`.
- **No Standard/Express split.** Locations and Readers are created with the platform's
  secret key plus the `Stripe-Account` header, identically for both account types.

Net effect: S0 shrinks to surfacing readiness. There is no capability to request and no
two-path onboarding to design.

---

## 4. Locked decisions

### 4.1 POS surface — web, tablet-responsive

Built in the existing Next.js shop dashboard, optimized for tablet. No `mobile/`
involvement.

**Consequence:** Tap to Pay on iPhone/Android is off the table — it requires a native
app. Card entry is via Stripe reader or manual keyed entry, so **physical reader
hardware is required before launch**. Development can proceed on Stripe's simulated
reader without hardware.

### 4.2 Commission on POS sales — same as bookings

`platformCommission.ts` is already tier-based and generic:

| Tier | Commission |
|---|---|
| Free / Starter / Growth | 1% (100 bps) |
| Business | 0.5% (50 bps) |

It reuses as-is. Rename `computeBookingCommissionCents` to drop "booking" and call it
from the POS path. `RefundIssuer` already claws the fee back on refunds. The existing
guard (`Math.min(fee, amountCents - 1)`) keeps the fee below the charge.

Two consequences of this choice:

1. **Cash sales are structurally uncommissionable.** No Stripe charge means no
   `application_fee_amount`. Either accept that counter cash is free, or accrue a fee
   and bill it on the monthly invoice — the latter is an invoicing feature and a trust
   conversation. **Decision: accept it for MVP**, monitor the cash/card mix.
2. **On split tender, the fee is taken on the card portion only.** Simple and
   predictable. Computing on the full sale total but charging against the card leg gets
   ugly — a $500 sale paid $10 card + $490 cash would eat half the card leg. The
   tradeoff is a mild incentive to steer customers to cash; monitor rather than
   pre-solve.

### 4.3 Tax — manual per-shop rates with category-level taxability

**Not Stripe Tax. Not flat-rate.**

Reasoning:

- **Decisive:** cash and split payments never touch Stripe. Stripe Tax can only compute
  on a Stripe charge, so cash sales would get no calculation at all — we would need our
  own engine regardless, and end up maintaining two systems.
- Stripe Tax adds a per-transaction fee.
- Under direct charges, Stripe Tax registrations live on **each shop's** account, not
  ours — per-shop configuration burden and a support surface we cannot control.
- Stripe Tax's real value is nexus tracking across states, which matters for remote
  sellers. A repair shop selling across its own counter has simple physical nexus —
  essentially one rate per location. We would be paying for a problem we do not have.
- Flat-rate is wrong precisely for repair: parts taxable, labor often not. Building
  parts-vs-labor in from the start is marginally more work; retrofitting it once sales
  are recorded is painful.

**Shape:**

- `shop_tax_rates` — shop-level default with per-location override (locations inherit,
  unlike holiday overrides which deliberately do not cascade).
- `taxable` flag plus a goods/labor category on both inventory items and services.
- Each sale line stores its **resolved** rate and tax amount as a snapshot. Historical
  receipts must never change when a shop edits its rate.

Stripe Tax remains available as a later add-on for shops that want automated filing.

---

## 5. Build order

S0 and S1 are independent of the sale model, so Terminal can ship while S2 is still
being designed. That is the fastest route to something real in a shop's hands.

| # | Slice | Size | Depends on |
|---|---|---|---|
| S0 | Terminal readiness — extend `ConnectAccountStatus`, Stripe Location strategy — **built** | S | — |
| S1 | **Phase 1** — reader pairing, status, default reader, disconnect, test charge — **built, untested against hardware** | M | S0 |
| S2 | **Sale model** — `pos_sales` / `pos_sale_items` / `pos_sale_payments` — **shipped (#710)** | L | — |
| S3 | Tax — rates, taxability, per-line snapshot — **built** | M | S2 |
| S4 | **Phase 2** — POS UI, tablet web, split tender — **shipped (#715)** | L | S1, S2, S3 |
| S5 | **Phase 5** — inventory wiring, per-branch stock, cost/margin — **built** | S | S2 |
| S6a | **Fiat-ledger reconciliation** (see 7a) — **built** | M | S2 |
| S6b | **Phase 8** — receipt, loyalty, review via notification gateway — **see 8a** | M | S2 |
| S7 | **Phase 6** — devices & warranty model | M | S2 |
| S8 | **Phase 4** — repair ticket workflow | L | S2, S7 |
| — | **Phases 3 & 7 (AI)** — deferred handoff | — | S2 |

### S0 — Terminal readiness — **done**

- Extended `ConnectAccountStatus` with `cardPaymentsCapability` and `terminalReady`
  (capability active **and** `charges_enabled`). No capability request needed — see the
  correction above.
- **Stripe Location strategy:** Terminal requires a Location object per reader.
  `multiLocation` is Business-tier gated, so every shop needs one implicit Stripe
  Location derived from its primary address regardless of tier.

### S1 — Phase 1: Terminal & readers — **built**

- Migration `255_create_shop_terminal_tables.sql` — `shop_terminal_locations`,
  `shop_terminal_readers`. **Not yet run.**
- `ShopTerminalRepository`, `StripeTerminalService`, routes at `/api/shops/terminal/*`.
- `CardReaders` panel on the Get Paid page, rendered only when `terminalReady`.

The test payment is a $1 authorization with `capture_method: 'manual'`, cancelled on
finish — never captured, so it is safe to run in live mode.

Reader Online/Offline comes from Stripe's reader `status`, polled on read. Stripe's own
SDK warns against using it in flows that block taking payments, so it is displayed but
never gates anything.

### S2 — The sale model (keystone)

`pos_sales` / `pos_sale_items` / `pos_sale_payments`. Split tender across card, cash,
gift card and RCN. Lines reference a service, an inventory item, or are ad-hoc. All
money in cents. Per-line and order-level discounts.

**Key architectural decision:** the POS sale is the ledger, and it **emits the existing
`service:completed` event**. Inventory deduction, RCN loyalty, reviews and reporting
then fire unchanged through machinery that already works — rather than teaching
`ServiceOrder` to be something it is not.

### S5 — Phase 5: inventory wiring — **built**

Both POS deduction paths now go through `InventoryRepository.adjustStock` carrying the sale's
`locationId`, so the branch's `inventory_item_stock` row and the item's shop-wide total move
together. That closes the drift described in 7 below.

`adjustStock` gained a `clampToZero` flag, used only by the sale paths: a sale that has already
taken the customer's money must not be refused because the recorded count was short, so it
deducts what is there and records the amount actually moved. Manual adjustments still throw.
The adjustment row now stores the applied delta rather than the requested one, so
`quantity_before + quantity_change = quantity_after` holds in every case.

Two bugs fixed on the way: a POS line selling the same service twice only consumed one set of
linked parts, and service parts sold at the counter were recorded against `service_order`
rather than `pos_sale`.

**Cost/margin** — migration 261 adds `unit_cost_cents` to `pos_sale_items`, snapshotted at
ring-up because `inventory_items.cost` moves every time a purchase order is received and
joining at read time would rewrite last month's margin. NULL means *unknown*, deliberately
distinct from 0. Products take the item's cost; services take the summed cost of their linked
parts — the same rows the sale deducts, so cost and stock movement agree. Labour cost is not
modelled, so a service figure is parts-only.

`GET /api/shops/pos/reports/summary?days=&locationId=` reports margin **over costed lines only**
and returns `uncostedRevenueCents` alongside. Folding unknown-cost lines in at zero cost would
report them as pure profit, which is the one answer guaranteed to be wrong. The Point of Sale
tab renders this as a counter-sales recap with 24h/7d/30d ranges.

Windows are rolling hours back from now, not calendar days: shops still have no timezone
recorded, so "today" would mean UTC midnight and cut a west-coast evening in half.

---

## 6. Risks

- **Cash breaks a Stripe assumption.** `PaymentReconciler` derives the ledger from
  Stripe charges. Cash tender has no Stripe object — the ledger needs non-Stripe rows,
  or reporting will silently under-count.
- **Refunds across split tender.** Partial refund against two tenders is fiddly. Design
  it into S2, not afterwards.
- **Offline mode.** Terminal offline payments are a real scope decision, not a detail.
- **Hardware.** Buildable on simulated readers, but at least one physical unit is needed
  before launch.
- **Manual keyed card entry** raises the fraud and PCI surface. Stripe handles the
  handling, but SAQ scope changes.

---

### S3 — Tax — **built**

Migration 257: `shop_tax_rates` plus a `taxable` column on `shop_services` and
`inventory_items`. A shop-level rate that locations inherit, with an optional
per-location override, enforced by partial unique indexes.

Tax is charged **per line, on the discounted price, and rounded there** rather than
across the whole sale — that is what a receipt has to show, and it keeps each line's
stored tax true to its own price when a line is later refunded or voided alone. A line
marked non-taxable stays at zero regardless of the rate, which is how labour is excluded
in the states that don't tax it.

Rates enter as a percentage and store as basis points, so 8.25% survives without a float.
Settings UI lives at Settings → Sales Tax (`shop:manage`); taxable toggles sit on the
service form and both inventory item modals.

**Nothing changes until a shop acts:** existing rows default to taxable, but no rate
exists until one is created, so tax stays zero until it is deliberately configured.

**Route trap worth knowing:** `shop/routes/index.ts` has a `router.get('/:shopId')`
catch-all mounted early, so any NEW single-segment route under `/api/shops` is swallowed
by it and returns "Shop not found". The tax endpoints are namespaced under
`/api/shops/pos/tax-rates` for that reason; the terminal and POS routes were already safe
by virtue of having two segments.

## 7. Open questions

1. **Tax on online bookings.** S3 is POS-only — `ServiceDomain/PaymentService` charges
   `finalAmountUsd` with no tax, so the same service costs $120 booked online and $129.90
   at the counter with an 8.25% rate. A shop legally required to collect tax owes it on
   both channels, so today they absorb it on bookings. Extending is not large (resolve the
   rate the same way, honour the `taxable` flag, add to `amountInCents`), but it needs
   decisions on RCN redemption ordering against the taxable base, returning the tax portion
   on refunds, and showing a tax line in the customer booking UI before payment.
2. **Gift cards** — greenfield. Rejected at the route boundary with a 400 for now; the
   tender enum accepts the value but there is no balance ledger behind it.

### Resolved

- **Offline mode** — out of scope. Sale ids stay server-generated with no idempotency layer.

## 6a. The reader test can leave an abandoned authorization

The Test button on the Card Readers panel raises a $1 PaymentIntent with
`capture_method: 'manual'` and cancels it on "Finish test". Nothing cancels it if the shop
taps a card and then closes the tab instead: the intent stays at `requires_capture` and the
$1 hold remains visible on that card's statement until Stripe auto-releases it, roughly a
week later. No money moves either way, but a real cardholder sees a pending charge.

Harmless while the shop is testing with its own card. It becomes a support ticket once shops
other than us are pairing readers.

Options, best first:

1. **Switch the test to a SetupIntent.** `stripe.terminal.readers.processSetupIntent` is
   already in the SDK; it reads the card and proves the reader works with no authorization
   hold at all, so the abandoned case stops existing. Trade-off: it saves a PaymentMethod, so
   card details are stored for what is meant to be a throwaway check.
2. **Sweep abandoned test intents** — a scheduled job cancelling intents with
   `terminalTest: 'true'` older than a few minutes. The metadata flag is already stamped.
3. **Best-effort cancel on unmount** — cheapest, catches ordinary navigation but not a hard
   tab close.

Deliberately left as-is for now.

## 7. POS stock deduction is not per-branch — **fixed in S5**

A POS sale now carries a `location_id` — the register binds to a branch on the Point of Sale
tab, which drives the tax rate and filters readers to that branch. **Stock deduction does not
use it.**

`deductStockForProduct` decrements `inventory_items.stock_quantity`, the shop-wide total, and
never touches the per-branch `inventory_item_stock` row that `InventoryRepository` maintains
(and that the per-location inventory views read). A sale at branch B therefore reduces the
shop total but leaves both branches' per-branch figures untouched, so they drift from reality
the moment a multi-location shop sells anything at the counter.

Single-location shops are unaffected: their totals and their one branch row stay in step.

**Fixed in S5** by routing both deduction paths through `adjustStock` with the sale's
`locationId`. Shops that sold at a counter before this landed still have drifted per-branch
figures — those need a stock count, not a backfill, since there is no record of which branch
the earlier sales belonged to beyond `pos_sales.location_id` (which is present, so a backfill
is possible if anyone wants one).

**Reserved quantity** was the related open question: nothing in the codebase ever writes
`reserved_quantity` — no reservation flow exists — so the POS has nothing to release and
needed no handling. It stays open for whoever builds reservations.

## 7a. POS sales are not properly in the fiat ledger — **fixed in S6a**

Found while testing the POS in August 2026. The shop Transactions page reads the `payments`
table, and POS card sales are reaching it **by accident** — via the Stripe webhook, not
because we write them.

`PaymentReconciler` builds each row from charge metadata:

```
customerAddress: this.lower(charge.metadata?.customerAddress)   // → null for POS
orderId:         charge.metadata?.orderId ?? null               // → null for POS
source:          this.sourceFromMetadata(charge.metadata)       // → always 'booking'
```

The POS PaymentIntent stamps only `{ shopId, posSaleId }`, so rows land with:

- **no customer** — correct for a walk-in, but indistinguishable from a lost attribution
- **no service name** — a counter sale is multi-line by definition, so there is no single
  service to join; it needs a summary, not a name
- **`source` = `'booking'`** — counter sales are actively **mislabeled as bookings**.
  `sourceFromMetadata` is an acknowledged stub whose own comment says "later slices set
  source explicitly for invoices/terminal/links". This is that slice.

Worse: **cash sales never reach the ledger at all**, because there is no Stripe charge for
the reconciler to see. The Transactions page therefore under-reports revenue silently —
the same structural point that ruled out Stripe Tax in S3.

### The fix — write the ledger ourselves, don't infer it from Stripe

1. Add `pos_sale_id` to `payments` so a row can point back at the sale.
2. On sale completion, write one `payments` row **per tender, cash included**, with
   `source: 'terminal'`, the customer when one is attached, and the fee on the card leg.
3. Stamp `type: 'pos_sale'` and `customerAddress` on the PaymentIntent, and teach
   `sourceFromMetadata` to return `'terminal'`, so the webhook reconciles onto the row we
   already wrote rather than creating a mislabeled duplicate.
4. Transactions UI: render "Counter sale #N — 3 items" where a service name would go, and
   leave the customer blank for walk-ins (blank is the correct answer there).

**The fiddly part is idempotency.** The webhook can land before or after completion, so the
write must be idempotent on `stripe_payment_intent_id` — the unique index `uq_payments_intent`
(migration 244) already exists for exactly this.

### How it was resolved

Migration 262 adds `pos_sale_id` and `pos_sale_payment_id` to `payments`. The second is the
idempotency key for cash: a card leg is already covered by `uq_payments_intent`, but a cash leg
has no PaymentIntent and nothing else unique about it.

`recordPosTender` writes one row per settled tender and picks its conflict target by leg, since
one statement can only name one. A card leg keys on the PaymentIntent so it meets whatever the
webhook wrote **in either order**; a cash leg keys on the tender.

The card leg's update deliberately leaves `gross_cents`, `fee_cents`, `net_cents` and `status`
alone. The webhook derives those from the balance transaction and is authoritative — a
completion landing after it would otherwise zero out fees the reconciler had already resolved.
`net_cents` is written as 0 on a card leg as a placeholder, not a claim; cash is written at full
value because nothing is deducted between the drawer and the shop.

The PaymentIntent now stamps `type: 'pos_sale'` and the customer when there is one, and
`sourceFromMetadata` returns `'terminal'` for it — so a charge reconciling *before* its sale is
completed is filed correctly rather than as a booking.

Transactions renders `Counter sale #7 · 3 items` where a service name would go, and *Walk-in*
where the customer would be. Blank is the correct answer for a counter sale with no customer
attached, but it is indistinguishable from lost attribution, so it says which.

**Still true:** a sale voided after a cash tender was taken leaves that tender in the ledger.
The money did move, so the row is not wrong, but there is no refund flow behind it yet.

## 8a. Phase 8 is bigger than this plan implies (S6b)

S2 above states that the POS sale "emits the existing `service:completed` event" so that
inventory, loyalty, reviews and reporting fire unchanged. **That is not what shipped.**
`completeSale` publishes its own `pos.sale_completed`, and `InventoryDomain` is its only
subscriber.

So for counter sales today there is no RCN issued, no review request, and no emailed receipt —
the register's receipt is on-screen only. None of it is broken; it was never wired, and the S2
section reads as though it was.

The decision S6b has to make first: emit `service:completed` as originally intended and inherit
the existing consumers, or add POS-specific handlers on `pos.sale_completed`. The first is
cheaper but pushes a walk-in with no customer address through machinery built around orders and
customers; the second is more code but honest about a sale that may have no customer at all.

Note also that Phase 8's receipt is specified to show **warranty**, but the device/warranty model
is S7 and greenfield. Either the receipt ships without warranty, or S7 moves ahead of it.

## 7b. Known bug, tracked separately

`InventoryDomain` subscribes to **`service:completed`** (`serviceIntegrationController.ts`),
but the event `OrderController` publishes on completion is **`service.order_completed`**.
`EventBus` does exact-match lookups with no normalisation, so `deductStockForService` has
**never run** — any shop that linked parts to a service has been expecting stock to come
down on booking completion, and it never has.

The payload is already compatible, so the fix is a one-word change. It is deliberately NOT
in the POS branches: flipping it starts moving stock for every shop with linked parts,
which is a live behavioural change that wants its own commit and its own decision.

---

## 8. Deferred: AI phases (3 and 7)

Phase 3 (AI product suggestions at the point of sale) and Phase 7 (AI business
intelligence) are deferred and belong to whoever owns the AI area.

Worth noting for whoever picks them up: `AIAgentDomain` already has a
recommendations/insights framework (`deadStock`, `reorderNeeded`, `businessBriefing`,
`proposePurchaseOrder`). **Phase 7 mostly needs POS data to read, not new AI plumbing** —
it gets substantially cheaper the moment S2 lands.

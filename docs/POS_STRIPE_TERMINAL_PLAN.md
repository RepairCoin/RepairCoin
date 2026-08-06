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
| S6b | **Customer + loyalty** — attach a customer, earn RCN — **built** | M | S2 |
| S6c-1 | **Customer's receipt** — email captured at the register, in-app for an attached customer — **built** | M | S6b |
| S6c-2 | **Review request** for a counter sale — needs the review path to accept one — **not started** | M | S6c-1 |
| S7a | **Warranty terms** — per-service term, snapshotted on sales and bookings — **built** | M | S2 |
| S7b | **Phase 6** — devices owned, per-device warranty | M | S2 |
| S8 | **Phase 4** — repair ticket workflow | L | S2, S7 |
| S9a | **Revenue excludes unpaid orders** (see 9a) — **built** | M | — |
| S9b | **Ledger completeness** (see 9b) — **built** | M | S6a |
| S9c | **Move revenue reporting onto the ledger** (see 9c) — S9c-1/2/3 all **built** | L | S9b |
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

### Resolved: POS-specific handlers, not the borrowed event

S2's intent was wrong. The consumers of `service.order_completed` are ad attribution, order
confirmation, campaign-reward redemption and messaging — **every one keys on an `orderId`
pointing at a `service_orders` row a counter sale does not have**. Republishing a sale as that
event would feed them something they cannot read and would corrupt ad attribution. So loyalty
subscribes to `pos.sale_completed` directly, and later consumers should too.

Note also that Phase 8's receipt is specified to show **warranty**, but the device/warranty model
is S7 and greenfield. Either the receipt ships without warranty, or S7 moves ahead of it.

**Resolved.** The receipt shipped first without it (S6c-1), and the warranty half of S7 followed
immediately after (S7a, section 11) — both receipt copies now carry the term per line. What is still
missing is the device it was performed on, which is S7b.

## 8b. Customer and loyalty at the counter (S6b) — **built**

**A customer must exist before the counter can name one.** `customers.address` is a NOT NULL
42-char wallet address and IS the identity — there is no way to mint an account for someone
standing at a till, and no server-side wallet generation anywhere in the codebase. So the
register offers a **signup QR** for new customers: they register on their own phone and earn from
their next visit. This sale stays a walk-in. The alternatives considered were an in-app wallet
created at the counter via thirdweb email OTP (stalls the queue while someone checks their inbox)
and pending claimable accounts (needs a pending-customer model and touches the identity
assumptions of the whole system).

The customer is settable **while the sale is open, not only at creation** — at a counter you ring
up first and find out who you are serving at payment, so requiring it up front would mean voiding
and restarting. `PUT`/`DELETE /api/shops/pos/sales/:id/customer`, reusing the existing
`CustomerSearchModal`.

**Earning basis is the whole sale net of tax** — services and products, after discounts, before
tax. Rewards step at $30/$50/$100, so including tax would let a state's rate decide whether a
customer crosses a threshold; identical purchases would earn differently by location. The event
carries `netCents` for this.

Issuance goes through the existing `rewardIssuanceService.issueExact`, which already wraps the
on-chain transfer/mint and the atomic balance debit, and never throws. The threshold and tier
maths moved to `utils/repairReward.ts` so the counter and the manual issue-reward route cannot
drift apart.

**Known quirk, matched deliberately:** the tier bonus does not depend on the base reward, so a
Gold customer spending $10 earns 5 RCN even though the amount is below the $30 base threshold.
That is pre-existing behaviour in the manual route; the counter mirrors it rather than quietly
applying a different rule to the same spend.

**Not surfaced to the register:** a shop with no RCN left has its reward skipped and logged, not
shown. Making it visible would mean issuing synchronously and letting a loyalty failure block a
sale that has already taken the customer's money. Worth a shop-facing alert eventually — it is
silent today.

## 9. Unify revenue reporting (S9) — scoped

**Counter sales are missing from every analytics surface.** Only `PaymentRepository` and
`PosSaleRepository` read `pos_sales` anywhere in the backend, so nothing that reports revenue can
see one.

| Surface | Reads | POS included? |
|---|---|---|
| Shop → Transactions | `payments` | Yes, since S6a |
| Admin → Payments + totals | `payments` | Yes, since S6a |
| POS tab → Counter sales | `pos_sales` | Yes, since S5 |
| Shop → Analytics | `service_orders` | **No** |
| Admin → Service Marketplace Analytics | `service_orders` | **No** |
| Admin platform stats / `MetricsService` | `transactions` | RCN only, not fiat |
| Shop dashboard "revenue" | `shop.totalTokensIssued` | **Not fiat revenue at all** |

Two consequences worth naming. RCN issued at the counter (S6b) *does* land in `transactions`, so
platform stats show the token outflow while the sale that caused it appears in no revenue figure.
And `shop/routes/index.ts:1134` returns `totalRevenue: shop.totalTokensIssued` — RCN issued, under
a field named revenue. That predates all POS work and has to be decided before anything is added
to it.

### The obvious fix does not work yet

"Point revenue analytics at `payments`" is the right end state — it is already the unified fiat
ledger and S6a made it complete for counter sales. But **neither table can produce correct total
revenue today**.

> **The figures below are from the shared development database, not production — there is no
> production yet.** Every Stripe id in it is test-mode (60 `cs_test_…`, zero `cs_live_…`) and the
> shops include `1111`, `7777` and `peanut`. They demonstrate that each defect class **exists**;
> the amounts are seeded data and carry no revenue meaning. An earlier draft of this section
> presented them as though they measured real money, which was wrong.

| | Rows | Revenue |
|---|---|---|
| Paid/completed `service_orders` | 282 | $50,410.95 |
| …of those, with **no** `payments` row | **57 (20%)** | **$10,587.80 (21%)** |
| Completed `pos_sales` (invisible to `service_orders`) | 9 | $1,542.19 |

`service_orders` misses POS entirely; `payments` misses a fifth of booking revenue. Switching
naively would trade one wrong number for a differently wrong number.

Investigating the 57 turned up **four** classes, not three, and the largest one is not a ledger
problem at all:

- **15 orders — `status` and `payment_status` disagree.** Marked paid/completed while payment is
  `unpaid` or `pending`. These should never have been counted; see 9a, now fixed.
- **25 orders — the reference is a Checkout Session (`cs_…`), not a PaymentIntent.** A
  `stripe_session_id` column already exists and is populated on 55 rows, so the id is simply in
  the wrong column. `backfill-payments.ts` filters on `LIKE 'pi_%'` and skips them. Recoverable:
  a session resolves to its PaymentIntent through the Stripe API.
- **16 orders — genuinely settled outside Stripe.** `payment_status = 'paid'`, no Stripe record.
  Structurally the same problem cash tender had, and it wants the same answer S6a gave: write the
  ledger row rather than infer it from Stripe.
- **1 order — has a `pi_` but no row.** Created after the backfill ran, with a webhook that never
  landed. A straggler, not a class.

## 9a. Revenue excludes unpaid orders — **built**

`status` tracks fulfilment and `payment_status` tracks money, and they disagree. Every revenue
figure keyed on `status IN ('paid','completed')` alone, so **work that was done but never paid for
counted as revenue** — on the dev database, 15 orders and 8.8% of the reported total.

`payment_status` is populated on every row (875/875), so it is a reliable signal to gate on.

The predicate was duplicated **26 times** across three files. It now lives once, in
`utils/sqlFragments.ts` as `revenueRecognized(alias?)`, which qualifies **both** halves with the
alias — aliasing only the first leaves a bare `payment_status` that becomes ambiguous the moment
the query joins another table carrying that column, and fails at runtime rather than build.

Both halves are required. `payment_status` alone would pull in cancelled and expired orders that
were paid — on the dev data, far more money than the over-count it fixes. Whether a paid-then-
cancelled order is revenue depends on whether it was refunded, which is a separate question and
deliberately not answered here.

**Money only.** `CalendarRepository` (sync) and `DiscoveryController` (trending services) keep the
old predicate: an unpaid booking still happened, and it is still demand signal.

### The dashboard revenue tile moved to the ledger

Two faults, one of them nothing to do with POS. It read `service_orders`, so counter sales could
never appear — a shop that took $335 across its till saw $0. And it bucketed revenue by
**`booking_date`**, so a tile labelled "Revenue / Today" with a vs-yesterday trend was reporting
takings for work *scheduled* today: money taken today for next week's booking landed on next week,
and a day of real trade could read zero.

Revenue now comes from `payments`, bucketed by `COALESCE(captured_at, created_at)` and net of
refunds. Bookings still bucket by `booking_date` — the two answer different questions and were
only ever sharing a join. `ancient-realm-tech` went from $0 to $205.69 on the first run.

This is the first piece of S9c rather than a parallel `pos_sales` branch. The ledger is already the
union of every channel, so the tile does not grow a case per channel; the warning against parallel
aggregation still stands for the remaining reports.

**Consequence to expect:** revenue for a booking now lands on the day it was paid, not the day it
was booked, so historical days will not match what the tile showed before. The S9b gap also applies
— a booking whose payment never reached the ledger contributes nothing here until S9b closes it.

### Handoff — closed 2026-08-05, at the owner's request

The section below is kept for the reasoning; the work is done. `AIAgentDomain` belongs to another
developer and the standing rule is not to edit it, so this was written as a handoff — then done
directly when asked.

**9 of the 13 sites took the predicate.** What the AI reported for revenue against what it reports
now, on staging:

| Shop | Was | Now | Never paid |
|---|---|---|---|
| `1111` | $31,656.41 | $27,906.41 | $3,750.00 |
| `7777` | $4,507.00 | $3,449.00 | $1,058.00 |
| `ancient-realm-tech` | $553.96 | $541.98 | $11.98 |
| Platform | $50,510.95 | $45,401.00 | 17 orders |

**4 sites were deliberately left on the fulfilment status**, and each now carries a comment saying
why — the earlier claim that "each is a money figure" was wrong. `repeatCustomerAnalysis` counts
orders to bucket customers as new or repeat; `topServices`' `paid_n` is the denominator of a
conversation-to-booking conversion rate; `MetricsAggregator`'s recovered-customer count asks whether
a nudge brought someone back. A booking that happened is a visit, a conversion and a recovery
whatever the payment did afterwards — that is S9a's own rule, and tightening these would change
which customers the AI describes rather than what it says they spent.

Four header comments documenting the old predicate were corrected too, so the files no longer
describe behaviour they do not have.

**Then S9c was applied to this domain too**, so the AI is no longer blind to the till. Each money
question went to whichever source can answer it, exactly as the dashboards did:

| Tool | Reads |
|---|---|
| `revenue_summary`, `weekly_revenue` anomaly, briefing revenue | the ledger, windowed on capture |
| `top_services`, briefing top service | `SERVICE_LINE_REVENUE` — the ledger has no line items |
| `top_customers`, briefing lapsed spend | the ledger by `customer_address` |
| `estimateCampaignRevenue` AOV | the ledger, averaged over purchases |
| `MetricsAggregator` AI-attributed revenue | ledger joined to the order for `conversation_id` |

Three details that are easy to get wrong and were checked on staging. A split-tender counter sale
writes one ledger row per tender, so every count is `COUNT(DISTINCT …)` over the sale — counting
rows would report one sale as two and halve a shop's average order value. AI attribution stays
joined to `service_orders` because `conversation_id` lives there and a counter sale has no
conversation; it measures what the assistant brought in, not what the shop took. And the lapsed
figure in the briefing mirrors `findLapsedBookers` after S9c-3 — who is lapsed still comes from
bookings, what they spent comes from the ledger.

`SERVICE_LINE_REVENUE` gained an `occurred_at` column for this: the briefing's top service is a
30-day window and the fragment had no date to filter on. Capture time for a booking, completion time
for a counter sale, so a window means the same thing on both channels.

Four unit-test suites asserted the old source (`FROM service_orders`, the bare status predicate).
They were updated rather than deleted — the guards still say "this tool must not quietly read
somewhere else", they just point at the ledger now.

### The original handoff note

`AIAgentDomain` belongs to another developer, so these were left alone. Each is a money figure and
each still counts unpaid orders:

| File | Occurrences |
|---|---|
| `services/insights/tools/businessBriefing.ts` | 3 |
| `services/insights/tools/revenueSummary.ts` | 2 |
| `services/insights/tools/topServices.ts` | 2 |
| `services/MetricsAggregator.ts` | 2 |
| `services/insights/anomalies/metrics.ts` | 1 |
| `services/insights/tools/repeatCustomerAnalysis.ts` | 1 |
| `services/insights/tools/topCustomers.ts` | 1 |
| `services/marketing/estimateCampaignRevenue.ts` | 1 |

The change is mechanical: import `revenueRecognized` from `utils/sqlFragments` and interpolate it
where the bare predicate sits, matching the table alias. Until then AI-reported revenue reads
higher than the dashboards.

## 9b. Ledger completeness — **built**

Measured again on the dev database before starting: **42 of 269 revenue-recognized bookings had no
ledger row, $6,149.45**. Lower than the 57 in section 9 because S9a had already removed the orders
whose `status` and `payment_status` disagreed. After the work: **0 missing, and the check exits 0.**

**The backfill only ever fixed history — the hole was still open.** `POST /orders/:id/mark-paid`
(`OrderController.markOrderPaid`) flipped `payment_status` and wrote nothing to `payments`, so every
cash booking a shop recorded re-opened the gap the moment it was closed. That endpoint now writes the
ledger row, and it is the half of this slice that matters going forward. The write is wrapped: the
shop has the cash whether or not the ledger accepts the row, so a ledger failure logs rather than
failing a booking that is genuinely paid.

`payments.method` is recorded as `cash`. Nothing stores *how* an off-Stripe booking was settled —
`cash` follows the endpoint's own documentation ("cash collected for a manual booking") and is an
assumption, not a fact from the data.

**Recovering the Checkout Sessions.** 25 of 27 resolved to a real PaymentIntent through the Stripe
API. The session is retrieved on the shop's connected account first and the platform second, because
nothing on the order records which one it was created on — direct-charge bookings live on the
connected account and platform-era ones do not. Gross comes from the PaymentIntent's
`amount_received`, not the order's amount: Stripe is authoritative on what was actually collected,
and the two differ once an RCN discount or partial capture is involved.

`service_orders` is deliberately **not** rewritten to move the `cs_…` out of
`stripe_payment_intent_id`. It would be tidier, but `PaymentService.handlePaymentSuccess` looks an
order up by whatever id it was given, and changing the stored id under it risks a re-confirmed
session creating a duplicate order. The ledger row carries the resolved `pi_` and records the session
it came from in `metadata.resolvedFrom`.

**Two orders were not a ledger problem at all.** `8ddf0654…` (`1111`, $600.00) and `7049b0d1…`
(`7777`, $89.00) were marked paid in our database while Stripe reported their session `unpaid`.
Writing a `succeeded` row for either would have fabricated revenue, so the backfill skips that case
with a logged reason rather than guessing. Both were seeded test bookings force-marked paid; their
`payment_status` has been corrected to `unpaid` on the dev database, which drops them out of
recognised revenue. `status` was left at `completed` — whether the work happened is a different
question from whether it was paid for, and that separation is the whole point of 9a.

The corrected orders were identified by re-reading Stripe at the time of the fix, not from a stored
verdict. Any future occurrence surfaces the same way: the backfill logs it and the check keeps
failing until someone decides what actually happened.

**Fees are zero on every backfilled row**, matching the three pre-existing sources. `net_cents` is
set equal to gross only for the off-Stripe rows, where it is true — cash carries no processing fee
and no platform commission, since there is no charge to attach an application fee to. Card rows
backfilled from a PaymentIntent leave net at 0 like the rows already in the table; resolving real
fees for historical charges is a separate exercise and would make `getTotals`' net column meaningful
for the first time.

### What was added

- `migrations/263_add_payments_manual_order_key.sql` — `uq_payments_manual_order`, a partial unique
  index on `order_id` where there is no PaymentIntent. Neither existing index covers an off-Stripe
  booking, so without it a double-tapped mark-paid doubles the shop's revenue.
- `PaymentRepository.recordManualOrderPayment` — DO NOTHING on conflict, not DO UPDATE: the row
  written when the shop said the money arrived is the truthful one, and a re-run must not overwrite
  it with a re-derived guess. Verified: a retry passing a deliberately wrong amount returned the
  existing row unchanged.
- `src/utils/ledgerCompleteness.ts` — the gap defined once, shared by the backfill and the check, so
  the check cannot bless a backfill that missed rows. Coverage matches on `order_id` **or** the
  PaymentIntent; pre-metadata checkout charges produced ledger rows with a null `order_id` and would
  otherwise be backfilled a second time.
- `scripts/backfill-payments.ts` — two new passes (session resolution, off-Stripe rows) plus
  `--dry-run`. Re-running after the fact inserted 0 rows.
- `scripts/check-ledger-completeness.ts` / `npm run db:check-ledger` — exits 1 while any gap remains.

**Applied to staging. Not yet run on production.** `backend/.env` points at
`db-postgresql-repaircoin-staging-…`, so the "shared development database" this plan refers to
throughout **is** the staging database — there is no separate dev instance. Earlier sections
describing measurements as coming from a development database are describing staging data.

### Next

S9c, scoped in full below.

## 9c. Move revenue reporting onto the ledger — scoped

Counter sales are still absent from every analytics surface. Only the dashboard revenue tile (9a)
and the Transactions screens read `payments`; everything else reads `service_orders`, which
structurally cannot see a POS sale.

The work is **27 references across 9 methods** in `ServiceAnalyticsRepository`, plus 3 in
`CustomerRepository`. They do not all move, and two groups of them cannot.

### The structural fact that shapes the slice

`payments` is **one row per money movement, with no line items**. A counter sale is one ledger row
covering many lines. So the ledger can attribute revenue to a shop, a day, an order or a customer —
and **cannot** attribute it to a service or a category. That splits the work in two, and it is the
reason this is not simply "repoint eight queries".

### Group A — moves cleanly to `payments`

`getShopMetrics` (`total_revenue`, `avg_order_value`), `getOrderTrends`, `getPlatformMetrics`,
`getTopPerformingShops`, `getPlatformOrderTrends`. Shop, day and platform totals; the ledger already
answers these with POS included.

### Group B — needs line-level attribution

`getServicePerformance`, `getShopCategoryPerformance`, `getPlatformCategoryPerformance`,
`getGroupPerformanceAnalytics`.

These need a union at the **line** level: bookings via `order_id → service_orders.service_id`,
counter sales via `pos_sale_items.service_id`. That is not the parallel aggregation warned against
below — the warning is about summing two revenue *totals* side by side; this is one line-level
source feeding one total.

**This corrects the earlier sketch**, which said category mix stays on `service_orders` because "a
counter sale has no service to attribute". It does: `pos_sale_items` carries `service_id` on every
`kind = 'service'` line. What it lacks is a service on `product` and `custom` lines, which have no
category either — today those would silently vanish from category reports and the category totals
would not reconcile with the shop total. They need an explicit bucket.

### Group C — stays on `service_orders`

RCN redeemed/discount columns (token ledger, not fiat), order counts, conversion rates, top services
by volume. An unpaid booking is still demand signal; a counter sale has no booking funnel.

### Four decisions this is blocked on

**1. RCN and gift-card tenders are written into the fiat ledger as `card`.** `PosSaleService.ts:436`
does `method: payment.method === 'cash' ? 'cash' : 'card'`, so an `rcn` or `gift_card` tender lands
in `payments` labelled card. Bookings treat RCN as a **discount** that reduces the Stripe charge;
the POS treats it as a **tender**. The same customer behaviour, accounted two opposite ways. Until
this is settled, POS revenue read from the ledger is inflated by every RCN redemption and a gift card
is booked as new revenue rather than deferred revenue being drawn down. **This is the real blocker**,
larger than any of the query rewrites.

**2. `payments` has no `location_id`.** Every shop analytics method takes a `locationId`. It is
reachable by join — `order_id → service_orders.location_id`, `pos_sale_id → pos_sales.location_id` —
but that is two outer joins on every report. A denormalised column written at insert is probably
right.

**3. Tax.** `payments.gross_cents` for a counter sale **includes tax** (S3 snapshots it per line);
booking revenue carries no tax at all. Summing both yields a figure that is tax-inclusive for POS and
tax-exclusive for bookings, which is not a number anyone can act on. Decide net-of-tax (subtract
`pos_sales.tax_cents`) or gross, once, before Group A moves.

**4. `shop/routes/index.ts:1134` returns `totalRevenue: shop.totalTokensIssued`** — RCN issued, under
a field named revenue. Predates all POS work. Settle what that field means before anything else is
added to it.

### Two things worth folding in

**Refunds.** `payments.refunded_cents` exists and the 9a dashboard tile is already net of refunds;
the `service_orders` reports are not. Moving to the ledger is the moment to make them agree —
otherwise two surfaces differ by exactly the refund total and both look defensible.

**Customer spend.** `CustomerRepository` has 3 occurrences (`total_spent`, lines ~1165, ~1248,
~1418). A customer who buys at the counter has spent money at that shop and is currently invisible
there.

### Build order

- **S9c-1** — settle decisions 1 and 3, add `payments.location_id`, move Group A. M — **built**
- **S9c-2** — line-level attribution for Group B, including the product/custom bucket. M — **built**
- **S9c-3** — the `totalRevenue` field cleanup and `CustomerRepository`. S — **built**

Group B before the RCN tender question is settled means writing the attribution twice.

## 9c-1. Group A on the ledger — **built**

**Decision 1 resolved: non-fiat tenders stay out of the fiat ledger.** `PosSaleService.writeToLedger`
now writes only `cash` and `card` legs. RCN is a loyalty discount — which is how the booking flow has
always treated it, reducing the Stripe charge rather than paying part of it — and a gift card draws
down revenue recognised when the card was sold. The alternative, writing them with honest labels,
would have made every revenue query correct only if it remembered `method NOT IN ('rcn','gift_card')`,
and a filter that must be remembered in a dozen places is the exact bug S9a spent a slice removing.
No such rows existed on staging yet, so nothing needed correcting — this is a guard, not a cleanup.

**Consequence to know:** a sale's total no longer equals the sum of its ledger rows whenever a
non-fiat tender is involved. Reconciliation between `pos_sales` and `payments` has to account for
that, deliberately.

**Decision 3 resolved: revenue is net of tax.** Migration 264 adds `tax_cents` to `payments`,
holding the tax contained *within* `gross_cents` rather than added to it, so revenue is
`gross - tax - refunded` in one expression for both channels. Bookings carry 0 and are unaffected.

Tax belongs to the sale but the ledger stores one row per tender, so it is apportioned pro rata
across the fiat legs with the rounding remainder on the largest — `utils/apportionTax.ts`, unit
tested for exactness across awkward splits. **The whole tax goes on the fiat legs, not a share
proportional to them:** a $108 sale settled with $50 RCN and $58 card still leaves the shop owing the
state all $8, so scaling the tax down would report $53.70 of revenue on a sale that earned $50. The
result is clamped to the tenders' total, because RCN covering more than the pre-tax value of the
goods would otherwise produce negative revenue.

**`payments.location_id`** (also migration 264) is denormalised on purpose. Every shop report filters
by location, and reaching it through a join means two outer joins on every report to produce one
number. Backfilled from `pos_sales` and `service_orders`; 767 of 781 rows resolved. New rows resolve
it in the INSERT itself — from the order for bookings, from the sale for counter takings — so no
caller has to remember to supply it.

### A third exclusion the scope missed

`payments` is wider than shop revenue. `rcn_purchase` is a shop buying tokens **from the platform**,
and `deposit` is a customer no-show deposit that is `held` — a liability, not something earned.
Pointing revenue at the ledger without filtering source would have counted a shop's own spending as
its earnings. `ledgerCustomerRevenue()` restricts to `booking | terminal | invoice | link`. On
staging this excludes $52.50 of `rcn_purchase`; the number is small, the class is not.

### The three shared fragments

`ledgerRecognized()`, `ledgerCustomerRevenue()` and `ledgerRevenueCents()` in `utils/sqlFragments.ts`,
alongside `revenueRecognized()`. Three questions kept separate on purpose: did the money arrive,
whose money is it, and how much of it counts. `refunded` status is *included* — a fully refunded
payment contributes `gross - refunded = 0` through the amount expression, so excluding it would be
the same answer written twice, while `partially_refunded` genuinely must stay.

### What moved

`getShopMetrics`, `getPlatformMetrics` (revenue + average order value), `getOrderTrends`,
`getPlatformOrderTrends`, `getTopPerformingShops`. RCN redeemed/discount and every volume metric
stayed on `service_orders`.

**Both trend queries became a union, not a join.** Bookings bucket on when they were taken, revenue
on when it was captured, and a day can have either without the other — a day of pure counter trade
has revenue and no bookings. A `FULL OUTER JOIN` on the date keeps both. On staging,
`ancient-realm-tech` has 5 such days in the last 90 and `1111` has 2; before this they showed nothing.

`getTopPerformingShops` takes revenue from a correlated subquery rather than another join. Joining
`payments` alongside `service_orders` multiplies their rows against each other and every SUM inflates
— the fan-out that a `COUNT(DISTINCT)` hides right up until money is added to the query.

### Verified on staging

Every sale's `tax_cents` equals the sum of its ledger rows' apportioned tax (zero mismatches).
Counter takings of $1,099.97 now appear in revenue figures that previously could not see them.

## 9c-2. Per-service and per-category revenue — **built**

The four Group B reports — `getServicePerformance`, `getShopCategoryPerformance`,
`getPlatformCategoryPerformance`, `getGroupPerformanceAnalytics` — now include counter sales. A
service sold over the counter used to contribute nothing to "your best earners"; the busier a shop's
till, the more wrong that ranking was.

All four read one shared source, `SERVICE_LINE_REVENUE` in `utils/sqlFragments.ts`. One definition,
five call sites — the same reason `revenueRecognized` exists.

### The booking half takes its amount from the ledger

The obvious construction — filter `service_orders` by `revenueRecognized` and use `final_amount_usd`
— was built first and **disagreed with the shop total by 30%**. The ledger counts money that arrived
regardless of what the booking's status later became; `revenueRecognized` drops paid-then-cancelled
orders whose money the shop kept. For `ancient-realm-tech` that was $1,207.76 against $566.98, so the
category chart would have summed to 71% of the revenue printed directly above it on the same screen.

So the booking half reads `payments` joined to `service_orders`, taking the amount from the ledger
and using the order only to say which service it was for. Categories for that shop now total
$1,561.98 against a ledger total of $1,447.76, and platform-wide the two are within 0.6%.

**The remaining residual is structural and one-directional.** The counter half must come from the
lines, because that is the only place the detail exists. Reports therefore exceed the ledger by
whatever RCN and gift cards covered on counter sales plus counter refunds — and, on staging, mostly
by counter sales completed before S6a wired the POS into the ledger, which have lines but no ledger
row and never will. Bounded and explainable, unlike the 30%.

One booking payment on staging has no `order_id` and so cannot be attributed to a service at all —
a pre-metadata charge, $75.78, absent from these four reports by construction.

### Non-service counter lines get their own rows

`pos_sale_items.kind` is `service`, `product` or `custom`. A part sold on its own or an ad-hoc charge
has no service and therefore no category. Dropping them would make the categories stop adding up to
the shop's revenue — two screens visibly contradicting each other, which is worse than the gap it
would hide. They appear as **Products** and **Other** rows with a service count of 0. On staging that
is $580 across 7 lines.

Counter lines are net of tax and discounts (`total_cents - tax_cents`, since `total_cents` includes
tax) and **gross of refunds**: a refund is recorded against the payment, not against a line, so
attributing one to a service would mean inventing a split. Voided and open sales are excluded;
refunded ones are not, for that reason.

### Counts stay booking-only

Orders, completions, favourites and the conversion rate they feed are questions about the booking
funnel, and a walk-in has no funnel. A service sold only over the counter shows 0 orders and real
revenue, which is the honest answer rather than a gap.

### Two fan-out traps avoided

Revenue joins in **pre-aggregated** in every one of these queries. Adding a second one-to-many join
alongside `service_orders` and `service_favorites` multiplies their rows and every `SUM` inflates —
a `COUNT(DISTINCT)` hides it right up until money is added to the query.

The group breakdown sums revenue **per group in its own CTE**. The outer query fans out over both
linked services and their orders, so a service's revenue repeats across rows: `SUM` would multiply
it, and `SUM(DISTINCT)` — which was written first — would silently drop a second service that
happened to earn exactly the same amount.

**Do not** aggregate `pos_sales` in parallel alongside `service_orders` in each report. That is
the cheap-looking option and it guarantees the two keep drifting, in eight places at once.

## 9c-3. The last two wrong money numbers — **built**

Two unrelated loose ends, both of the same kind: a money figure that is not what its name says.
S9c is complete with these.

### A field called `totalRevenue` that returned loyalty tokens

`shop/routes/index.ts` built the shop dashboard's `summary.totalRevenue` from
`shop.totalTokensIssued` — a count of RCN, in a field named revenue, rendered by any client as
dollars. Not stale, a different unit entirely. On staging, shop `1111` was reporting **4,044,996**
as its revenue; the real figure is **$59,685.47**.

Now `ShopRepository.getFiatRevenueUsd()`, reading the ledger like every other revenue figure since
S9c-1 — counter sales included, net of tax and refunds. The token count is untouched and still
present in the same payload under `shop.totalTokensIssued`, which is its honest name.

Changed in place rather than added alongside. `/shops/:shopId/dashboard` has no consumer in the web
app or in `mobile/`, so the risk of correcting it is close to nil, and adding
`totalFiatRevenue` next to a `totalRevenue` that stays wrong preserves the bug for whoever reads the
obvious field name.

### Customer spend could not see the counter

Three queries in `CustomerRepository` — `findByShopInteraction`, `findLapsedBookers`,
`findByShopInteractionPaginated` — computed `total_spent` from `service_orders`, so a regular who
buys at the till every week showed as having spent nothing. They now share
`CUSTOMER_SPEND_FROM_LEDGER`, since `payments` carries `customer_address` on both channels.

At one staging shop a customer went from $541.98 to $1,076.98, and a second who had shown $0
appeared at $105.00.

**Only the money moved.** `findLapsedBookers` still takes last-visit and visit-count from
`service_orders`: that list is about lapsed *visits*, and a booking is the visit. Mixing the two
would have changed which customers the list returns, which is a different decision from what it
reports they spent.

**Walk-ins are not attributable and never will be.** A counter sale does not require a customer —
that is how a till works — so the sum of customer spend is always less than shop revenue. On staging
that is 10 of 12 completed sales, $1,747.85. Not a gap to close.

## 10. The customer's receipt (S6c-1) — **built**

The register has always shown the cashier a receipt after checkout. The customer got nothing.

**Where it goes.** Migration 265 adds `pos_sales.receipt_email` and `receipt_sent_at`, and the
register asks for an address on the completion step. A wallet was the only contact detail a sale
carried before this, and on staging only 3 of 20 sales name a customer — gating the receipt on
having an account would have reached roughly one sale in seven. The address typed at the counter
wins over the one on the customer's account: it is the one the person standing there just gave, and
may not be theirs at all.

**Two deliveries, two audiences.** An attached customer gets `pos_sale_receipt` through the
notification gateway (persist + WS + push, marked transactional — a record of money taken is not
something a preference toggle should be able to mute). Anyone who gave an email gets the emailed
copy, account or not. Give neither and nothing is sent, which is the ordinary case at a counter.

**Nothing here can fail a sale.** `PosReceiptListener` hangs off `pos.sale_completed`, like loyalty
and stock before it, so it runs after the money is taken. Every failure is logged and swallowed —
the customer has already left, so there is nothing a retry rescues and nothing the register could
usefully be told. A malformed address is dropped the same way rather than raised: refusing to close
a paid sale over a typo would leave the shop holding an open till.

`receipt_sent_at` is how "did they get it?" gets answered later, since the send is invisible at the
register by design.

Only settled tenders appear on either copy. A declined attempt is register noise, and including it
would make the tenders fail to sum to the total.

**Paper.** *Print receipt* on the completion screen renders an 80mm roll layout — `@page { size:
80mm auto }` so the roll cuts at the end of the receipt instead of feeding a blank page — and prints
through a hidden iframe rather than a popup window, because a till behind a popup blocker would fail
to produce a receipt with nothing on screen to explain why. On an ordinary A4 printer it just prints
narrow. This is the only copy that needs no contact detail at all, which makes it the fallback for
the cash customer who wants something in hand.

**Not covered:** the web notification bell maps the new `receipt` icon token; mobile's own map does
not, so it falls back to its default icon there until whoever owns mobile adds it. Reprinting an
earlier sale is also absent — `listSales` has no frontend caller at all, so there is no sales history
screen to hang a reprint off, and building one is its own slice.

### Next

S6c-2, the review request, which is the harder half. `ReviewController.createReview` resolves the
order through `orderRepository.getOrderById` and 404s on anything that is not a `service_order`, and
`service_reviews.service_id` is NOT NULL — so only service lines are reviewable at all, and the
create path needs to learn about POS sales before a review request means anything. There are no FK
constraints on `service_reviews`, so nothing stops a sale id being stored; the controller is the
real barrier, not the schema.

---

## 11. Warranty terms, without the device model (S7a) — **built**

S7 was scoped as "devices owned, warranty". Splitting it turned out to be the better trade: the
warranty half carries almost all of the value and none of the greenfield device modelling, and a
shop can state its terms before the system knows what a device is.

**Why it was worth doing before anything else in S7.** A shop's warranty on its own labour is its
liability, and nothing held it. When a customer came back with the same fault there was no way to
tell a warranty claim from a new sale — not from the order, not from the sale, not from their
history. That is money in both directions, and it was being settled by whoever remembered harder.

**Bookings, not just the counter.** 877 service orders exist against 42 POS lines, and 278 of those
orders are completed. A warranty that only existed at the counter would have missed nearly all
completed repairs and produced a rule nobody could explain — cover depending on whether the customer
booked online. Migration 266 puts `warranty_days` on `shop_services` (the shop's current terms) and
snapshot copies on both `pos_sale_items` and `service_orders`.

**The snapshot is the point.** Terms move; a promise doesn't. Copying the term at the moment the
work is delivered — ring-up for a counter line, completion for a booking — means a shop that
shortens its warranty next month cannot shorten one it already gave. Same reasoning as
`unit_cost_cents` in S5. The booking snapshot is inlined into both completion writes rather than
done as a follow-up query: an order completed without its term recorded is a claim nobody can
settle. `COALESCE` keeps the first value, so re-completing an order can never move an expiry the
customer has already been told about — verified against staging inside a rolled-back transaction.

**No expiry column.** Cover is `completed_at + warranty_days`, derived wherever both are already in
hand. Storing the expiry as well would allow a completion date that gets corrected and an expiry
that silently doesn't. `utils/warranty.ts` owns the arithmetic so the receipt, the register panel and
any later claim check cannot disagree.

**NULL, 0 and negative all mean not covered**, collapsed to NULL on write. The "unknown vs zero"
distinction `unit_cost_cents` needs has no analogue: a warranty nobody stated and one of no days are
the same promise. An uncovered line prints no warranty row at all rather than "0-day warranty", which
reads as a broken feature rather than an absence of cover.

**Where a claim gets checked.** Attaching a customer at the register loads what the shop still covers
for them, soonest to expire first — the order the conversation wants, since the claim in question is
usually the one about to run out. It loads on attach rather than on completion, because the question
comes up before anything is rung up. Scoped to the shop: one shop has no business reading another's
liabilities. Days remaining round *up*, so the last day of cover reads as 1 rather than 0 — a
register showing 0 invites the shop to refuse a claim it still owes.

**Not covered:** what the work was performed on. That is still S7b, still greenfield. This records
the term, not the device, so a customer with two phones has one list of covered repairs and no way to
tell which phone each belongs to.

---

## 7b. Half-built feature, deliberately left alone — **not the live bug this said it was**

`InventoryDomain` subscribes to **`service:completed`** (`serviceIntegrationController.ts:464`),
but the event `OrderController` publishes on completion is **`service.order_completed`**
(`OrderController.ts:408`). `EventBus` does exact-match lookups with no normalisation, so
`deductStockForService` has **never run**.

**This section previously called that a live defect corrupting inventory, and it is not.** Checked
2026-08-05: the only UI that links parts to a service is `ServiceInventoryPickerModal.tsx`, and
**nothing imports or renders it** — the component name appears nowhere else in the frontend. Three
of the five `service-integration` endpoints have no caller at all (availability, unlink,
services-using-item). With no reachable way to create a link, `deductStockForService` returns at its
`No inventory items linked` guard and deducts nothing.

So the typo and the unmounted modal have been hiding each other: two halves of one unfinished
feature, not a bug with a one-word fix. Fixing the event name alone accomplishes nothing.

**Decision: leave it.** Not fixed, not removed. The options if it is ever picked up are to finish it
(mount the modal, wire the three unused endpoints, then correct the event name) or to delete the
modal, endpoints, listener and table.

**The trap to avoid:** correcting the event name in good faith without checking
`SELECT count(*) FROM service_inventory_items` first. If links exist — created through the API or an
earlier build — flipping it starts moving real stock for those shops.

**Run on staging 2026-08-06: 0 rows.** Nothing is linked, so no shop's stock is at risk either way
and the decision can be made on the feature's merits rather than under a deadline. Production has
not been checked; run the same query there before touching the event name.

---

## 8. Deferred: AI phases (3 and 7)

Phase 3 (AI product suggestions at the point of sale) and Phase 7 (AI business
intelligence) are deferred and belong to whoever owns the AI area.

Worth noting for whoever picks them up: `AIAgentDomain` already has a
recommendations/insights framework (`deadStock`, `reorderNeeded`, `businessBriefing`,
`proposePurchaseOrder`). **Phase 7 mostly needs POS data to read, not new AI plumbing** —
it gets substantially cheaper the moment S2 lands.

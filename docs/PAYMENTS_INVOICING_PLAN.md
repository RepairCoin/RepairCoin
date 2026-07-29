# FixFlow Payments & Invoicing Center — Implementation Plan

> Goal: make FixFlow the shop's complete financial workspace. Stripe stays the
> processor and compliance layer underneath; FixFlow owns the entire experience so
> shop owners never open the Stripe Dashboard. The user should feel like they are
> using **FixFlow Payments**, not switching between FixFlow and Stripe.

Status: **Phase 0 code-complete (unverified) · Slices 1.0–1.3 shipped (launch scope complete)**
· Owner: Nico · Last updated: 2026-07-29

> **Launch scope is merged** (Slice 1.3 via PR #679). Verified on staging: migration 250
> applied, and a full refund on a Connect direct charge reconciled correctly (`refunds` row
> `succeeded`, `payments.refunded_cents` + status updated by `charge.refunded`). Still
> unverified: partial refunds, the `payments:refund` permission split, and the Stripe failure
> path.

> **Scope decision (2026-07-28) — launch first.** Phase 1 is cut to Transactions,
> Refunds, and the order↔payment linking that both need. **Invoices, Payment Links,
> Payouts, and the Revenue Dashboard move to Phase 2.** Rationale: the product is built
> but unused, and shipping everything first delays launch by an estimated 1–2 months;
> shops can still take payment through booking checkout on day one. This deliberately
> departs from §1, which is written invoice-first — the canonical workflow below is the
> Phase 2 target, not the launch target.

---

## 1. Core principle & canonical workflow

Shop creates an invoice in FixFlow → FixFlow creates the Stripe invoice / payment
intent behind the scenes → customer receives it by email or SMS → customer pays
securely (Stripe-hosted / embedded, FixFlow never stores card data) → Stripe
processes → **webhook is the source of truth** → the invoice, order, booking,
customer timeline, transaction history, and payout records update automatically →
AI follows up when an invoice is viewed-but-unpaid or overdue.

### Non-negotiable architecture requirements
- **Stripe Connect** for shop-level payment accounts; Stripe account IDs and payment
  objects always tied to the correct shop.
- **Fully embedded — NO Stripe redirects.** Every shop- and customer-facing flow —
  Connect **onboarding & verification**, checkout, virtual terminal, invoice payment,
  and payout/bank setup — happens **inside FixFlow** via Stripe **embedded components**
  (`@stripe/connect-js` / Connect embedded components + **Account Sessions**) and
  **Elements**. No bounce to Stripe-hosted OAuth, hosted invoice, hosted Checkout, or
  Payment Link pages. FixFlow never stores raw card data (PCI: Elements only).
  → **Implication:** embedded onboarding requires **Express or Custom** connected
  accounts, not the current **Standard/OAuth** setup. This replaces the existing OAuth
  redirect flow and forces a Connect account-type decision + migration of already-
  onboarded shops — see §7 Slice 1.0 and §9 Decisions 5–6.
- **Webhooks are the source of truth** for payment, refund, dispute, invoice, and
  payout status. Request-time writes are provisional; the webhook reconciles.
- **Idempotency** on every charge and every webhook — no duplicate charges or rows.
- An **internal FixFlow record** for every Stripe object (bidirectional link).
- **Role permissions + audit logs** on payments, refunds, and invoice edits.
- **Mobile and web share the same backend** payment services.

---

## 2. Where FixFlow already is (audit summary)

~60% of the plumbing exists. The feature is mostly about adding a **first-class fiat
money model** on top of infrastructure that's already live.

### Reusable today
| Capability | Location |
|---|---|
| Connect status sync + guards/banners (⚠️ the **OAuth/Standard redirect onboarding is being REPLACED** by embedded onboarding — see §7 Slice 1.0; status-sync/columns are reused) | `backend/src/services/StripeConnectService.ts`, `backend/src/domains/shop/routes/connect.ts`, migration `230_add_stripe_connect_accounts.sql`, `shops.stripe_connect_account_id / connect_charges_enabled / connect_payouts_enabled / connect_onboarded_at` |
| Stripe SDK wrapper: PaymentIntents (direct charge + `application_fee_amount`), refunds w/ fee reversal, ad-hoc invoices (`createImmediateInvoice`), subscription tier changes | `backend/src/services/StripeService.ts` |
| Stripe webhook receiver (raw-body verify) + subscription/PI/`account.updated` handlers | `backend/src/domains/shop/routes/webhooks.ts` (raw body mounted at `app.ts:294`) |
| Booking payments: Connect direct charge, order-created-on-payment-success, refunds | `backend/src/domains/ServiceDomain/services/PaymentService.ts` |
| The only order concept — service bookings | `service_orders` table, `backend/src/repositories/OrderRepository.ts` |
| Staff attribution + commission ledger | `shop_team_members`, `staff_commissions` (mig 213), `service_orders.completed_by_member_id` |
| Tiered platform commission (Free/Starter/Growth 1%, Business 0.5%) | `backend/src/utils/platformCommission.ts` |
| CSV export | `backend/src/utils/csvExport.ts` (`CSVExportService`) |
| Notification gateway + registry (for reminders) | `backend/src/domains/notification/config/notificationRegistry.ts`, `NotificationGateway.dispatch()` |
| App-level HTTP idempotency (header-based) | `backend/src/repositories/IdempotencyRepository.ts` (not yet wired to Stripe) |
| Domain/EventBus/BaseRepository/migration scaffolding | `backend/src/domains/types.ts` (`DomainModule`), `DomainRegistry.ts`, `events/EventBus.ts`, `repositories/BaseRepository.ts`, `backend/migrations/` |

### Gaps to build
1. **No unified fiat ledger.** Money data is scattered as opaque `stripe_*_id`
   fragments across 8 feature tables (`subscription_payment_ledger`,
   `ai_overage_charges`, `ad_billing_charges`, `deposit_transactions`,
   `shop_rcn_purchases`, `service_orders`, `stripe_payment_attempts`, `stripe_customers`).
2. **No invoices / line-items / refunds / payouts / receipts tables.**
3. **No Stripe balance/payout/transfer reads** — payouts are entirely unsurfaced.
4. **No Stripe-native webhook idempotency** — re-delivered events aren't deduped by
   `stripe_event_id` (only per-handler DB guards).
5. **No Stripe idempotency keys** on any `stripe.*.create` call — duplicate-charge risk.
6. **Thin money model** — dollars-only `DECIMAL(10,2)`, hardcoded `usd`, no
   tax/tip/discount/currency/deposit/commission columns; single line item per order.
7. **Employee filter not queryable** — `completed_by_member_id` stored but not a filter
   in `getOrdersByShop`.
8. **No customer activity/timeline table** for a payment feed.

> ⚠️ **Naming landmine:** the `transactions` table / `TransactionRepository` is the
> **RCN token ledger** — do **not** reuse it for fiat. The Transactions UI reads the
> new `payments` table (plus the `shop_rcn_purchases.total_cost` USD crossover).

---

## 3. Foundational data model

New tables via `npm run db:create-migration <name>` (auto-picks the next free number —
currently ~243; never hardcode). **All money as integer cents + `currency` char(3)**,
converting only at display — matches Stripe and avoids the current dollar-rounding risk.

1. **`payments`** — unified fiat ledger; one row per money movement. What the
   Transactions screen reads. (DDL in §7, Slice 0.1.)
2. **`invoices`** — invoice number, statuses (`draft|sent|viewed|partially_paid|paid|
   overdue|canceled`), subtotal/tax/tip/discount/total cents, `amount_paid_cents`,
   `deposit_cents`, `due_date`, notes, `stripe_invoice_id?`, `hosted_url?`, `pdf_url?`,
   `order_id?`, `viewed_at`/`sent_at`.
3. **`invoice_line_items`** — `invoice_id`, description, quantity, `unit_price_cents`,
   `amount_cents`, `service_id?`.
4. **`refunds`** — `payment_id`, `amount_cents`, reason, status, `stripe_refund_id`,
   `created_by`. (Today refunds only live inline on `deposit_transactions`.)
5. **`payouts`** — `stripe_payout_id`, `amount_cents`, status, `arrival_date`, method;
   synced from `payout.*` webhooks + balance reads.
6. **`payment_links`** — type (`deposit|balance|full|custom|membership`),
   `amount_cents?`, `invoice_id?`/`order_id?`, `stripe_payment_link_id`, status
   (`active|paid|expired|canceled`), `opened_at`/`paid_at`/`expires_at`.
7. **`stripe_events`** — `stripe_event_id` PK; webhook idempotency (insert-on-arrival,
   skip if present).
8. *(Phase 3)* **`vendors`, `bills`, `bill_payments`** for Bill Pay.

---

## 4. New `PaymentsDomain`

`backend/src/domains/PaymentsDomain/` (PascalCase single-file convention, like
`AdsDomain`):
- `index.ts` implements `DomainModule` (`backend/src/domains/types.ts:10`): `name =
  'payments'` → mounts at `/api/payments`; `initialize()` registers EventBus listeners.
- `routes.ts` (`initializeRoutes(): Router`), `controllers/`, `services/`
  (`InvoiceService`, `PaymentReconciler`, `PayoutService`, `PaymentLinkService`,
  `VirtualTerminalService`), `repositories/`, `events.ts` (`PaymentsEvents`:
  `payments:payment_recorded`, `payments:invoice_paid`, `payments:invoice_overdue`, …).
- Register: one import + `domainRegistry.register(new PaymentsDomain())` in `app.ts`
  `setupDomains()` (~L394).
- **Reuse** the existing `StripeService` / `StripeConnectService` singletons — do not fork.
- **One Stripe webhook endpoint.** Keep `/api/shops/webhooks/stripe` (already raw-body
  mounted); it delegates money events to a `PaymentReconciler` service. No second raw-body route.

---

## 5. Section-by-section build

| Section | Approach | New vs reuse |
|---|---|---|
| **Onboarding ("Get Paid")** | FixFlow-owned multi-step checklist (Verify Business, Business Details, Owner KYC, Bank, Tax, Identity, Statement Descriptor) via Account Sessions + embedded components — no OAuth redirect, no "Stripe" branding. Requires Express/Custom accounts | Replaces OAuth redirect; reuse `shops.connect_*` + status sync |
| **Transactions** | `GET /api/payments/transactions` over `payments` with filters (customer, date, status, method); detail + receipt; CSV via `CSVExportService` | New reads; reuse export util. Employee filter dropped for launch (Slice 1.1) |
| **Orders** | Phase 1 links payments/invoices to existing `service_orders` (customer/booking/technician/messages already attached). Repair/product/marketplace orders don't exist → separate track | Reuse `service_orders`; generalized multi-type order model deferred |
| **Invoices** | CRUD + duplicate; status lifecycle; deposits/partial/tax/discount/tip/due/notes/attachments; send via SMS (gateway) / email (Resend); pay via a **FixFlow-hosted page with embedded Elements** (not Stripe's hosted invoice); server-rendered PDF; AI reminders (Phase 2) | New FixFlow pay page; PaymentIntent per invoice |
| **Virtual Terminal** | PaymentIntent on connected account (reuse `createPaymentIntent`); select/create customer; charge saved methods (SetupIntents / `stripe_customers`); tips/tax/discount/receipt; link to order/booking/invoice | Elements only — no raw PAN |
| **Payment Links** | FixFlow short links (`/pay/:token`) to the **embedded Elements pay page** — NOT Stripe-hosted Payment Links (those redirect to Stripe). `payment_links` row per link; send SMS/email/messages; webhook flips status + updates invoice/order | All new |
| **Payouts** | `PayoutService` → `stripe.balance.retrieve` + `stripe.payouts.list` per connected account + `payout.*` webhooks → `payouts`; balances, upcoming/completed, fees, bank status. Optionally the embedded **payouts/balances** Connect component | All new (no payout code today) |
| **Revenue Dashboard** | Aggregations over the `payments` ledger + `payouts`: revenue over time, by method/service/employee, avg ticket, refunds rate, outstanding invoices, deposits held. The financial home screen | New read/aggregation layer over the ledger |
| **Bill Pay (Phase 3)** | `vendors`/`bills`/`bill_payments`; tracking first, money movement later | All new; correctly separable |

---

## 6. Delivery phases

One branch per phase, one commit per slice.

### Phase 0 — Foundation (no UI) — detail in §7 — **code-complete, unverified**
`payments` + `stripe_events` tables · PaymentsDomain skeleton · Stripe idempotency
keys everywhere · webhook dedup + reconcile into ledger · backfill existing charges.
Written and typecheck-clean on `feat/payments-foundation` (uncommitted). **Migrations 244/245
have never been applied and no code path has run against a database or a real Stripe event.**

### Phase 1 — launch scope
Transactions view + export · Refunds table + UI · Order↔payment linking.
("Get Paid" embedded onboarding — Slice 1.0 — **already shipped**, commit `2e374635` / PR #663.)

### Phase 2
Invoices (create/send/embedded-pay/PDF, core statuses) · Payment Links (FixFlow-hosted) ·
Payouts visibility · Revenue Dashboard · Virtual Terminal · saved payment methods ·
deposits/partial payments · recurring invoices · AI collection reminders
(`invoice_viewed_unpaid` / `invoice_overdue` types + scheduler).

### Phase 3
Bill tracking · vendor management · approvals · (optional) real bill-payment rails.

### Frontend wiring (each phase)
Top-level **Payments** sidebar tab + subtabs (Transactions/Invoices/Links/Terminal/
Payouts) via `ShopSidebar.tsx` (`shopSectionsRaw`), `ShopSubTabs.tsx`
(`SHOP_TAB_GROUPS`), `ShopDashboardClient.tsx` (`activeTab` dispatch ~L1798), gated by a
new **`payments:manage`** permission (`backend/src/domains/shop/permissions.ts` +
`frontend/src/config/shopTabPermissions.ts` mirror). API service:
`frontend/src/services/api/payments.ts` (template: `ads.ts`). Mobile reuses the same
backend services.

---

## 7. Slice-level detail (all phases)

Every slice = one commit on that phase's branch. Endpoints are under `/api/payments`
unless noted. "Reuse" = existing code from the audit (§2).

### Phase 0 — Foundation (no UI)

#### Slice 0.1 — Data model + repositories

`NNN_create_payments.sql`
```sql
CREATE TABLE IF NOT EXISTS payments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                  VARCHAR(100) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  customer_address         VARCHAR(100),
  order_id                 VARCHAR(100),            -- service_orders.order_id ("ord_…")
  invoice_id               UUID,                    -- FK wired in Phase 1
  method                   VARCHAR(20)  NOT NULL,   -- card|cash|ach|deposit|terminal|link
  source                   VARCHAR(30)  NOT NULL,   -- booking|invoice|terminal|link|rcn_purchase|deposit
  gross_cents              INTEGER      NOT NULL,
  fee_cents                INTEGER      NOT NULL DEFAULT 0,   -- Stripe processing fee (balance txn)
  application_fee_cents    INTEGER      NOT NULL DEFAULT 0,   -- platform fee (0 = pass-through)
  net_cents                INTEGER      NOT NULL DEFAULT 0,   -- settles to shop
  refunded_cents           INTEGER      NOT NULL DEFAULT 0,
  currency                 CHAR(3)      NOT NULL DEFAULT 'usd',
  status                   VARCHAR(24)  NOT NULL,   -- requires_payment|processing|succeeded|failed|refunded|partially_refunded
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id         VARCHAR(255),
  stripe_account_id        VARCHAR(255),            -- connected account
  captured_at              TIMESTAMPTZ,
  metadata                 JSONB        NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_shop     ON payments (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments (shop_id, customer_address);
CREATE INDEX IF NOT EXISTS idx_payments_order    ON payments (order_id);
-- Natural idempotency for webhook reconcile: one payment row per PaymentIntent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_intent
  ON payments (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
```

`NNN_create_stripe_events.sql`
```sql
CREATE TABLE IF NOT EXISTS stripe_events (
  stripe_event_id VARCHAR(255) PRIMARY KEY,
  type            VARCHAR(80)  NOT NULL,
  account_id      VARCHAR(255),          -- event.account for Connect events
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events (type, received_at DESC);
```

`PaymentRepository extends BaseRepository`:
- `upsertByPaymentIntent(input)` — `INSERT … ON CONFLICT (stripe_payment_intent_id) DO UPDATE` (reconcile primitive).
- `listByShop(shopId, filters, page, limit): PaginatedResult<Payment>` (filters stubbed; used Phase 1).
- `getByPaymentIntent(pi)`, `markRefunded(id, refundedCents, status)`.
- `StripeEventRepository.claim(eventId, type, accountId): boolean` — `INSERT … ON CONFLICT DO NOTHING RETURNING` → true if first-seen.

#### Slice 0.2 — PaymentsDomain skeleton + registration
`index.ts` (`DomainModule`, `name='payments'`) · `routes.ts` (only `GET /api/payments/_health`
in Phase 0) · `events.ts` · `services/PaymentReconciler.ts` · register in `app.ts` `setupDomains()`.

#### Slice 0.3 — Stripe idempotency keys
`backend/src/services/stripeIdempotency.ts` → `idemKey(scope, id)` returning a **stable**
key. Threaded into `StripeService.createPaymentIntent`, both booking flows
(`ServiceDomain/services/PaymentService.ts` createPaymentIntent / createStripeCheckout), and
refunds. Behavior-preserving (keys only affect retries).

**The key basis matters more than the plumbing (resolved 2026-07-28).** The first pass keyed
bookings on `orderId`, which is useless: both flows mint `ord_<uuid>` fresh per request, so a
double-clicked "Book" produced two keys and two PaymentIntents — the exact duplicate the key
exists to prevent. Replaced with `bookingIdemRef({customerAddress, serviceId, bookingDate,
bookingTime, amountCents})`, a sha1 over what the customer actually chose. A retry of the same
booking reuses the PaymentIntent; a different slot/service/amount gets its own key. Stripe
expires idempotency keys after 24h, which is the effective dedup window. (The alternative — a
client-supplied `bookingDraftId` — was rejected for launch: it changes the API contract and
needs matching web + mobile work.)

Same trap on refunds: keying a partial refund on `PI + amount` would collapse two legitimate
same-amount partial refunds into one. `StripeService.partialRefund` now takes an explicit
`idempotencyRef` from the caller (`deposit:<orderId>` for the deposit refund on completion) and
sends **no** key when the caller has no stable reference — a missing key is safer than a
colliding one.

#### Slice 0.4 — Webhook dedup + reconcile
Modify `backend/src/domains/shop/routes/webhooks.ts`:
1. **Dedup gate** after `constructEvent`: `if (!await stripeEventRepo.claim(event.id, event.type, event.account)) return res.json({received:true})`.
2. **Delegate** `payment_intent.succeeded`, `charge.succeeded`, `charge.refunded`,
   `payment_intent.payment_failed` to `PaymentReconciler`, which expands the charge's
   `balance_transaction` (→ `fee_cents`/`net_cents`), reads `application_fee_amount`,
   calls `paymentRepo.upsertByPaymentIntent(...)`, emits `payments:payment_recorded`.
3. Existing booking-order + subscription handlers unchanged (reconciler keyed independently on the PI).

#### Slice 0.5 — Backfill
`backend/scripts/backfill-payments.ts` (idempotent via `uq_payments_intent`): read
`service_orders` (w/ `stripe_payment_intent_id`), `deposit_transactions`
(`stripe_charge_id`/`stripe_refund_id`), `shop_rcn_purchases` (`total_cost`,
`payment_reference`) → insert `payments` rows. Add `npm run` entry; run once post-deploy
(migrations non-fatal in the pipeline — verify after).

**Phase 0 exit criteria:** every new Stripe charge/refund lands as a reconciled
`payments` row; re-delivered webhooks are no-ops; retries can't double-charge; history
backfilled. No UI yet.

### Phase 1 — Transactions + Refunds (launch scope)

Branch `feat/payments-phase1`. Assumes Phase 0 merged. Frontend shell (Payments tab +
subtabs, `payments:manage` permission, `frontend/src/services/api/payments.ts`) ships in
Slice 1.2 and later slices add their subtab.

**Launch scope is 1.1 → 1.2 → 1.3 only.** Slice 1.0 is already shipped; slices 1.4–1.8 keep
their numbering below but are **deferred to Phase 2** per the scope decision at the top of this
doc. Slice 1.8 was specced as the Payments landing screen — with it deferred, the tab must
default to **Transactions**.

#### Slice 1.0 — "Get Paid" embedded onboarding (replaces the OAuth redirect) — ✅ SHIPPED
> Merged to `main` as commit `2e374635` (PR #663). Spec retained below for reference.
`FixFlow → Payments → Get Paid` — a FixFlow-owned, multi-step checklist the owner completes
without ever seeing the word "Stripe": **Verify Business · Business Details · Owner
Verification (KYC) · Bank Account · Tax Information · Identity Verification · Statement
Descriptor.** Ordered first — new shops can't take in-app payments without it. Guiding rule:
**FixFlow owns the wrapper, Stripe owns the secure fields**; Stripe still handles PCI, KYC,
identity, bank verification, and fraud underneath.
- **Account type (see §9 Decision 6):** create Express/Custom accounts via
  `stripe.accounts.create` (not OAuth). The fully-branded, FixFlow-built named steps in the
  mockup are **Custom-account** territory; **Express + embedded components** delivers the
  same "no redirect, in-app" outcome with Stripe-rendered (themeable) fields and far less
  compliance burden — recommended starting point.
- **Account Sessions:** `POST /connect/account-session` → `stripe.accountSessions.create`
  enabling `account_onboarding` (+ later `payouts`, `account_management`, `documents`,
  `notification_banner`); new `OnboardingService` (PaymentsDomain).
- **FixFlow "Get Paid" checklist:** derive step state from the account's
  `requirements.currently_due` / `eventually_due` + capability/verification states, mapped
  to the friendly labels above, so FixFlow natively renders "Bank Account ✅ / Tax
  Information ⟳ / Identity Verification ⚠︎" progress around the embedded fields. Statement
  descriptor set via `accounts.update`.
- **Frontend:** `@stripe/react-connect-js` embedded components inside a FixFlow "Get Paid"
  page (replaces the `register/shop/payouts` redirect) + a Settings → Payments panel for
  post-setup edits. No redirect anywhere.
- **State:** reuse `shops.connect_*` columns + `account.updated` webhook sync; add
  `connect_account_type` to distinguish embedded (Express/Custom) from legacy Standard.
- **Legacy Standard shops:** cannot be converted and must **not** be deauthorized
  (irreversible — bricks the account). Dual-path (legacy stays OAuth) or re-onboard fresh —
  §9 Decision 6. Mobile shares the same Account Session endpoint.

#### Slice 1.1 — Order↔payment linking — ✅ IMPLEMENTED (backend-only, uncommitted)
Scope reduced 2026-07-28: **linking only, employee filter dropped.** The filter existed to
serve Slice 1.8's revenue-by-employee breakdown, which moved to Phase 2, and shops can
already reconcile staff payouts in the shipped CommissionsTab. Nothing in Transactions or
Refunds needs it, and it can be added later against data that is already being written.

- **Checkout metadata → the charge.** `payments.order_id` is populated by the reconciler
  from the charge's `orderId` metadata, but `createStripeCheckout` only ever set metadata on
  the **Checkout Session**, which does *not* propagate to the PaymentIntent or the charge.
  Every checkout-flow booking therefore landed in the ledger with `order_id = NULL` and no
  way to join it back to its order. Fixed by setting the same `bookingMetadata` object on
  both the session and `payment_intent_data.metadata`. (The PaymentIntent path was already
  correct.) Note `payment_intent_data` is now always present, not only when there is an
  application fee.
  **Not retroactive:** Stripe metadata is fixed at charge time, so rows written before this
  deploy are permanently unlinkable.
- **`completedByMemberId` on the order DTO.** The column has been written at completion
  since migration 213 (staff commissions) but `mapOrderRow` silently dropped it, so nothing
  downstream could read it. One line in the mapper — no join, no added query cost — so the
  data is available whenever Transactions wants a "completed by" column.

**Dropped:** `employeeId` filter + `shop_team_members` join on
`OrderRepository.getOrdersByShop` (still status/date/customer/location only).

#### Slice 1.2 — Transactions view + export + FE shell
- `GET /transactions` → `PaymentRepository.listByShop` with filters (customer, date range,
  status, method) + pagination (`PaginatedResult`). **Employee filtering is out** — see the
  Slice 1.1 scope reduction; `completedByMemberId` is exposed on the order DTO if a
  read-only "completed by" column is wanted, but there is no filter behind it.
- `GET /transactions/:id` → detail (gross/fee/net, `application_fee_cents`, refunds,
  linked order/invoice/customer).
- `GET /transactions/export.csv` → `CSVExportService` (`utils/csvExport.ts`).
- **Frontend shell:** Payments sidebar item (`ShopSidebar.tsx`), subtab group
  (`ShopSubTabs.tsx`), `activeTab` dispatch (`ShopDashboardClient.tsx`), `payments:manage`
  in `permissions.ts` + `shopTabPermissions.ts` mirror, `api/payments.ts`. Transactions
  table + detail drawer.

#### Slice 1.3 — Refunds — ✅ SHIPPED (PR #679)
- Migration `refunds` (`payment_id`, `amount_cents`, reason, status, `stripe_refund_id`,
  `created_by`). `RefundRepository`. **Shipped as migration 250**, not 248 — 248/249 were taken
  by the automation work; the guard is `version = 250`.
- `POST /transactions/:id/refund` (full/partial) → `StripeService.refundPayment` /
  `partialRefund` (with `refund_application_fee` for Connect) → insert `refunds` row.
- Reconcile stays authoritative: `charge.refunded` (Phase 0) updates `payments.refunded_cents`
  + status; this slice records the refund entity + reason and closes the loop by
  `stripe_refund_id`.
- Log to `admin_activity_logs` (`AdminRepository.logAdminActivity`). Refund button in the
  transaction detail drawer.
- **The audit log did not work and had to be fixed separately (2026-07-29).**
  `logAdminActivity` inserted into `action_type` / `action_description` / `entity_type` /
  `entity_id` / `metadata`; the table is `(admin_address, action, details jsonb)` per
  `000_base_schema.sql:1397` and never had those columns. Every write threw and was swallowed
  by the method's own catch, so all 11 call sites (mints, suspensions, contract ops, refunds)
  had been logging nothing — the table held one row, written directly by a 2025 migration
  script. Fixed by mapping onto the real columns rather than migrating to the imagined ones:
  `action` ← actionType, the rest folded into `details`, reads mapped back out, `entityType`
  filter → `details->>'entityType'`. No call site changed. **Nothing before the fix is
  recoverable — there is no backfill source.**

#### Slice 1.4 — Invoices data model + CRUD — ⏭ DEFERRED TO PHASE 2
- Migrations `invoices` + `invoice_line_items`; add FK `payments.invoice_id → invoices.id`.
- `InvoiceRepository` (per-shop `invoice_number` sequence, transactional line-item writes
  via `withTransaction`) + `InvoiceService`.
- Endpoints: `POST /invoices` (draft), `PUT /invoices/:id`, `POST /invoices/:id/duplicate`,
  `GET /invoices`, `GET /invoices/:id`, `DELETE /invoices/:id` (draft only).
- **Frontend:** Invoices subtab + invoice builder (line items, tax/discount/tip/due/notes/
  attachments, deposit field). Draft lifecycle only.

#### Slice 1.5 — Invoice send + pay (embedded) + PDF + status lifecycle — ⏭ DEFERRED TO PHASE 2
- On send: create a PaymentIntent on the connected account for the invoice balance +
  generate a **FixFlow-hosted pay page** at `/pay/:token` (public route). Deliver the link
  via email (existing Resend service) + SMS (notification gateway). **No Stripe-hosted
  invoice / redirect.**
- The `/pay/:token` page renders **Stripe Elements** (Payment Element) against that
  PaymentIntent — customer pays without leaving FixFlow's domain. Server-rendered PDF +
  receipt (FixFlow template), not Stripe's `pdf_url`.
- Status transitions driven by page + webhook: token opened → `viewed`;
  `payment_intent.succeeded` (Phase 0 reconciler) → `paid`/`partially_paid`; daily job
  flips past-due → `overdue`.
- Emits `payments:invoice_paid`. Reconciler links the `payments` row to the invoice.

#### Slice 1.6 — Payment Links (FixFlow-hosted, embedded) — ⏭ DEFERRED TO PHASE 2
- Migration `payment_links`. `PaymentLinkService` creates a `payment_links` row +
  `/pay/:token` link backed by a PaymentIntent on the connected account (reuse the Slice
  1.5 embedded pay page) — **not** `stripe.paymentLinks` (those redirect to Stripe).
  Types: deposit / balance / full / custom / membership.
- `POST /links`, `GET /links`, `POST /links/:id/cancel`. Send via SMS / email / customer
  messages.
- The pay page + `payment_intent.succeeded` webhook flip status
  (`active → paid | expired | canceled`) + auto-update the related invoice/order.
- **Frontend:** Links subtab (create, track sent/opened/paid/expired/canceled).

#### Slice 1.7 — Payouts visibility — ⏭ DEFERRED TO PHASE 2
- Migration `payouts`. `PayoutService` → `stripe.balance.retrieve` + `stripe.payouts.list`
  per connected account; `payout.*` webhooks upsert `payouts`.
- `GET /payouts`, `GET /balance` (current / pending / available). Bank + onboarding status
  reuse `StripeConnectService.getAccountStatus`.
- **Frontend:** Payouts subtab (balances, upcoming/completed payouts, processing fees,
  bank/payout-setup status; reuse `PayoutSetupBanner` state).

#### Slice 1.8 — Revenue Dashboard — ⏭ DEFERRED TO PHASE 2
- `GET /revenue/summary?range=` aggregating the `payments` ledger + `payouts`: gross/net
  revenue over time, by method / service / employee (`completed_by_member_id`), average
  ticket, refund rate, outstanding-invoice total, deposits held. Reuse the token-analytics
  query patterns (`ServiceDomain/controllers/AnalyticsController.ts`) but over fiat.
- **Frontend:** the Payments landing screen — headline KPIs + trend charts (reuse the
  existing dashboard chart components); links into Transactions/Invoices/Payouts.

**Phase 1 exit criteria (launch scope):** a shop can view/search/filter/export every
transaction it has taken — with gross, Stripe fee, platform commission, and net — see the
detail behind any one of them, and issue a full or partial refund from inside FixFlow with a
reason and an audit trail, without opening the Stripe Dashboard. Onboarding (Slice 1.0) is
already live.

*Original (pre-cut) exit criteria, now the Phase 2 target: also create→send→get-paid on an
invoice (PDF + embedded pay page), generate/track payment links, see balances + payout
history, and read a revenue dashboard.*

### Admin oversight — Slices A1–A2 (specced 2026-07-29, not scheduled)

Everything in Phase 1 is shop-facing: every route in `PaymentsDomain/routes.ts` is
`requireRole(['shop'])` with `shopId` taken from the JWT, so an **admin cannot read the fiat
ledger at all** — not per-shop, not platform-wide. The admin dashboard's existing
`admin/tabs/TransactionsTab.tsx` is the RCN *token* ledger (mint/redemption/purchase,
`txHash`), unrelated to `payments`. Consequence worth naming: `SUM(application_fee_cents)` is
the platform's revenue from payments and it is currently visible in **no** UI.

Lettered rather than numbered so Phase 2's 1.4–1.8 keep their meaning. A1 is read-only and
cheap; A2 moves a merchant's money and is a product decision before it is a code change.

#### Slice A1 — Admin payments visibility (read-only)
- **Generalize the shop scoping, don't fork it.** `PaymentRepository.buildFilters(shopId,
  filters)` hardcodes `p.shop_id = $1` as its first predicate. Change the parameter to
  `string | null` (null = skip it) and accept `shopId` as an optional *filter* instead. Every
  current caller passes a real id and is unaffected. Then add `listAll(filters, page, limit)`,
  a nullable-`shopId` `listAllForExport`, `getByIdAdmin(id)`, and
  `getPlatformTotals(filters)` → `{count, grossCents, feeCents, applicationFeeCents,
  netCents, refundedCents}`.
- **`shopName` into `contextSelect`** via `LEFT JOIN shops sh ON sh.shop_id = p.shop_id` — a
  platform list of bare shop ids is unusable. Costs the shop-side queries one join; worth it
  to keep a single read path.
- **`controllers/AdminTransactionController.ts`** in PaymentsDomain (the ledger stays in its
  own domain), reusing an exported `parseFilters` extended with `shopId`.
- **Routes**, declared BEFORE the shop `/transactions/:id` routes or Express matches `admin`
  as an id — the same trap as `/export.csv`:
  `GET /admin/transactions`, `/admin/transactions/:id`, `/admin/transactions/:id/refunds`,
  `/admin/transactions/summary`, `/admin/transactions/export.csv`, all behind
  `[authMiddleware, requireAdmin]`. CSV gains a leading Shop column.
- **Migration: one index.** Every index on `payments` leads with `shop_id`, so a platform-wide
  `ORDER BY created_at DESC` can use none of them:
  `CREATE INDEX idx_payments_created ON payments (created_at DESC)`.
- **Frontend:** `services/api/adminPayments.ts`; `admin/tabs/PaymentsTab.tsx` — **named
  Payments, not Transactions**, because `admin/tabs/TransactionsTab.tsx` already exists and is
  a different ledger. Reuse the shop TransactionsTab layout + drawer, add a Shop column, a shop
  filter, and summary cards (Gross · Stripe fees · **Platform fees** · Net · Refunded). Drawer
  is read-only — refund history listed, no refund button. Wire in three places:
  `ui/sidebar/AdminSidebar.tsx`, `admin/AdminDashboardClient.tsx` (`LazyTabWrapper`),
  `admin/SmartCommandBar.tsx`.
- **QA focus:** the nullable-`shopId` refactor touches the shop read path shipped in 1.2. A
  null-scoping bug there is a cross-tenant leak — verify a shop still sees only its own rows in
  list, detail, and CSV. That matters more than anything in the admin feature itself.
- ~1 day; most of it repurposed.

#### Slice A2 — Admin-initiated refunds
Mechanically small — `RefundController` already resolves the connected account from
`payment.stripeAccountId` — which is the trap. These are **direct charges**: the money sits in
the shop's Stripe account, so an admin refund debits the merchant (and `refund_application_fee`
claws back our commission), overdrawing them if the balance is short. The platform reaching
into a merchant's account is a policy question, not an implementation one; scope it to disputes
and fraud, not routine customer service.
- **Attribution:** `refunds.created_by` can't distinguish an admin from an owner. Add
  `created_by_role VARCHAR(16)` (`shop` | `admin`). The shop must see in its own drawer that
  *the platform* issued it — a silent debit is how support tickets are made.
- Mandatory `note`; shop notification via `getNotificationGateway().dispatch(...)` + a registry
  entry (never hand-wired — see CLAUDE.md); `logAdminActivity` with the admin wallet.
- Confirmation stricter than the shop's: type the amount, show the shop name. The failure mode
  is the right amount on the wrong shop's charge.
- **Recommendation: ship A1 alone first.** It answers what admins ask today (what's flowing,
  what have we earned, did that refund land) at a fraction of the risk. A2 waits for a concrete
  dispute workflow to hang it on.

### Phase 2 — Invoices, Links, Payouts, Dashboard, Virtual Terminal, saved methods, deposits, recurring, AI reminders

Slices 1.4–1.8 (above, numbering retained) land here first — invoices before deposits (2.3)
and recurring (2.4), which depend on the invoice model.

Branch `feat/payments-phase2`.

#### Slice 2.1 — Saved payment methods
- SetupIntents on the connected account; attach to the customer's `stripe_customers`
  record; `GET/POST/DELETE /customers/:address/payment-methods`. Consent/permission
  captured so a saved method can be charged later "where permitted".

#### Slice 2.2 — Virtual Terminal
- `VirtualTerminalService`: create a PaymentIntent on the connected account (reuse
  `StripeService.createPaymentIntent`) via Stripe Elements — no raw PAN in FixFlow.
- `POST /terminal/charge`: select/create customer, charge a saved method or new card,
  tips/tax/discount/notes/receipt delivery, link to order/booking/invoice.
- **Frontend:** Terminal subtab (Stripe Elements form).

#### Slice 2.3 — Deposits & partial payments
- Invoice `deposit_cents` + multiple `payments` per invoice (FK already exists); maintain
  `amount_paid_cents` and the `partially_paid` status. Deposit collection reuses the
  existing `deposit_transactions` pattern where it's a booking deposit.

#### Slice 2.4 — Recurring invoices
- Recurring config (Stripe subscription / invoice schedule on the connected account, or a
  `recurring_invoices` schedule table + scheduler). Generates invoices on cadence, each
  flowing through Slice 1.5's send/pay/status path.

#### Slice 2.5 — AI collection reminders
- Add `invoice_viewed_unpaid` + `invoice_overdue` to `notificationRegistry.ts`
  (`transactional: true`, channels `persist/ws/push`, optional `sms`).
- Scheduler scans invoices (`viewed_at` set + unpaid; past `due_date`) → dispatch via
  `getNotificationGateway().dispatch(...)`; emit `payments:invoice_overdue`. AI copy tuned
  per state (viewed-but-unpaid vs overdue), respecting cadence/quiet hours.

### Phase 3 — Bill Pay (separable)

Branch `feat/payments-phase3`. Stripe Connect does **not** provide accounts-payable, so
this starts as tracking and only later adds real vendor-payment rails.

#### Slice 3.1 — Vendors
- Migration `vendors` (`shop_id`, name, contact, payment details ref) + CRUD + Vendors UI.

#### Slice 3.2 — Bill tracking
- Migration `bills` (`vendor_id`, `amount_cents`, `due_date`, `recurring`, status
  `unpaid|scheduled|paid|void`, notes, attachments). CRUD + list with due-date views.
  **No money movement** — tracking only.

#### Slice 3.3 — Approvals
- Approval workflow on bills (`pending_approval→approved→paid`), gated by a
  `bills:approve` permission; audit to `admin_activity_logs`.

#### Slice 3.4 — Bill payments (optional, later)
- Migration `bill_payments`; integrate a real payout/ACH rail. **Legal/compliance review
  required** before moving vendor money — treat as its own initiative.

---

## 8. Cross-cutting requirements
- **Roles/audit:** gate payment routes on `payments:manage`; log refunds and invoice
  edits to `admin_activity_logs` (`AdminRepository.logAdminActivity()`).
- **PCI:** Stripe Elements / embedded Connect components only — no raw card data, no
  Stripe-hosted redirects.
- **Money in cents** across all new tables.
- **Mobile & web share** the backend payment services (incl. the Account Session endpoint).

---

## 9. Open decisions (now block Phase 2, not the Phase 1 launch scope)

Phase 0 is robust to all of these — the ledger records `application_fee_cents`
regardless, and cents is settled for new tables.

**Updated 2026-07-28:** the launch cut clears every one of these off the critical path.
Decision 1 (the platform-fee legal gate) only bites on *arbitrary invoices*, which moved to
Phase 2 — bookings already take a tier-based application fee today and that behavior is
unchanged. Decision 3 is moot for launch since terminal/links/invoices are deferred, and
Decisions 5–6 were settled and shipped in Slice 1.0. Decision 2 is settled by default for
launch: Slice 1.1 links payments to **service bookings only**. So **no open decision blocks
Transactions + Refunds** — they gate Phase 2 instead.

1. **⚠️ Platform fee on invoices — legal gate.** Taking a fee cut on *arbitrary
   invoices* (not just bookings) can trigger money-transmitter / marketplace-facilitator
   rules. See `docs/tasks/strategy/pricing-alignment/payments-processing-connect-scope.md`
   §7 (and §3: the deliberately-omitted `payments_processing_enabled` / `platform_fee_bps`
   columns). **Decision: pass-through (shop keeps 100%, FixFlow monetizes via
   subscription) or FixFlow takes a bps fee?** Needs legal sign-off if the latter.
2. **Orders scope.** Phase 1 links payments to **service bookings only** (recommended),
   or build a new multi-type order + product catalog + POS (large separate track)?
3. **Charge model.** Stay on **direct charge + application fee** (bookings already use it)
   for terminal/links/invoices, or destination charges?
4. **Cents migration.** New tables in cents (settled); also migrate legacy dollar columns
   on `service_orders`, or convert at the boundary only?
5. **Onboarding experience — DECIDED: fully embedded, no Stripe redirect** (per product
   direction). Everything happens in-app via Account Sessions + embedded components. This
   forces Decision 6.
6. **⚠️ Connect account type + legacy migration — the central onboarding tradeoff.**
   Embedded onboarding needs **Express or Custom** accounts, not the current
   **Standard/OAuth**. Both are "in-app, no redirect"; they differ in how much of the UX
   and liability FixFlow owns:
   - **Express + embedded components (recommended start):** Stripe renders the onboarding
     *fields* (themeable) inside FixFlow; FixFlow wraps them in the "Get Paid" checklist,
     progress, and status. Fastest to ship, Stripe carries most compliance/dispute/support.
     Caveat: the field UI is Stripe's, so the 7 named steps are a FixFlow *shell* around
     Stripe's flow, not pixel-for-pixel custom screens.
   - **Custom accounts:** FixFlow builds *every* screen exactly as mocked (fully white-label
     named steps) and submits via API; Stripe still verifies underneath. Matches the vision
     most literally — but FixFlow owns all compliance, requirements handling, identity
     document upload, dispute/support burden. Much larger, ongoing lift + higher risk.
   - **Recommendation:** launch on **Express + embedded** wrapped in the FixFlow "Get Paid"
     shell (achieves "never feels like Stripe" at low risk); revisit **Custom** later if
     brand control demands pixel-perfect screens.
   - **Legacy Standard shops** already onboarded via OAuth **cannot be converted** and must
     **not** be deauthorized (irreversible — bricks the account). Choose: (a) dual-path —
     legacy stays on OAuth, new shops get embedded Express; or (b) invite all shops to
     re-onboard fresh Express accounts. Recommend **(a) dual-path**.
   - New column `shops.connect_account_type` to route the two paths.

### Recommended defaults (if we proceed without blocking)
Pass-through fees · service-orders-only · direct charge + application fee · cents on new
tables (boundary-convert legacy) · **embedded onboarding on Express accounts, legacy
Standard shops kept on a dual-path**.

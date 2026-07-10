# Scope — Welcome RCN on Claim

**Status:** Proposed (not built)
**Owner area:** Account claim flow (`AccountClaimController.claimAccount`) + RCN balance/source layer
**Companion to:** Square→FixFlow win-back campaign (`square-switch-execution-scope.md`, Phases 1–3 built)
**Why it exists:** the conversion incentive that turns "claim later" into "claim now."

---

## 1. Strategy — what this is and why

When an imported customer (e.g. carried over from Square) **claims** their account, grant
them a one-time **welcome RCN** reward. RCN is the one thing the old POS structurally cannot
offer, so it's the strongest pull in the migration funnel.

The two pieces are designed as a pair:
- The **win-back campaign** (already built) *drives* the customer to claim.
- The **welcome RCN** *rewards* the claim — the campaign and landing page can both say
  "claim your account and get {amount} RCN."

Without this hook, a claiming customer gets their history back but **no incentive for the
effort**, which suppresses claim rate — the top-of-funnel metric for the whole migration.

## 2. What happens today (no reward)

`AccountClaimController.claimAccount` (POST `/api/customers/claim`), in one DB transaction:
verifies email/phone match → transfers `service_orders`, `customer_rcn_sources`,
`conversations`, `notifications` to the real account → copies name → clears the placeholder's
contact so it can't be re-claimed. **No RCN is granted anywhere in this flow.**

## 3. What happens with the hook

Inside the SAME claim transaction, after the merge succeeds and before COMMIT:

1. **Detect migration claim** — the claimed placeholder had `import_source` set (and/or was a
   `0xMANUAL…` wallet). Non-imported claims are unaffected.
2. **Eligibility / guards**
   - one welcome grant per customer, EVER (idempotency — see §5);
   - the shop has opted in and the funding source has budget (see Decision A);
   - amount > 0.
3. **Grant** the welcome amount to the real customer:
   - increment `customers.current_rcn_balance` (the existing off-chain credit path), and
   - record provenance via `recordRcnSource({ customerAddress, shopId, amount,
     sourceType: 'migration_welcome', isRedeemable: ... })` into `customer_rcn_sources`.
4. **Debit funder** if shop-funded — decrement `shops.purchased_rcn_balance` by the amount
   (same column shops draw down when issuing normal rewards).
5. **Notify** the customer ("Welcome to FixFlow — here's {amount} RCN to get started").
6. If any step fails, the whole claim transaction rolls back (grant is atomic with the claim —
   never a partial "claimed but no RCN" or "RCN but not claimed" state).

## 4. Decisions to lock (these change the build)

### Decision A — Who funds the welcome RCN?  ✅ LOCKED: shop-funded, opt-in
**Decided (2026-06-28):** shop-funded, opt-in. Debit `shops.purchased_rcn_balance`; the shop
owns the customer relationship and the upside, so they fund their own win-back. If the shop is
opted out OR has insufficient balance, **the claim still succeeds with no grant and no error
to the customer** (the grant is best-effort, the claim is not). Platform-funded and hybrid are
dropped from v1.

### Decision B — On-chain mint vs off-chain credit?  ✅ LOCKED: off-chain credit
**Decided (2026-06-28):** off-chain credit only. Management is hiding the blockchain and
live minting is not relevant right now (consistent with the DB-only mode the recent main
merge introduced). So the grant **increments `customers.current_rcn_balance` and records a
`customer_rcn_sources` row — no on-chain mint in the claim path.** On-chain settlement, if it
ever happens, follows the same deferred path as every other reward; it is NOT part of this
hook. On-chain-mint-at-claim is dropped, not deferred.

### Decision C — Amount + configuration  ✅ LOCKED: 25 RCN default + per-shop override
**Decided (2026-06-28):** flat global default of **25 RCN (≈ $2.50)** with an optional
per-shop override (`shops.welcome_rcn_amount`, NULL = use global default). Global default in
config/env (`WELCOME_RCN_DEFAULT_AMOUNT=25`). Variable/tiered-by-spend is dropped from v1.

## 5. Anti-abuse / correctness

- **One grant per customer, ever.** Enforce by checking for an existing
  `customer_rcn_sources` row with `sourceType='migration_welcome'` for that customer (and/or a
  `customers.welcome_rcn_granted_at` timestamp — see §6) BEFORE granting, inside the txn.
- **Imported-only.** Only fire when the claimed placeholder had `import_source` — a normal
  signup claim gets nothing.
- Abuse surface is low: only the shop imports customers, and claiming requires an email/phone
  match to a real placeholder. The per-customer cap closes the residual loop.
- **Atomic with claim** — grant lives in the existing claim transaction; partial states are
  impossible.

## 6. Schema / config changes

Likely one migration (confirm next-free NNN across branches/bundles at build time per the
migration-numbering rule — current max on this branch is 184):
- `shops.welcome_rcn_enabled BOOLEAN DEFAULT false` — per-shop opt-in (Decision A).
- `shops.welcome_rcn_amount NUMERIC(12,2)` — optional per-shop override (Decision C); NULL =
  use global default.
- (Optional, cleaner idempotency) `customers.welcome_rcn_granted_at TIMESTAMPTZ` — explicit
  one-per-customer guard, in addition to / instead of the `customer_rcn_sources` check.

Global default amount: config/env (e.g. `WELCOME_RCN_DEFAULT_AMOUNT=25`). Whole feature behind
a flag (e.g. `ENABLE_WELCOME_RCN`, default off) for safe rollout.

## 7. Acceptance criteria

- Claiming an imported account with the shop opted-in credits exactly the configured amount
  once; `current_rcn_balance` and a `migration_welcome` source row both reflect it; shop
  balance is debited (if shop-funded).
- Claiming again (or a second imported placeholder) grants nothing — one per customer.
- Claiming a NON-imported account grants nothing.
- Shop opted-out or insufficient balance → claim still succeeds, no grant, no error to the
  customer.
- Customer sees a "welcome RCN" notification.
- Grant failure rolls back the entire claim (atomic).
- Backend tsc 0; live claim test on peanut (seed an imported customer → claim → verify
  balance + source + shop debit, then re-claim is a no-op).

## 8. Out of scope (v1)

- On-chain mint at claim (off-chain credit only).
- Platform/hybrid funding (shop-funded only).
- Variable/tiered amounts.
- First-booking bonus (a separate, later funnel reward — this hook is claim-only).
- Resend domain verification (needed to actually SEND the campaign that drives claims — its
  own task).

## 9. Phasing / estimate

- **Phase 1 — config + guard** (migration: shop opt-in/amount + optional granted_at; flag;
  global default). ~half day.
- **Phase 2 — grant in the claim transaction** (detect imported, eligibility, credit balance +
  recordRcnSource, debit shop, notify; all atomic). ~half day.
- **Phase 3 — surface it** (campaign/landing copy references the amount; shop setting toggle in
  the dashboard). ~half day.

Build Phase 1+2 first (the reward must work and be safe); Phase 3 is the visible polish.

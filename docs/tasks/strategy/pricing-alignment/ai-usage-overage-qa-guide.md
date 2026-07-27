# QA Guide — AI Usage Overage (T3.2)

How to test the AI Usage Overage add-on end-to-end on staging. Covers Slices 1 (behavior), 2 (metering),
2.5 (guardrail + consent), the card-on-file gate, and Slice 3 (Stripe charging — built + test-mode verified,
gated behind `AI_OVERAGE_STRIPE_ENABLED`, default OFF; see Test D).

Related: `ai-usage-overage-implementation-plan.md`.

---

## 0. How it works (30-second version)

Each shop has a monthly AI allowance by tier — **$10 Starter / $30 Growth / $75 Business** — tracked in
`ai_shop_settings.current_month_spend_usd`.

- **Without overage:** at 70% the AI drops to the cheaper model (Haiku); at 100% it stays on Haiku and
  shows the "upgrade or add overage" banner — never a hard block.
- **With overage ON:** past 100% it **keeps the full model**, and every dollar beyond the allowance is
  metered into `ai_overage_charges` at **Usage ×3** (`amount_cents = overage_cost × 3`).
- **Guardrail:** once billable overage `(spent − allowance) × 3` reaches `AI_OVERAGE_MONTHLY_CAP_USD`
  (default $100) it reverts to Haiku (no runaway invoice).
- **Enabling** requires an explicit consent click (stamped to `ai_overage_consent_at`) **and** a card on file.

---

## 1. Why the card shows "Coming soon" (and how to make it live)

The Plans-hub card is **backend-driven** (no frontend build-time flag). It stays **Coming soon** until the
single backend flag is on:

| Flag | Where | Effect |
|---|---|---|
| `ENABLE_AI_OVERAGE=true` | DO backend | `/ai/spend` reports `overageAvailable:true` → the card becomes a live Enable button; the enforcer honors overage; the enable endpoint works |

Set it, restart/redeploy the backend, reload the Plans page → the card flips to **Enable**. (Diagnostic: the
Plans page fires a `GET /api/ai/spend` — if its response has `overageAvailable:true` the card is live.)

> Note: there is intentionally **no** `NEXT_PUBLIC_AI_OVERAGE_ENABLED` flag — it was removed so a Vercel env
> change (which never re-inlines into an existing build) can't leave the card stuck on "Coming soon". Only the
> backend flag matters.

Optional testing flags (DO backend):
- `AI_OVERAGE_REQUIRE_CARD=false` — bypass the card-on-file check (staging shops often have none)
- `AI_OVERAGE_MONTHLY_CAP_USD=3` — set low so the guardrail is easy to trip (default 100)

After setting these + **redeploying the frontend**, the card flips from "Coming soon" to an **Enable** button.

**Shop prereqs:** AI on (`ai_shop_settings.ai_global_enabled=true`) and a resolvable tier.

---

## 2. Test A — the enable flow (consent + card)

1. Shop → **Plans & Billing** (`/shop?tab=plans`) → the **AI Usage Overage** card shows **Enable** (not "Coming soon").
2. Click **Enable** → a confirm dialog states the Usage ×3 terms → **OK**.
3. Expect: toast "AI Usage overage enabled"; the card badge flips to **Active** ("Disable" button).
4. DB check:
   ```sql
   SELECT ai_overage_enabled, ai_overage_consent_at FROM ai_shop_settings WHERE shop_id='<shop>';
   -- ai_overage_enabled=true, ai_overage_consent_at stamped
   ```

**Card-gate variant:** with `AI_OVERAGE_REQUIRE_CARD=true` and no card on file → enabling returns **402**
and a toast "Add a payment method before enabling AI Usage Overage" (no DB write).

**Disable:** click **Disable** → `ai_overage_enabled=false` (consent timestamp is preserved as history).

---

## 3. Test B — full model past the cap + metering (the core)

You can't realistically spend $10–$75 of AI by hand, so **seed the spend** just over the allowance.
Example: a **Growth ($30)** shop.

1. Seed spend over the cap:
   ```sql
   UPDATE ai_shop_settings SET current_month_spend_usd = 31 WHERE shop_id='<shop>';
   ```
2. **Overage OFF** (baseline): send a message to the shop's AI (the "Ask AI" unified assistant, or in-app
   chat). Expect: reply runs on **Haiku**, and the "upgrade / add overage" banner shows.
3. **Enable overage** (Test A), then send another AI message. Expect: **full model, no banner**.
4. Verify the model actually used (audit log):
   ```sql
   SELECT model, cost_usd, created_at FROM ai_agent_messages
   WHERE shop_id='<shop>' ORDER BY created_at DESC LIMIT 3;
   -- full model = claude-sonnet-*   |   degraded = claude-haiku-4-5-*
   ```
5. Verify the accrual ledger:
   ```sql
   SELECT overage_cost_cents, multiplier, amount_cents, status FROM ai_overage_charges
   WHERE shop_id='<shop>' AND period_month = DATE_TRUNC('month', now())::date;
   -- overage_cost_cents > 0 ; amount_cents = overage_cost_cents * 3 ; status='pending'
   ```
6. Shop-visible number: `GET /api/ai/spend` returns `overageChargeUsd` > 0 (and `overageEnabled:true`).

---

## 4. Test C — the bill-shock guardrail (platform default + per-shop cap)

The guardrail cap is the shop's own `overage_cap_usd` if set, else the platform default
`AI_OVERAGE_MONTHLY_CAP_USD` (default $100).

**C1 — platform default:**
1. Set the default low: `AI_OVERAGE_MONTHLY_CAP_USD=3` (redeploy backend).
2. Seed spend so billable overage ≥ cap. Growth $30: set spend to **$32** → billable = (32−30)×3 = **$6 ≥ $3**.
   ```sql
   UPDATE ai_shop_settings SET current_month_spend_usd = 32, overage_cap_usd = NULL WHERE shop_id='<shop>';
   ```
3. With overage **enabled**, send an AI message. Expect: **back on Haiku** (guardrail tripped) + the
   cap-reached banner ("raise your overage cap"). Confirm via the audit `model` (Haiku) on the latest call.

**C2 — per-shop cap (Slice 2.6):** the shop's own cap overrides the platform default, both ways.
1. On **Plans & Billing**, under the overage indicator, set the **Overage safety cap** input to **$2** and
   Save (or `POST /api/ai/overage/cap { "capUsd": 2 }`). DB: `overage_cap_usd = 2.00`.
2. With spend $32 (billable $6 ≥ $2) → **Haiku + cap-reached banner**, regardless of the platform default.
3. Raise the cap to **$50** (billable $6 < $50) → **full model resumes**, even if the platform default is
   lower. Clear the input (blank + Save) → `overage_cap_usd = NULL` → inherits the platform default again.
4. Guards: `capUsd ≤ 0` → **400**; the input's "In effect: $X (default)" hint reflects the active cap.

---

## 4b. Test D — Stripe charging (Slice 3, flag-gated)

Charging bundles a shop's **completed-month** pending overage (`period_month < this month`) into one direct
Stripe invoice to its existing `stripe_customer_id` (same mechanism as ads billing — NOT Stripe Connect).
It is fully dark until the master switch is on:

| Flag | Effect |
|---|---|
| `AI_OVERAGE_STRIPE_ENABLED=false` (default) | admin invoice endpoint returns **501**; nothing is charged; the accrual ledger keeps accruing |
| `AI_OVERAGE_STRIPE_ENABLED=true` | invoicing is live (only flip once the Usage ×3 terms are signed off) |

**D0 — prove it's dark (flag OFF):**
```
POST /api/ai/admin/overage-invoice   {"shopId":"<shop>"}   (admin auth)
-> 501  "AI Usage Overage billing to Stripe is disabled…"
```

**D1 — charge one shop (Stripe TEST mode only):** seed a *completed-month* pending row (charging skips the
current month on purpose):
```sql
INSERT INTO ai_overage_charges (shop_id, period_month, overage_cost_cents, multiplier, amount_cents, status)
VALUES ('<shop>', (DATE_TRUNC('month', now()) - interval '1 month')::date, 10, 3, 30, 'pending');
```
With `AI_OVERAGE_STRIPE_ENABLED=true` and a shop that has a Stripe customer (`stripe_customers.shop_id`):
```
POST /api/ai/admin/overage-invoice   {"shopId":"<shop>"}
-> 200 { stripeInvoiceId, totalCents:30, status:'paid'|'invoiced' }
```
- No pending → **400**; shop has no Stripe customer → **409**.
- Ledger check: the row flips `pending → invoiced` (or `paid`) with `stripe_invoice_id` set.
- `invoice.payment_succeeded` webhook → `reconcileOverageInvoice` flips `invoiced → paid` on collection.
- Batch variant: `{"all":true}` invoices every shop with completed-month pending (best-effort per shop).

**Cleanup:** void the test invoice in the Stripe dashboard (TEST mode = no real money) and
`DELETE FROM ai_overage_charges WHERE …` the seeded row.

> ⚠️ Only run D1 against a `sk_test_` key. Confirm the key mode before invoicing a real shop's customer.

---

## 5. Reset / cleanup between runs

```sql
-- reset the shop's spend + overage state
UPDATE ai_shop_settings
   SET current_month_spend_usd = 0, ai_overage_enabled = false, ai_overage_consent_at = NULL,
       overage_cap_usd = NULL
 WHERE shop_id='<shop>';
-- clear the accrual ledger for this shop/month
DELETE FROM ai_overage_charges
 WHERE shop_id='<shop>' AND period_month = DATE_TRUNC('month', now())::date;
```

Then flip the flags back off when done (`ENABLE_AI_OVERAGE`, `AI_OVERAGE_STRIPE_ENABLED`) — everything
is default-OFF, so leaving them off restores normal soft-landing behavior.

---

## Quick reference

- **Flags (all backend):** `ENABLE_AI_OVERAGE` (the only one that gates visibility), `AI_OVERAGE_REQUIRE_CARD`,
  `AI_OVERAGE_MONTHLY_CAP_USD` (platform-default cap; per-shop `overage_cap_usd` overrides it),
  `AI_OVERAGE_STRIPE_ENABLED` (gates real charging, default OFF)
- **Tables:** `ai_shop_settings` (`ai_overage_enabled`, `ai_overage_consent_at`, `current_month_spend_usd`,
  `overage_cap_usd`), `ai_overage_charges` (accrual ledger), `ai_agent_messages` (model per call)
- **Endpoints:** `GET /api/ai/spend` (`overageEnabled`/`overageAvailable`/`overageChargeUsd`/`overageCapUsd`/`overageCapDefaultUsd`),
  `POST /api/ai/overage {enabled, consent}`, `POST /api/ai/overage/cap {capUsd|null}` (shop),
  `POST /api/ai/admin/overage-invoice {shopId | all:true}` (admin)
- **Migrations:** 224–226 (overage core), **228** (`overage_cap_usd` per-shop cap)
- **Migrations:** 224 (`ai_overage_enabled`), 225 (`ai_overage_charges`), 226 (`ai_overage_consent_at`)

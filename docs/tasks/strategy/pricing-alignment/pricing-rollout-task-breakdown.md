# FixFlow Pricing Rollout — Developer Task Breakdown

**Date:** 2026-06-22
**Source:** `c:/dev/pricing.jpeg` (FixFlow "Your AI Business Team") + verified against the codebase.
**Companion:** `pricing-sheet-vs-code-gap-analysis.md` (the why/what-exists). This doc = the **assignable
task list**, grouped into workstreams (WS) so each maps to a developer/squad.

**Legend:** ✅ done · ⚠️ partial · 📋 scoped (doc exists) · ❌ not started · 🔒 needs management/legal decision first.
**Effort:** S ≤1d · M 2–4d · L 1–2wk · XL >2wk. **Owner:** suggested role.

---

## WS0 — Decisions & non-engineering (unblock everything else)

Each decision has a **Recommended default** — the lowest-friction choice to unblock the build. These are
defaults to confirm/override, not final calls.

- ✅ **D1 — Legacy $500/mo shops. → DECIDED 2026-06-22: migrate ALL existing $500 shops to Business ($599).**
  *(Owner: Management/PM — locked.)* Rationale: this is **dev/staging only — no real paying customers**, so the
  usual churn / price-hike-notice / revenue concerns don't apply. Business ($599) is the closest tier to the
  current $500 and preserves full feature access (no feature loss). **No `legacy` tier needed.**
  - **Impact on T1.2:** the `plan_tier` backfill sets every existing `shop_subscriptions` row to `business`;
    move their Stripe subscription onto the Business Price ($599). No grandfather path to maintain.
- ✅ **D2 — "AI usage included $10/$30/$75". → DECIDED 2026-06-22 (keep the sheet's numbers; soft-landing at cap).**
  *(Owner: Management/PM — locked.)* The advertised allowances stand as **real metered allowances** ($10/$30/$75 raw
  AI cost, the unit `ai_shop_settings.monthly_budget_usd` measures). $10 for Starter is fine **because feature
  gating (WS2) keeps the expensive ops — image generation ~$0.06 each, Voice AI — out of Starter**; Starter's
  text-only Haiku usage = thousands of messages on $10. The lever is gating, not the dollar number.
  - **Behavior at the cap (3-step soft landing — replaces today's hard block):**
    1. **70%** — keep the existing auto-downshift to Haiku.
    2. **100% (default)** — do NOT kill AI: degrade to **Haiku-only at minimal cost** + surface "You've reached
       your plan's AI limit — upgrade or enable pay-as-you-grow." (No dead end.)
    3. **Opt-in overage** — if enabled, keep serving past the cap and **bill at 3× raw cost** ("Usage ×3" add-on = T3.2).
  - **Open follow-up (non-blocking):** per-action cost figures above are estimates off one data point; calibrate
    against the real `ad_ai_costs` + `ai_shop_settings` spend history before final lock (optional).
- ✅ **D3 — "Multi-Location" definition. → DECIDED 2026-06-22: new one-owner-many-branches model, "coming soon," build later.**
  *(Owner: Management/PM — locked.)* "Multi-Location Management" = **one owner with several branches under a parent
  account** (shared billing, per-location + rolled-up data) — a **genuinely new data model, NOT** the existing
  `AffiliateShopGroupDomain` peer coalitions (which are multi-*owner* and would be misleading to market as this).
  **Do not block the WS1/WS2 launch on it.**
  - **Impact:** ship the Business tier with Multi-Location shown as **"Business — coming soon"** (gate it in
    T2.5); schedule the real build (T7.4) as a later Business-tier deliverable (XL).
- ✅ **D4 — Payments Processing. → DECIDED 2026-06-22: Stripe Connect Express + app fee; build gated on Legal; "coming soon" at launch.**
  *(Owner: Legal for the gate; Backend-Billing for the build.)* Technical model is **Stripe Connect Express +
  destination charges with `application_fee` (0.5–1%) on the post-RCN amount** (Express keeps Stripe as merchant
  of record = lowest compliance burden). **Do NOT start WS4 until Legal clears the payfac / money-transmission
  question.** Does NOT block the WS1/WS2/WS3 launch.
  - **Impact:** ship Payments Processing as **"coming soon"** in the add-on hub (one registry flag) until Legal
    signs off and T4.1–T4.4 land. The Legal review runs in parallel with the rest of the rollout.
- ✅ **D5 — 30-day money-back scope. → DECIDED 2026-06-22: fee-only, 30 days from first payment, first-time only.**
  *(Owner: Management/PM + Legal — locked.)* "100% money back" = **100% of the FixFlow subscription/plan fee only**.
  **Never** refund third-party **ad spend** (went to Meta/Google, shop-funded) or **payment-processing
  pass-through** (not FixFlow's money). Window = **30 days from FIRST PAYMENT** (not signup — fair given the
  14-day free trial). **First-time only** (one refund window per shop) to prevent subscribe-refund-resubscribe abuse.
  - **Impact:** WS9 **T9.3** builds the fee-only refund flow on these rules; reuses `StripeService.refundInvoice`
    — the **same primitive** ads **Safeguard 6** (ROI money-back) needs. Does NOT block the core launch (early
    refunds can be processed manually in Stripe until T9.3 lands).
- **D6 — Dedicated Account Manager (Business) & Priority Phone/Chat Support (Business).** Operational, not code:
  staffing + a support-routing SLA + a "priority" flag on the shop record. *(Owner: Ops/Support)*
  - **Recommended: add a `priority_support` boolean on the shop (set by tier) now; staff the human side as Ops
    capacity allows.** The flag is trivial and lets routing/UX react immediately; the actual account-manager
    coverage is a hiring/SLA decision, not a launch blocker.

---

## WS1 — Subscription & plan tiering (the core of the sheet)

Today: one Stripe price, flat `$500/mo`, `subscription_type` always `'standard'`, no `plan_tier`.
Files: `migrations/024_add_shop_subscriptions_fixed_v2.sql`, `domains/shop/routes/subscription.ts`,
`services/SubscriptionService.ts`, `repositories/ShopSubscriptionRepository.ts`, `services/StripeService.ts`.

- ❌ **T1.1** Create 3 Stripe Prices — Starter $99 / Growth $299 / Business $599 (monthly). Add env IDs. *(Backend-Billing, S)*
- ❌ **T1.2** Migration: add `plan_tier` (+ optional `ai_allowance_cents`) to `shop_subscriptions`; **backfill all
  existing rows to `business` and move their Stripe subscription onto the $599 Business Price (per D1 — no
  grandfather/legacy tier).** *(Backend-Billing, S)*
- ❌ **T1.3** Plan selection at checkout — choose tier → correct Stripe Price; persist `plan_tier`. *(Backend-Billing + FE, M)*
- ❌ **T1.4** Upgrade / downgrade with proration (upgrade immediate+prorated, downgrade next cycle). NOTE: the
  **ads** add-on already implements this exact pattern in `AdsDomain/SubscriptionService` — reuse/lift it. *(Backend-Billing, M)*
- ❌ **T1.5** 14-day free trial, **no credit card** — Stripe trial config + trial state in UI; convert-or-pause at trial end. *(Backend-Billing + FE, M)*
- ❌ **T1.6** "No contracts — cancel anytime" — self-serve cancel at period end (no lock-in). *(Backend-Billing + FE, S)*
- ❌ **T1.7** Plan picker + current-plan UI on the pricing/billing screen (Start Free Trial CTAs, "Most Popular" Growth). *(Frontend, M)*
- ❌ **T1.8** Webhook reconciliation for tier changes (`customer.subscription.updated`, invoice events → `plan_tier`/status). *(Backend-Billing, S)*

---

## WS2 — Feature gating & entitlements

Today: access is **binary** — `middleware/subscriptionGuard.ts` qualifies a shop by active sub **or** ≥10K RCG,
then grants **everything**. No per-tier gating.

- ❌ **T2.1** Build a **plan→feature entitlement matrix** config (single source of truth: feature key → min tier). *(Backend-Platform, S)*
- ❌ **T2.2** Extend `subscriptionGuard.ts` (or new `entitlementGuard`) to enforce the matrix per route/feature; helper `hasEntitlement(shop, feature)`. *(Backend-Platform, M)*
- ❌ **T2.3** Frontend gating + upsell UX — lock icons / "Upgrade to Growth" prompts on gated features; reuse the add-on hub's `ctaFor` pattern. *(Frontend, M)*
- ❌ **T2.4** Apply gates to **Growth+** features: AI Marketing Suite, AI Image & Content Generator, AI Lead
  Follow-Up (Email & SMS), AI Insights & BI, Inventory Management, Voice AI Assistant, Campaign Builder,
  Advanced Reports & Analytics. *(Backend-Platform + FE, M)*
- ❌ **T2.5** Apply gates to **Business** features: Multi-Location, AI Memory & Automation, Team Mgmt &
  Permissions, AI Auto-Replies (Voice+Text), AI Campaigns (Advanced), Custom Workflows, Advanced Inventory
  Intelligence. (Several are net-new — see WS7; gate ships with the build. **Multi-Location renders as
  "Business — coming soon" per D3** until T7.4 lands. **AI Memory (T7.3) is already BUILT + flag-gated** — here it
  just needs the Business entitlement check added on top of `ENABLE_AI_MEMORY`.) *(Backend-Platform + FE, M)*
- ❌ **T2.6** Decide RCG-holder access vs paid tiers — does ≥10K RCG still grant "everything", or map to a tier?
  (Touches `subscriptionGuard`.) *(Backend-Platform, S — needs D-note)*

---

## WS3 — AI usage allowances & overage (the "$ included" + "Usage ×3" add-on)

Today: flat **$20/mo** per shop (`AIAgentDomain/SpendCapEnforcer.ts`, `ai_shop_settings.monthly_budget_usd`);
Haiku at 70%, **hard-block at 100%**, no metering/overage. Scope doc: `ai-usage-overage-scope.md`.

- ❌ **T3.1** Wire per-plan allowance ($10 / $30 / $75) to `ai_shop_settings.monthly_budget_usd` from `plan_tier`
  instead of a flat $20 default. Depends on **T1.2**. *(Backend-AI, S)*
- ❌ **T3.1b** **Replace the 100% hard-block with the D2 soft landing** in `SpendCapEnforcer`: keep 70% Haiku
  downshift; at 100% degrade to **Haiku-only** (don't stop) + emit an "AI limit reached — upgrade / enable
  pay-as-you-grow" signal. *(Backend-AI, S)*
- 📋 **T3.2** **AI Usage Overage billing** — opt-in; meter spend past the allowance and bill **3× raw cost**
  ("Usage ×3") via Stripe. When OFF, T3.1b's Haiku-only mode is the ceiling. *(Backend-AI + Billing, M)*
- 📋 **T3.3** **Exempt ads-AI COGS from the shop pool** — ads creative/auto-answer spend currently drains the shop
  AI budget via `recordSpend`; it's COGS tracked in `ad_ai_costs`. Must be excluded before overage billing is fair.
  *(Backend-AI, S — do before/with T3.2)*
- ❌ **T3.4** Usage meter UI — show "X of $Y used" per plan (the add-on hub already renders a bar; wire real allowance). *(Frontend, S)*
- ⚠️ **T3.5** New-shop provisioning — confirm the lazy default-budget fix (`AI spend-cap new-shop`) interacts
  correctly with per-tier allowances. *(Backend-AI, S — verify)*

---

## WS4 — Add-on: Payments Processing (0.5%–1% / transaction)

Today: ❌ none. Customer→shop PaymentIntents exist (`ServiceDomain/PaymentService.ts`) but take **no platform fee**;
no Stripe Connect anywhere for customer payments. 🔒 Gated on **D4 (legal sign-off)** — model **locked = Connect
Express + app fee**; ships as **"coming soon"** until Legal clears + build lands. Scope: `payments-processing-connect-scope.md`.

- 🔒 **T4.0** Legal review — payfac / money-transmission posture for Connect Express. **Must clear before T4.1.** *(Legal, —)*
- 🔒 **T4.1** Stripe Connect onboarding (Express accounts) per shop. *(Backend-Billing, L)*
- 🔒 **T4.2** Route customer payments as destination charges with `application_fee` (0.5–1%, configurable). Apply fee
  on the **post-RCN** amount. *(Backend-Billing, M)*
- 🔒 **T4.3** Connect account status + payout UI for shops; fee transparency. *(Frontend, M)*
- 🔒 **T4.4** Reconciliation + refunds with Connect (fee handling on refund). *(Backend-Billing, M)*

---

## WS5 — Add-on: AI Ads Management ($199–$999/mo)  — MOSTLY DONE

✅ Built & committed on `deo/ads-system`: flat tiers $199/$499/$999 (A/B/C retired, migration 155), the
"Plans & Billing" add-on hub, and the full ads relationship lifecycle (self-serve tier change, capacity 1/3/10,
durable comms, §9 money safeguards), currency-aware display, Safeguards 1–5.

- ✅ **T5.1** Flat-tier billing + lifecycle + hub — **DONE**.
- 🔒 **T5.2** Go-live for real: Meta **App Review** of write scopes (`ads_management`/`pages_manage_ads`/`leads_retrieval`). *(Backend-Ads + Ops, M)*
- 🔒 **T5.3** Live spend enforcement + Google channel (tier promises currently admin-honored; Meta scaffold only). *(Backend-Ads, L)*
- 🔒 **T5.4** Outbound lead transport (SMS/WhatsApp/Messenger provider) — today messages are "recorded". *(Backend-Ads, M)*
- 🔒 **T5.5** Turn on real Stripe collection (`ADS_BILLING_STRIPE_ENABLED`) once subscription billing is live. *(Backend-Billing, S)*
- 🔒 **T5.6** Safeguard 6 (ROI money-back refund) — gated on Stripe-live + 60-day ROI + legal (**D5**). Scoped. *(Backend-Ads, M)*
- 📋 **T5.7** (optional) Video creatives — scoped, not built. *(Backend-Ads, M)*

---

## WS6 — Add-on: Agency Program ($999/mo · ≤10 clients @ $50)

Today: ❌ none. Affiliate groups are **peer coalitions**, not managed-client accounts. **Unscoped.**

- ❌ **T6.0** Write the engineering scope (data model + billing rollup + white-label question). *(Architect/PM, S)*
- ❌ **T6.1** Parent→client account hierarchy (agency owns ≤10 shop accounts). *(Backend-Platform, L)*
- ❌ **T6.2** Agency dashboard — manage/switch between client accounts. *(Frontend, L)*
- ❌ **T6.3** Agency billing rollup — $999 base + $50/client metering. *(Backend-Billing, M)*
- ❌ **T6.4** (decision) White-label / branding per agency? *(PM, —)*

---

## WS7 — Net-new feature builds (plan inclusions not yet built)

- ❌ **T7.1 Team Management & Permissions** (Business) — shop-internal staff/employee roles + scoped permissions.
  Today only `admin/shop/customer` (no shop-staff layer; `config/permissions.ts` is admin sub-roles only). *(Backend-Platform + FE, L)*
- ⚠️ **T7.2 Custom Workflows** (Business) — promote the existing event-driven handlers into a real workflow
  builder (today: handlers only, no builder). *(Backend-Platform + FE, XL)*
- ✅ **T7.3 AI Memory** (Business) — **BUILT 2026-06-23** (flag `ENABLE_AI_MEMORY`, default OFF). The unified
  assistant now remembers the owner's STANDING INTENT (preferences/instructions/decisions/corrections) across
  conversations — NOT DB facts (the assistant is already DB-grounded), NOT chat history. Committed on
  `deo/ads-system`: Phase 1 recall + `remember_this` (mig 175, `f7e6371d8`), Phase 2 settings UI + CRUD
  (`f7e6371d8`), Phase 5 shared reads — also honored in marketing chat + ads lead replies (`cdb4721bd`), nightly
  `purgeStale` (`dc9cf9855`). Live-verified on peanut (chat + marketing). Docs: `../ai-memory/` (scope, impl-plan,
  QA guide). **Remaining (optional/gated):** Phase 3 auto-extract (deprioritized — DB grounding makes it
  low-signal), Phase 4 customer-level (privacy review). **Business-tier ENTITLEMENT gate still pending WS2** —
  until then it's env-flag-gated, not plan-gated. NOTE the sheet's "AI Memory & Automation" also implies T7.2
  (workflows/automation), which is separate + unbuilt. *(Backend-AI — v1 DONE; tier-gate via WS2.)*
- ⚠️ **T7.4 True Multi-Location Management** (Business) — one-owner-many-branches data model (parent account +
  child locations, shared billing, per-location + rolled-up data; **NOT** affiliate coalitions). **D3 locked:
  build LATER — ships as "Business — coming soon" at launch (gated via T2.5).** *(Architect + Backend, XL — deferred)*
- ⚠️ **T7.5 Advanced Inventory Intelligence** (Business) — audit existing `InventoryDomain` (low-stock + PO
  suggestions exist) and define the "advanced/intelligence" delta. *(Backend, M — scope first)*
- ⚠️ **T7.6 AI Auto-Replies (Voice + Text)** (Business) — verify the existing `messaging`/Voice AI covers the
  Business-tier "auto-replies"; gate Basic vs full. *(Backend-AI, M — verify/scope)*

---

## WS8 — "Basic vs full" feature-level tiering (within already-built features)

The sheet markets Starter inclusions as **Basic** variants (implying intra-feature gating, not just on/off):

- ❌ **T8.1 AI Assistant (Basic)** vs full — define what "Basic" limits (model, tools, depth) for Starter. *(Backend-AI + PM, M)*
- ❌ **T8.2 Branding Studio (Basic)** vs full — Starter gets a reduced Branding Studio. *(Backend + FE, M)*
- ❌ **T8.3 Email & SMS Marketing (Basic)** vs Growth's AI Marketing Suite — split basic vs advanced. *(Backend + FE, M)*
- ❌ **T8.4 Reports: Basic (Starter)** → **Advanced Reports & Analytics (Growth)** — tier the reporting surface. *(Backend + FE, M)*

---

## WS9 — Trial, contracts & money-back guarantee (cross-cutting)

- ❌ **T9.1** 14-day free trial, no card (see T1.5) — applies across all plans. *(Backend-Billing, —/with T1.5)*
- ❌ **T9.2** "No Contracts. Cancel Anytime." — ensure cancel is always self-serve, period-end (see T1.6). *(Backend-Billing, —)*
- ❌ **T9.3** **30-Day Money-Back Guarantee** — refund flow per **D5 (locked): fee-only, 30 days from first
  payment, first-time only; exclude ad spend + payment pass-through.** Track first-payment date + a
  `refund_used` flag per shop. Reuses `StripeService.refundInvoice` (same primitive ads Safeguard 6 needs).
  *(Backend-Billing, M)*

---

## WS10 — Marketing-truth audit (make the footer claims true)

- ✅/⚠️ **T10.1 "Built for every industry"** — `industries` taxonomy + seeds exist (ads system). Confirm the
  customer-facing claim is backed across booking/marketing, not just ads. *(Backend, S — verify)*
- ⚠️ **T10.2 Mobile App (Starter+)** — FixFlow mobile exists; confirm feature parity for what each tier promises on mobile. *(Mobile, M — audit)*
- ❌ **T10.3** Pricing page itself — build/refresh the public pricing + Start-Free-Trial funnel to match the sheet. *(Frontend, M)*

---

## WS11 — Feature hide/disable (management decision: turn OFF Affiliate Groups + Blockchain)

Management directed turning OFF the **Affiliate Shop Groups** feature and the **Blockchain** layer.
**Confirmed 2026-06-22: this is a REVERSIBLE HIDE/DISABLE, NOT a hard removal.** No code/contract deletion,
no dropping of data — gate both behind feature flags so they go dark in the UI + stop firing, but can be
re-enabled. This mirrors the blockchain "Strategy B" already in place. Investigated against the codebase 2026-06-22.

### WS11a — Affiliate Shop Groups: hide/disable behind a flag — ❌ ~0% done (not started)

Fully wired and live with **no off-switch today**: `AffiliateShopGroupDomain` is registered (`app.ts:27,390`);
order completion mints group tokens (`OrderController.ts:1158–1219`); shop nav link, `/shop/groups` routes,
customer group balances/badges all present. DB tables intact (migrations 18/19/34/35). **Approach = add a flag
(mirror blockchain's `ENABLE_BLOCKCHAIN_MINTING`), e.g. `ENABLE_AFFILIATE_GROUPS` / `NEXT_PUBLIC_AFFILIATE_GROUPS_ENABLED`,
default OFF. Keep all code + tables in place (dormant).**

- ❌ **T11a.1** Add the backend flag + a public config exposure (extend the existing `GET /api/config` from the
  blockchain work). *(Backend, S)*
- ❌ **T11a.2** Backend: when OFF, short-circuit group behavior — skip group-token issuance in `OrderController`
  completion, hide group surfacing in `DiscoveryController`/`ServiceRepository.getServiceGroups`; gate the
  `AffiliateShopGroupDomain` routes (404/disabled) without unregistering the code. *(Backend, M)*
- ❌ **T11a.3** Frontend: when OFF, hide the dedicated surfaces — `components/shop/groups/` (~12), `GroupsTab`,
  `GroupPerformanceSection`, `ServiceGroupSettings`, `/shop/groups` routes (redirect), `ShopSidebar` nav link. *(Frontend, M)*
- ❌ **T11a.4** Frontend: when OFF, hide the coupled customer surfaces — marketplace group badges/filter
  (`ServiceMarketplaceClient`), `GroupBalancesCard`, FAQ/breadcrumb group refs. *(Frontend, S)*
- ❌ **T11a.5** Regression-test BOTH states — OFF (no group UI, normal RCN earning intact) and ON (feature still
  works), so the flag is genuinely reversible. *(QA, S)*
- **Summary: 0% done / 100% remaining.** Effort ~**M** — lighter than a delete (no surgical removal, no DB
  migration); the work is wiring the flag through the order/marketplace/balance/nav surfaces. Code + data stay.

### WS11b — Blockchain: hide/disable (already done as reversible "Strategy B") — 🟡 ~90% done (web+backend)

**Confirmed: reversible HIDE, not a hard removal** — exactly the intended model. Toggle
`ENABLE_BLOCKCHAIN_MINTING=false` → DB-only; contracts moved to `src/contracts/_archive/` (dormant, loaded only
when the flag is on); blockchain-only UI hidden via `GET /api/config`. **Wallet/Thirdweb login KEPT permanently
(decision June 18).** No contract deletion, RCN/RCG stay. Tracker: `docs/blockchain-removal/IMPLEMENTATION_STATUS.md`
+ `ZEFF_TASK.md`. Committed: `572e9fed`, `5ffd1e20`.

- ✅ **T11b.1** Backend DB-only provider pattern + flag, redeem/debit via provider, RCG tier/pricing off-chain,
  Phase-3 archive of contract modules, staging deploy flag, 220 tests green. **DONE & committed.**
- ❌ **T11b.2** **Commit the frontend UI-hiding work** — ~12 files + new `frontend/src/contexts/AppConfigContext.tsx`
  (hides Mint-to-Wallet, Bulk Mint/Transfer, RCG Transfer/OTC, Stake-RCG, crypto pay, Buy-RCG). **Built, uncommitted.** *(Frontend, S)*
- ❌ **T11b.3** **Manual prod step** — set `ENABLE_BLOCKCHAIN_MINTING=false` on the live DigitalOcean prod component
  (in-repo `.do/app.yaml` covers staging only). *(DevOps, S)*
- ❌ **T11b.4** Mobile token-decoupling (redemption signature, thirdweb constants) — **separate deferred track, not started.** *(Mobile, M)*
- ❌ **T11b.5** Optional cleanup — move `MintResult` type out of `_archive/`, re-enable smoke test, gate `debug-pending-mints` page. *(Backend, S)*
- **Summary: ~90% done (web+backend) / ~75% if mobile included.** Remaining = commit the UI hiding + flip the prod
  env var + (later) mobile. Confirmed as the reversible-hide model — **no hard-removal work in scope.**

---

## Suggested squad assignment

- **Billing squad (Stripe):** WS1 (all), WS3.2/3.3, WS4, WS5.5, WS6.3, WS9. — *the critical path; the sheet is a billing story.*
- **Platform squad (entitlements/roles):** WS2, WS6.1, WS7.1, WS7.4.
- **AI squad:** WS3.1/3.4/3.5, WS7.3, WS7.6, WS8.1, WS5.x ads-AI bits.
- **Frontend squad:** WS1.7, WS2.3, WS3.4, WS6.2, WS8.x, WS10.3.
- **Ads squad:** WS5 (go-live items).
- **Mobile:** WS10.2, WS11b.4 (blockchain mobile decouple).
- **Hide/disable squad:** WS11a (affiliate flag — backend + frontend + QA), WS11b.2/b.3/b.5 (blockchain commit + prod flag + cleanup).
- **Legal/Ops/PM:** WS0, WS4 gate, WS9.3, WS6.0/6.4, D6.

## Critical path / recommended order

1. **WS0 decisions** (D1–D5) — nothing real ships without them.
2. **WS1 tiering + WS2 gating + WS3.1 allowance** — closes ~70% of the gap, reuses existing features. *(This is the MVP of "the sheet is true.")*
3. **WS9 trial/guarantee** (rides on WS1).
4. **WS3.2 overage**, then **WS4 Payments** (legal-gated), then **WS5 ads go-live**.
5. **WS7 net-new features** + **WS8 Basic/full splits** — longest pole; sequence by tier demand.
6. **WS6 Agency** — scope (T6.0) early, build last.
7. **WS11 hide/disable** (reversible flags, NOT hard removal) — runs in parallel: WS11b blockchain is ~90% done
   (just commit + prod flag); WS11a affiliate is 0% done (~M, flag-gate the surfaces; code + data stay in place).

> Standing note: AI Ads Management (WS5 core) is the only add-on already built. The **plans column**
> ($99/$299/$599 tiering + gating + allowances) is the highest-leverage unbuilt work.

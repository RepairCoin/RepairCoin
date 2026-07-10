# FixFlow Pricing Sheet vs. Codebase — Gap Analysis & Task Plan

**Date:** 2026-06-15 · **Refreshed:** 2026-06-22
**Source:** `c:/dev/pricing.jpeg` (FixFlow "Your AI Business Team" pricing sheet)
**Status:** Analysis complete. Since the original pass, the **AI Ads Management add-on** moved from
scoped → **built & committed** (flat tiers + add-on hub + full ads relationship lifecycle). Everything
else remains as analysed. See **§6 — Status update (2026-06-22)** for the current done/missing snapshot.
Standing rule: do not commit unless told.

---

## 0. TL;DR — done vs missing (refreshed 2026-06-22)

- ✅ **Done:** AI Ads Management add-on as flat tiers ($199/$499/$999, A/B/C retired) + the "Plans &
  Billing" add-on hub + the full ads subscription/campaign-request lifecycle (self-serve tier change,
  capacity, durable comms, money safeguards). Built & committed on `deo/ads-system`.
- 📋 **Scoped, not built:** AI Usage Overage billing; Payments Processing (Stripe Connect — gated on
  legal); per-tier ROI-refund + test-budget safeguards.
- ❌ **Not started:** the **3-tier main subscription** ($99/$299/$599) + per-plan feature gating +
  per-plan AI allowance ($10/$30/$75) — the single highest-leverage gap; Agency Program; Team
  Management & Permissions; Custom Workflows + persistent AI Memory; true Multi-Location.

---

## 1. Headline

The pricing sheet describes a product the code **does not yet package**. The sheet sells a
**3-tier subscription** ($99 Starter / $299 Growth / $599 Business) with **per-plan feature
gating** and **per-plan AI-usage allowances**, plus paid **add-ons**. The codebase has a
**single flat $500/mo subscription** with **no tiers, no plan-based feature gating, and a flat
$20/mo AI budget per shop**.

Most *features* on the sheet already exist. The missing work is the **packaging, metering, and
billing** the sheet is built around — not the features themselves.

---

## 2. The sheet (as advertised)

**Plans (billed monthly, 14-day free trial, no card, no contracts):**
- **Starter AI — $99/mo** — Online Booking & Scheduling, CRM & Customer Mgmt, Review Mgmt,
  AI Assistant (Basic), Branding Studio (Basic), Email & SMS Marketing (Basic), Mobile App,
  Basic Reports. **AI usage included: $10/mo value.**
- **Growth AI — $299/mo** ⭐ MOST POPULAR (Starter +) — AI Marketing Suite, AI Image & Content
  Generator, AI Lead Follow-Up (Email & SMS), AI Insights & BI, Inventory Mgmt, Voice AI
  Assistant, Campaign Builder, Advanced Reports & Analytics, Priority Email Support.
  **AI usage included: $30/mo value.**
- **Business AI — $599/mo** (Growth +) — Multi-Location Mgmt, AI Memory & Automation, Team
  Mgmt & Permissions, AI Auto-Replies (Voice + Text), AI Campaigns (Advanced), Custom Workflows,
  Advanced Inventory Intelligence, Dedicated Account Manager, Priority Phone & Chat Support.
  **AI usage included: $75/mo value.**

**Add-ons:**
- **Payments Processing** — 0.5%–1% per transaction.
- **AI Usage Overage** — Usage ×3, pay-as-you-grow (beyond plan limits).
- **AI Ads Management** — $199–$999/mo.
- **Agency Program** — $999/mo, manage up to 10 client accounts ($50/client).

---

## 3. What the code actually has (verified)

**Subscription / plans — SINGLE FLAT FEE, NO TIERS**
- One Stripe price (`STRIPE_MONTHLY_PRICE_ID`), **$500/mo flat**. `subscription_type` is always
  `'standard'`.
- Files: `backend/migrations/024_add_shop_subscriptions_fixed_v2.sql` (`monthly_amount DEFAULT 500.00`),
  `backend/src/domains/shop/routes/subscription.ts`, `backend/src/services/SubscriptionService.ts`.
- Access is **binary** via `backend/src/middleware/subscriptionGuard.ts`: a shop qualifies through an
  active Stripe subscription **or** ≥10K RCG; once qualified it gets **everything**. No tier gating.
- (Separate RCG governance tiers — Standard/Premium/Elite — only affect **RCN purchase price**, not
  subscription cost or feature access.)

**AI usage metering — FLAT $20/mo, HARD CAP, NO OVERAGE BILLING**
- `backend/src/domains/AIAgentDomain/services/SpendCapEnforcer.ts`: default **$20/mo** per shop
  (`ai_shop_settings.monthly_budget_usd`, admin-editable). Switches to Haiku at 70%, **hard-blocks at
  100%**. Auto-rolls over each calendar month. All AI features share the one pool.
- No plan→budget linkage. **No overage billing** — it stops, it does not meter-and-charge.

**AI features — mostly built, NOT gated by plan**
- ✅ Exists: AI Assistant/Unified (`AIAgentDomain` orchestrator), Business Insights, AI Marketing +
  Image/Content gen, Branding Studio, Voice AI (Whisper/TTS/dispatch), Inventory (`InventoryDomain` +
  low-stock + PO suggestions), AI Lead Follow-Up (`AISalesFollowUpDetector/Handler`), AI Auto-Replies
  (`messaging` MessageService), Campaign Builder (`MarketingDomain`), Booking/CRM/Reviews/Email&SMS,
  Affiliate Shop Groups.
- ⚠️ Partial: **AI Memory & Automation / Custom Workflows** — event-driven handlers only; no workflow
  builder; memory is conversation-scoped only. **Multi-Location** — only peer affiliate-coalitions
  (`AffiliateShopGroupDomain`), not single-owner-many-branches.
- ❌ Missing: **Team Management & Permissions** — only `admin/shop/customer` roles; no shop-internal
  staff/employee role layer.

**Add-ons**
- **Payments Processing (0.5–1%/txn)** — ❌ NOT FOUND. No Stripe Connect, no `application_fee`, no
  platform cut. Customer→shop PaymentIntents exist (`ServiceDomain/PaymentService.ts`) but take no fee.
- **AI Ads Management ($199–$999/mo)** — ✅ **BUILT (2026-06-22 refresh).** The Plan A/B/C markup model is
  **RETIRED**; `AdsDomain` now bills **flat tiers $199/$499/$999** (starter/growth/business, migration 155,
  `BillingPlanRepository.FLAT_TIER_FEES`, `AdBillingService.accrueMonthlyFees`) exactly as the sheet sells.
  Shop pays its own ad spend directly; FixFlow charges only the flat management fee. Shipped alongside the
  "Plans & Billing" add-on hub and the full ads relationship lifecycle (self-serve tier change + proration,
  capacity 1/3/10, durable shop↔admin thread, §9 money safeguards). Real Stripe collection still gated by
  `ADS_BILLING_STRIPE_ENABLED` (accrue-only until on). See [[project-pricing-alignment-state]] + [[project-ads-system-state]].
- **Agency Program ($999/mo, 10 clients @ $50)** — ❌ NOT FOUND. No parent→client account hierarchy or
  white-label. Affiliate groups are peer coalitions, not managed-client accounts.

---

## 4. Missing tasks (prioritized)

### P0 — Makes the sheet true (highest leverage; reuses existing features)
1. **Tiered subscription system.** Define Starter/Growth/Business as 3 Stripe prices; add `plan_tier`
   to `shop_subscriptions`; plan selection at checkout + upgrade/downgrade with proration. Decide what
   happens to the legacy $500 flat plan (grandfather vs migrate).
2. **Per-plan feature gating.** A plan→feature matrix + middleware (extend `subscriptionGuard.ts`):
   Growth+ gates Voice/Inventory/AI-Lead-Followup/AI-Marketing; Business gates Multi-Location/AI-Auto-
   Replies (Voice+Text)/Advanced-Inventory/Team-Mgmt/Custom-Workflows. Today every active shop gets
   everything.
3. **Per-plan AI allowance.** Wire `ai_shop_settings.monthly_budget_usd` to plan tier ($10/$30/$75)
   instead of a flat $20 default.

### P1 — Billed add-ons the sheet sells
4. 📋 **AI usage overage billing.** Meter spend past the included allowance and bill "Usage ×3" via Stripe
   instead of hard-blocking at 100%. (Touches `SpendCapEnforcer` + a new Stripe metered/invoice path.)
   **SCOPED, not built** — `ai-usage-overage-scope.md` (~1.5–2d; KEY: exempt ads-AI COGS from the shop pool).
5. 📋 **Payments Processing add-on.** Stripe Connect + per-transaction platform fee (0.5–1%). Net-new —
   nothing exists today. **SCOPED, not built** — `payments-processing-connect-scope.md` (~4–6d, **gated on
   legal/compliance** — payfac / money-transmission).
6. ✅ **AI Ads Management as a fixed $199–$999 tier. — DONE (2026-06-22).** Built as flat tiers
   $199/$499/$999 (migration 155); A/B/C **retired**. See §3 + §6.

### P2 — Feature inclusions not yet built
7. **Team Management & Permissions.** Staff/employee roles + scoped permissions (net-new role layer on
   top of `admin/shop/customer`).
8. **Agency Program.** Parent account managing ≤10 client shops at $50/client + agency dashboard +
   billing rollup. Net-new.
9. **Custom Workflows + AI Memory.** Promote event-driven handlers into a workflow builder; add
   persistent cross-conversation memory (Business AI tier).
10. **True Multi-Location Management.** If the sheet means one owner / many branches (vs affiliate
    coalitions), that is a separate data model from `AffiliateShopGroupDomain`.

---

## 5. Recommendation

Cheapest path to "the sheet is true": **P0 #1–#3** (tiering + gating + allowance) closes ~70% of the
gap and reuses everything already built. Add-ons (#4–#6) are the next revenue layer; net-new features
(#7–#10) are the longest pole.

**Open decisions for exec before building:**
- Legacy $500/mo shops: grandfather, migrate to Growth, or sunset?
- Is "AI usage included $value" a real hard allowance (and overage billed), or marketing framing over a
  generous flat budget?
- Ads add-on: keep the flexible A/B/C model internally and *present* it as $199–$999 tiers, or replace
  with true flat tiers?
- "Multi-Location" definition: branches-of-one-owner vs the existing affiliate coalition.

---

## 6. Status update (2026-06-22)

What changed since the 2026-06-15 analysis, item by item:

**✅ Built & committed (on `deo/ads-system`)**
- **AI Ads Management add-on (task #6)** — flat tiers $199/$499/$999, A/B/C retired (migration 155).
  Shop funds its own ad spend; FixFlow bills only the flat fee. Real Stripe collection gated by
  `ADS_BILLING_STRIPE_ENABLED` (accrue-only until on).
- **Add-on access hub** ("Plans & Billing" shop tab) — registry-driven catalog with deep-links; AI Ads
  is live, the other add-ons render as "coming soon" until their scopes ship. Flag `NEXT_PUBLIC_ADDON_HUB_ENABLED`.
- **Full ads relationship lifecycle** — self-serve tier subscribe/upgrade/downgrade + proration,
  capacity (1/3/10 campaigns), recurring campaign requests, durable shop↔admin thread, and §9 money
  safeguards (bill-only-when-live, payment-method gate, cancel = period-end). Migrations 156–161.
- **Ads safeguards 4 & 5** (test-budget tier + free-creative-refresh trigger) and a **currency-aware
  display sweep** also landed — ads-system-internal, not pricing-sheet line items (see [[project-ads-system-state]]).

**📋 Scoped, not built (engineering scope docs exist in this folder)**
- **AI Usage Overage (task #4)** — `ai-usage-overage-scope.md`.
- **Payments Processing (task #5)** — `payments-processing-connect-scope.md` (gated on legal).
- **Per-tier ROI-refund / test-budget safeguards** — `roi-refund-safeguard-scope.md`,
  `test-budget-and-diagnostic-scope.md` (the ROI-refund piece = ads Safeguard 6, still gated on Stripe-live + legal).

**❌ Not started (unchanged from §4)**
- **3-tier main subscription $99/$299/$599 + feature gating + per-plan AI allowance (tasks #1–#3)** — the
  product subscription is still a single flat $500/mo with binary access and a flat $20/mo AI cap. This
  remains the **highest-leverage gap** and is independent of the ads add-on tiers above.
- **Agency Program (#8)** — still unscoped.
- **Team Management & Permissions (#7)**, **Custom Workflows + persistent AI Memory (#9)**, **true
  Multi-Location (#10)** — net-new, not started.

**Bottom line:** the **add-ons column** of the sheet is now partly real (AI Ads done; Payments + Overage
scoped). The **plans column** ($99/$299/$599 tiering) — the core of the sheet — is **still not built**.

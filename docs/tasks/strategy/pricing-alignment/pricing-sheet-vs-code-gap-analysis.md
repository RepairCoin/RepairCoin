# FixFlow Pricing Sheet vs. Codebase — Gap Analysis & Task Plan

**Date:** 2026-06-15
**Source:** `c:/dev/pricing.jpeg` (FixFlow "Your AI Business Team" pricing sheet)
**Status:** Analysis complete — no code written. Standing rule: do not commit unless told.

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
- **AI Ads Management ($199–$999/mo)** — ⚠️ PARTIAL. `AdsDomain` billing exists as Plan A ($299 flat
  dashboard fee) / B (20% markup, default) / C ($50/booking or 10% rev-share) — `ad_billing_plans`,
  `BillingPlanRepository.DEFAULT_PLAN`. **Not** the simple $199–$999 tiered monthly fee the sheet sells.
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
4. **AI usage overage billing.** Meter spend past the included allowance and bill "Usage ×3" via Stripe
   instead of hard-blocking at 100%. (Touches `SpendCapEnforcer` + a new Stripe metered/invoice path.)
5. **Payments Processing add-on.** Stripe Connect + per-transaction platform fee (0.5–1%). Net-new —
   nothing exists today.
6. **AI Ads Management as a fixed $199–$999 tier.** Reconcile the sheet's flat tier with the existing
   A/B/C markup model; likely add a flat-fee plan option to `ad_billing_plans` / `AdBillingService`.

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

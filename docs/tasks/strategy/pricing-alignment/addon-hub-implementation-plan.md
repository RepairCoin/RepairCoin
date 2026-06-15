# Implementation Plan — Add-On Access Hub ("Plans & Billing")

**Date:** 2026-06-15
**Status:** Plan — no code written yet. Standing rule: do not build/commit until told.
**Implements:** `addon-access-design.md` (central hub + registry + deep-links).
**Grounded in:** `frontend/src/components/ui/sidebar/ShopSidebar.tsx`, `ShopDashboardClient.tsx` (tab pattern),
`frontend/src/services/api/*` (existing typed clients), `backend` shop subscription routes + `ai_shop_settings`.

---

## 1. Guiding principle — ship the hub FIRST, light up gradually

The hub is the integration point every add-on plugs into, so it's the right first build. Critically, it
**degrades gracefully**: an add-on whose backend isn't built yet renders as a `coming_soon` card. So the hub
ships useful on day one and each add-on flips from "coming soon" → live by changing **one registry entry** when
its scope lands. **No hard dependency on the other scopes.**

It also reuses data that already exists — subscription status, AI usage, ads enrollment — so v1 needs almost no
new backend.

---

## 2. How the app wires a tab (the pattern we copy)

From the real code:
- **Sidebar** (`ShopSidebar.tsx`): an item `{ title, href: "/shop?tab=plans", icon, tabId: "plans" }`, optionally
  env-gated (exactly how the Ads item is gated by `NEXT_PUBLIC_ADS_DASHBOARD_ENABLED`).
- **Dashboard** (`ShopDashboardClient.tsx`): reads `searchParams.get("tab")` → `activeTab`; renders a block
  `{activeTab === "plans" && <ShopPlansBillingTab .../>}` (mirrors `{activeTab === "ads" && <ShopAdsTab/>}`).
- **API**: a typed client in `src/services/api/` (like `ads.ts`, `aiSettings.ts`).

So the hub is "just another tab" — low-risk, no routing changes.

---

## 3. Data sources — what the hub reads (mostly EXISTING)

| Hub section | Source | Status |
|---|---|---|
| YOUR PLAN (current tier/status) | `GET /subscription/status` (shop routes) | ✅ exists |
| AI allowance + usage | `ai_shop_settings` via `aiSettings.ts` (monthly_budget_usd / current_month_spend_usd) | ✅ exists |
| AI Ads add-on status | ads enrollment/plan — `ads.ts` (`getMyEnrollment`, plan) | ✅ exists (built) |
| Payments add-on status | `shops.payments_processing_enabled` / `connect_charges_enabled` | ⏳ payments scope |
| AI Overage status | `ai_shop_settings.overage_enabled` | ⏳ overage scope |
| Billing (method + invoices) | subscription billing reads / Stripe customer | ✅ exists (subscription) |

v1 composes these with **parallel client calls** from the hub (no new aggregator). A backend aggregator
(`GET /shop/addons/summary`) is an optional later optimization, not required.

---

## 4. The registry (frontend config — the extensibility core)

`frontend/src/config/addonRegistry.ts`:
```ts
export interface AddonDef {
  id: 'ai_ads' | 'payments' | 'ai_overage' | 'agency' | string;
  displayName: string; priceLabel: string;
  category: 'marketing' | 'payments' | 'ai' | 'agency';
  activationType: 'toggle' | 'request' | 'onboarding' | 'contact' | 'coming_soon';
  manageLink?: string;          // '/shop?tab=ads', '/shop?tab=settings', etc.
  featureFlag?: string;         // env flag to reveal during rollout
}
export const ADDON_REGISTRY: AddonDef[] = [
  { id:'ai_ads',     displayName:'AI Ads Management', priceLabel:'$199–$999/mo', category:'marketing',
    activationType:'request',    manageLink:'/shop?tab=ads' },
  { id:'payments',   displayName:'Payments Processing', priceLabel:'0.5–1%/txn', category:'payments',
    activationType:'onboarding', manageLink:'/shop?tab=wallet' },
  { id:'ai_overage', displayName:'AI Usage Overage', priceLabel:'Usage ×3', category:'ai',
    activationType:'toggle',     manageLink:'/shop?tab=settings' },
  { id:'agency',     displayName:'Agency Program', priceLabel:'$999/mo', category:'agency',
    activationType:'contact' },
];
```
- **Status** is resolved at runtime by a `statusResolver` keyed off `id` (reads the §3 sources). Kept out of the
  static config so the registry stays declarative.
- A not-yet-built add-on = set its `activationType:'coming_soon'` (or gate with `featureFlag`) → disabled card.

---

## 5. Phased build

### Phase 0 — Scaffold the tab + registry (frame, placeholder data) · ~0.5 day
- Add `ADDON_REGISTRY` + `AddonDef`.
- Add the **"Plans & Billing"** sidebar item (gated `NEXT_PUBLIC_ADDON_HUB_ENABLED`).
- Add `{activeTab === "plans" && <ShopPlansBillingTab/>}` + a skeleton `ShopPlansBillingTab.tsx` that maps the
  registry → cards with placeholder statuses.
- ✅ Outcome: the page exists, nav works, cards render.

### Phase 1 — Status resolvers (real per-shop state) · ~0.5 day
- `frontend/src/services/api/addons.ts` — thin client that fans out to the existing endpoints (§3) in parallel.
- Implement `resolveStatus(id, shopId)` → off | pending | active per card.
- ✅ Outcome: each card shows the shop's real status (ads = active/pending, others = off/coming-soon).

### Phase 2 — YOUR PLAN + BILLING sections · ~0.5–1 day
- YOUR PLAN card from `/subscription/status` (today shows the flat $500/Standard; auto-reflects tiers when the
  P0 tiered-subscription work lands — no rework).
- AI allowance/usage bar from `aiSettings` (e.g. "$30/mo · 78% used"). Reuses readability floor
  ([[feedback-readability-text-floor]]).
- BILLING: payment method + invoices link (reuse subscription billing reads).
- ✅ Outcome: full hub view assembled from existing data.

### Phase 3 — Activation wiring · ~0.5 day
- Card CTA dispatch by `activationType`: `request`/`onboarding`/`contact` → deep-link via `manageLink`
  (push `/shop?tab=...`); `toggle` → inline action; `coming_soon` → disabled + optional "Notify me".
- AI Ads `request` deep-links into the **built** ads enrollment flow. Payments/Overage stay `coming_soon` until
  their scopes ship, then flip the registry entry.
- ✅ Outcome: every card routes correctly; built add-ons are fully usable.

### Phase 4 — Admin mirror + teaser repoint · ~0.5 day
- Admin: surface per-shop add-on enablement (reuse `AdEnrollmentRequests` + ads/billing panels; add others as
  they ship).
- Repoint the built `AdEnrollmentTeaser` to deep-link INTO the hub card instead of the Ads tab directly.
- ✅ Outcome: discovery + admin oversight consistent.

### Phase 5 (optional, later) — backend aggregator + `shop_addons` table
- `GET /shop/addons/summary` to replace the parallel calls (perf/cleanliness) if needed.
- `shop_addons (shop_id, addon_id, status, enabled_at)` only for future add-ons lacking a natural source.

---

## 6. Rollout, effort, deps

- **Flag:** `NEXT_PUBLIC_ADDON_HUB_ENABLED` (mirror the ads flag) — ship dark, enable when ready.
- **Effort:** Phases 0–3 (shippable hub with real statuses + working deep-links) ≈ **2–2.5 days**; +0.5 for
  Phase 4. Per future add-on, hub cost ≈ one registry entry.
- **Dependencies:** none hard. Reuses subscription + ai_shop_settings + ads (all built). The "Change plan"
  control is a stub/deep-link until the P0 tiered-subscription work exists; AI-Overage toggle and Payments
  onboarding stay `coming_soon` until their scopes ship.

## 7. Testing

- Registry → cards: each `AddonDef` renders one card; `coming_soon` is disabled; flagged entries hidden when
  the flag is off.
- `resolveStatus`: ads active/pending/off map correctly; missing sources → `coming_soon`/off (no crash).
- Tab routing: `?tab=plans` renders the hub; deep-link CTAs navigate to the right `?tab=`.
- Graceful degradation: with all add-on backends absent, the hub still renders (plan + usage + coming-soon
  cards) without errors.

## 8. Open decisions (carried from the design doc)

1. Nav label/placement — "Plans & Billing" new top-level (recommended) vs. under Settings/Wallet.
2. Registry source — code-config v1 (this plan) vs. DB-backed.
3. Billing section — unified invoice vs. links to separate streams (depends on one-Stripe-customer billing).
4. "Notify me" on coming-soon — collect interest vs. visual-only.

See [[project-pricing-alignment-state]]. Plan only — nothing built/committed.

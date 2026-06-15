# Design — Shop Add-On Access (Central Hub + Deep Links)

**Date:** 2026-06-15
**Status:** Design / IA decision — no code written. Standing rule: do not build/commit until sign-off.
**Decision:** access model = **central "Plans & Billing" hub that renders from an add-on REGISTRY, with
operational config deep-linked into each feature.** Chosen because the catalog will GROW ("more add-ons coming
soon") — a thin catalog scales by adding one card; a fully-centralized page degrades with every add-on.
**Grounded in:** `frontend/src/components/ui/sidebar/ShopSidebar.tsx` (real nav), the built ads enrollment flow
(`AdEnrollmentCTA`/`AdEnrollmentTeaser`), `ai_shop_settings`, `shops` (Stripe fields).

---

## 1. The problem today

Add-ons have no shared home. From `ShopSidebar.tsx`: Ads is buried under SHOP MANAGEMENT → Marketing; Payments
would sit near top-level **Wallet & Payouts**; AI overage belongs in **Settings**; the $500 subscription is on
its own page. A shop has **no single "what am I paying for / what can I add"** view → poor discoverability
(no upsell surface) and unclear billing (charges scattered).

## 2. The model — hub as a CATALOG, features as the workshop

- **One "Plans & Billing" page** owns the *commercial* surface: current plan, the add-on catalog (enable /
  price / status), payment method, invoices. It is the single front door.
- **Each feature keeps its operational config** (campaigns in the Ads tab, payouts in Wallet & Payouts, AI cap
  in Settings). The hub **deep-links** to them.
- The hub renders from a **registry**, so a new add-on = one new catalog entry, never a hub rebuild. This is
  the app-store pattern (list everything centrally; each app owns its settings).

```
Plans & Billing
──────────────────────────────────────────────
YOUR PLAN
  ● Growth AI — $299/mo                 [Change plan]
    AI usage included: $30/mo · 78% used this month
──────────────────────────────────────────────
ADD-ONS
  AI Ads Management   $199–$999/mo  ● Active     [Manage in Ads →]
  Payments Processing 0.75%/txn     ○ Not set    [Connect Stripe]
  AI Usage Overage    Usage ×3      ○ Off        [Enable]
  Agency Program      $999/mo       ○ Off        [Contact us]
  ── coming soon ──
  (next add-on)       —             ◌ Soon       [Notify me]
──────────────────────────────────────────────
BILLING
  Payment method: •••• 4242              [Update]
  This month: $299 plan + $499 ads + $14 overage = $812
  [View invoices]
```

## 3. The add-on registry (what makes it extensible)

The hub maps over a registry; each entry declares everything the card needs:
```ts
interface AddonDef {
  id: string;                  // 'ai_ads' | 'payments' | 'ai_overage' | 'agency' | ...
  displayName: string;
  priceLabel: string;          // '$199–$999/mo', '0.75%/txn', 'Usage ×3'
  category: 'marketing' | 'payments' | 'ai' | 'agency';
  activationType: 'toggle' | 'request' | 'onboarding' | 'contact' | 'coming_soon';
  statusResolver: (shopId) => 'off' | 'pending' | 'active';  // per-shop state
  manageLink?: string;         // deep-link into the feature (e.g. '?tab=ads')
  featureFlag?: string;        // gate visibility during rollout
}
```
- **Adding an add-on** = append one `AddonDef` + build its activation/config in its own feature area. The hub
  code never changes.
- **"Coming soon"** = an entry with `activationType: 'coming_soon'` → renders a disabled card + optional
  "Notify me." (No clean home for this in a fully-centralized page — another reason for the catalog model.)
- The registry can be **code-config** (simplest, versioned) for v1; promote to a DB-backed catalog later if
  add-ons need to appear without a deploy.

## 4. Per-add-on activation paths (the card's button adapts)

| Add-on | `activationType` | Flow | Status lifecycle | Deep-link |
|---|---|---|---|---|
| Subscription tier | (plan, not add-on) | Change plan → Stripe proration | active | — |
| AI Ads Management | `request` | Request → **admin approves** (v1 admin builds campaigns) | off → pending → active | Ads tab |
| Payments Processing | `onboarding` | Enable → **Stripe Connect** onboarding (external) | off → onboarding → active | Wallet & Payouts |
| AI Usage Overage | `toggle` | **Instant** toggle + optional cap | off / on | Settings → AI |
| Agency Program | `contact` | Apply / sales-assisted | off → active | (agency dashboard) |

Each activation path already has (or will have) its own scope doc; the hub just triggers the entry point and
reflects the resolved status.

## 5. Navigation placement

- **New top-level item: "Plans & Billing"** in `ShopSidebar.tsx` (near the existing **Wallet & Payouts** /
  **Settings** money-and-account items — its natural neighborhood). Single click from anywhere.
- **Keep the feature surfaces** (Ads tab under Marketing, Wallet & Payouts, Settings) for operational work —
  the hub points INTO them, doesn't replace them.
- **Keep contextual teasers** (the built `AdEnrollmentTeaser` on the dashboard) — repoint them to deep-link
  INTO the hub's relevant card, so discovery still happens where the shop is working.

## 6. Data model

- **Per-shop add-on state** reuses each add-on's existing source of truth where one exists:
  - AI Ads → `ad_billing_plans` / `ad_enrollment_requests` (built).
  - Payments → `shops.payments_processing_enabled` + `connect_charges_enabled` (payments scope).
  - AI Overage → `ai_shop_settings.overage_enabled` (overage scope).
- For add-ons without a natural home, a thin `shop_addons (shop_id, addon_id, status, enabled_at)` table. The
  `statusResolver` in the registry reads whichever source applies — the hub doesn't care where it lives.

## 7. Admin side

- Admin gets the mirror view: per-shop **which add-ons are enabled** + the ones needing action (e.g. pending
  ads-enrollment requests — already built in `AdEnrollmentRequests`). Admin can enable/override per shop and
  set fee rates / plan amounts. Reuses the existing admin ads/billing panels; the hub is the shop-facing twin.

## 8. How the scoped add-ons plug in

| Add-on | Hub entry | Build owned by its own scope doc |
|---|---|---|
| AI Ads Management | `request` card, deep-link Ads | `ads-flat-tier-*` + ads-system (built) |
| Payments Processing | `onboarding` card | `payments-processing-connect-scope.md` |
| AI Usage Overage | `toggle` card | `ai-usage-overage-scope.md` |
| Agency Program | `contact` card | (not yet scoped) |
| Subscription tiers | YOUR PLAN section | gap-analysis P0 (tiered subscription) |

The hub is the **integration point** — each scope builds its own activation + config; the hub surfaces them
uniformly.

## 9. Effort

- **Hub itself:** ~1.5–2 days — the registry, the catalog page (cards + status resolvers + deep-links), the
  YOUR PLAN + BILLING sections (billing reads reuse existing subscription + ads-billing data), one nav item.
- **Net-new per add-on:** ~0 hub cost — each add-on already carries its activation/config in its own scope;
  joining the hub is one registry entry + a status resolver.

## 10. Open decisions

1. **Nav label/placement** — "Plans & Billing" as a new top-level item (recommended) vs. folded into Settings
   or Wallet & Payouts.
2. **Registry source** — code-config for v1 (recommended) vs. DB-backed catalog now.
3. **Billing consolidation** — does the hub's BILLING section show a true unified invoice (subscription +
   add-ons + overage + ads fees in one), or link out to separate invoices per stream? (Unified is nicer;
   depends on whether all streams bill through one Stripe customer/invoice.)
4. **"Notify me" on coming-soon** — collect interest (store + notify) or purely visual placeholder for v1.

See [[project-pricing-alignment-state]]. Analysis/design only — nothing built.

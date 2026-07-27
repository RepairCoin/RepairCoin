# Ads — Subscription Panel Redesign (tier inclusions + naming disambiguation)

> **Status (2026-07-27): all 3 phases BUILT + verified, UNCOMMITTED.** Mockup approved. Both builds
> green, typecheck clean on all touched files, and the tier-catalog endpoint verified against staging
> (returns `TIER_LIMITS` exactly). `priority support` was dropped from the Ads Pro card — it had no
> backing entitlement in `TIER_LIMITS`, so no fake checkmark. Panel kept on FixFlow's custom dark card
> system rather than shadcn, to stay consistent with the hand-themed ads dashboard.
>
> Touched: `ads.ts` (`ADS_TIER_LABELS` + `adsTierLabel`, relabelled `FLAT_TIERS`, `AdTierOption` +
> `tiers` on `AdSubscription`), `SubscriptionController.ts` (tier catalog in the response),
> `SubscriptionPanel.tsx` (rebuilt as comparison cards), `ShopAdsTab.tsx` (header label + passes
> `capacity`). No migration, no billing-logic change — display + one read field only.

The shop-dashboard "Your ads plan" panel (`/shop?tab=ads`) presents the three ads-management tiers as
bare price buttons. Two problems, both confirmed in code:

1. **The shop cannot see what each ads tier includes.** The panel renders only the price label
   (`Starter — $199/mo`), so a shop deciding whether to upgrade has no idea that Growth adds
   Instagram + AI lead answering, or that Business adds Google + 10 campaigns. The capability data
   *exists* — it's just never rendered.
2. **The ads tier names collide with the general subscription plan.** Both systems use
   `Starter / Growth / Business`, so the shop sees "Business Plan" (general subscription, top-right)
   and "Business — $999/mo" (ads) at the same time — two different products, same word, different
   prices.

---

## Root cause (grounded in code)

**Problem 1 — the inclusions are computed but discarded.**
- `BillingPlanRepository.TIER_LIMITS` (backend) is the authoritative capability matrix:

  ```
  starter:  maxCampaigns 1,  channels [facebook],                     aiAutoAnswer false
  growth:   maxCampaigns 3,  channels [facebook, instagram],          aiAutoAnswer true
  business: maxCampaigns 10, channels [facebook, instagram, google],  aiAutoAnswer true
  ```
- `FLAT_TIERS` (`frontend/src/services/api/ads.ts:215`) even carries a `blurb` summarizing each tier
  ("Facebook · 1 campaign · you reply to leads"), but `SubscriptionPanel.tsx` maps over `FLAT_TIERS`
  and renders only `{t.label}` — the blurb and the real limits never reach the screen.
- Live usage is already available too: `GET /ads/shop/capacity` → `{ tier, maxCampaigns, usedCampaigns,
  remaining }`, and channel eligibility via the channel-access shape (`google.reason: 'tier_locked'`).

**Problem 2 — two billing systems share one vocabulary.**
- General plan (`backend/src/config/subscriptionPlans.ts`): slugs `starter/growth/business`, labels
  "Starter AI / Growth AI / Business AI" ($80/$299/$599).
- Ads plan (`FLAT_TIERS`): slugs `starter/growth/business`, labels "Starter/Growth/Business"
  ($199/$499/$999).
- The stored `ad_billing_plans.flat_tier_name` is the ads slug and is used for billing history and
  reporting — so the collision must be fixed at the **display** layer, not by renaming slugs (a slug
  rename would be a billing-data migration for zero functional gain).

---

## Decisions (locked)

- **D1 — Rename the ads tiers to a distinct vocabulary: `Ads Lite / Ads Plus / Ads Pro`.**
  Display-label only; the stored slugs stay `starter / growth / business`. This permanently kills the
  collision (no shared word survives) and the new names never appear on the general plan.

  | Slug (unchanged) | Old label | **New label** | Fee |
  |---|---|---|---|
  | `starter`  | Starter  | **Ads Lite** | $199/mo |
  | `growth`   | Growth   | **Ads Plus** | $499/mo |
  | `business` | Business | **Ads Pro**  | $999/mo |

- **D2 — Full comparison-card layout.** Replace the price-button row with three side-by-side cards, one
  per tier, each listing its inclusions, the current tier marked, and the upgrade delta emphasized.

- **D3 — No data migration, no billing-logic change.** This is presentation + one read endpoint. The
  slugs, fees, proration, history, and cancel flow are untouched.

- **D4 — Capabilities come from the backend, not a frontend constant.** Expose `TIER_LIMITS` through the
  API so the cards render from the source of truth and can't drift from what billing actually enforces.
  `FLAT_TIERS.blurb` becomes seed copy only, or is removed.

---

## Inclusion matrix (what each card renders)

| | **Ads Lite** $199 | **Ads Plus** $499 | **Ads Pro** $999 |
|---|---|---|---|
| Campaigns | 1 | 3 | 10 |
| Channels | Facebook | + Instagram | + Google |
| AI answers leads | — | ✓ | ✓ |
| Priority support | — | — | ✓ |

Delta emphasis (upgrade motivation), derived by diffing each tier against the current one:
- On **Ads Plus** while on Lite → highlight "+ Instagram, + AI lead answering, 3 campaigns".
- On **Ads Pro** while on Plus → highlight "+ Google, 10 campaigns, priority".

---

## Design — comparison-card layout

Three cards in a responsive row (stack on mobile). Each card:

- **Header**: tier name (`Ads Lite/Plus/Pro`) + price. The shop's current tier gets a "Current" badge
  and a highlighted border; the others get an action button.
- **Inclusion checklist**: the four rows from the matrix, rendered from the API limits. Present
  capabilities as ✓ rows and absent ones as muted "—" rows so the card is a self-contained "what you
  get." Channels shown as their real names (Facebook / Instagram / Google), not slugs.
- **Usage on the current card**: "1 of 1 campaigns used" from `GET /ads/shop/capacity`, so the
  capacity ceiling is concrete and an at-capacity shop sees *why* it should upgrade.
- **Action**: upgrade/downgrade button carrying the existing `changeMyTier(slug)` call and the current
  proration/scheduling copy ("Upgrades apply now (prorated); downgrades take effect next cycle").
- **Delta hint** on upgrade targets: a one-line "Adds …" summarizing what the current tier lacks.

Keep the existing surrounding elements — the change-history log, "Cancel ads", and the
"Subscription Required" banner — unchanged, but see the disambiguation rules for the history log copy.

**UI constraints (house rules):**
- Build with shadcn `Card` / `Badge` / `Button` primitives — check the existing components before
  rolling custom.
- Readability floor: nothing below 12px; tier name and price ≥16px, inclusion rows ≥14px. The panel is
  used by shop owners of all ages.
- No mockup exists for this panel; if one is later provided, match it (dim/disable rather than hide any
  element it shows).

---

## Disambiguation rules (apply everywhere the ads tier is named)

The rename only helps if it's consistent. Audit every ads-tier reference and switch to the new label:

- The current-tier chip and the header summary ("Business plan · 9 of 10 campaigns" → "Ads Pro · 9 of
  10 campaigns").
- The change-history log renders raw slugs today ("downgrade → growth"); map through the label so it
  reads "downgrade → Ads Plus".
- Toasts from `changeMyTier` ("Upgraded to business …" → "Upgraded to Ads Pro …").
- Anywhere the general plan and ads plan can appear together, the ads one always reads "Ads <Tier>" so
  the two are never ambiguous.

A single label helper (slug → "Ads Lite/Plus/Pro") should back all of these so nothing drifts.

---

## Code touchpoints

- `frontend/src/components/ads/SubscriptionPanel.tsx` — the redesign (buttons → cards); currently
  renders `FLAT_TIERS.map(... {t.label} ...)`.
- `frontend/src/services/api/ads.ts` — `FLAT_TIERS` (relabel / demote to seed), `AdSubscription`,
  `getMySubscription`, `getMyCapacity`, `changeMyTier`; add the tier-limits type + fetch.
- **Backend**: expose `TIER_LIMITS` (`BillingPlanRepository.ts`) — extend `GET /ads/shop/subscription`
  with a `tiers` array, or add `GET /ads/shop/tiers`. Keep `FlatTierName` slugs.
- New shared label helper (slug → display name) used by the panel, history log, header chip, toasts.
- General-plan collision reference: `backend/src/config/subscriptionPlans.ts` (no change; documented so
  the two label sets are known not to overlap after D1).

---

## Phased plan

- **Phase 1 — Naming + disambiguation (fast, high-value).** Add the label helper, relabel `FLAT_TIERS`
  to Ads Lite/Plus/Pro, and route every ads-tier reference (panel, history log, header chip, toasts)
  through it. Kills the collision on its own, no layout work. ~0.5 day.
- **Phase 2 — Expose tier limits.** Backend endpoint/field returning `TIER_LIMITS`; frontend type +
  fetch. ~0.5 day.
- **Phase 3 — Comparison-card layout.** Rebuild the panel as inclusion cards (matrix + delta + current
  usage) on the Phase 2 data, shadcn primitives. ~1–1.5 days.

Phase 1 can ship independently and immediately resolves Problem 2; Phases 2–3 resolve Problem 1.

## Out of scope / not changed

- Billing logic, proration, cancel flow, the stored `flat_tier_name` slugs, and the general
  subscription plan — untouched.
- The ads-tier *capabilities themselves* (campaign caps, channels, AI gating) — this is surfacing what
  already exists, not repricing or re-gating. Any change to the inclusions is a separate pricing
  decision.

## Open questions

- **"Priority support" (Ads Pro row)** — is there an actual entitlement behind it, or is it marketing
  copy? `TIER_LIMITS` has no support field. Confirm before listing it as a checked inclusion, or drop
  it from the matrix.
- Should downgrade be a button on the lower cards, or kept in a secondary menu to avoid accidental
  downgrades? (Current UI exposes both directions inline.)

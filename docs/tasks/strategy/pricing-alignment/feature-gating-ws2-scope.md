# Scope — WS2: Feature Gating & Entitlements

**Workstream:** WS2 of the pricing rollout — see `pricing-rollout-task-breakdown.md`. Follows WS3 (AI
allowances, built 2026-07-13). Covers T2.1–T2.5.
**Goal:** every pricing-sheet inclusion is available to a shop **iff its plan tier includes it**, enforced
authoritatively on the backend and reflected (locked/upsell) in the UI. Stop features being toggled on
manually per-shop by an admin.
**Status:** scoped, not started. No schema change required (reuses `getShopTier`).

---

## Entitlement model (confirmed)

**Tiers are CUMULATIVE (min-tier-required).** A feature tagged `growth` is available to **Growth AND
Business**; a feature tagged `business` is Business-only; anything not in the matrix is available to all
(Starter+). This is already how `tierAllowsFeature(tier, feature)` works (rank starter=0 < growth=1 <
business=2; feature passes when `shopRank ≥ requiredRank`). No change to the mechanism — WS2 just
**populates the matrix** and **enforces it**.

**Two concepts the current admin toggles conflate — WS2 separates them:**
1. **Entitlement (from the tier):** does the plan *include* this feature at all? Comes from `getShopTier`
   + the matrix. Not admin-set.
2. **On/off preference (within an entitled tier):** a legitimate switch, only meaningful where the tier
   allows the feature. Below the required tier the feature is off, full stop — the toggle is disabled.

---

## Current state (grounded in code)

- `config/featureTiers.ts` (BE + FE mirror): matrix + `tierAllowsFeature` + `getRequiredTier` — **works,
  but only 5 features gated**: `inventoryManagement`, `campaignBuilder`, `advancedReports` → growth;
  `teamManagement`, `multiLocation` → business.
- `utils/shopTier.getShopTier` — resolves tier (trial→business, sub_type→tier, fail-closed starter). ✅
- **Frontend:** `<TierGate feature="…">` component EXISTS and wraps a few tabs (Inventory, Marketing,
  Team, Advanced Reports); `useFeatureAccess().can(feature)`; `GET /api/shops/feature-access` returns the
  tier + per-feature flags. Multi-location has its own paid-entitlement gate.
- **Gaps:**
  - **No backend enforcement** — gating is UI-only today. `TierGate` hides tabs, but the feature ROUTES
    don't check the tier, so a Growth feature is reachable via direct API call on a Starter plan.
  - **Admin AI toggles are ungated** — `AdminAISettingsTab` lets an admin flip `AI Sales Agent`,
    `Follow-up Nudges`, `AI Images`, `Campaign Rewards` per shop regardless of tier (the screenshot).
  - **Matrix is 5 of ~20** inclusions.

---

## Feature → tier mapping (from the pricing sheet)

Cumulative: each row = the MINIMUM tier. `[all]` = ungated (Starter+).

**Starter+ (ungated):** Online Booking & Scheduling, CRM & Customer Mgmt, Review Management, AI Assistant
(Basic), Branding Studio (Basic), Email & SMS Marketing (Basic), Mobile App, Basic Reports.

**Growth (min tier = growth):**
- `inventoryManagement` ✅ (already), `campaignBuilder` ✅, `advancedReports` ✅
- `aiMarketingSuite`, `aiImageGen` (→ **AI Images** toggle), `aiLeadFollowUp` (→ **Follow-up Nudges**
  toggle), `aiInsights` (AI Business Intelligence), `voiceAiAssistant`

**Business (min tier = business):**
- `multiLocation` ✅ (already), `teamManagement` ✅
- `aiMemory` (Advanced AI Memory & Automation), `aiAutoReplies` (Voice + Text), `aiCampaignsAdvanced`,
  `advancedInventory`
- Dedicated Account Manager / Priority Phone & Chat = **operational** (a `priority_support` flag by tier),
  not a code gate.

**Admin AI toggles → feature keys (the screenshot):**
- **Follow-up Nudges** (`ai_followup_enabled`) → `aiLeadFollowUp` = **growth**
- **AI Images** (`ai_images_enabled`) → `aiImageGen` = **growth**
- **Campaign Rewards** (`campaign_rewards_enabled`) → `campaignRewards` = **growth** — DECIDED 2026-07-14.
- **AI Sales Agent** (`ai_global_enabled`) = the MASTER AI on/off → **Starter+ (ungated)** — DECIDED
  2026-07-14. Every tier can turn AI on (Starter has "AI Assistant (Basic)"); the *advanced* AI features
  (images, follow-up, voice, auto-replies, memory…) are gated individually by tier.

---

## Tasks

### T2.1 — Populate the feature→tier matrix (BE + FE mirror)
- Add all Growth/Business rows above to `config/featureTiers.ts` (both copies).
- **Decisions LOCKED (2026-07-14):** AI Sales Agent = **Starter+ (ungated)**; Campaign Rewards = **Growth**.
  AI Assistant "Basic vs full" split (Starter gets a limited assistant) = WS8, deferred.

### T2.2 — Backend enforcement (the real guard)
- Build a `featureGuard(feature)` middleware: `getShopTier(shopId)` → `tierAllowsFeature` → 403 +
  `{ required_tier, current_tier }` upsell payload when denied. Apply to the gated feature ROUTES
  (inventory, campaigns, advanced reports, AI images, follow-up, voice, team, multi-location, AI memory…).
- **Entitlement in the AI features themselves:** where a boolean toggle currently gates behavior
  (ai_images_enabled, ai_followup_enabled, campaign_rewards_enabled), the effective enable =
  `tierAllowsFeature(tier, feature) && <the stored preference>`. A stale "on" cannot let a below-tier shop
  use the feature. (Trial = business, so trials get everything — matches getShopTier.)

### T2.3 — Frontend gating + the admin-toggle fix
- **Admin AI toggles (the screenshot):** make each tier-aware — **disabled + "Growth+"/"Business" note**
  when the shop's tier doesn't include the feature (same read-only treatment the Budget column just got);
  editable only where the tier allows. The stored preference persists but is inert below tier.
- Wrap the remaining shop tabs with `<TierGate>`; add **lock badges** in the shop sidebar nav; add
  upgrade-prompt empty-states on locked feature pages.

### T2.4 / T2.5 — Apply the gates
- T2.4: Growth+ routes/features. T2.5: Business routes/features (AI Memory: currently only flag-gated —
  add the entitlement check on top).

### Out of scope (WS2)
- **T2.6** RCG-holder mapping (≥10K RCG bypass) — does a bypass shop get "everything" or map to a tier?
  PM decision; non-blocking (can inherit getShopTier).
- **WS8** Starter "Basic vs full" intra-feature splits (e.g., AI Assistant = Haiku-only on Starter).
- **WS1** `plan_tier` persistence + Starter $80→$99 fix.

---

## Decisions (LOCKED 2026-07-14)
1. **AI Sales Agent (`ai_global_enabled`) = Starter+ (ungated).** Every tier can turn AI on; advanced AI
   features are gated individually.
2. **Campaign Rewards = Growth.**
3. **RCG-holder entitlement** (T2.6) — still open; defer (non-blocking, can inherit getShopTier).

## Testing
- Unit: expanded matrix; `tierAllowsFeature` cumulative (growth feature allowed on business; business
  feature denied on growth/starter); `featureGuard` returns 403 + upsell below tier, next() at/above tier;
  AI-feature effective-enable = tier AND preference.
- The admin toggle renders disabled below the required tier; editable at/above.

## Rollout
- No migration. Flag-safe. Trial shops (=business) keep full access. Verify against the staging tier
  distribution (40 starter / 19 business / 0 growth) — seed a growth shop for QA.

---

## Built 2026-07-14 — WS2 Slice 1 (matrix + AI-toggle entitlement + admin UI)

- **T2.1 — matrix expanded** (BE `config/featureTiers.ts` + FE mirror): aiImageGen/aiLeadFollowUp/
  campaignRewards/voiceAiAssistant/aiMarketingSuite/aiInsights = growth; aiMemory/aiAutoReplies/
  aiCampaignsAdvanced/advancedInventory = business. AI Sales Agent (ai_global_enabled) intentionally
  ungated (Starter+).
- **T2.2 — real entitlement enforcement** at the 3 actual gate points (a stale per-shop "enabled" flag
  can't bypass tier): `shopHasFeature(shopId, feature)` helper in `utils/shopTier.ts`, applied in
  `ImageGenerationService.checkGates` (aiImageGen), `AISalesFollowUpHandler` (aiLeadFollowUp),
  `CampaignRewardService.isEnabled` (campaignRewards). Plus **admin write-side reject** —
  `adminUpdateShopAiSettings` returns 403 when enabling a below-tier toggle.
- **T2.3 (admin tab)** — the AdminAISettingsTab toggles are now tier-aware: `<FeatureSwitch>` disables +
  shows "Growth+" when the shop's plan doesn't include the feature; the admin response now carries `tier`.
- Tests: `config/featureTiers.test.ts` (matrix + cumulative), SettingsController WS2 reject/allow +
  `tier` field; AISalesFollowUp + CampaignReward tests mock `shopHasFeature`. 107/107, tsc clean.

## Remaining — WS2 Slice 2 (tab-level route gating)
- **T2.2 continued:** a generic `featureGuard(feature)` middleware on the gated *tab* ROUTES
  (inventory, campaigns, advanced reports, voice, team, multi-location…) — today those routes are only
  UI-gated by `<TierGate>`, reachable via direct API.
- **T2.3 continued:** wrap remaining shop tabs with `<TierGate>`; sidebar lock badges; shop-side upgrade
  prompts on locked pages.

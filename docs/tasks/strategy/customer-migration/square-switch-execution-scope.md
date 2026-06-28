# Scope — Square→FixFlow Switch: shop-side win-back execution surface

**Status:** Proposed (not built)
**Owner area:** Shop AI Marketing panel + audience builder
**Depends on:** Audience-builder home_shop_id fix (DONE), customer import (DONE), claim flow (DONE)
**Companion piece:** "Welcome RCN on claim" hook (separate, not built)

---

## 1. What this is (and what it is NOT)

This is the **execution surface** that lets a shop actually run the migration campaign
described in `square-to-fixflow-switch-playbook.md`.

- The **playbook** = strategy: cadence (T+0 announce → T+3-5 reminder → T+10-14 last call),
  messaging, welcome-RCN incentive, success metrics. It's "what to say and when."
- This **scope** = the product feature: a dedicated **`imported_winback` audience** in the
  shop's AI campaign panel so the shop can target *only* its migrated (Square/other-POS)
  customers, instead of mixing them into `all_customers` / `lapsed`.

They are complementary. The playbook is the plan; this is the button that sends it.

## 2. Problem being solved

After the audience fix, imported customers are *reachable*, but only generically — there is
**no way to target just the migrated cohort**. A shop that switches from Square wants to send
"we've upgraded, claim your account" to exactly the people it imported, not to its existing
FixFlow base. Today that segment doesn't exist in the panel.

## 3. Already in place (do not rebuild)

- Imported customers land with `import_source`, `home_shop_id`, placeholder wallet
  (`0xMANUAL…`), and imported recency/spend columns (`last_visit_at`, `lifetime_spend_usd`,
  `visit_count`). Migration `183`.
- Audience builder (`CustomerRepository.findByShopInteraction` / `findLapsedBookers` /
  `…Paginated`) now qualifies on `home_shop_id`, so imported customers are reachable by
  existing audiences. Verified on peanut (3 imported-only newly reachable).
- Claim flow merges imported history into a real account (fixed + tested).

## 4. The build

### 4.1 Identify the cohort + funnel stage (backend)
New repo method `CustomerRepository.findImportedCustomers(shopId, stage?)` returning the same
row shape as `findByShopInteraction`. Base filter:
`import_source IS NOT NULL AND LOWER(home_shop_id) = LOWER($shopId) AND is_active AND suspended_at IS NULL`.

Funnel `stage` (optional sub-filter) — mirrors the playbook cadence as living segments:
- `not_claimed` — placeholder wallet (`wallet_address ILIKE '0xmanual%'`). → "claim your account"
- `claimed_not_booked` — real wallet, no `service_orders` row at this shop. → "first booking" nudge
- `active` — has bookings at this shop. → **excluded from win-back** (already converted)

Default (no stage) = `not_claimed` + `claimed_not_booked` (everyone not yet converted).

### 4.2 New audience type (backend)
- Add `imported_winback` to `MarketingCampaign['audienceType']` and to the
  `ResolvedAudienceType` unions in `lookupAudienceCount.ts` and `proposeCampaignDraft.ts`.
- Add `case 'imported_winback':` in `MarketingService.resolveTargetAudience`
  (`MarketingService.ts:527`) → calls `findImportedCustomers(shopId, filters?.stage)`.
  (Note: this case must source its own list, not filter the default `shopCustomers`, so a
  `stage` like `not_claimed` is resolved at the SQL level.)

### 4.3 AI drafter context
- Teach `lookupAudienceCount` to resolve NL like "win back my Square customers" / "migrated
  customers" → `{ audienceType: 'imported_winback' }`.
- In `proposeCampaignDraft`, when audience is `imported_winback`, inject context into the
  drafting prompt: *"These are customers migrated from a prior POS (e.g. Square). Write
  migration copy — 'we've upgraded our booking & rewards, claim your account, history
  preserved' — not generic win-back. Mention the welcome RCN if the reward hook is enabled."*

### 4.4 Reachable-count honesty (backend + FE)
The Square file is phone-dominant (~12.5k phone vs ~3.8k email). Email campaigns reach only
email + marketing-consent customers; marketing SMS is TCPA-gated and OUT OF SCOPE.
- The audience count returned to the panel must show **reachable-by-email** (has email AND
  `marketing_email_consent`/not unsubscribed), not the raw cohort size.
- FE displays "X of Y imported reachable by email" so the shop isn't surprised by a small send.

### 4.5 Frontend (shop AI campaign panel)
- `CampaignBuilderModal.tsx` — add "Imported / win-back (migrated customers)" as an audience
  option, with the optional funnel-stage selector (Not claimed / Claimed, not booked / All
  not-yet-converted). Use shadcn select/segmented control.
- `MarketingAIPanel.tsx` / `MarketingToolCallCard.tsx` — render the new audience type + the
  reachable-by-email line when the AI proposes it.

## 5. Acceptance criteria

- A shop can select "Imported / win-back" in the campaign panel and send to only its
  migrated cohort; existing FixFlow customers are not included.
- Funnel-stage filter works: `not_claimed` returns only placeholder-wallet imports; once a
  customer claims + books, they drop out of the win-back audience automatically.
- The AI panel resolves "win back my Square customers" to this audience and drafts
  migration-appropriate copy.
- The panel shows reachable-by-email count, not raw cohort size.
- Backend tsc 0; live dry-run on peanut shows the segment + counts.

## 6. Out of scope (explicitly)

- Marketing **SMS** to phone-only imports (TCPA — needs explicit opt-in; transactional only).
- The **welcome-RCN-on-claim** reward hook (separate scope — this campaign drives the claim;
  the reward rewards it).
- Automated multi-touch cadence/scheduling (T+0/T+3/T+10 auto-sequence) — v1 is shop-triggered
  manual sends per stage; auto-cadence is a follow-up.

## 7. Phasing / estimate

- **Phase 1 — backend cohort + audience type** (`findImportedCustomers`, `imported_winback`
  case, reachable-by-email count). ~half day. Unit/dry-run on peanut.
- **Phase 2 — AI resolution + drafter context** (lookup + proposeCampaignDraft). ~half day.
- **Phase 3 — frontend audience option + funnel selector + reachable line.** ~half day.

Recommend building Phase 1 first (it's the leverage point — without the segment the shop
can't act), then 2 and 3.

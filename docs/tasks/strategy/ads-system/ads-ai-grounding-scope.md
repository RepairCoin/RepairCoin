# Ads — Lead AI grounding: ad creative + service catalog

Make the lead-conversation AI answer **definitively about what the shop actually sells and what the ad promised**,
instead of deferring ("let me get our team to confirm") for anything beyond generic brand chit-chat.

## Why (the gap, observed live)
`LeadAutoAnswerService.generateReply` currently grounds the model on only four things:
`systemPromptFor(shopName, industry, voice, campaign.name)` + the conversation thread + AI-memory recall. It has
**no list of the shop's services** and **no copy from the ad the lead clicked**. So on peanut's live Messenger test:

- *"Do you offer baking training?"* → *"Let me get our team to confirm whether we offer baking training…"*

The AI can't say yes/no because it doesn't know the catalog, and it can't reference the specific offer/promo in the ad.
This enhancement injects both, so the reply is decisive and on-message (and still honest — "we don't offer that" when
the service genuinely isn't in the catalog, rather than inventing it).

**Applies to every channel** (Messenger, email) and **both entry points** (auto-answer + the admin "AI answer" button),
because they all funnel through the one `generateReply`. Single change, full coverage.

## What already exists (reuse — don't rebuild)
- **Service catalog** — `ServiceRepository.getServicesByShop(shopId, { activeOnly: true })` → `ShopService[]`
  (`serviceName`, `description`, `priceUsd`, `durationMinutes`, `category`, `active`). (Via `ServiceManagementService.getShopServices`,
  or inject `ServiceRepository` directly to avoid domain coupling — see Decision 1.)
- **Ad creative** — `CreativeRepository`. `AdCreative` has `headline` + `body` (the ad copy) + `landingUrlType`.
  Resolve per-lead: `lead.creativeId` → `findById`; else the campaign's approved creative via `listByCampaign(campaignId)`.
- **Cached system blocks** — `generateReply` already passes `systemBlocks: { text, cache }[]` to `anthropic.complete`.
  The base prompt is `cache:true`; AI-memory is `cache:false`. Catalog + creative are stable per shop/campaign → `cache:true`
  (they ride the prompt cache, so the extra tokens are near-free after the first call).
- **Spend cap + cost ledger** — unchanged; the added input tokens flow through the existing `SpendCapEnforcer` + `AiCostRepository`.

## The change (one method: `LeadAutoAnswerService.generateReply`)
Add two system blocks between the base prompt and the AI-memory block:

1. **Service-catalog block** (`cache:true`)
   - Fetch active services for `shopId` (cap **~30**, sorted by category then name).
   - Render compact lines: `- {serviceName} ({category})${price ? `, $${priceUsd}` : ''}${duration ? `, ${durationMinutes}min` : ''} — {description truncated ~120 chars}`.
   - Prompt rule: *"These are the ONLY services this shop offers. If the customer asks about something on this list,
     answer directly (name it, quote the price if given). If they ask about something NOT on the list, say the shop
     doesn't offer it — do NOT invent services, prices, or guarantees."*
   - If the shop has no active services → skip the block (falls back to today's behavior).

2. **Ad-creative block** (`cache:true`)
   - Resolve the creative (lead's creative, else campaign's approved creative).
   - Inject: *"The customer clicked an ad that said — Headline: '{headline}'. Body: '{body}'. Stay consistent with that
     offer; if it named a promo/discount, honor it."*
   - If no creative resolvable → skip.

Everything else in `generateReply` is untouched (thread mapping, empty-reply guard, deliver, cost record).

## Guardrails
- **Availability stays deferred.** The catalog answers *what/how much*, NOT *when*. Scheduling remains "the team will
  confirm the time" — real slot lookup is the separate appointment integration (out of scope here). Keep that rule in the prompt.
- **Token budget.** Cap catalog at ~30 services + truncate descriptions so the block stays bounded; `maxTokens` stays 400.
  Both new blocks are `cache:true` so repeat turns in a thread don't re-pay for them.
- **No new external calls** — pure DB reads on the same pool.

## Decisions
1. **Catalog source** — inject `ServiceRepository` directly into `LeadAutoAnswerService` (read-only) rather than importing
   `ServiceManagementService` (avoids AdsDomain→ServiceDomain coupling; consistent with how other repos are used). *(Recommended.)*
2. **Which creative when `lead.creativeId` is null** (the CTM-webhook case — our test lead had `creative_id: null`) —
   use the campaign's **approved** creative (latest by version). If multiple, latest approved. *(Recommended.)*
3. **Flag** — gate behind `ADS_AI_CATALOG_GROUNDING` (default **on**; it only enriches the prompt, but a flag gives a
   one-switch rollback if a shop's catalog data is messy). *(Recommended — cheap insurance.)*

## Testing
- **Unit** — monkeypatch `anthropic.complete` to capture `systemPrompt`; assert the blocks contain a seeded service name +
  price and the creative headline; assert a shop with zero active services omits the catalog block (no crash). Fake
  `ServiceRepository`/`CreativeRepository`; no live AI. (Same pattern as `AdsMessengerObjective` / `LeadMessengerRouting`.)
- **Live (peanut)** — add a real service (e.g. "Baking Training") → message the Page → AI answers definitively (names it +
  price); ask for something off-catalog → AI says the shop doesn't offer it. Verify the outbound row is still
  `channel: messenger / sent`.

## Effort
~0.5 day: the two blocks + resolver + flag + unit test. No migration, no new deps, no API surface change.

## Out of scope (future)
- Real appointment/slot answers ("do you have Sunday?") — needs the appointment system wired into the AI (bigger).
- Group-token / bonus-reward awareness in replies.
- Per-service FAQ retrieval (there's an existing service-FAQ corpus; could be a richer grounding source later).

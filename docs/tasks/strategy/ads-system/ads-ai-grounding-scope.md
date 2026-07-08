# Ads — Lead AI grounding: catalog, creative, availability

Make the lead-conversation AI answer **definitively about what the shop sells, what the ad promised, and when the
customer can come in** — instead of deferring ("let me get our team to confirm") — so more ad clicks become bookings.

**Status:** Phase 1 (service catalog) + Phase 2 (ad creative) **SHIPPED + live-verified in production 2026-07-08**
(commit `b1204b71c`, merged in `ed07935`). **Phase 3 (availability grounding) is scoped below.**

## Goal — why this exists (the path to bookings)
The AI auto-reply is not a chatbot for its own sake. Its single purpose: **turn ad spend into confirmed, paid bookings,
automatically** — recover the leads that leak today because the owner is busy and replies come hours later (or never).
The metric that matters is **cost per booking / ROI** (ad spend + AI cost → booking revenue), not "replies sent."

**The funnel, and what plugs each leak:**
- **Click → conversation** — click-to-Messenger opens the thread instantly, no email/phone friction. ✅ (Messenger P1+P2)
- **Speed-to-lead** — instant AI reply; the biggest conversion lever (leads decay in minutes). ✅ (auto-answer + delivery fix)
- **"Do you offer this? how much?"** — the #1 drop reason → catalog + creative grounding answers decisively. ✅ (Phases 1–2)
- **"When can I come in?"** — the next friction; a concrete slot is a strong CTA → **availability grounding. 🔜 Phase 3 (this doc).**
- **Hot lead → human close** — escalation flags ready-to-book leads so the owner pounces. ✅
- **Complex / high-value** — take-over lets the human step in. ✅

**The honest gap:** the AI still stops *just short* of the goal — it answers and nudges but doesn't **create** the booking,
so interest can leak back out at the handoff. Reaching the goal takes three things, in order: **(1)** close the last mile
(Phase 3 makes a lead *book-ready* with a real slot + a one-tap link / auto-escalation; **Phase 4** = the AI books directly —
higher value, higher risk, deferred), **(2)** **turn on conversion attribution** (`ADS_CONVERSION_ATTRIBUTION`) so leads→paid
orders→ROI stop being structurally zero and we can *see* it working, **(3)** feed conversions back to Meta (pixel "Lead"
optimization, already built) so the funnel gets better leads over time. **Phase 3 plugs the "when" leak and sets up the
book-ready moment.**

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

## Phases 1–2 — the change (one method: `LeadAutoAnswerService.generateReply`) — SHIPPED
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

## Guardrails (Phases 1–2)
- **Availability stays deferred (Phases 1–2).** The catalog answers *what/how much*, NOT *when*. Scheduling remains "the team
  will confirm the time" — real slot lookup is **Phase 3 below.** Keep that rule in the prompt until Phase 3 ships.
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

## Phase 3 — availability grounding (answer "when," make the lead book-ready)

**Funnel leak it plugs:** the "*When can I come in?*" drop-off. Today the AI defers scheduling ("the team will confirm").
Answering with a **real, concrete slot** turns a warm lead into a book-ready moment — the strongest CTA in the whole thread.
**Read-only** — the AI *reports* availability; it does not book (booking = Phase 4, the risky write-path).

**What already exists (reuse):** `AppointmentService.getAvailableTimeSlots(shopId, serviceId, date)` → `TimeSlot[]` —
the same engine that powers the customer booking UI. It's **timezone-aware** (`shop_time_slot_config.timezone`), respects
operating hours / breaks / holiday overrides, and accounts for existing bookings. We just call it and ground on the result.

**Design — gated pre-fetch + LLM date/service extraction + deterministic slot lookup + inject** (chosen over native
tool-use — see Decision below). Per inbound message:
1. **Cheap intent gate** (keywords/regex: day names, "available", "schedule", "when", "book", times/dates) — most messages
   skip this path entirely, so no added cost on normal turns.
2. If it looks like a scheduling question → **one structured extraction call** (Haiku, JSON):
   `{ wantsAvailability, serviceHint, date (ISO, resolved against injected today + shop TZ), timeOfDay }`.
3. **Code calls `getAvailableTimeSlots(shopId, serviceId, date)`** — deterministic, auditable; the model never invents slots.
4. **Inject the real open slots** as a grounding block (same pattern as the catalog) → the reply states them, e.g.
   *"This Friday, July 11 we have 9:00, 10:30 and 11:15 open for Newly Baker — want me to get you set up?"*
5. **Book-ready handoff** — pair the slot with a one-tap booking link (`/l/{campaignId}` or the shop booking page) and/or
   auto-escalate the now-qualified lead (existing escalation) so the owner confirms in seconds.

**Guardrails**
- **Read-only** — reports slots, never writes a booking (that's Phase 4, behind a human/confirmation step).
- **Echo the resolved date** ("For Friday, July 11…") so a date misparse is self-correcting.
- **"Subject to confirmation" framing** — never a hard promise; a slot can be taken between quote and booking (staleness).
- **Fallbacks** — no `shop_time_slot_config`, ambiguous service, or unparseable date → fall back to today's "team will
  confirm" defer. Can never do worse than current behavior.
- **Service resolution** — `getAvailableTimeSlots` needs a `serviceId`; infer from the thread/creative, else the AI asks
  which service first.
- **Flag** — `ADS_AI_AVAILABILITY_GROUNDING`, default **off** until validated live.

**Decision — why gated pre-fetch, not native tool-use.** Determinism (a scheduling question *always* triggers a real
lookup; the model can't forget or fabricate slots), testability (fixture-test extract→fetch→inject), and it keeps
`generateReply` close to its current shape (extract call + reply call, no agentic loop / max-iteration guards). The LLM is
used only where it's strong (messy date language); the risky part (which slots exist) stays in code. **Native tool-use is
the natural Phase 4+ evolution** if scheduling dialogs get richer (multi-slot negotiation, rescheduling, "anything after 3pm").

**Testing** — unit: fake `AppointmentService` returning known slots; assert the intent gate fires, extraction shape, the
injected block lists exactly those slots, and the no-config/ambiguous paths fall back to defer. Live (peanut/Nanays): ask
"is Friday morning available?" → AI names real open slots + the resolved date; a no-config shop → defers.

**Effort** — ~1.5–2 days (intent gate + extraction + slot fetch + inject block + book-ready link + flag + tests). The
availability engine is reused for free; no migration.

## Follow-through (beyond this doc — the rest of the path to bookings)
- **Phase 4 — direct AI booking:** the AI creates the appointment (optionally a deposit), behind a confirmation step. The
  real finish line, but the risky write-path (double-booking, payment, no-shows) — separate scope, decide after Phase 3
  shows where the handoff still leaks.
- **Turn on conversion attribution** (`ADS_CONVERSION_ATTRIBUTION`) so leads→paid orders→ROI/Bookings are measurable — you
  can't optimize the funnel you can't see.
- **Per-service FAQ retrieval** (existing service-FAQ corpus) as a richer grounding source.
- **Group-token / bonus-reward awareness** in replies.

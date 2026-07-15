# Scope — AI Auto-Replies (Voice + Text) → Business gate

**Workstream:** WS2 (Feature Gating) follow-up — see `feature-gating-ws2-scope.md`. Sibling to the voice
gate (`voiceAiAssistant` = Growth, shipped 2026-07-14).
**Goal:** make the pricing.jpeg line **"AI Auto-Replies (Voice + Text)"** (a **Business** inclusion)
actually govern access, without breaking Growth's **"AI Lead Follow-Up (Email & SMS)"** line.
**Status:** scoped, NOT started. `aiAutoReplies` already exists in the matrix (`config/featureTiers.ts` =
`business`) but is **not wired to any enforcement point**.

---

## Why this isn't a one-liner

The pricing sheet has two adjacent AI lines:
- **Growth:** *AI Lead Follow-Up (Email & SMS)* — text-channel outreach.
- **Business:** *AI Auto-Replies (Voice + Text)* — adds **Voice**.

But the code doesn't split cleanly along those words. There are **two separate AI systems**, each with an
**inbound** (reactive) and an **outbound** (proactive) half, and the current tier gating is inconsistent:

| System | Path | What it does | File (approx) | Current gate |
|---|---|---|---|---|
| Marketplace conversations | **Inbound reply** | AI answers a customer's incoming chat message | `messaging/MessageService.fireAiAutoReply` → `AIAgentDomain/AgentOrchestrator.handleCustomerMessage` | `ai_global_enabled` (**Starter+**) + `service.aiSalesEnabled` |
| Marketplace conversations | **Outbound follow-up** | AI nudges a quiet conversation | `AIAgentDomain/AISalesFollowUpHandler.tryFollowUp` | `ai_global_enabled` + `ai_followup_enabled` + `shopHasFeature('aiLeadFollowUp')` (**Growth**) ✓ |
| Ads leads | **Inbound reply** | AI answers an inbound lead SMS/email | `AdsDomain/LeadAutoAnswerService.handleInbound` → `generateReply` | `campaign.aiAgentEnabled` only (**no tier gate**); bills to **ads COGS**, not the shop AI budget |
| Ads leads | **Manual trigger** | Admin/shop taps "auto-answer" | `AdsDomain/LeadController.autoAnswerLead / autoAnswerShopLead` | none |
| Owner voice | in/out | Owner dictation + spoken replies | `voice/transcribe`,`/dispatch`,`/voice/speak` | `requireTier('voiceAiAssistant')` (**Growth**) ✓ |

**Two problems fall out of that table:**
1. **The Starter leak:** the marketplace **inbound reply** is `Starter+` today — a Starter shop's AI already
   auto-replies to customers. So gating "auto-replies" to Business would *remove a live feature* from Starter
   (and possibly Growth) shops. This needs an explicit product call + rollout care, not a silent flip.
2. **The Voice half isn't built.** The Explore pass found **no inbound-voice path** (no AI answering a
   customer call/voicemail). `VoiceTranscribe/Speak/Dispatch` are all *owner*-facing (already
   `voiceAiAssistant`). So the thing that most distinguishes Business ("+ Voice") **doesn't exist yet** —
   there's nothing to gate for it; it's a *build*, not a gate.

---

## The central decision (D1) — what does `aiAutoReplies` gate?

Two coherent readings; they enforce at different points.

### Option A — Direction-based (literal): inbound reply = Business, follow-up = Growth
- Gate marketplace **inbound reply** (`fireAiAutoReply`) → `aiAutoReplies` (**Business**).
- Leave outbound follow-up at Growth (unchanged).
- **Matches the label** ("Auto-Replies" = reactive = Business; "Follow-Up" = proactive = Growth).
- **Breaks the loop for Growth:** a Growth shop can *nudge* a quiet customer but the AI **can't answer** when
  they reply → a half-working two-way experience. And it strips inbound auto-reply from **Starter + Growth**.

### Option B — Channel-based (RECOMMENDED): text two-way = Growth, Voice = Business
- Treat the **text** customer-conversation AI as one coherent Growth capability: gate the marketplace
  **inbound reply** to **`aiLeadFollowUp` (Growth)** so inbound + outbound sit together (no broken loop).
  This still closes the **Starter leak** (Starter loses auto-reply; Growth keeps full two-way text).
- Reserve **`aiAutoReplies` (Business)** for the **Voice** auto-reply channel — inbound AI call/voicemail
  answering — which is a **future build**. Until that ships, the Business line is "text auto-replies
  (inherited from Growth) **plus** voice", and the only enforcement wired today is the Starter→Growth close.
- **Matches "Email & SMS" (Growth) vs "+ Voice" (Business)** and keeps the funnel coherent.
- **Cost:** the Business gate has little to enforce *today* (voice inbound unbuilt) — honestly, "Business
  auto-replies" is partly a roadmap item, not just a gate.

### Option C — Strict Business, all inbound (both systems) = Business
- Gate BOTH marketplace inbound AND ads-lead inbound to `aiAutoReplies` (Business).
- Cleanest label-match, biggest blast radius: removes AI auto-reply from Starter **and** Growth, and pulls
  ads-lead auto-answer behind the subscription tier (see D2). Highest churn risk.

**Recommendation: Option B.** It closes the real leak (Starter auto-replying for free), keeps Growth's
follow-up coherent, matches the channel wording, and correctly labels Voice auto-replies as a build that
earns the Business tier — rather than pretending a gate alone delivers the Business line.

---

## Secondary decisions

- **D2 — Ads-lead auto-answer (`LeadAutoAnswerService`).** Ads leads bill to **ads COGS** (the separately-
  priced Ads add-on), not the shop's $10/$30/$75 AI budget. Is inbound lead auto-answer part of the **Ads
  product** (governed by ad spend / the ads plan) or the **subscription AI tier**?
  **Recommend:** governed by the Ads product — do **NOT** subscription-gate it here (leave to a separate
  ads-tier decision). Otherwise buying ads doesn't get you lead replies unless you're also on Business,
  which fights the ads funnel. (If Option C is chosen, revisit.)
- **D3 — Migration / grandfathering.** Inbound auto-reply is live at Starter+ today. Options: (a) hard cut
  behind a flag, (b) grandfather shops that have `ai_global_enabled=true` + have ever auto-replied, (c)
  announce + grace period. **Recommend:** flag-gated (`ENFORCE_AI_AUTOREPLY_TIER`, default off) + a one-time
  audit of who'd lose it before flipping on staging, then prod.
- **D4 — Manual `/auto-answer` endpoints.** If ads leads are exempt (D2), leave them. If not, gate the two
  `LeadController` endpoints too (route `requireTier` or in-controller check).

---

## Enforcement points (for the RECOMMENDED Option B)

1. **Close the Starter leak — marketplace inbound reply → Growth.**
   In `messaging/services/MessageService.fireAiAutoReply` (just before it calls
   `orchestrator.handleCustomerMessage`), add:
   ```ts
   if (!(await shopHasFeature(shopId, 'aiLeadFollowUp'))) return; // silent skip, same as other gates
   ```
   (Mirror of the existing follow-up gate in `AISalesFollowUpHandler:153`. Belt-and-suspenders: also add
   the same guard at the top of `AgentOrchestrator.handleCustomerMessage` so a direct caller can't bypass
   it — same pattern used for images/follow-up in Slice 1.)
   - Silent early-return (customer never sees an error), consistent with the existing skip reasons.
   - Gate **before** the spend-cap check so a below-tier shop never spends.

2. **Reserve `aiAutoReplies` (Business) for Voice — future build.**
   No code today. When inbound-voice answering is built, gate its entry route with
   `requireTier('aiAutoReplies')`. Record here so it isn't forgotten.

3. **Ads leads (D2 = exempt):** no change in `LeadAutoAnswerService` / `LeadController`.

> If **Option A/C** is chosen instead: swap the feature key in step 1 from `aiLeadFollowUp` to
> `aiAutoReplies`, and (Option C) add `shopHasFeature(shopId,'aiAutoReplies')` to
> `LeadAutoAnswerService.handleInbound` + gate the two `LeadController` `/auto-answer` endpoints.

---

## Frontend / admin

- **Admin AI settings:** no toggle maps 1:1 to auto-replies today (the closest is `ai_followup_enabled` =
  the outbound nudge staged-rollout flag). No new admin toggle needed for Option B — entitlement is
  tier-derived. If we later add an "AI answers customers" switch, gate it like the other `FeatureSwitch`
  toggles (disabled + "Growth"/"Business" note below tier).
- No new shop-facing surface required; the effect is behavioral (AI stops auto-answering below tier).

## Testing

- Unit: `fireAiAutoReply` / `handleCustomerMessage` early-returns when `shopHasFeature` is false; proceeds
  when true (mock `shopHasFeature`, mirror `AISalesFollowUpHandler` tests).
- Integration/manual on staging: a **Starter** shop conversation → customer message → **no** AI reply; seed
  to **Growth** → AI replies. (Reuse the Peanut seed/unseed flow.)
- Regression: outbound follow-up still fires at Growth; ads-lead auto-answer unaffected (D2).

## Rollout

- Flag `ENFORCE_AI_AUTOREPLY_TIER` (default **off**). Audit affected shops on staging before enabling.
- No migration (reuses `getShopTier` + the existing matrix entry).
- Note the **live-feature-removal** risk in the release notes — this turns off a behavior Starter shops
  have today; coordinate comms / grandfathering per D3.

---

## Decisions — LOCKED 2026-07-15 (management, via WhatsApp — see pricing.jpeg screenshot)

Management clarified what "AI Auto-Replies (Voice + Text)" means:
> "Not voice… auto response" · "There ai voice.." · "With twilio." · "With gohighlevel" ·
> "AI answers calls 📞" · "We don't need to have yet…"

Read: **the auto-response is TEXT** for now; **AI VOICE (answering calls, built via Twilio / GoHighLevel)
is a separate future capability we don't need yet.** So:

- **D1 — LOCKED = Option A (direction-based).** `aiAutoReplies` (Business) gates the **reactive TEXT
  auto-reply** — the AI auto-responding to an inbound customer message. Proactive **follow-up** nudges stay
  **Growth** (`aiLeadFollowUp`, already gated in `AISalesFollowUpHandler`). The upsell ladder: Growth = the
  AI reaches out; Business = the AI answers back.
- **Voice half = DEFERRED build** ("don't need yet") — AI answering inbound calls via Twilio / GoHighLevel.
  Not gated because it doesn't exist. When built, gate its entry with `requireTier('aiAutoReplies')`.
- **D2 — LOCKED = exempt.** Ads-lead auto-answer (`LeadAutoAnswerService`) stays Ads-product-governed
  (COGS), NOT subscription-gated. No change there.
- **D3 — grandfathering:** shipped behind a flag (below) so nothing changes until a deliberate, audited
  rollout. Audit affected Starter/Growth shops before flipping on.
- **D4 — n/a** (ads exempt, so the manual `/auto-answer` endpoints aren't gated).

## Built 2026-07-15 (flag-gated, default OFF — zero behavior change until enabled)

- **Enforcement point:** `AgentOrchestrator.handleCustomerMessage` — right after the `ai_global_enabled`
  kill-switch skip, a new gate:
  ```ts
  if (process.env.ENFORCE_AI_AUTOREPLY_TIER === "true" &&
      !(await shopHasFeature(shopId, "aiAutoReplies"))) {
    return { outcome: "skipped", reason: "autoreply_tier_not_included" };
  }
  ```
  Silent skip (same shape as the other skips — the customer never sees an error). It's the single chokepoint
  for the inbound auto-reply, so `MessageService.fireAiAutoReply` and any other caller inherit it.
- **New `SkipReason`:** `autoreply_tier_not_included` (types.ts).
- **Flag `ENFORCE_AI_AUTOREPLY_TIER` (default off).** OFF = today's behavior (Starter+ auto-reply). Turning
  it ON removes the auto-reply from Starter/Growth shops → do the affected-shop audit first, then enable on
  staging, then prod.
- **Tests:** `AgentOrchestrator.test.ts` — flag ON + below tier → skipped `autoreply_tier_not_included`
  (no reply posted); flag OFF → auto-reply still fires below tier; flag ON + entitled → replies. 109/109.
- **Not touched:** `LeadAutoAnswerService` (ads, D2 exempt), `AISalesFollowUpHandler` (follow-up already
  Growth). Voice = not built.

### Remaining (not this slice)
- The affected-shop **audit** + staged rollout (flip the flag) — a business/ops step.
- **Voice auto-replies** build (Twilio / GoHighLevel, AI answers calls) — deferred per management.

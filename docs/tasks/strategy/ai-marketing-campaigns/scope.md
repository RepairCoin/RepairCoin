# AI Marketing Campaigns — Strategy (Scope)

**Status:** Strategy draft — not yet planned-out into implementation.
**Created:** 2026-05-26.
**Owner:** Deo.
**Asked for by exec:** *"Having the AI send email/text campaigns by just telling it — like 'send a campaign to my top 100 customers' or 'make a Black Friday campaign' or 'bring old customers back.' If we execute that right it will be big."*

---

## 1. Goal

Shop owners can run targeted marketing campaigns by **telling the AI in plain English** instead of clicking through builders. The AI proposes:
- **Who** to send to (segment from the customer base)
- **What** to send (subject + body for email; short body for SMS)
- **Which channel** (email / SMS / both, gated by what the segment opted into)

…then the shop reviews and **taps to send**. No mass-send fires without explicit confirmation.

Three target conversations:
- *"Send a campaign to my top 100 customers about our new pastry tutorial."*
- *"Make a Black Friday campaign — 20% off all services this weekend."*
- *"Bring old customers back. Anyone who hasn't booked in 90 days."*

---

## 2. Current state — what already exists (investigation 2026-05-26)

Significant infrastructure is already built. The AI layer is the only major net-new piece.

### 2.1 Marketing domain (backend)

`backend/src/domains/MarketingDomain/` + `backend/src/services/MarketingService.ts`:

- **Campaign CRUD** — `GET/POST/PATCH/DELETE /api/marketing/shops/:shopId/campaigns`
- **Campaign send** — `POST /api/marketing/campaigns/:campaignId/send` (already-existing route, status: `draft → scheduled → sent`)
- **Audience segmentation** — `MarketingService.getTargetAudience(shopId, audienceType, audienceFilters)`:
  - `all_customers` — every customer who's interacted with the shop
  - `top_spenders` — top 20% by `total_spent`
  - `frequent_visitors` — top 20% by `visit_count`
  - `active_customers` — anyone who visited in the last 30 days
  - `select_customers` — explicit list of wallet addresses
  - `custom` — filter object (minSpent, minVisits, tier, etc.)
- **Audience count** — `GET /shops/:shopId/audience-count?audienceType=...` (preview-the-segment endpoint)
- **Campaign types** — `announce_service`, `offer_coupon`, `newsletter`, `custom`
- **Delivery method enum** — `email`, `in_app`, `both`
- **Customer list for campaigns** — `GET /shops/:shopId/customers` (paginated, searchable)

### 2.2 Contact + email infrastructure

- **`ContactRepository`** — separate from the customer model; supports email AND phone, with `campaignType: 'email' | 'sms' | 'both'` per contact (shop's own contact-list import path). Tracks `smsSentCount`. Phone fields ready.
- **`CampaignEmailService`** — SendGrid-backed batch sender. Inputs subject + html + text + recipients, batches with delays. Per-recipient send result returned.
- **Email send is end-to-end live** — Shop-side `EmailCampaignComposerModal.tsx`, `ContactImportModal.tsx`, `ContactListView.tsx`, `CampaignBuilderModal.tsx` all exist. The shop can already create + send campaigns via the UI today.

### 2.3 SMS / WhatsApp infrastructure (partial)

- **`WhatsAppService`** stub exists (`backend/src/services/WhatsAppService.ts`) — WhatsApp Business API integration. Setup-only; not wired to campaign sends yet.
- **No Twilio / direct-SMS service** — `ContactRepository.campaignType: 'sms'` is in the schema, but there's no sender service to actually deliver SMS bodies. Would need either WhatsApp completion or new Twilio integration.

### 2.4 Frontend Marketing tab

`frontend/src/components/shop/tabs/MarketingTab.tsx` is the existing shop-side surface. Modals already shipped:
- `CampaignBuilderModal.tsx` — multi-step wizard: audience → content → schedule → review
- `EmailCampaignComposerModal.tsx` — subject + body editor
- `ContactImportModal.tsx` — CSV/manual contact upload
- `ContactListView.tsx` — list + filter contacts

Customer/AI side: no marketing surface exists yet (and shouldn't — marketing is a shop-owner tool, not a customer-facing one).

### 2.5 AI Sales Agent infrastructure (reusable patterns)

The reschedule + cancel work (PRs #384 / #387 / #392) shipped a complete **propose-then-tap** architecture that's directly transferable:
- Claude proposes via a tool (`propose_booking_slot`, `propose_cancellation`, `propose_reschedule_request`).
- Frontend renders a tap card.
- Customer (or in this case, shop owner) confirms.
- Server-side validates + executes via existing endpoint.
- Event-bus subscriber posts an AI confirmation message after.

The exact same shape works for `propose_campaign_send` — destructive action (mass-send to N customers, can't be undone), customer-confirms via tap, server fires the existing send pipeline.

### 2.6 Insights panel infrastructure (reusable for the chat surface)

The Business-Data Insights panel (Phase 1-7 of that workstream) is a multi-turn shop-owner-facing Sonnet+tools chat with prompt caching, spend cap, audit logging, ranges vocabulary, and rendered data cards. The "marketing AI" chat would slot in beside it as a sibling panel — same shop, same auth, same chrome.

---

## 3. The gap — what needs building

Three layers of net-new work:

1. **AI tools layer** — Claude tools that translate natural language into structured campaign actions.
2. **Marketing chat panel** — shop-side surface (Slide-over Sheet alongside InsightsLauncher, NOT the customer chat) that takes plain-English commands and proposes campaigns.
3. **SMS sender** — `ContactRepository` is ready for SMS contacts but there's no send service. Either complete the WhatsApp integration OR add a Twilio service. **Decision needed.**

---

## 4. Proposed architecture

### 4.1 New Claude tools (5-6, propose-then-tap pattern)

| Tool | What it does | Validation |
|---|---|---|
| `lookup_audience_count` | Returns count + sample of customers matching a segment hint ("top 100 by spend", "lapsed 90+ days", "Gold tier"). Maps natural language → existing audienceType + filters. Read-only — Claude calls this BEFORE proposing send. | shop-scoped, server-side resolution of "top N" semantics |
| `propose_campaign_draft` | Emits a `CampaignDraftProposal` to message metadata. Frontend renders a tap-to-preview card showing audience size + subject + first-paragraph + channel + ETA. | Validates resolved-audience-count > 0, subject non-empty, body non-empty, channel matches recipients' opt-ins |
| `propose_campaign_send` | (Optional second step) After preview, the customer can either edit in a modal OR tap "send as-is". Tool emits a `CampaignSendProposal` carrying the resolved campaign-id from a draft `POST /campaigns` call. | Validates the draft id is owned by this shop + status=draft |
| `suggest_campaign_strategies` | Meta-tool — emits 2-3 chip suggestions of campaign IDEAS the shop hasn't run yet ("you haven't messaged your top 100 in 60 days — want to send a check-in?"). Mirrors Phase 6.3 `suggest_followups` for Insights. | Read-only, returns array of suggestion strings |

Two-step send (`draft` then `send`) instead of one-step matches existing Marketing CRUD lifecycle. The shop can also abandon at the preview step.

### 4.2 Conversation flows

**Flow A — "Send a campaign to my top 100 customers"**

```
Shop: "Send a campaign to my top 100 customers about our new pastry tutorial."

AI: [calls lookup_audience_count(segment_hint="top 100 by spend")]
AI: "You have 87 customers — top 100 returns all of them. Drafting a Newly Baker campaign…"
AI: [calls propose_campaign_draft({
       audience: {type: 'top_spenders', limit: 100, resolved_count: 87},
       channel: 'email',
       subject: 'Try our new pastry tutorial 🥐',
       body: "...Newly Baker is hands-on bread + pastry training at Peanut. First 10 bookings get 15% off..."
     })]
AI: "Here's the draft — tap to preview the full email + see who'll get it."
   [CampaignDraftCard: "Pastry tutorial promo → 87 customers via email"]

Shop: [taps card → preview modal opens with rendered email + full recipient list]
Shop: [taps "Send 87 emails" → confirmation modal → Confirm]

→ POST /api/marketing/campaigns/:id/send (existing endpoint, customer-auth via shop JWT)

AI (auto-message via event-bus subscriber): "Campaign sent. 87 emails queued, 0 failed at handoff. I'll let you know if any bounced."
```

**Flow B — "Bring old customers back"**

```
Shop: "Bring old customers back. Anyone who hasn't booked in 90 days."

AI: [calls lookup_audience_count(segment_hint="lapsed 90+ days")]
   → maps to `custom` audienceType with daysSinceLastVisit filter (NEEDS NEW FILTER, see §5)
AI: "23 customers haven't booked in 90+ days. Drafting a win-back…"
AI: [calls propose_campaign_draft({
       audience: {type: 'custom', filters: {minDaysSinceLastVisit: 90}, resolved_count: 23},
       channel: 'email',
       subject: 'We miss you — come back and get 20% off',
       body: "..."
     })]
AI: "Tap to preview the win-back email + 23 recipients."
   [CampaignDraftCard]
```

**Flow C — "Make a Black Friday campaign"**

```
Shop: "Make a Black Friday campaign — 20% off all services this weekend."

AI: [no lookup needed — segment defaults to all_customers for shop-wide promo]
   [calls propose_campaign_draft({
     audience: {type: 'all_customers', resolved_count: 142},
     channel: 'email',
     subject: '🛍️ Black Friday at Peanut — 20% off all services',
     body: "..."
   })]
AI: "Here's a Black Friday draft for all 142 customers. Tap to preview + edit before sending."
```

### 4.3 Frontend — new shop-side panel

New `frontend/src/components/shop/marketing/MarketingAIPanel.tsx` — mirrors `InsightsPanel.tsx` in shape:
- `MarketingAILauncher` button in the shop dashboard (or as a tab inside the existing `MarketingTab`)
- Multi-turn chat with prompt cache + spend cap (reuse existing controllers — `AnthropicClient`, `SpendCapEnforcer`)
- Rendered cards under AI bubbles: `CampaignDraftCard`, `AudienceSummaryCard`, `SendConfirmationCard`
- Same Phase 6.3-style follow-up chips
- Same Phase 7.3-style pinned questions (frequent campaign templates — "monthly newsletter", "weekend special")

New `CampaignDraftCard` — visual contract:
- Header: campaign name + audience size + channel icon (✉️ / 💬 / both)
- Body: subject line preview + first 2 lines of content + "..." + recipient sample (avatars or count)
- Footer: **Preview & send** button → opens `CampaignReviewModal`

New `CampaignReviewModal` — destructive-action gate (Q1 of reschedule-cancel-scope's modal-vs-inline reasoning):
- Rendered email preview (or SMS preview)
- Full recipient list (paginated if > 50)
- Editable subject + body (uses existing `EmailCampaignComposerModal` editor)
- **Send now** button + **Schedule for later** option
- Confirm → POST `/campaigns/:id/send` with the existing send pipeline

### 4.4 Backend extensions

| Need | Where | Effort |
|---|---|---|
| New audience filter: `minDaysSinceLastVisit` | `MarketingService.getTargetAudience` `custom` branch | ~30 min |
| AI campaign-draft endpoint that pre-creates a `draft` campaign + returns its id | `MarketingController.createDraftFromAI` (wraps existing `createCampaign`) | ~1 day |
| Event-bus publish on campaign-sent for the AI confirmation message | `MarketingService.sendCampaign` → `'campaign:sent'` event | ~30 min |
| New AIMarketingDomain controller — Claude orchestration + tool dispatch | New file mirroring `InsightsController` | 2-3 days |
| Prompt rules — what tools to call when, how to phrase chip suggestions, never auto-send | New section in a Marketing-specific prompt builder | ~1 day |
| SMS sender (if SMS channel is in v1) | Either Twilio integration OR finish WhatsApp wiring | 1-2 days |

---

## 5. Decisions to lock (10 open questions)

These need answers before an implementation plan. Recommendations in **bold**.

1. **Q1 — SMS channel in v1, or email-only?**
   - Option A: **Email-only v1**, SMS in v2 (Recommended). Email infra is complete; SMS needs Twilio integration or WhatsApp completion. Ship faster, learn from email data first.
   - Option B: SMS in v1 too — bigger UX wow factor ("send a text to my top 100") but slower ship.

2. **Q2 — Where does the AI panel live?**
   - Option A: **New sibling launcher in shop dashboard** (next to InsightsLauncher), as a slide-over Sheet (Recommended). Discoverable, doesn't crowd the Marketing tab, matches Insights UX.
   - Option B: New tab inside the existing `MarketingTab.tsx`. Better contextual coherence but might be missed by users not currently in the Marketing tab.
   - Option C: A persistent chat widget on every page of the shop dashboard (most ambitious — could replace the manual builder eventually).

3. **Q3 — Do we keep the existing manual campaign builder, or replace it?**
   - Option A: **Keep both** (Recommended). AI is the fast path; manual builder is the precision path. AI-drafted campaigns drop into the same `campaigns` table — the user can switch to the manual editor at the preview step. No data fragmentation.
   - Option B: Replace manual builder over time — ambitious but losing the precision path for power users.

4. **Q4 — Confirmation UX: tap-to-preview-then-send, OR inline single-tap send?**
   - **Tap-to-preview, then confirm in modal** (Recommended). Mass-send is destructive — same reasoning as the cancel modal vs reschedule inline. A mistap can't be undone (emails are out). Matches Q4 of reschedule-cancel-scope: destructive → modal.

5. **Q5 — Reuse the existing AI Sales Agent's AnthropicClient / SpendCapEnforcer, or build a new one?**
   - Option A: **Reuse** (Recommended). Same shop-scoped budget. Mirror how the Insights surface reuses these. Shop's monthly AI spend cap covers all surfaces.
   - Option B: Separate budget for marketing AI — finer cost control but more dashboards / more knobs.

6. **Q6 — Does the AI free-draft, or work from templates?**

   Templates are a **scaffold**, not a cage. The AI always interprets the shop's request first and chooses the path per-request:
   - Recognizable category (Black Friday / win-back / weekend-special / new-service) → load template scaffold (subject pattern, body structure, CTA placement, unsubscribe footer), then fill in shop-specific copy, services, offers, brand voice.
   - Novel ask ("tell my top 50 about my new puppy-training class on Saturdays") → free-draft from scratch using shop context (services, prior campaign style, brand voice from past messages).
   - Hybrid ("Black Friday but also tease my new service") → start from Black Friday scaffold, edit it.

   - Option A: Free-draft only. AI writes every campaign from scratch. Maximum flexibility, less consistency floor, more cost (~3x output tokens), more risk of malformed campaigns (missing CTA / footer).
   - Option B: **Hybrid — templates for recognized categories, free-draft for novel asks** (Recommended). AI decides per request. Templates guarantee quality bones (CTA, footer, unsubscribe) for the 80% of asks that fit a known pattern; free-draft handles the 20% that don't. A/B improving templates compounds over time.
   - Option C: Templates only. Restrictive — rejected; doesn't match the exec's "just tell it" vision.

   Why have templates at all under Option B: (1) quality floor — guarantees CTA + unsubscribe + deadline structure, (2) consistency the team can A/B improve, (3) cheaper tokens on the common cases (~500 vs ~1.5K output tokens per draft).

7. **Q7 — When should the AI proactively suggest campaigns?**
   - Option A: Only on shop request — passive.
   - Option B: **Cron-based weekly summary** that shows up in the panel ("You haven't messaged your top spenders in 60 days — want to draft a check-in?") — analogous to the Insights anomaly banner pattern (Recommended).
   - Option C: Real-time triggered by shop activity (new service launched → propose announce campaign).

8. **Q8 — Compliance / unsubscribe?**
   - Email: SendGrid already handles list-unsubscribe headers. AI-drafted emails must inherit the existing template footer that includes the unsubscribe link. **No new compliance work needed** if AI campaigns flow through the existing `CampaignEmailService`.
   - SMS (if v1): TCPA requires STOP-to-unsubscribe handling per message. Needs Twilio's auto-handling or a custom keyword-handler. **Defer to v2.**

9. **Q9 — Cost control on AI suggestions?**
   - Drafting a Black Friday email = a Sonnet call (~3K-5K input tokens with shop context + ~500-1K output). That's $0.04 per draft. A chatty shop could rack up $5-10/mo on drafts.
   - **Recommended: reuse the SpendCapEnforcer pattern** (per-shop monthly budget covers all AI surfaces). Plus a hard "max 50 drafts/day" guard at the controller layer.

10. **Q10 — What's the minimum viable demo?**
    - **Recommended v1 scope** to show the exec: email-only, top-spenders + lapsed-customers + all-customers segments only, hybrid drafting (4 starter scaffolds — Black Friday / win-back / new-service / weekend-special — PLUS free-draft fallback for anything that doesn't fit), no scheduling (send-now only), reuse existing campaign DB + send pipeline.
    - Stretch: more template scaffolds, custom audience filters, SMS, scheduling, A/B subject testing.

---

## 6. Out of scope for v1

- **SMS sending** (defer to v2 pending Q1 decision).
- **Scheduled sends** ("send this Black Friday morning at 9am") — existing campaign schema supports `scheduled` status; AI v1 only does send-now. v2 adds `propose_campaign_schedule` tool.
- **Auto-send** without confirmation — never. Always tap-to-confirm.
- **Multi-step automation flows** ("send win-back, then 7 days later send follow-up") — separate workstream.
- **Subject A/B testing**, click-tracking dashboard — exists in some form; AI v1 reads existing stats via Insights tools but doesn't generate A/B variants.
- **Cross-shop benchmarks** ("your open rate is below average") — Phase 8 / privacy implications.
- **AI-generated images / brand visuals** — text-only for v1.
- **Voice input on the Marketing chat panel** — handled at the platform level via `docs/tasks/strategy/voice-ai-dispatcher/scope.md`. v1 of that workstream's Phase 5.5 ships a shared `<InlineVoiceMic />` component that mounts inside the Marketing panel's input area (alongside the send button). Do NOT build a Marketing-specific voice input — wait for the platform component.

---

## 7. Risk checklist

- **Mass-send mistakes are unrecoverable** — Q4's modal-confirm is non-negotiable. If a shop owner accidentally sends a wrong campaign to 500 customers, that's a real reputational hit.
- **AI hallucinating offers** — "20% off this weekend" → the shop didn't actually authorize that discount in their system. Mitigation: prompt rule that ANY offer in the body must echo a value the shop explicitly stated in their current message; if not, mark it as "(your offer here)" placeholder.
- **Spam-like volume** — shop suddenly sends 4 campaigns/week to the same list. Mitigation: rate-limit per shop ("you've sent 3 campaigns to your top spenders in the last 30 days — sure?") at the propose step.
- **Privacy on AI prompts** — Claude sees shop's customer list (names, emails) to draft messages. Audit log already captures this. Confirm with legal that customer PII in audit `request_payload` is acceptable.
- **Drift between AI draft and what got sent** — if the shop edits in the preview modal, the sent message diverges from what the AI logged. Audit the FINAL sent content separately from the AI proposal so post-hoc analysis isn't misleading.
- **Twilio / SendGrid costs** — separate from AI cost. Today the shop owns SendGrid charges; if AI dramatically increases send volume, shop's bill increases. Make this transparent in the preview modal: "This send will use X SendGrid credits."

---

## 8. Rough effort estimate

Per the v1 minimum-viable demo (Q10 recommendation):

| Phase | Work | Est. |
|---|---|---|
| 1 | Backend: new audience filter (`minDaysSinceLastVisit`), AI draft endpoint, `campaign:sent` event publish | 1d |
| 2 | New AIMarketingDomain controller + 4 Claude tools + prompt builder + 4 starter template scaffolds + free-draft path | 3-4d |
| 3 | Frontend: `MarketingAIPanel` + launcher + `CampaignDraftCard` + `CampaignReviewModal` + thread wiring | 3-4d |
| 4 | Event-bus confirmation message handler ("Campaign sent. N emails queued.") | 0.5d |
| 5 | QA fixtures + test scenarios doc (mirror reschedule + cancel QA pattern) | 1d |
| 6 | Manual smoke + cost calibration on a real shop | 1d |

**v1 estimate: ~10-12 days** for a usable demo. SMS adds ~2 days. Proactive suggestions (Q7B) adds ~1 day.

---

## 9. Why this is worth doing (the exec's intuition)

Three reinforcing arguments:

1. **The infrastructure tax is already paid.** Audience segmentation, contact data, email send pipeline, customer profiles, AI orchestration patterns — all exist. The AI layer is the only thing left to build.

2. **Marketing is the hardest part of shop ownership.** Repair shops are technicians, not marketers. They have customer data but don't act on it. "Write a Black Friday email" is a real cognitive blocker that AI removes.

3. **Compounding RCN value.** Every campaign that brings a customer back is a service order → RCN earned → tier progression → more future loyalty. The AI campaign feature is a multiplier on the existing RCN economy.

The exec's quote — *"if we execute that right it will be big"* — is correctly identifying that this is a force multiplier on existing capability, not a net-new system.

---

## 10. Next step

If the 10 decisions in §5 land roughly where the recommendations point, the path forward is:

1. **Confirm v1 scope** (Q10 recommendation: email-only, 3 segments, hybrid drafting with 4 scaffolds + free-draft fallback, send-now).
2. **Write `ai-marketing-campaigns-implementation.md`** as a sibling doc — per-task breakdown analogous to `reschedule-cancel-implementation.md`.
3. **Phase 1 first** (backend audience + event publish) — small, isolated, can land before any AI work begins.

No code work until decisions are locked.

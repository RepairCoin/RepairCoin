# Ads — Shop Lead-Conversation Visibility + AI-Initiated Outreach (scope)

Two related lead-engagement improvements found while bringing up inbound email:
- **Part A** — the shop **can't view the lead conversation** in-app (the thread is admin-only). A blocker for the
  AI-email model, where replies land in the app instead of the shop's inbox.
- **Part B** — today the AI only **answers** inbound replies; **first contact is manual** (AI drafts, a human sends).
  Should the AI **initiate** contact, and if so, how?

Status as of 2026-07-06. Inbound email → AI auto-reply is built + verified (see `ads-inbound-email-scope.md`).

---

## Part A — Shop lead-conversation visibility

### Why it matters
In the AI-email model, a lead's reply is delivered to `<token>@reply.fixflow.ai` (our app), **not** the shop's inbox.
If the shop can't read the thread in-app, they are blind to their own leads and can't (a) see what the AI said on their
behalf, (b) take over / correct / pause the AI, (c) judge lead quality. Scope §8 of the inbound doc lists shop visibility
+ notification as a **requirement**, not optional. A "you got a reply" notification with no way to read it is broken.

### Current state (works vs. gap)
- **Works:** shop gets a notification (`InboundEmailService.notifyShop` → "New email reply from {lead}"), sees the lead on
  the **Kanban** (`LeadKanban mode="shop"`), can change status, log a call, send a tracked email
  (`/shop/leads/:id/activities`, `/shop/leads/:id/email` — all ownership-gated).
- **Gap:** the **conversation thread itself is admin-only.** `LeadConversation` calls:
  - `getLeadThread` → `GET /ads/leads/:id/messages`
  - `sendLeadMessage` → `POST /ads/leads/:id/messages`
  - `autoAnswerLead` → `POST /ads/leads/:id/auto-answer`, `draftLeadReply` → `POST /ads/leads/:id/draft-reply`

  These frontend helpers are **hardcoded to the admin base** (not `leadBase(mode)`), and the backend has **no
  `/shop/leads/:id/messages`** (or auto-answer / draft-reply) route. So a shop opening a lead's conversation hits an
  admin-gated endpoint → **403 / empty thread**. The shop is notified but **can't read the reply or respond from the app.**

### Fix
- **Backend** — add ownership-gated shop routes mirroring admin, each verifying the lead's campaign belongs to the caller's
  shop (via `ad_campaigns.shop_id`, same pattern as the existing `/shop/leads/*` routes):
  - `GET  /shop/leads/:id/messages`   → shop conversation thread
  - `POST /shop/leads/:id/messages`   → shop manual reply (records + sends via `LeadChannelSender`)
  - `POST /shop/leads/:id/auto-answer`→ let the shop trigger an AI answer on demand
  - `POST /shop/leads/:id/draft-reply`→ shop-side AI draft
- **Frontend** — make `getLeadThread` / `sendLeadMessage` / `autoAnswerLead` / `draftLeadReply` **mode-aware**
  (`leadBase(mode)`), and thread `mode` through `LeadConversation` (it already receives `mode` from `LeadKanban`).
- **Ownership** — a shop may only read/post to leads on its own campaigns; reuse the existing shop-lead guard.

### Effort / risk
~0.5 day. Low risk (mirrors existing admin routes + the established `/shop/leads/*` ownership pattern). Add 2–3 tests:
ownership rejection (shop A can't read shop B's lead), thread read, shop reply records + sends.

---

## Part B — Should the AI initiate first contact?

### The question
Today: a lead arrives (landing form / Meta webhook / manual) → `LeadAIService.draftOutreach()` **drafts** a first message,
but a **human sends it** (draft-only, "Option C"). The AI only auto-answers *inbound* replies (`LeadAutoAnswerService`).
Should the AI **send the first outreach automatically** instead of waiting for the shop owner?

### Recommendation: YES — opt-in, AI-initiated first contact (email), with guardrails.
**Speed is the single biggest driver of lead conversion.** Leads go cold fast; the shop dashboard already shows leads
"awaiting response 13d". A busy repair-shop owner is not a sales desk — expecting them to notice and reply within minutes,
nights/weekends included, is unrealistic. An AI that reaches out in **seconds**, brand-grounded, then hands a warm thread
to the owner, is the whole value proposition. This is strictly better than a draft sitting unsent.

But it must be **opt-in and guarded** — auto-sending on a shop's behalf carries brand, consent, deliverability, and
wasted-spend risk. So the design is a spectrum, not a switch.

### Best approach
1. **Per-campaign engagement mode** (not global). Three levels:
   - `off` — no AI outreach (today's manual-only).
   - `draft` — AI drafts, human sends (today's `draftOutreach`).
   - `auto` — **AI sends the first outreach automatically** (new).
   Reuse / extend the existing `ai_agent_enabled` semantics; add an `ai_initiate` mode column (or enum) on the campaign.
2. **Trigger on lead creation, async.** Emit a new `ad_lead:created` event (none exists today) from every creation path
   (`LandingController`, manual `LeadController`, `LeadAttributionService`). A handler enqueues the outreach — **never
   inline** with the lead-create request (don't block the landing form; allows debounce/dedupe).
3. **Guardrails before sending** (reuse what exists):
   - **Consent** — only auto-contact leads with a contactable channel + implied consent (form submit = consent for email;
     SMS/other need explicit consent → out of scope for v1).
   - **Junk filter** — skip obvious junk (reuse the conversion junk-filter) so AI spend isn't wasted.
   - **Spend cap** — `SpendCapEnforcer.canSpend(shopId)` (already gates auto-answer).
   - **Brand grounding** — `BrandKitService` (already used; keeps the message on-brand, as proven in the inbound test).
   - **Quiet hours** — respect the shop timezone (`shop_time_slot_config.timezone`); optionally hold overnight sends.
   - **Idempotency / rate** — one initiation per lead; cap per campaign/hour to protect domain reputation.
4. **Channel = email (v1).** We just shipped the 2-way email loop; `LeadChannelSender.deliverEmail` already sets
   `reply-to: <token>@reply.fixflow.ai`, so the lead's reply flows straight back into `LeadAutoAnswerService`. SMS/WhatsApp
   initiation waits on live lead transport (`ADS_LEAD_TRANSPORT_ENABLED`) + consent.
5. **Human override + visibility** — depends on **Part A**: the shop must see the AI's first message and the thread, and be
   able to jump in / pause. Ship Part A first (or together); AI-initiated contact without shop visibility is unsafe.
6. **Flagged rollout** — behind `ADS_AI_INITIATE_ENABLED` (default off); enable per campaign in `auto` mode; measure
   first-response-time and reply-rate before widening.

### Reuses what already exists
`LeadAIService.draftOutreach` (the message), `LeadChannelSender`/`LeadEmailService` (send + reply-to token),
`LeadAutoAnswerService` (handles the reply), `SpendCapEnforcer`, `BrandKitService`, the inbound webhook. The **new** parts
are just: the `ad_lead:created` event + handler, the per-campaign engagement mode, and the pre-send guardrail gate.

### Risks
- **Off-brand / wrong first message** → brand-kit grounding + start `draft` mode per shop, graduate to `auto` once trusted.
- **Deliverability** → rate-limit + quiet hours + only contactable-with-consent leads.
- **Wasted spend on junk** → junk filter before send; spend cap.
- **Shop surprise** ("who sent this?") → opt-in per campaign + Part A visibility + notification on each AI send.

### Phasing
- **P1** — Part A (shop conversation visibility). Prerequisite.
- **P2** — `ad_lead:created` event + per-campaign engagement mode (`off`/`draft`/`auto`) + the auto-send handler behind
  `ADS_AI_INITIATE_ENABLED`, email only, with the guardrail gate.
- **P3** — quiet-hours hold + per-campaign rate limits + metrics (first-response-time, reply-rate, cost/lead).
- **Later** — SMS/WhatsApp initiation once transport + consent land.

### Decisions needed
1. Engagement-mode granularity — per **campaign** (recommended) vs per **shop**.
2. Default for new campaigns — `draft` (safe) vs `auto` (aggressive); recommend `draft`, let the shop opt into `auto`.
3. Quiet-hours behavior — hold-until-morning vs send-anyway (email is low-intrusion; leaning send-anyway with a later
   hold option).
4. Consent copy on the landing form — add an explicit "we may follow up by email" note to harden consent.

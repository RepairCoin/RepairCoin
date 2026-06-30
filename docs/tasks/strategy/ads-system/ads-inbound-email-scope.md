# Scope — Inbound email (lead replies → app → AI auto-answer)

**Date:** 2026-06-30 (updated 2026-06-30)
**Status:** ⏸️ **BUILT but PARKED — blocked on Resend Receiving (paid plan; deprioritized by management).**
The full feature (Increments 1+2: per-lead reply token + reply-to switch + Svix-verified inbound webhook +
resolve/clean/`handleInbound` + loop-safety + shop notification) is **code-complete and tsc-clean**, committed on a
**dedicated branch `deo/inbound-email` (tip `db31f1e81`)** — deliberately kept **OFF `deo/ads-system`/`main`** so it can
never ride a merge into a deploy. Resend "Enable Receiving" can't be toggled on the current plan (new domain / receiving
is plan-gated), and management hasn't prioritized it. **Revive when prioritized + Resend upgraded:** check out
`deo/inbound-email`, merge latest `main`, **verify the Resend inbound payload field-paths against a real delivery**, then
merge + set `ADS_INBOUND_EMAIL_ENABLED=true` (+ `RESEND_INBOUND_WEBHOOK_SECRET`, MX on the receiving domain). Behind
`ADS_INBOUND_EMAIL_ENABLED` (default off); with the flag off it's behaviour-neutral to AI ads management.
**Goal:** close the email conversation loop. Today FixFlow can **send** a lead email (manual composer + AI
auto-answer transport, both via Resend — `223f796a1`), but a customer's **reply** goes to the shop's own inbox and the
app never sees it. This scopes **inbound email**: the customer's reply lands in the app, threads onto the lead, and (when
the campaign's AI agent is on) gets **auto-answered by email** — the "AI answers every lead 24/7" loop, for the email channel.
**Builds on:** the lead conversation thread + `LeadAutoAnswerService.handleInbound` (already the entry point), the Resend
engagement webhook verify pattern (`ResendWebhookService`), and the email transport just shipped. Companion to
`ads-lead-followup-tracking-plan.md` Phase 4. See [[project-ads-system-state]].

---

## 1. The core decision (read first) — who owns the reply?
Inbound only works if replies are addressed to **us**, not the shop. That directly conflicts with today's
`reply-to = shop's email`. Two models:
- **(A) Shop-direct (today):** `reply-to = shop inbox` → customer replies go straight to the shop. App never sees them.
  No AI. Simple, but no loop.
- **(B) FixFlow-capture (this scope):** `reply-to = a per-lead FixFlow address` → reply hits our inbound webhook → we
  thread it + the AI can auto-answer. The shop sees the conversation **in the app** (+ a notification) instead of raw email.

**Recommended: drive the model by the existing `campaign.ai_agent_enabled` flag** (no new toggle):
- **AI agent ON** → use **(B)** FixFlow-capture reply-to → inbound + auto-answer (the hands-off Business-tier experience).
- **AI agent OFF** → keep **(A)** shop-direct reply-to (today's behaviour) — the shop wants the raw email relationship.

This is clean: the same flag that decides "does the AI answer?" decides "where do replies go?". No reply is silently
hidden from a shop that opted out of AI.

---

## 2. What already exists (reuse — don't rebuild)
- **`LeadAutoAnswerService.handleInbound(leadId, body, channel?)`** — THE entry point: records the inbound message, and
  auto-answers via `generateReply` when `campaign.ai_agent_enabled`. Inbound email just needs to **call this** with `'email'`.
- **`POST /ads/leads/inbound`** — already records an inbound + triggers auto-answer (used in the Option-A test). But it
  takes a **`leadId`** — inbound email arrives with a **to/from address**, so we need a *resolve-lead-from-address* step.
- **Resend webhook verify** — `ResendWebhookService.verifyResendSignature` (Svix HMAC, node crypto) + the raw-body
  pattern in `app.ts` — reuse verbatim for the inbound receiver.
- **Email send + reply-to** — `LeadEmailService` (manual) and `LeadChannelSender.deliverEmail` (transport) both set
  `replyTo`. They become the place to switch reply-to between model (A) and (B).
- **Idempotency precedent** — `LeadRepository.findByMetaLeadId` (dedupe Meta re-delivery) → mirror for inbound `Message-ID`.

---

## 3. Prerequisites (external — like the Meta/Google access tracks)
- **Resend "Enable Receiving"** on a domain (the toggle seen during setup, currently OFF) → Resend provisions **MX
  records** for that domain and delivers received mail to a webhook.
- **A dedicated receiving subdomain** — recommend **`reply.fixflow.ai`** (NOT `send.fixflow.ai`) so inbound MX doesn't
  collide with the sending domain / any existing mail. Add the MX records Resend gives (Hostinger, like the SPF/DKIM setup).
- **Inbound webhook signing secret** (`RESEND_INBOUND_WEBHOOK_SECRET`) — verify like the engagement webhook.
- Confirm Resend's **inbound event/payload shape** at build time (from, to, subject, text, html, headers, attachments) —
  documented but verify against a real delivery.

---

## 4. Architecture / flow
```
Send (model B):  reply-to = <token>@reply.fixflow.ai   (per-lead, on the receiving subdomain)
Customer replies ──▶ MX (reply.fixflow.ai) ──▶ Resend Inbound ──▶ POST /api/ads/webhooks/resend-inbound (Svix-signed)
   └─ verify signature → parse → resolve lead from the to-address token → clean the reply body
      → handleInbound(leadId, cleanBody, 'email')
         └─ records inbound message on the thread + stamps activity
         └─ if campaign.ai_agent_enabled → generateReply → deliverEmail (Resend) → AI reply emailed back
            (loops: each AI reply also uses the per-lead reply-to, so the conversation continues by email)
```

---

## 5. Per-lead reply address scheme
- Add **`ad_leads.reply_token TEXT UNIQUE`** (random, ~16+ chars, indexed) — opaque, no leadId leakage/spoofing.
- Reply-to (model B) = **`${reply_token}@reply.fixflow.ai`**. On inbound, look up the lead by the local-part. (Dedicated
  local-part beats `plus+addressing` — some providers mangle `+`.)
- Generated lazily on first model-B send; null until then.

## 6. Reply body extraction (the fiddly part)
Inbound emails carry the **entire quoted history + signatures**. We must extract only the new reply:
- Strip quoted blocks: lines after `On … wrote:`, `-----Original Message-----`, leading `>` quote levels, and the
  `\n-- \n` signature delimiter.
- Prefer the `text` part; fall back to HTML→text (reuse `ResendEmailService.htmlToText`).
- Heuristic, not perfect — store the **raw** body in `meta` so nothing is lost; feed the **cleaned** body to the AI.
  (A talon-style library is overkill for v1; a tested heuristic is enough.)

## 7. Loop & abuse safety (must-haves — auto-reply can ping-pong)
- **Ignore machine mail:** drop if headers say `Auto-Submitted: auto-*`, `Precedence: bulk/auto_reply/list`,
  `X-Autoreply`, or the envelope-from is empty/`<>` (bounces, OOO, mailer-daemon).
- **Idempotency:** dedupe on `Message-ID` (skip re-deliveries).
- **Rate-limit auto-answers per lead** (e.g. ≤ N/hour, env-tunable) so two bots can't loop forever.
- **Ignore the shop's own address** as a sender (shop replying ≠ customer).
- **Unknown/expired token → drop + log** (don't create orphan leads from spam to the receiving domain).
- All gated behind a flag (`ADS_INBOUND_EMAIL_ENABLED`, default OFF).

## 8. Shop visibility (since replies no longer hit the shop inbox in model B)
- On an inbound capture, **notify the shop** via the notification gateway ("New reply from {lead}") so they're not blind.
- The thread + Kanban already show it; the shop can take over (manual reply / pause the AI). No raw-email forwarding in v1
  (optional later: BCC/forward the shop a copy).

## 9. Endpoints + data
- **`POST /api/ads/webhooks/resend-inbound`** (public, Svix-verified, raw body in `app.ts`) — the receiver.
- **`InboundEmailService`** — verify → parse → resolve lead (token, else from-address contact-match fallback) → clean →
  `handleInbound`. Mirrors `ResendWebhookController`/`Service`.
- **Migration:** `ad_leads.reply_token` (unique, indexed). Inbound `Message-ID` dedupe via a small `meta`/column on
  `ad_lead_messages` or a seen-set table.
- **Reply-to switch:** `LeadEmailService` + `LeadChannelSender.deliverEmail` choose `${reply_token}@reply.fixflow.ai`
  (model B, AI on) vs `shop.email` (model A, AI off).

---

## 10. Phasing & effort (behind `ADS_INBOUND_EMAIL_ENABLED`, default OFF)
- **P0 — receiving setup (external):** enable Resend receiving on `reply.fixflow.ai` + MX + inbound webhook secret. (No code; like the DNS setup.)
- **P1 — receiver + verify + resolve:** `/webhooks/resend-inbound` + Svix verify + reply-token lookup (+ contact-match
  fallback) + dedupe. ~1.5–2d.
- **P2 — reply extraction + handleInbound wiring:** strip quotes/signatures, feed clean body to `handleInbound('email')`,
  store raw in meta. ~1d.
- **P3 — reply-to switch (model B) + per-lead token:** migration + send-path switch driven by `ai_agent_enabled`. ~0.5–1d.
- **P4 — loop/abuse safety + shop notification:** auto-mail filters, rate limit, shop-sender ignore, notify gateway. ~1–1.5d.
≈ **4–5.5 dev-days** of code + the external receiving setup. P1–P3 deliver the loop; P4 is the safety net (don't ship without it).

## 11. Risks
- **Auto-reply loops** — the #1 risk; P4 filters + rate-limit are mandatory before enabling.
- **Reply-parsing imperfection** — quoted text may leak into the AI prompt; mitigated by storing raw + a tested heuristic;
  worst case the AI sees a bit of history (usually harmless).
- **Shop-direct expectation** — shops used to replies in their own inbox; model B moves them to the app. Mitigated by
  gating on `ai_agent_enabled` (opt-in) + the shop notification.
- **Deliverability** — a receiving subdomain + new MX; keep sending on `send.fixflow.ai` so SPF/DKIM/reputation are unaffected.
- **Resend inbound maturity** — verify the payload/limits (attachment size, html fidelity) against a live delivery before relying on it.

## 12. Out of scope
- Inbound **SMS/WhatsApp/Messenger** (separate transports; Messenger is the Meta App-Review path).
- Raw-email **forwarding** to the shop (v1 = in-app thread + notification).
- Rich attachment handling (store/ignore in v1).
- A full ML reply-parser (heuristic is enough for v1).

## 13. Decisions needed
1. **Model gate (§1):** drive reply-to by `ai_agent_enabled` (recommended) — confirm, vs a separate per-shop "let the AI handle email" toggle.
2. **Receiving subdomain (§3):** `reply.fixflow.ai` (recommended) vs reuse `send.fixflow.ai`.
3. **Reply-token (§5):** stored random token (recommended) vs HMAC-signed leadId vs plus-addressing.
4. **Shop visibility (§8):** in-app notification only (recommended v1) vs also BCC/forward the shop a copy.
5. **Rate-limit threshold (§7):** auto-answers per lead per hour (default?).

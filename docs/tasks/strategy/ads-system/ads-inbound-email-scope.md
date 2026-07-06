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

---

## 14. Resend account migration — full runbook (recreate domains, DNS in Hostinger, webhooks, env)

**Context.** The original Resend account was not the company's real account. Management provisioned a **new** Resend
account (invited us in) with an upgraded payment method / plan — inbound receiving requires the paid plan. In Resend,
**domains, API keys, and webhooks are account-scoped — nothing transfers.** Recreating them in the new account mints
**new DKIM keys** (→ new DNS records in Hostinger) and **new webhook signing secrets** (→ new env). We rebuild two
domains and two webhooks:
- **`send.fixflow.ai`** — sending domain (outbound campaign / lead email, `leads@send.fixflow.ai`).
- **`reply.fixflow.ai`** — receiving/inbound subdomain (customer replies → our webhook).
- Webhook **`POST /api/ads/webhooks/resend`** — engagement events (sent/delivered/bounced/opened), secret `RESEND_WEBHOOK_SECRET`.
- Webhook **`POST /api/ads/webhooks/resend-inbound`** — inbound email, secret `RESEND_INBOUND_WEBHOOK_SECRET`.
Both routes are raw-body + Svix-verified in `app.ts`; a wrong secret returns **401** (a fast way to confirm the secret).

DNS for `fixflow.ai` is hosted at **Hostinger**. All the records below go in Hostinger's DNS Zone editor.

### 14.0 Prereqs
- Accept the Resend invite; confirm a role that can manage **Domains / API Keys / Webhooks** (Admin or Developer, not Viewer),
  and that the **paid plan is active** (inbound receiving needs it).
- **Keep the old Resend account live** until cutover so outbound mail doesn't drop.
- **Confirm Hostinger is authoritative for `fixflow.ai`:** hPanel → Domains → `fixflow.ai` → *DNS / Nameservers*. The
  nameservers must be Hostinger's (`ns1.dns-parking.com` / `ns2.dns-parking.com`) for the DNS Zone editor to take effect.
  If they point elsewhere (e.g. Cloudflare), add all records **there** instead — the Hostinger zone is ignored.
- In Hostinger, temporarily set new records' **TTL to 300** (5 min) for fast propagation during the migration; raise back
  to default (14400) once verified.

### 14.1 New account — claim the SENDING domain `send.fixflow.ai` (ownership transfer)

Because `send.fixflow.ai` already exists in the **old** Resend team, adding it in the new team triggers Resend's
**claim / ownership-transfer** flow, not a from-scratch setup. Resend shows the banner *"send.fixflow.ai is in use by
another Resend team. Verifying ownership will transfer the domain to your team and revoke their access."* and asks for a
**single ownership TXT** (`resend-domain-…`). **This is the recommended path** — the existing DKIM/SPF/MX carry over, so
there's **no new DKIM to add and no sending gap**. Do *not* delete the domain from the old account first (that turns it
into a fresh setup with new DKIM keys + a downtime window; see the fallback below).

1. Resend (new team) → **Domains → Add Domain** → `send.fixflow.ai` (same region as prod). The **Claim domain** screen appears.
2. Resend shows one record, e.g. `Type TXT · Name @ · Content resend-domain-…` — **use the exact value shown.**
3. **Hostinger `@` gotcha:** Resend's `Name = @` means *the domain being claimed* (`send.fixflow.ai`), **not** the zone root.
   In Hostinger, add: **Type** `TXT`, **Name/Host** = `send` (Hostinger appends `.fixflow.ai` → `send.fixflow.ai`),
   **Value** = the `resend-domain-…` string, TTL Auto/300. Do **not** enter `@` in Hostinger. Verify with
   `nslookup -type=TXT send.fixflow.ai`.
4. Click **Verify ownership**. On success the domain (with its DKIM/SPF/MX) transfers to your team and the old team loses it.
5. Confirm the domain page now shows **Verified** with DKIM/MX present. Only add missing records if it flags any.
6. **Hand-off (do right after Verify):** once ownership transfers, the **old account's API key can no longer send** from this
   domain. Immediately swap `RESEND_API_KEY` (+ the webhook secrets, §14.5/14.6) to the new account and redeploy. DKIM is
   unchanged, so the cutover is seamless.

**Fallback — only if the claim/transfer won't work** (e.g. can't add the TXT, or you deliberately deleted the domain from
the old account): it becomes a normal fresh setup — Resend generates **new** DKIM keys and you add the full record set in
Hostinger (host prefixes shown; use the exact values from the Resend page):
- **MX** — host `send`, value like `feedback-smtp.us-east-1.amazonses.com`, priority `10`.
- **TXT (SPF)** — host `send`, value `v=spf1 include:amazonses.com ~all`.
- **TXT (DKIM)** — host `resend._domainkey.send`, value the long `p=…` key.
- **TXT (DMARC), optional** — host `_dmarc`, value `v=DMARC1; p=none;` (only if not already at root).
Leave the old DKIM stacked until the new domain verifies (avoids a sending gap), then remove it. Expect brief outbound
downtime while new DKIM propagates.

### 14.2 New account — recreate the RECEIVING domain `reply.fixflow.ai`

⚠️ **Receiving is a SEPARATE toggle from sending — this is the step that's easy to miss.** Adding the domain only
provisions the **sending** records by default (DKIM `resend._domainkey.reply` + SPF on `send.reply` + an MX on
`send.reply` → `feedback-smtp.<region>.amazonses.com`). Those verifying and the domain showing "Verified" means
**sending** works — it does **NOT** mean the domain can receive mail. Inbound needs the Receiving toggle flipped, which
provisions a **different** MX. If you skip it, mail to `…@reply.fixflow.ai` bounces and the webhook never fires (looks
like a silent failure — the domain reads "Verified").

1. Resend → **Domains → Add Domain** → `reply.fixflow.ai`. It sets up as a sending domain (DKIM/SPF/`send.reply` MX).
2. On the domain page, scroll to **"Enable Receiving"** and **toggle it ON**. **The inbound MX host only appears after this
   toggle is on** — there's nothing to add in Hostinger until you flip it.
   - **Permission gate:** the Receiving toggle requires **Admin/Owner** on the Resend account. A **Member cannot** flip it —
     get an admin (management) to enable it or to upgrade your role first.
3. Resend now shows the **receiving MX** — on the bare domain (Name `reply` / `@`), pointing to **Resend's inbound host**
   (e.g. `inbound-smtp.…`), **not** `feedback-smtp`/amazonses. Copy the exact host + priority.
4. In Hostinger add: **Type** MX, **Name** `reply` (the bare `reply`, **NOT** `send.reply`), **Value** = the Resend inbound
   host, **Priority** as shown (usually `10`), **TTL** `300`.
   - **Do not confuse or delete the `send.reply` MX** (`feedback-smtp.<region>.amazonses.com`) — that's the sending
     bounce/return-path record and must stay. The receiving MX is an **additional** record on a different host; they coexist.
5. Verify the receiving MX resolves before testing: `nslookup -type=MX reply.fixflow.ai` must return the **Resend inbound
   host** (not `feedback-smtp`; if it returns nothing, the record is on `send.reply`, not `reply`).
6. Confirm Resend shows **Receiving enabled/verified** for `reply.fixflow.ai`.

### 14.3 Hostinger DNS Zone — how to add each record
1. hPanel → **Domains** → `fixflow.ai` → **DNS / Nameservers** → **DNS records** (DNS Zone editor).
2. **Manage / delete** any stale records first: old Resend/SES **DKIM TXT** and any duplicate **SPF** on `send` (keep only
   one SPF per host). Don't touch unrelated records (website A/CNAME, Google MX on root, etc.).
3. **Add record** for each row from §14.1/§14.2:
   - **Type** = MX / TXT (as specified).
   - **Name/Host** = the prefix only (`send`, `resend._domainkey.send`, `reply`, `_dmarc`; `@` = root).
   - **Points to / Value** = the exact string from Resend (paste long DKIM keys whole).
   - **Priority** = required for MX (e.g. `10`).
   - **TTL** = 300 during migration.
4. Save. Propagation is usually minutes at TTL 300; verify with `nslookup -type=TXT resend._domainkey.send.fixflow.ai`
   and `nslookup -type=MX reply.fixflow.ai` before clicking Verify in Resend.

### 14.4 New account — API key
- Resend → **API Keys → Create** (Sending + Domains, or Full access). Copy once → this is `RESEND_API_KEY`.

### 14.5 New account — recreate BOTH webhooks
- **Webhooks → Add Endpoint** for each:
  - Engagement/events (sent, delivered, bounced, opened): URL `https://<backend-host>/api/ads/webhooks/resend`
    → copy signing secret → `RESEND_WEBHOOK_SECRET`.
  - Inbound (email received): URL `https://<backend-host>/api/ads/webhooks/resend-inbound`
    → copy signing secret → `RESEND_INBOUND_WEBHOOK_SECRET`.
- Two **different** `whsec_…` secrets — do not reuse one for both.
- `<backend-host>` = the DO backend (staging first, e.g. `https://staging-api.repaircoin.ai`).

### 14.6 Env vars (DigitalOcean backend) — rotate/verify all
Set on **staging first**, then prod:
- `RESEND_API_KEY` — new key (§14.4).
- `RESEND_WEBHOOK_SECRET` — new engagement secret (§14.5).
- `RESEND_INBOUND_WEBHOOK_SECRET` — new inbound secret (§14.5).
- `RESEND_FROM_EMAIL` — stays `leads@send.fixflow.ai` (domain Verified in §14.1).
- `RESEND_FROM_NAME` — unchanged.
- `RESEND_REPLY_DOMAIN` — stays `reply.fixflow.ai` (Verified in §14.2).
- `ADS_INBOUND_EMAIL_ENABLED` — keep `false` until the inbound payload is verified against a live delivery (§10/P0);
  flip to `true` after.
- (optional) `ADS_INBOUND_MAX_AUTOANSWERS_PER_HOUR` (default `5`); `ADS_INBOUND_WEBHOOK_TOKEN` only guards the separate
  manual `POST /leads/inbound` test endpoint — not the Resend path.

### 14.7 Deploy + verify (in order)
1. Redeploy/restart the backend so it picks up the new env.
2. **Outbound:** send a test campaign / lead email → confirm it sends from the **new** account (new account → Logs) with a
   clean **DKIM/SPF pass**.
3. **Engagement webhook:** confirm delivered/opened events arrive, no 401s in backend logs (401 = wrong `RESEND_WEBHOOK_SECRET`).
4. **Inbound:** reply to an AI-agent campaign email → confirm the hit on `/resend-inbound` and that `InboundEmailService`
   parsed `from` / `text` / headers correctly (still the unverified P0 — dump one raw payload if fields come back empty).

### 14.8 Decommission the old account
- If you used the **claim/transfer** (§14.1), `send.fixflow.ai` is already off the old team and its DKIM carried over — so
  there's **no old DKIM to prune** and nothing to remove for that domain. Just remove the old **webhooks** (avoid double
  delivery) and **delete the old API key**.
- Remove any **other** domains still on the old team, then close/downgrade the old account.
- Restore Hostinger TTLs to default (14400) once everything is confirmed working.
- **Only in the fallback (fresh-setup) path** do you prune the leftover old DKIM TXT from Hostinger after the new domain
  is confirmed sending.

**DKIM caution (fallback path only):** DKIM tokens are per-account, so a *fresh* `send.fixflow.ai` can't be verified in both
accounts without stacking records — do the DKIM swap in a low-send window and keep the old account sending until the new
domain shows Verified. The claim/transfer path avoids this entirely (same DKIM, no gap).

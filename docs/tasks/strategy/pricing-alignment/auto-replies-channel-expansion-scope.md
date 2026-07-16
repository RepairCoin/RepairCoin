# Scope — AI Auto-Replies: SMS + WhatsApp channel expansion

**Workstream:** extends `auto-replies-business-gate-scope.md`. Delivers the multi-channel half of the
pricing.jpeg Business line **"AI Auto-Replies (Voice + Text)"**.
**Goal:** let the AI auto-respond to a shop's **regular customers over SMS and WhatsApp**, not just the in-app
chat — reusing the same AI engine, gated to Business.
**Status:** ✅ **CODE-COMPLETE (all phases), committed on `deo/ads-system`, 2026-07-16.** Flag-gated (all default
off); live-prod still gated on external steps (per-shop numbers/senders, Twilio KYC, Meta approval, legal sign-off
for consent enforcement). See **Build status** below.

---

## Build status (2026-07-16)

Commits on `deo/ads-system`: `6cb64488a` (P0) · `f97891d52` (P1 SMS) · `ba8180d4d` (P2 WhatsApp) · `4e53b8646`
(P3 cost+consent). Migrations **217–220** applied to staging. Backend `tsc` clean; ~90 unit/integration tests
added; the in-app AI hot path (`handleCustomerMessage`) is untouched (proven by the 850-test AI-agent regression).

**✅ Done in code (all behind flags):**
- **Phase 0 — channel foundation.** `channel` on conversations/messages + `conversation_channel_identities` map.
- **Phase 1 — SMS end-to-end.** Inbound webhook → To→shop → resolve/mint customer + sms conversation → serviceless
  shop-level AI reply (`handleShopLevelMessage`, a NEW sibling method — the service-bound orchestrator is untouched)
  → relay back over SMS. Opt-out honored.
- **Phase 2 — WhatsApp end-to-end.** Same pipeline reused (a wa_id is an E.164 phone); Meta webhook parser +
  free-form 24h-window reply.
- **Phase 3 — cost + consent.** Per-reply cost ledger (AI + estimated carrier) for who-pays economics (D5);
  opt-IN consent recorded on every inbound + enforced-when-flagged (D6).

**⏳ Left — EXTERNAL gates only (not code):**
- **SMS multi-shop (D2):** per-shop Twilio numbers must be provisioned + written into `shop_sms_numbers` (table +
  reader done; the provisioning writer/flow is unbuilt) — management decision A vs B. A shared number can't
  attribute inbound across 2+ shops.
- **Twilio Trust Hub KYC** + A2P 10DLC (US) before real SMS sending at scale.
- **WhatsApp per-shop senders (the WhatsApp "D2"):** today one global number via `WHATSAPP_DEFAULT_SHOP_ID`;
  per-shop WhatsApp Business connect + Meta Business verification is unbuilt.
- **Meta approval:** subscribe the `messages` field on the WhatsApp Business Account; per-shop Page/WABA setup.
- **Legal sign-off** before flipping `ENFORCE_MESSAGING_CONSENT=true`; **carrier-rate calibration** for the ledger.
- **Optional follow-ups:** WhatsApp name enrichment; the `shop_sms_numbers` / `shop_whatsapp_numbers` provisioning
  writers; a cost/consent admin dashboard.

## Environment variables

**New flags introduced by this workstream (all default OFF):**
- `ENABLE_CUSTOMER_SMS` — master switch for customer SMS auto-replies (Phase 1).
- `ENABLE_CUSTOMER_WHATSAPP` — master switch for customer WhatsApp auto-replies (Phase 2).
- `WHATSAPP_DEFAULT_SHOP_ID` — until per-shop senders exist, attributes inbound WhatsApp on the single platform
  number to this shop. Empty ⇒ WhatsApp inbound is skipped.
- `SMS_CARRIER_COST_CENTS` (default `0.79`) / `WHATSAPP_CARRIER_COST_CENTS` (default `0`) — flat per-message carrier
  estimate written to the cost ledger; calibrate to real billing.
- `ENFORCE_MESSAGING_CONSENT` (default `false`) — turns ON consent *enforcement* (recording always happens); flip
  only after legal sign-off. Fails closed when on.

**Existing platform env this feature depends on:**
- SMS transport (Twilio): `TWILIO_SMS_ENABLED=true`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`
  (shared fallback number), optional `TWILIO_WEBHOOK_URL`.
- WhatsApp transport (Meta): `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION`
  (default `v18.0`).
- Meta webhook (WhatsApp inbound rides the existing Meta app webhook): `META_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET`.
- Business-tier gate: `ENFORCE_AI_AUTOREPLY_TIER=true` restricts auto-replies to shops with the `aiAutoReplies`
  (Business) entitlement. Also each shop needs `ai_shop_settings.ai_global_enabled=true`.

**Minimum to smoke-test SMS on one shop (staging):** `ENABLE_CUSTOMER_SMS=true` + `TWILIO_SMS_ENABLED=true` +
Twilio creds/`TWILIO_SMS_FROM` + a `shop_sms_numbers` row (or use the shared number). **WhatsApp:**
`ENABLE_CUSTOMER_WHATSAPP=true` + `WHATSAPP_*` creds + `WHATSAPP_DEFAULT_SHOP_ID` + `META_*` webhook config.

---

## Where we are today

- **In-app auto-reply — DONE** (flag-gated): `MessageService.fireAiAutoReply` → `AgentOrchestrator.
  handleCustomerMessage`, over the `conversations`/`messages` tables. Wallet-keyed, in-app only.
- **Ads-lead SMS/email auto-answer — DONE** (separate system): `AdsDomain/LeadAutoAnswerService` + a Twilio
  inbound webhook. Phone/lead-keyed, campaign-scoped, billed to `ad_ai_costs` (COGS). **Not** for regular
  customers.
- **Regular customers have NO SMS/WhatsApp conversation path.** That's this scope.

## What already exists and is reusable (big head start)

| Piece | Where | Reuse |
|---|---|---|
| **Twilio SMS send** | `services/TwilioService.sendSms()` (env `TWILIO_SMS_FROM`, `TWILIO_SMS_ENABLED`) | as-is |
| **Twilio webhook signature verify** | `TwilioService.verifyWebhookSignature()` | as-is |
| **Global SMS opt-out** | `SmsOptOutRepository` + `sms_opt_outs` (mig 212), `isOptedOut/optOut/optIn`, STOP/START | as-is |
| **Inbound SMS webhook** | `AdsDomain/TwilioWebhookController` (`POST /api/ads/webhooks/twilio`) — routes to **leads** | pattern + extend |
| **Channel routing enum** | `AdsDomain/LeadChannelSender` — `MsgChannel = sms\|whatsapp\|messenger\|email\|manual`, `pickChannel`, `deliver*` | pattern |
| **WhatsApp OUTBOUND** | `services/WhatsAppService` (Meta Graph API) — notifications only, **no inbound** | partial |
| **The AI reply engine** | `AgentOrchestrator.handleCustomerMessage` | reuse (add channel) |
| **Customer phone** | `customers.phone` column (optional, populated from orders/registration) | join in |

**The AI engine is ready.** The work is wiring SMS/WhatsApp as first-class conversation channels alongside
in-app — identity, channel-awareness, inbound routing.

## The core architectural gaps

1. **Identity mismatch (the big one).** `conversations` is keyed by `customer_address` (**wallet**); SMS/
   WhatsApp are keyed by **phone** (E.164). There is **no phone→customer/conversation mapping** for regular
   customers (leads have `findByPhone`; customers don't, on conversations).
2. **No `channel` on customer messages.** `ad_lead_messages` has a `channel` column; the regular `messages`/
   `conversations` tables don't — everything is implicitly in-app. Can't tell where a message came from or
   where to reply.
3. **No inbound router for customer SMS.** The Twilio webhook only resolves **leads** → `LeadAutoAnswerService`.
   Nothing turns an inbound customer SMS into a `conversations` turn + fires the orchestrator.
4. **No inbound WhatsApp at all.** `WhatsAppService` is send-only; there's no Meta WhatsApp webhook receiver.
5. **AI reply isn't channel-aware.** `fireAiAutoReply` always persists an in-app message; nothing sends the
   reply back out over SMS/WhatsApp, or checks opt-out on that send.
6. **Service context.** `handleCustomerMessage` requires a non-null `serviceId` (else it skips). An SMS/
   WhatsApp customer has no service context to anchor on.

---

## Decisions needed before build (sign-off)

- **D1 — Phone ↔ customer identity.** How does an inbound phone resolve to a customer + conversation?
  - (a) Match `customers.phone` → existing customer → their (customer_address, shop) conversation.
  - (b) New `conversation_channel_identities` table (conversation_id ↔ phone/whatsapp_id) — cleaner, mirrors
    the leads model. **Recommended.**
  - Sub-question: an inbound from an **unknown phone** (no matching customer) — create a lightweight
    phone-only "guest" customer/conversation, or drop it? (Recommend: create a guest conversation scoped to
    the shop that owns the receiving number.)
- **D2 — Which shop / which number (the hardest infra decision).** Every SMS carries two numbers: the
  customer's phone (`From`) and the number they texted (`To`). A **single shared `TWILIO_SMS_FROM`** works for
  OUTBOUND (send from shared → customer) but **breaks INBOUND attribution**: every shop's customers text the
  same `To`, so `To` can't identify the shop, and the `From` phone is ambiguous the moment a customer has
  dealt with 2+ shops ("is it ready?" — *which* shop?). A shared number is therefore only safe if we accept
  silent misattribution/drops for multi-shop customers — not acceptable for a paid Business feature.

  **The fix is a per-shop number** (each shop has its own dedicated texting number → the inbound `To` *is* the
  shop → unambiguous, always). Inbound routing becomes a simple `To → shop_id` lookup. Two ways to get one:

  - **Option A — Platform-provisioned.** On enable, FixFlow buys a Twilio number via the API and assigns it to
    the shop (`shop_id ↔ sms_number` mapping). Simplest technically; downside is it's a *new* number customers
    don't recognize.
  - **Option B — BYO ("bring your own"), via hosted SMS.** The shop connects its **existing** business number
    (the one on its receipts/website). Twilio handles **SMS** on it (signed **Letter of Authorization**) while
    the number **stays** with the shop's voice carrier for calls — no porting, voice unaffected. Upside:
    customers text the shop's real, recognizable number → more trust/UX. Downside: the LOA/hosting flow +
    per-shop onboarding.

  Either way FixFlow must build/manage: the `shop_id ↔ sms_number` mapping, a **provisioning step** at enable
  time (buy-number for A / LOA+hosting for B), **A2P 10DLC registration** per number (US carrier compliance —
  which also clears the Trust Hub/KYC currently blocking the account), and `To → shop` inbound routing.

  **A "Letter of Authorization" (LOA)** — the mechanism behind Option B. It's a document the shop **signs**
  authorizing Twilio (via FixFlow) to send/receive SMS on the shop's *existing* number. It proves the shop
  owns/consents (so a number can't be hijacked), and enables **hosted SMS**: the number **stays with the
  shop's voice carrier for calls**, Twilio only handles texting — no porting, phone service untouched. Submit
  the signed LOA → Twilio verifies with the carrier → SMS enabled in a few business days.

  **Fees apply to BOTH A and B (not a cost differentiator).** Roughly (US ballparks — verify current Twilio
  pricing): **per-message SMS** ~$0.008–$0.01+ per segment, **in AND out**; **A2P 10DLC** brand (one-time) +
  campaign (monthly ~$1.50–$10) registration + small carrier pass-through; and a **modest per-number monthly
  fee** (rented number for A / hosted-number fee for B). B skips *buying* a new number but still pays
  messaging + compliance + hosting — so A-vs-B is **UX (recognizable number) vs onboarding effort (LOA), not
  price**. WHO bears these fees is **D5**.

  **RECOMMENDATION:** per-shop numbers, rolled out **on-request / as each shop opts in** (support BOTH A and B
  — let a shop take a provisioned number or bring their own) rather than pre-buying a pool or forcing a shared
  line. This gives correct attribution from day one and keeps upfront number cost + compliance proportional to
  actual adoption. **WhatsApp doesn't have this problem** — a WhatsApp Business sender is inherently per-shop;
  its cost is Meta's per-business verification instead.
- **D3 — Service context (relax the serviceId gate).** SMS/WhatsApp turns have no service. Either bind to the
  customer's **most-recent booking's service**, or allow a **shop-level (serviceless) AI reply** for these
  channels (the orchestrator + prompt would need a serviceless mode). **Recommend:** serviceless shop-level
  mode for off-channel, anchored to recent booking when one exists.
- **D4 — Channel order.** **SMS first** (Twilio send/opt-out/webhook already built — mostly identity +
  routing + channel column). **WhatsApp second** (needs a full Meta inbound webhook + template/24h-window
  rules — higher effort). **Recommended split.**
- **D5 — Cost + WHO pays (management decision).** Each auto-reply has TWO cost streams:
  1. **AI (Anthropic)** — draw on the shop's existing $ AI budget via the soft-landing cap (already built).
  2. **Carrier + compliance (Twilio/Meta)** — the itemized SMS fees from D2: per-message (in & out), A2P 10DLC
     brand + campaign (monthly), carrier pass-through, and the per-number monthly/hosting fee. WhatsApp has its
     own per-conversation pricing + Meta verification.

  The open question is **who shoulders stream #2**: bundle it into the Business plan (FixFlow eats it), pass it
  through to the shop (per-number + per-message billing / Stripe), or cap it (e.g. N free auto-reply texts/mo
  then overage). This is a **pricing/margin decision for management** — captured in the separate decision brief
  `auto-replies-sms-cost-decision.md`. Track spend via a `customer_ai_costs` ledger (or shop-budget tag) so the
  chosen model is enforceable.
- **D6 — Consent / compliance (legal, blocking for prod).** SMS/WhatsApp **auto-replies to customers require
  prior opt-in consent** (TCPA / WhatsApp 24-hour session + template rules). `sms_opt_outs` handles opt-OUT,
  but **opt-IN consent capture** doesn't exist. WhatsApp business-initiated messaging is template-gated.
  **Needs legal sign-off + a consent-capture flow** before enabling.

---

## Proposed phased plan (Business-gated, flag-gated)

### Phase 0 — Channel foundation (shared by SMS + WhatsApp)
- Migration: add `channel TEXT DEFAULT 'app'` to `messages` (+ `conversations`), values `app|sms|whatsapp`.
- `conversation_channel_identities` table (D1b): conversation_id ↔ external id (phone / whatsapp_id) + channel.
- Thread `channel` through `MessageService.sendMessage` + the `Message`/`Conversation` maps.

### Phase 1 — SMS (reuses the most)
- **Inbound:** extend `TwilioWebhookController` (or a new `/api/messages/webhooks/twilio`): after the existing
  lead lookup misses, resolve the phone → customer/conversation (D1), create the turn via
  `MessageService.sendMessage({ channel:'sms' })`, which fires the orchestrator.
- **Outbound:** make `fireAiAutoReply` channel-aware — when the conversation channel is `sms`, send the AI
  reply via `TwilioService.sendSms` **after the `sms_opt_outs` check**, and stamp the message `channel='sms'`.
- **Gate:** `requireTier`/`shopHasFeature('aiAutoReplies')` (Business) + `ENFORCE_AI_AUTOREPLY_TIER` + a new
  `ENABLE_CUSTOMER_SMS` flag (default off).
- **Service context:** D3 (serviceless shop-level reply, anchored to recent booking).

### Phase 2 — WhatsApp
- **Inbound webhook:** build the Meta WhatsApp webhook receiver (`/api/messages/webhooks/whatsapp`) —
  verification handshake + inbound message parse → same conversation-resolve → orchestrator.
- **Outbound:** wire `WhatsAppService` send into the channel-aware `fireAiAutoReply` (respect the 24-hour
  session window + template rules for business-initiated messages).
- **Gate:** same Business gate + `ENABLE_CUSTOMER_WHATSAPP` flag.

### Phase 3 — Cost + consent
- `customer_ai_costs` ledger (or shop-budget tagging) per D5.
- Consent-capture flow + enforcement per D6 (blocks prod enablement).

---

## Gating (Business)
- All customer SMS/WhatsApp auto-reply paths gate on `shopHasFeature(shopId, 'aiAutoReplies')` (Business) —
  the same key the in-app auto-reply uses. Behind per-channel enable flags, default off, so it's a deliberate
  rollout (and consent-gated per D6).

## Testing
- Deterministic Twilio testing per the existing pattern (monkeypatch the `twilioService` singleton, fake
  repos, `encryptToken('fake')`); unit-test the phone→conversation resolver + channel-aware `fireAiAutoReply`
  (opt-out respected, correct channel stamped). Live SMS/WhatsApp is externally gated (Trust Hub / Meta).

## Rough effort
- Phase 0: **S–M** · Phase 1 (SMS): **M** · Phase 2 (WhatsApp): **L** (Meta inbound + template rules) ·
  Phase 3 (cost+consent): **M** + legal. Total ≈ a **multi-week** feature — materially bigger than the
  shipped in-app auto-reply.

## Open decisions (blocking)
- **D2 (per-shop number)** — the hardest; a shared `TWILIO_SMS_FROM` can't attribute inbound once a customer
  uses 2+ shops. **Recommendation = per-shop numbers, on-request**, supporting BOTH **Option A**
  (platform-provisioned Twilio number) and **Option B** (BYO / hosted SMS on the shop's existing number). Each
  needs A2P 10DLC registration; WhatsApp is per-shop by nature. Confirm the recommendation + who bears the
  number cost.
- **D6 (consent + WhatsApp templates)** — legal sign-off is a prerequisite for prod.
- **D1 / D3 / D5** — recommendations above; confirm.
- Twilio account is still **Trust Hub / KYC gated** (from the SMS integration work) — external blocker for
  live sending regardless of code.

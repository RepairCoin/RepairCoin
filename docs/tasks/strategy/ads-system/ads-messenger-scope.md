# Ads — Messenger channel (click-to-Messenger + AI in Messenger)

Extend the AI lead-engagement loop (auto-initiate → auto-answer → take-over → escalation, all proven on email)
to **Facebook Messenger** — the "narrative moat": a click-to-Messenger ad opens a thread with the shop's Page, the AI
greets + answers, the shop takes over when needed. This is the highest-value channel because it's native to Meta ads
(no email/phone required) and the conversation lives where the click happens.

## What already exists (reuse — don't rebuild)
- **Page connection + token.** `MetaConnectionRepository` stores `pageId` + encrypted `pageTokenEnc` per shop
  (`saveSelection`), populated during the Meta connect flow. The Send API needs exactly this.
- **Signed page webhook.** `MetaWebhookController` at `POST /api/ads/webhooks/meta/leads` already does Meta's GET
  verification (`hub.challenge` + `META_WEBHOOK_VERIFY_TOKEN`) and `X-Hub-Signature-256` verification for **leadgen**.
  Messenger `messaging` events arrive on the **same** page-subscribed webhook → we extend this controller.
- **Channel model.** `ad_leads.messenger_id`, `LeadChannelSender.pickChannel` → `'messenger'`, and `hasChatChannel` are
  already there; `deliver()` currently returns `queued` for messenger (no provider wired).
- **The whole AI loop** — `LeadAutoAnswerService.handleInbound`, take-over (`ai_paused`), escalation — is channel-agnostic;
  it just needs inbound messages routed in and a working outbound `deliver`.
- **Graph client** — `MetaService` (`GRAPH` base + axios) for the Send API call.

## The gate (be honest)
- **App Review — `pages_messaging`.** Sending to **real** (non-app-role) users needs Meta App Review. Until approved,
  the Send API only works to people with a **role on the app** (admins/developers/testers). So we can **build + test the
  full plumbing now** with a test user, but live rollout waits on review. (Same shape as the existing `leads_retrieval`
  gate.) Flag everything behind `ADS_MESSENGER_ENABLED` (default off).
- **24-hour standard messaging window.** You may message a user freely only within 24h of their last message. Outside it,
  only tagged/OTN messages. v1: AI answers within the window (the normal case); flag/skip out-of-window sends.

## Phase 1 — the conversation loop (build now, testable with a test user)
1. **`MessengerService.send(pageId, pageToken, recipientPsid, text)`** → `POST {GRAPH}/{pageId}/messages`
   (`recipient:{id:psid}`, `messaging_type:'RESPONSE'`, `message:{text}`). Returns delivery status; maps Graph errors.
2. **`LeadChannelSender.deliverMessenger`** — resolve the lead's shop → `MetaConnection` (pageId + decrypted pageToken),
   recipient PSID = `lead.messengerId`; call `MessengerService.send`. Wire into `deliver('messenger', …)`.
3. **Inbound messaging** — `parseMessagingEvents(payload)` (pure) → `[{ pageId, senderPsid, text, mid, refAdId }]`;
   `receiveMetaWebhook` also loops these:
   - Resolve the **existing** lead by `messenger_id = senderPsid`.
   - If none, it's a **new** conversation (a CTM click) → resolve shop by `pageId`
     (`MetaConnectionRepository.getShopIdByPageId`), attach to the referral ad's campaign (`refAdId`) or the shop's active
     messenger campaign, create the lead with `messenger_id = psid`, consent implied (they messaged first).
   - Route to `handleInbound(leadId, text, 'messenger')` — the AI answers (or stays silent if `ai_paused`), escalation
     applies, exactly like email.
4. **Dedupe** on the message `mid` (reuse the `external_id` idempotency on `ad_lead_messages`).
5. Behind `ADS_MESSENGER_ENABLED`.

## Phase 2 — acquisition (the ad side)
- **Messages objective** — a click-to-Messenger campaign flavor in the builder/`MetaPushService`
  (`OUTCOME_ENGAGEMENT` + `messenger` destination / `CTWA`-style), so new ads open Messenger instead of the landing page.
- **Welcome / ice-breakers** — the Page's greeting + the AI's first message when a thread opens.
- **Auto-initiation over Messenger** — extend `LeadInitiationService` to fire on a new Messenger lead (first AI message),
  not just email.

## Phase 3 — polish
- 24h-window handling (message tags / OTN for follow-ups), delivery/read receipts into the Activity timeline,
  per-shop enable + App-Review status surfaced in the UI.

## Data
- Reuse `ad_leads.messenger_id` (PSID). New: `MetaConnectionRepository.getShopIdByPageId(pageId)`. No new tables in P1.

## Decisions
1. **New-PSID campaign mapping** — use the CTM referral `ad_id` when present (recommended), else the shop's most-recent
   active messenger campaign, else a per-shop "Messenger" catch-all campaign.
2. **Consent** — a user messaging the Page first = implied consent (recommended); no extra opt-in in P1.
3. **Out-of-window sends** — skip + flag in P1 (recommended) vs. buy message tags. Revisit with volume.

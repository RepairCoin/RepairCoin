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

## Phase 2 — acquisition: the click-to-Messenger (CTM) ad objective

**Status: BUILT** (unit-tested; live delivery App-Review-gated). `metaTargeting` adds `OUTCOME_ENGAGEMENT`
(→ `CONVERSATIONS` optimization + a `messagingDestination` flag; goal `'messages'` maps to it); `MetaService.createAdSet`
sets `destination_type: MESSENGER` + promoted page; `createAdCreative` uses a `MESSAGE_PAGE` CTA with **no** landing link;
`MetaPushService` threads both flags; the DraftComposer objective picker's "Messages (Messenger)" option is enabled with an
objective-aware hint. Test `AdsMessengerObjective` (6) asserts the spec + the ad-set/creative bodies. Push still creates
**PAUSED** objects (reviewable in Ads Manager before App Review clears).

Goal: a shop can run a **"Messages"** campaign whose ads open a **Messenger thread with the shop's Page** (instead of the
landing page), so the click lands the person straight into the AI conversation (Phase 1 handles the rest). Everything is
already scaffolded — the objective picker even shows `OUTCOME_ENGAGEMENT: "Messages (Messenger)"` in `DraftComposer` — so
this is wiring, not greenfield.

### What Meta requires for a CTM ad (vs. our current link/lead flow)
- **Campaign objective:** `OUTCOME_ENGAGEMENT` (the "Messages" objective).
- **Ad set:** `optimization_goal: 'CONVERSATIONS'`, `destination_type: 'MESSENGER'`, `promoted_object: { page_id }`.
- **Ad creative:** an `object_story_spec` with a `MESSAGE_PAGE`-style CTA (`call_to_action` type `MESSAGE_PAGE`), linking to
  the Page's Messenger — **no landing URL**. (Contrast: today's creative uses a website link / lead form.)

### Code changes (grounded in the current build path)
1. **`metaTargeting.ts`**
   - Add `OUTCOME_ENGAGEMENT` to the `MetaObjective` union + `validateObjective` (so the picker value is accepted).
   - `objectiveForGoal`: map a new brief goal `'messages'` → `OUTCOME_ENGAGEMENT`.
   - `optimizationForObjective('OUTCOME_ENGAGEMENT')` → `{ optimizationGoal: 'CONVERSATIONS', billingEvent: 'IMPRESSIONS' }`.
   - Extend `CampaignSpec` with a `messagingDestination?: boolean` (or derive from objective) so downstream knows this is CTM.
2. **`MetaService.createAdSet`** — when the objective is `OUTCOME_ENGAGEMENT`: set `destination_type = 'MESSENGER'` and
   `promoted_object = { page_id }` (we already have `promotedPageId`). Skip the pixel/lead-form branches.
3. **`MetaService.createAdCreative`** — a Messenger variant: build `object_story_spec.link_data` with
   `call_to_action: { type: 'MESSAGE_PAGE', value: { app_destination: 'MESSENGER' } }` and the page, **no `link` landing
   URL**. (New `opts.messaging` flag selects this shape.)
4. **`MetaPushService`** — when `spec.objective === 'OUTCOME_ENGAGEMENT'`: skip the landing-URL/lead-form logic, pass the
   messaging flags to `createAdSet`/`createAdCreative`. The creative copy (headline/primary text) still comes from
   `AdCreativeService`.
5. **Frontend** — enable the "Messages (Messenger)" option in the objective picker (it's already labeled); in review/preview,
   state "this ad opens Messenger — no landing page," and hide the landing-page bits for this objective.

### Welcome experience
- **Ice-breakers / greeting** — optionally set the Page's Messenger greeting + persistent menu via the Messenger Profile
  API so the thread has a warm first frame before the customer types. (Nice-to-have; the AI answers on first inbound anyway.)
- **Auto-initiation is NOT needed for CTM** — the customer messages first (they clicked → opened Messenger → typed), so
  Phase 1's inbound path already greets them. (`LeadInitiationService` stays email/first-outreach-only.)

### Testing & gates
- Unit-test the spec/adset/creative shape (dry-run body assertions, like the existing Meta push tests) — buildable now.
- **Live** needs: `pages_messaging` App Review, a connected Page, `ADS_MESSENGER_ENABLED`, and Meta approving CTM delivery
  on the account. Push creates the objects **PAUSED** (existing prepare→push→go-live flow), so it's safe to build + eyeball
  the created objects in Ads Manager before review completes.

### Effort
~1–1.5 dev-days for the objective/adset/creative wiring + FE picker + unit tests. The Messenger Profile greeting is a small
add-on. All behind the existing review-gate + `ADS_MESSENGER_ENABLED`.

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

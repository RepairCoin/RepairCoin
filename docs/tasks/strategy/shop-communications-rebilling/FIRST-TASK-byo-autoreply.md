# FIRST TASK — BYO number connect + turn on SMS/WhatsApp auto-reply

**One-line goal:** let a shop connect its **own** Twilio number (BYO), so the **already-built** SMS/WhatsApp
AI auto-reply answers customers on it — with **no rebilling, no wallet, no markup.**

This is the single next task. It is *not* the phone system (buying numbers + taking a cut) — that's the later
"managed" phase. This just gives auto-reply the one thing it's missing: a number attached to the shop.

---

## The mental model (hold this)

- **Number connection (BYO)** = the small foundation → *this task.*
- **AI auto-reply (SMS + WhatsApp)** = the feature on top → *already coded; BYO switches it on.*
- **Rebilling (buy-through-us, wallet, "the cut")** = the money layer → *later, separate task (management's Phase 2).*

**Does auto-reply need a phone number? Yes — you can't answer a text without one.
Does it need the phone *system*? No — BYO gives it the number without any billing machinery.**

---

## What already exists (do NOT rebuild)

- **Auto-reply engine — code-complete**, behind flags, migrations 217–220 on `deo/ads-system`. Scope:
  `pricing-alignment/auto-replies-channel-expansion-scope.md`.
  - Inbound SMS webhook → `To`→shop → resolve/mint customer → serviceless AI reply
    (`AgentOrchestrator.handleShopLevelMessage`, a sibling of the in-app hot path) → relay back over SMS.
  - WhatsApp: same pipeline (Meta webhook, 24h-window reply).
  - Opt-out honored; per-reply cost ledger; consent recorded on every inbound.
- **Number registry — table + reader + WRITER all built.** `shop_sms_numbers` (mig 218),
  `ShopSmsNumberRepository.assign()` / `.getActiveForShop()` / `.findShopIdByNumber()`, and
  `SmsNumberService.resolveOutboundFrom()` / `.findShopIdByInboundNumber()`. The `provisioning_mode` column
  already distinguishes `'platform'` (managed, later) from `'byo'` (this task).
- **The in-app AI auto-reply** (customer messages inside the app) is already LIVE and untouched by any of this.

So the reply logic, the routing, and the number storage all exist. **What's missing is only the shop-facing
flow that puts a BYO number into the registry, and flipping the flags on.**

---

## Step 0 — prove it works TODAY (manual pilot, no UI)

There's already a real, active, non-trial Twilio account with a live **toll-free** number
(+1 888 471-5544; SMS/MMS/Voice). You can demonstrate the whole auto-reply pipeline before building any UI:

1. In the Twilio console, point the number's **inbound messaging webhook** at our existing
   `TwilioWebhookController` ("Set up" next to Messaging configuration).
2. **Manually assign** the number to a pilot shop — call `ShopSmsNumberRepository.assign(shopId, '+18884715544',
   'byo')` or a direct row insert.
3. Set `ENABLE_CUSTOMER_SMS=true` (+ wire `.env` with the real account creds; `TWILIO_SMS_ENABLED=false` today)
   and handle consent for the test customer.
4. **Text the number → get a real AI reply.**

This proves the pipeline end-to-end on real hardware. It is an **internal pilot only** — see prerequisites
below before any real customer traffic. The steps in "What to build" below simply productize step 2 (let a
shop do the assign itself, with its own number).

---

## What to build (the small delta)

1. **BYO connect flow (backend + UI).** In Settings → Phone: shop enters its own Twilio number (+ the creds/
   subaccount needed to send on it), FixFlow validates it can send/receive, then calls
   `ShopSmsNumberRepository.assign(shopId, number, mode='byo')`. Point the shop's Twilio number's
   inbound webhook at our existing `TwilioWebhookController`.
2. **WhatsApp BYO connect** (if WhatsApp is in this task): shop connects its own WhatsApp Business sender;
   today there's only one global sender via `WHATSAPP_DEFAULT_SHOP_ID`. (SMS-first is fine — WhatsApp can be a
   fast follow.)
3. **Consent capture (⚙️ from D4 4d)** — the opt-IN flow legal defines. Wire it before enabling for real
   customers; enforcement flag is `ENFORCE_MESSAGING_CONSENT`.
4. **Flip the flags** once the above + prerequisites are ready: `ENABLE_CUSTOMER_SMS=true`
   (`ENABLE_CUSTOMER_WHATSAPP=true` for WhatsApp). Both default `false` today.

That's it. No wallet, no rate card, no markup, no marketplace — those are the later managed phase.

---

## External prerequisites (block REAL-CUSTOMER go-live, not the build or internal pilot)

The Twilio account is real and active (non-trial) with a live toll-free number, so **build + internal pilot
are unblocked today.** These gate turning it on for *real customers* — start them now, in parallel:

- **AI-consent legal sign-off (D4 4c + 4d).** The universal prerequisite — gates BYO *and* managed. Defines
  what valid consent is, the recording/AI-assisted disclosure, opt-out/DNC/time-of-day rules. See
  `shop-communications-rebilling/scope.md` §D4.
- **Toll-Free Verification.** The live number (+1 888…) is toll-free, so it uses **TF Verification, NOT A2P
  10DLC.** Unverified TF sends for internal testing, but carriers throttle/block unverified A2P toll-free at
  volume — verify before real customer traffic. Days of lead time; start now. (Local per-shop numbers under
  BYO would each need their own A2P 10DLC on the shop's account instead — D4 4f.)
- **`.env` wiring.** `TWILIO_SMS_ENABLED=false` and creds not yet set in the real env — a config step.

**BYO deliberately sheds the telecom-reseller / USF / state-telecom-tax burden (D4 4a)** — that only applies
to the managed phase. That's the whole reason BYO ships first.

---

## Explicitly OUT of scope for this task (it's the later managed phase)

- Buying a number *through* FixFlow / Twilio subaccounts under FixFlow.
- Prepaid wallet, auto-reload, rate card, markup engine, usage metering for the cut.
- Number marketplace UI.
- AI **voice** calling (that's Phase 3, greenfield).

Revenue on this task = **subscription + the metered AI layer** (the AI usage already draws on the shop's AI
budget/overage). No telecom cut — by design.

---

## Definition of done

- A pilot shop connects its own Twilio number in the UI; a real inbound text gets an AI reply on that number.
- Consent is captured on inbound and the opt-out path works.
- Flags on for pilot shops only; in-app auto-reply and the 850-test AI hot path unaffected.
- Cost ledger shows AI + carrier estimate per reply.

## Source docs (don't re-read all five — these are the two that matter here)

- Auto-reply build detail: `pricing-alignment/auto-replies-channel-expansion-scope.md`
- Legal / phasing / BYO context: `shop-communications-rebilling/scope.md` (D4, D7, Phase 1)

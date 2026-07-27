# Scope — Shop Communications Rebilling (SMS + AI Calling, GoHighLevel-style)

Management ask: let a shop owner **buy their own number through Twilio**, then FixFlow **takes a margin on
every text message and AI phone call** that number sends/receives — the GoHighLevel "rebilling" model.

This is a new **product line**, not a feature. It turns FixFlow into a reseller of Twilio capacity with a
markup. Two revenue surfaces: **SMS** (mostly wiring what exists) and **AI voice calling** (largely
greenfield). Related: `pricing-alignment/auto-replies-channel-expansion-scope.md` (the per-shop-number
groundwork), `pricing-alignment/auto-replies-sms-cost-decision.md` (who-pays framing).

---

## What GoHighLevel actually does (the model we're copying)

- The shop connects/buys a phone number inside the platform.
- The platform resells Twilio: it charges the shop **more** than Twilio charges the platform — a markup on
  every segment sent/received and every call minute.
- The shop **pre-pays into a wallet**; usage draws the balance down at the marked-up rate; auto-reload tops
  it up. The spread (marked-up rate − Twilio cost) is the platform's margin.
- Number rental, A2P registration fees, and per-use are all billed to the shop.

So the deliverable is: **number provisioning + usage metering + a marked-up wallet/billing engine + (new)
AI voice calling**, on top of the SMS transport we already have.

---

## What already exists (large head start on SMS, none on voice)

**Reuse — SMS side is ~70% there:**
- `shop_sms_numbers` (migration 218) + `SmsNumberService` — the per-shop number registry, already built to
  support **both** platform-provisioned (Option A) and BYO/hosted (Option B). It's the seam the whole thing
  plugs into.
- `TwilioService` — outbound SMS transport (REST + Basic auth, no SDK), delivery-status callbacks.
- `TwilioWebhookController` — inbound SMS routing.
- `LeadAutoAnswerService` — brand-voiced, multi-turn, spend-capped AI auto-answer **over text**. The AI
  conversation brain for calls can reuse this shape.

**Reuse — the "take a cut" mechanism already exists in another form:**
- `platformCommission.ts` + `StripeService` take a platform margin today via Stripe
  `application_fee_amount` on booking charges, **tier-based, with free shops charged more**. That is exactly
  the markup pattern management wants, applied to a different event. The billing primitive is proven.
- `AiOverageChargeRepository` + `SpendCapEnforcer` + the AI cost-ledger — a working usage-metering +
  monthly-charge precedent (currently post-pay, at cost, no markup).
- `StripeConnectService` — Connect accounts + application fees, already onboarding shops.

**Greenfield — nothing exists:**
- **Shop-facing number PURCHASE flow.** The registry stores a number; nothing lets a shop *search available
  numbers, buy one, and pay the rental*. This is the "acquire their number" ask.
- **Marked-up usage billing + wallet.** No credits/wallet/prepaid-balance table exists. AI overage is
  post-pay at cost — it does not mark up, and it does not pre-pay.
- **AI VOICE CALLING — entirely new.** No Twilio Voice, no TwiML, no in-call speech-to-text / text-to-speech,
  no AI phone agent, no per-minute metering. `LeadAutoAnswerService` is text only. This is the large,
  expensive, high-risk half of the ask.
- **A2P 10DLC registration** per number (US carrier compliance) — the same external gate the SMS scope
  already flagged.

---

## The core new pieces

1. **Number marketplace** — search Twilio's available-numbers API by area code, show price, buy on click,
   write the row into `shop_sms_numbers`, start the rental billing. (BYO path = the existing LOA/hosted flow.)
2. **Rate card + markup engine** — the platform's sell price per SMS segment, per inbound/outbound, per call
   minute, per number/month. `sell = twilio_cost × (1 + margin)` or a flat per-unit price. Must be
   configurable and auditable (a shop will dispute a bill).
3. **Usage meter** — every message and call minute recorded with Twilio's actual cost AND the marked-up
   charge, per shop, idempotent on Twilio's SID (the same discipline the AI cost-ledger uses).
4. **Wallet / billing** — either a **prepaid wallet** (GHL's model: balance table, draw-down, auto-reload via
   Stripe, block at zero) or **post-pay metered Stripe billing** (usage records → monthly invoice). Prepaid
   protects margin against fraud/chargebacks; post-pay is less friction. This is the central product decision.
5. **AI voice calling** — the greenfield build: Twilio Voice number config → inbound call hits a TwiML
   webhook → stream audio → STT → the `LeadAutoAnswerService`-style brain → TTS back → per-minute metered.
   Outbound AI calls (reminders, follow-ups) are a further step. Realistically its own multi-phase project.

---

## Decisions

**LOCKED (management, 2026-07-23):**

- **D1 — Margin model → FLAT published rate card.** A flat per-unit sell price (e.g. "2¢/text,
  15¢/AI-call-minute, $2/number/month"), not a percentage markup. Simpler to communicate, hides our
  wholesale cost, and the margin is the flat price minus Twilio's rate. (The metering must still store
  Twilio's actual cost per event so the spread stays reportable and disputes are auditable.)
- **D2 — Billing → PREPAID WALLET + auto-reload.** Balance table per shop, usage draws it down at the D1
  rate, Stripe auto-reload on a low-balance threshold, outbound blocked at zero (inbound still received).
  Chosen over post-pay metering because usage-based reselling carries fraud + chargeback + margin risk, and
  a wallet gives a clean "out of credit" stop instead of a surprise invoice.
- **D3 — Account of record → FIXFLOW master Twilio + one SUBACCOUNT per shop.** Every managed number lives in
  a shop-specific subaccount under FixFlow's account, so all usage flows through accounts FixFlow owns and can
  meter + mark up. This is the only structure that earns the cut; it also means FixFlow carries the aggregate
  Twilio bill, telecom liability, and per-subaccount A2P — which is what D4 must clear. BYO remains the
  no-margin alternative (D7).

**STILL OPEN (blocking go-live, not the build):**

- **D4 — Regulatory reality. THE go-live gate.** Because FixFlow becomes the account of record and marks up
  usage (D3), it may be classified as a telecom reseller. This needs real telecom counsel — the checklist
  below is what to hand a lawyer, not legal advice. **Four items become engineering tasks** once answered
  (flagged ⚙️); the rest are legal/finance and don't block the Phase 2 wallet build but DO block flipping it
  on — and the tax items feed back into the D1 rate card. (Note 4f below: BYO in Phase 1 sheds the 4a
  reseller/tax block entirely — 4a is a Phase-2 concern only.)

  **4a — Reseller status, registration & tax** (can reshape the margin math):
  - FCC registration — whether FixFlow must file (Form 499-A/499-Q) and obtain an FRN/499 ID.
  - **Universal Service Fund (USF)** — reselling interstate telecom can trigger a %-of-revenue contribution.
  - **State telecom taxes + per-line E911 fees** — taxed differently than SaaS; likely collect + remit on the
    marked-up charge.
  - Sales-tax treatment — the usage line item may be taxable where the subscription isn't.
  - *These eat into the spread, so set the D1 rate card AFTER this is known.*

  **4b — Messaging compliance (A2P 10DLC):**
  - Brand + campaign registration per shop with The Campaign Registry.
  - **Who is the "brand"** — FixFlow as CSP/ISV filing on behalf of shops (fits the subaccount model) vs each
    shop self-registering. Determines the ⚙️ onboarding flow built in Phase 2.
  - Carrier campaign fees + per-campaign throughput limits.

  **4c — Calling compliance (strictest; why voice is later):**
  - TCPA consent — marketing calls/texts need prior express consent; autodialed/prerecorded marketing calls
    need prior express **written** consent.
  - **AI voice = "artificial/prerecorded voice" under the FCC's Feb-2024 ruling** → outbound AI marketing
    calls need written consent. This is why Phase 4 (outbound AI) is last and Phase 3 is inbound-only
    (inbound = customer called you, consent implicit).
  - STIR/SHAKEN caller-ID authentication for outbound voice.
  - ⚙️ **Call-recording / transcript consent** — 11 states require all-party consent, so the AI must announce
    "recorded / AI-assisted" at call start.
  - ⚙️ **Time-of-day + DNC** — no calls/texts before 8am / after 9pm local; honor the National DNC list for
    marketing.

  **4d — ⚙️ Consent capture (legal defines, we build):** `sms_opt_outs` handles opt-OUT; opt-IN capture
  doesn't exist. Legal specifies what counts as valid consent (wording, checkbox vs written, per-channel);
  engineering builds capture + proof-of-consent storage. Nothing marketing-facing ships without it.

  **4e — Liability, terms & money:**
  - ToS pushing sending obligations to the shop + indemnification — as account of record, **FixFlow carries
    carrier liability if a shop spams** (a shop can get FixFlow's Twilio account flagged).
  - Contractual + ⚙️ technical right to **suspend a shop's subaccount** for abuse.
  - Prepaid wallet — confirm closed-loop credits for FixFlow's own service aren't money transmission (Stripe
    moves the actual funds). Likely fine; one-line check.

  ### 4f — BYO legal profile (the shop uses its OWN Twilio)

  The load-bearing principle: **BYO sheds FixFlow's *telecom* exposure but NOT its *AI* exposure — because the
  risky part was never the pipe, it's the AI, and the AI is FixFlow's on both models.** So BYO's requirements
  are a strict subset of managed, split by who owns each:

  **On the shop (they are Twilio's customer / account of record):**
  - ⚙️→their side: **A2P 10DLC brand + campaign on THEIR Twilio account** (SMS won't deliver otherwise) — the
    shop is the registrant, not FixFlow. (Facilitation UI optional; not FixFlow's legal obligation.)
  - Their own Twilio ToS + acceptable-use.
  - As a business texting its own customers on its own account, the shop is **not a reseller** either — so no
    USF / FCC-499 / telecom-tax lands on anyone. That whole category (4a) simply does not exist in BYO.

  **Still FixFlow's, because FixFlow provides the AI + the automated sending system** (identical to managed —
  platform TCPA liability follows whoever provides the autodialer/AI-voice, not the account of record):
  - ⚙️ Opt-in **consent capture** (4d) — before the AI texts/calls.
  - ⚙️ **Opt-out / STOP + National DNC + time-of-day** gating (4c).
  - ⚙️ **Recording / "AI-assisted" disclosure** (4c) — FixFlow's system records regardless of whose number.
  - TCPA + FCC-Feb-2024 AI-voice written-consent rules (4c) for outbound AI calls.
  - ToS + indemnification (4e) — reframed from "protect FixFlow's Twilio account" to "protect FixFlow from
    having provided a tool used non-compliantly"; plus the right to suspend the shop's AI access for abuse.

  **What BYO removes from FixFlow:** the entire 4a block (reseller status, USF, FCC-499, state telecom tax,
  E911, account-of-record carrier liability). Gone — FixFlow isn't the telecom provider on BYO.

  **Consequence for sequencing:** the AI-consent items (⚙️ 4c + 4d) gate **both** managed and BYO — they are
  the true universal prerequisite. Legal should answer 4c/4d **first**; the reseller question (4a) only
  matters for the managed path. Neither BYO nor managed ships until 4c/4d clear. See D7 / `user-stories`
  Story 5b for the matching BYO *revenue* picture (transport = shop's, intelligence = FixFlow's — the durable
  margin AND the durable liability both sit on the AI).
- **D5 — Tier / entitlement.** Is this a Business-tier feature, an add-on any tier can buy, or usage-only with
  no plan gate? Ties into the pricing sheet.
- **D6 — AI calling scope for v1.** Inbound-only (customer calls the shop's number, AI answers) is far simpler
  than outbound AI calls (we dial the customer — much heavier TCPA/consent exposure). *Recommend inbound-only
  first, if voice is in v1 at all.*
- **D7 — BYO revenue + the transport/intelligence split.** On BYO the shop uses its own Twilio, so there is no
  telecom margin. But the **AI layer is FixFlow's regardless of whose number carries the message** — the
  transport (segment/minute) is the shop's, the intelligence (the AI drafting/talking) is FixFlow's and is
  metered through the existing AI budget/overage. Decision: **(a) meter the AI layer independently of
  transport** so BYO shops still pay for the AI they consume, and **(b) gate BYO behind a higher tier**
  (recommend Business) so it's a deliberate power-user choice, not the default everyone picks to dodge the
  markup. Optionally a flat per-number management fee on BYO. *Recommend both (a) and (b).* This makes the AI
  the durable margin (transport is a commodity; the agent isn't) and turns BYO into a retention lever rather
  than a revenue hole. See `user-stories-and-flows.md` Story 5b.

---

## Phased plan (management numbering, 2026-07-23)

**The rebilling / "we take a cut" work is deferred to Phase 2 so AI features reach production fast on BYO
first.** BYO carries no telecom-reseller/tax burden (4a), so it ships as soon as the shared prerequisites
(AI-consent legal 4c/4d + a verified Twilio account) clear — no wallet, no markup, no marketplace needed.

- **Phase 0 — Shared prerequisites (start now, external lead time).** AI-consent legal review (⚙️ 4c + 4d —
  gates BYO **and** managed) + Twilio account verification (Trust Hub KYC + A2P). These block *both* phases;
  kick them off the same day. The reseller/tax review (4a) is Phase-2-only and can start later.
- **Phase 1 — BYO + auto-reply/AI live (the fast path).** Shop connects its **own** Twilio number to FixFlow;
  auto-reply (already code-complete, migs 217–220) and the AI answer texts/calls on it. **Revenue = plan
  subscription + the metered AI layer** (D7) — no telecom cut, and no telecom-reseller legal (4f). Build left
  is small: the BYO connect flow + the ⚙️ consent-capture / opt-out+DNC / recording-disclosure items as legal
  lands them. **This is what gets AI messaging to production quickly.**
- **Phase 2 — Managed rebilling (buy a number through FixFlow), BYO stays available.** Add the option for a
  shop to **buy a number via FixFlow as a subaccount** (D3) → FixFlow takes the cut: flat rate card + markup
  engine (D1), usage meter (Twilio cost + marked-up charge per SID), **prepaid wallet + Stripe auto-reload
  (D2)**, number marketplace, and ⚙️ 4b A2P automation. BYO remains as the no-cut alternative alongside it
  (GHL's dual model). **This is the phase that needs the 4a telecom-reseller/tax review.**
- **Phase 3 — AI voice calling (inbound).** Greenfield: TwiML, in-call STT/TTS, the AI phone agent reusing the
  LeadAutoAnswer brain, per-minute metering, the ⚙️ "recorded / AI-assisted" disclosure (4c), STIR/SHAKEN.
  Works on either a BYO or a managed number. Its own project.
- **Phase 4 — Outbound AI calls.** Reminders / win-back by AI voice. Highest TCPA exposure — last, only after
  D4 explicitly clears it.

**Phase 1 delivers "AI answers customers over text, on the shop's own number" with zero telecom-reseller
legal.** Phase 2 adds the "buy through us and we take a cut" monetization on top, and is the one that carries
the reseller/tax burden. AI voice (Phase 3+) is a separate, larger investment — not a quick add-on to SMS.

---

## Effort (very rough, pending D-decisions)

Phase 0 — external (legal weeks, Twilio KYC/A2P days–weeks). Phase 1 BYO+auto-reply — **small; auto-reply is
already built**, so it's the BYO connect flow + the consent ⚙️ items (~1 wk eng once legal defines consent).
Phase 2 managed rebilling — ~2–3 wks eng (wallet + metering + marketplace are the new parts). Phase 3 AI voice
— multi-week greenfield, month+ on its own. Phase 4 — comparable again.

## Open decisions (blocking)

**D1 (flat rate card), D2 (prepaid wallet), D3 (subaccounts under FixFlow) are LOCKED** — these define the
**Phase 2** (managed rebilling) billing + account model. **Phase 1 (BYO + auto-reply) needs none of them** —
no wallet, no markup, no marketplace — so it can go live first.

**Build + internal pilot: UNBLOCKED (2026-07-23).** There is a real, active, non-trial Twilio account with a
live **toll-free** number (+1 888 471-5544; SMS/MMS/Voice, $17.85 balance). Combined with the already-built
`assign()` + reply engine, you can wire the number's inbound webhook → `TwilioWebhookController`, manually
assign it to a pilot shop, flip `ENABLE_CUSTOMER_SMS`, and get a real AI reply to a real text **today** — no
BYO UI required for the internal pilot.

**Blocking Phase 1 REAL-CUSTOMER go-live (not the build/pilot):**
- **AI-consent legal (⚙️ 4c + 4d)** — the universal prerequisite; gates BYO **and** managed. Answer first.
- **Toll-Free Verification** — the live number is toll-free, so it uses **TF Verification, NOT A2P 10DLC**.
  Unverified TF sends for internal testing but carriers throttle/block unverified A2P toll-free at volume.
  Days of lead time — start now. (`TWILIO_SMS_ENABLED=false` today; `.env` still needs the real creds wired.)
- Note: the number's messaging/voice webhooks are unconfigured ("Set up" in console) — a wiring task, not a
  blocker.

**Additionally blocking Phase 2 (managed rebilling / the cut):**
- **4a reseller/tax review** — telecom-reseller status, USF, FCC-499, state telecom tax. BYO (Phase 1) sheds
  this entirely (4f); it's a Phase-2-only gate. Feeds back into the D1 rate card.

**Still shaping later phases:** D6 (inbound-only voice first) blocks Phase 3. D7 (BYO AI-layer metering +
Business gate) shapes Phase 1 billing but doesn't block it.

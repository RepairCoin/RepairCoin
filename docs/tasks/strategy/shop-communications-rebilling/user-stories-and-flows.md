# User Stories & Flows — Shop Phone System (SMS + AI Calling)

Companion to `scope.md`. This walks the feature from each person's point of view so the flow is concrete.
Assumes the recommended model: **FixFlow master Twilio account → one subaccount per shop → prepaid wallet →
usage marked up → the spread is FixFlow's margin.**

---

## The actors

- **Shop owner** — buys a number, sends/receives texts, has an AI answer calls. Pays FixFlow, not Twilio.
- **Customer** — texts or calls the shop's number. Never sees FixFlow or Twilio; just talks to "the shop".
- **FixFlow (platform)** — owns the Twilio account, provisions numbers, meters usage, takes the margin.
- **AI agent** — FixFlow's assistant, answering texts and calls in the shop's brand voice.

---

## Story 1 — The shop gets a phone number

> *As a shop owner, I want my own business texting/calling number, so customers can reach me and an AI can
> handle it when I can't.*

**Flow:**
1. Owner opens **Settings → Phone** and sees two choices:
   - **Get a number** (managed — FixFlow provisions it; usage billed through FixFlow at published rates)
   - **Bring my own Twilio** (advanced — they connect their own account; FixFlow takes no usage cut)
2. Managed path: they search by area code, see available numbers with a monthly price, and click **Buy**.
3. FixFlow calls Twilio to create a **subaccount for this shop** (first time only) and provision the number
   inside it. The row lands in `shop_sms_numbers` (`provisioning_mode = 'platform'`, `status = 'active'`).
4. The number now routes: inbound texts/calls to this number → FixFlow's webhook → this shop.
5. Behind the scenes FixFlow kicks off **A2P 10DLC registration** for the number (US carrier requirement).
   Until it clears, texting may be limited — the UI shows "registration pending".

**BYO path:** the owner pastes their Twilio credentials; FixFlow stores them, `provisioning_mode = 'byo'`,
and every send uses their account. No wallet, no markup — they pay Twilio directly, FixFlow charges only its
subscription.

---

## Story 2 — The shop funds its wallet

> *As a shop owner, I want to pre-load credit and have it top up automatically, so my texts and calls never
> stop mid-conversation.*

**Flow:**
1. On first number purchase, the owner is asked to **add credit** (e.g. $20) and optionally turn on
   **auto-reload** ("when balance drops below $5, add $20").
2. FixFlow charges their card via Stripe and records the balance in a **wallet** (new
   `shop_comms_wallet` — balance in cents, per shop).
3. Every message and call minute **draws the balance down at FixFlow's rate** (Story 5 explains the rate).
4. When the balance hits zero: outbound sending is **blocked** and the owner is nudged to reload. Inbound
   still arrives (you don't want to miss a customer), but AI replies pause until funded.

*Prepaid, not a monthly invoice — this is the GHL model. It caps FixFlow's exposure: a shop can never run up
a bill it hasn't paid, and there are no chargebacks on usage already consumed.*

---

## Story 3 — A customer texts the shop

> *As a customer, I want to text the shop a question, so I get an answer without calling.*

**Flow:**
1. Customer texts the shop's number: *"Do you fix cracked iPhone screens?"*
2. Twilio delivers it to FixFlow's inbound webhook. The `To` number identifies **which shop** (that's why
   each shop needs its own number).
3. FixFlow records the inbound segment against the shop's usage, **draws the marked-up cost from the wallet**,
   and stores the message in the conversation.
4. If the shop has **AI auto-reply on** and credit remains, the AI agent (same brain as today's text
   auto-answer) drafts a brand-voiced reply and sends it — another metered, marked-up outbound segment.
5. If AI is off, the message just lands in the shop's inbox for a human to answer.

**Cost path in one line:** inbound segment + AI's outbound segment each cost FixFlow the Twilio rate and cost
the shop the *marked-up* rate → the difference is margin.

---

## Story 4 — A customer calls, and the AI answers

> *As a customer, I want to call and get a real answer even after hours, so I don't have to wait or call back.*

*(This is Phase 3 — greenfield voice. The SMS stories above ship first.)*

**Flow:**
1. Customer dials the shop's number.
2. Twilio routes the call to FixFlow's **voice webhook**, which returns instructions (TwiML): greet the
   caller, start streaming the audio.
3. FixFlow transcribes the caller in real time (speech-to-text), feeds it to the **AI agent** (the
   LeadAutoAnswer brain, now over voice), and speaks the reply back (text-to-speech). Multi-turn, in the
   shop's brand voice.
4. The AI answers questions, quotes services, and nudges toward booking — e.g. *"We can fit you in Thursday
   at 2, want me to hold it?"*
5. The whole call is **metered per minute** and drawn from the wallet at FixFlow's marked-up per-minute rate.
6. Optional escalation: "press 0 / say 'human'" forwards to the owner's real phone if they're available.

**Why inbound-first:** the customer initiated the call, so consent is simple. Outbound AI calls (FixFlow
dialing the customer) carry much stricter rules and come later (Phase 4).

---

## Story 5 — How FixFlow makes money (the "cut")

> *As FixFlow, I want a margin on every text and minute, so the phone system is a revenue line, not a cost.*

**Flow (invisible to the shop):**
1. FixFlow publishes a **rate card**: e.g. 2¢/text, 15¢/AI-call-minute, $2/number/month. These are what the
   shop's wallet is charged.
2. Twilio charges FixFlow its **wholesale** rate (fractions of a cent per text, ~1–2¢/min, ~$1/number).
3. Every usage event is written twice: **Twilio's actual cost** and the **shop's marked-up charge**,
   idempotent on Twilio's message/call SID (so a webhook retry can't double-charge).
4. The **spread** (marked-up charge − Twilio cost) is FixFlow's margin, reportable per shop and in aggregate.
5. Monthly, FixFlow reconciles its metered totals against Twilio's real invoice — the two must match, or the
   rate card / metering is wrong.

*This is the same shape as the existing per-booking platform commission (`platformCommission.ts`), just
applied to messages and minutes instead of bookings.*

---

## Story 5b — Revenue when the shop is BYO (no telecom cut)

> *As FixFlow, I still want to make money on a shop that brings its own Twilio, so BYO is a retention option
> — not a revenue hole.*

On BYO there is **no telecom margin** — that's the whole point of BYO for the shop (raw Twilio pricing), so
there is no spread to take. Messages and minutes run on the shop's own Twilio account; Twilio bills them
directly. FixFlow still earns three ways:

1. **The plan subscription.** A BYO shop is still on Growth/Business. The phone feature is a reason to stay on
   the plan; the transport just happens to be theirs.
2. **The AI layer — the durable one.** The AI that answers the texts/calls is **FixFlow's**, running on
   FixFlow's infrastructure and metered through the existing AI budget / spend-cap / overage. So the split is:
   **transport** (segment, minute) → the shop's Twilio; **intelligence** (drafting the reply, holding the
   voice conversation) → FixFlow, metered by FixFlow. FixFlow monetizes the *brain* regardless of whose pipe
   carries the words — the more defensible margin, since transport is a commodity and the AI agent isn't.
3. **Optional flat management fee.** A small per-number / per-month "connected number" charge for routing, the
   inbox, and A2P help — so BYO isn't a pure freebie. (GHL-style.)

**Strategic framing:** BYO is a *retention* lever, not a *revenue* lever. You offer it so a high-volume shop
doesn't churn to GoHighLevel for raw pricing — you keep them on the plan and keep selling them the AI. You
give up the telecom skim precisely on the shops where that skim would have been most contentious.

Two design consequences, both folded into the decisions (see scope D7): **gate BYO behind a higher tier** so
it's a deliberate power-user choice, not the default everyone picks to dodge the markup; and **meter the AI
layer independently of transport** so BYO shops still consume — and pay overage on — the AI budget.

---

## Story 6 — The shop owner works their inbox

> *As a shop owner, I want to see conversations and step in when the AI can't handle it, so nothing falls
> through.*

**Flow:**
1. Owner opens **Messages** and sees every text thread and (Phase 3) call transcript, per customer.
2. AI-handled threads are marked; the owner can take over any thread and type a reply themselves.
3. A usage widget shows **credit remaining** and **spend this month**, so there's never a surprise.
4. From a thread the owner can jump straight to booking, customer profile, or a win-back campaign — the phone
   system feeds the same customer graph everything else uses.

---

## Story 7 — Edge cases the flow must handle

- **Out of credit** — outbound blocked, inbound still received, owner nudged to reload. AI resumes on top-up.
- **A2P not yet approved** — texting limited/queued; the UI is honest about "registration pending", not
  silently dropping messages.
- **Number release** — owner cancels the number; FixFlow releases it at Twilio, stops the rental charge,
  marks the row `released`. Warn that inbound to that number will stop.
- **Multi-shop customer** — a customer who deals with two shops texts two different numbers; each `To`
  resolves to the right shop, so threads never cross. (This is why a shared number was rejected.)
- **BYO shop** — no wallet, no telecom markup; sends go out on the shop's own Twilio. FixFlow still earns the
  subscription + the metered **AI layer** + an optional flat number fee (Story 5b).
- **Dispute** — a shop questions a charge; because every event stores both Twilio cost and the marked-up
  charge with the SID, any line is auditable back to a real Twilio event.

---

## The one-paragraph picture

A shop buys a number through FixFlow; it's provisioned inside that shop's own Twilio **subaccount under
FixFlow's master account**. The shop pre-loads a **wallet**. Customers text and (later) call that number;
FixFlow's **AI agent** answers in the shop's voice. Every text and minute is **metered and charged to the
wallet at a marked-up rate**; FixFlow pays Twilio the wholesale cost and keeps the **spread**. The shop sees a
simple inbox and a credit balance; FixFlow sees a per-shop margin. A **BYO Twilio** option exists for shops
who want raw pricing — FixFlow takes no telecom cut there, but still earns the subscription and the **metered
AI layer** (transport is theirs, the intelligence is FixFlow's). None of it is legal to switch on until the
telecom-reseller / A2P / consent review (D4) clears.

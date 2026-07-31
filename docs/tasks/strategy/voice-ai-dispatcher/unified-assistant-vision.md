# Scope Delta — Unified "Talk To My Business" Assistant (exec vision)

**Status:** Analysis only. No build commitment. Written 2026-06-01 from an
exec request (`exec.txt` viral-video concepts + a WhatsApp screenshot
`sc1.png`). This compares what the exec is asking for against the **locked**
Voice-first AI Dispatcher v1 decisions (`scope.md`) and the capabilities that
already exist in the codebase, then sizes the gap.

**Companion docs:** `scope.md` (9 locked decisions), `implementation.md`
(7-phase voice plan), `user-flow.md`.

---

## 0. v2 at a glance (executive summary)

**One line:** v2 is **one named, owner-facing assistant ("Adam/Cain") you talk
to — by voice or text — that answers, recommends, and *acts* across your whole
business in a single conversation.** It replaces the 4-door panel model with one
door, reusing all the domain brains behind it.

**What the owner experiences** — one thread doing
Information → Recommendation → Action, spoken back (turn-based, Siri-style):

```
Owner: "How did we do this month?"
Adam:  "Revenue up 18%, repeat visits up 11%."          ← Information (insights tools)
Owner: "Why does it feel slower though?"
Adam:  "Repeat customers dropped 14%. Want me to win them back?"  ← Recommendation
Owner: "Yeah, do it."
Adam:  "Found 324 lapsed customers. Drafted a 15%-off win-back. [Send] [Edit]"  ← Action (w/ confirm)
Owner: "Send it. Also what's low in inventory?"
Adam:  "Sent to 324. And iPhone 13 screens — 7 days left. Order more? [Order]"  ← cross-domain + proactive
Owner: "How's the AI doing with customers this week?"
Adam:  "Closed 12 bookings, escalated 3 to you. Want to see them?"  ← supervises the Sales Agent (§4a)
```

**Capability surface (all owner-facing):**

| Capability | Backed by (mostly exists) |
|---|---|
| Answer — revenue, top customers, bookings count, low stock, top technician, AI impact | Insights tools (~15) |
| Recommend — "why are sales down?", win-back suggestions | Insights + `suggestCampaignStrategies` |
| Act: marketing — draft + send campaigns | `lookupAudienceCount → proposeCampaignDraft → proposeCampaignSend` (live) |
| Act: inventory — "order more" → PO | `poSuggestionService.approveSuggestion(…, autoCreatePO)` (wrap as tool) |
| Supervise Sales Agent — pause/resume, per-service toggle, escalations, tone | kill-switches + `ai_shop_settings` + `EscalationDetector` |
| Proactive — "running out in 7 days" alerts | inventory toolkit + scheduled detector |
| Help — how-to / where-is | existing Help surface |

**How it's built:**

```
        🎤/⌨  Owner input (voice or text)
              │   Whisper STT (turn-based)
              ▼
   ┌──────────────────────────────────────────┐
   │   Unified Orchestrator  (the new build)    │  ← generalize AgentOrchestrator
   │   • merged cross-domain TOOL REGISTRY      │
   │   • picks + chains tools per turn          │
   │   • guardrails: tool-schema validation,    │
   │     confirm-before-execute, spend cap,     │
   │     escalation, kill-switch                │
   └──────────────────────────────────────────┘
       │        │         │          │
   Insights  Marketing  Inventory  Sales-Agent   ← existing domain tools (reused)
       │
       ▼  text answer → TTS → spoken reply
```

- **Reuses:** Whisper, `AnthropicClient`, `SpendCapEnforcer`, audit, every
  domain's tools, and the Sales Agent's proven guardrail pattern (§4a).
- **New work:** the orchestrator + merged tool registry (central build), the TTS
  leg, branding/persona config, and a few new action tools (PO create, owner
  booking-reads, Sales-Agent control).

**Scope boundary** — *In v2:* owner-facing answer + recommend + act across
Insights/Marketing/Inventory/Help + Sales-Agent supervision; turn-based voice
in/out; named/brandable. *Not v2 (later/separate):* customer-facing voice;
real-time duplex; no-confirm autonomous actions on money/outward-facing steps;
owner-initiated *customer* booking (open decision).

**Honest summary:** ~70% assembly, ~30% new — the intelligence (domain tools)
and the safety pattern (Sales Agent guardrails) already exist; the new build is
*the orchestrator that unifies them behind one door*, plus voice-out and
branding. The risk isn't capability — it's the **autonomy line** on actions and
the **Q1 architecture sign-off** (§7).

---

## 1. What the exec is asking for

Two inputs, one thesis.

**`exec.txt`** — five viral-video concepts ("I Talk To My Business", "Fix My
Business", "AI Runs My Marketing", "AI Finds Problems Before I Do", "The Entire
Business In One Chat"). The distilled thesis is its own closing line:

> Most software gives information. Your vision is: **Information → Recommendation → Action.**

The opener is the real signal:

> "Honestly, not the AI chat. Not the marketing AI. Not even the voice mic."

He is **not** dismissing the surfaces we built — he's saying the viral
differentiator isn't any single one of them; it's **unifying them into one
assistant that takes action.**

**`sc1.png`** (exec WhatsApp) adds two requirements:
- **Siri-like** — "get the AI to this point… like Siri… just ask."
- **Brandable / named** — "they can name it… brand it for our own… we can call
  it Cain… I was thinking Adam… will find a name or have options to customize
  the AI bot."

### Distilled requirements

| # | Requirement | Example from exec.txt |
|---|---|---|
| R1 | **One conversation** spans the whole business | "How many bookings today? … Send promotion … What's low in inventory? … Show my top technician" |
| R2 | **Answers** (Information) across domains | "How did we do this month?" → "Revenue up 18%…" |
| R3 | **Recommends** (diagnosis) | "Why are sales down?" → "Repeat customers dropped 14%" |
| R4 | **Acts** in-thread (Action) | "Fix it" → campaign created & scheduled; "Send it" → done; "Order more" → PO created |
| R5 | **Spoken** (Siri framing) | implies TTS, bidirectional voice |
| R6 | **Branded / named / customizable** | Adam / Cain / owner-chosen |
| R7 | **Proactive** ("before I do") | "You're projected to run out of iPhone 13 screens in 7 days" |

---

## 1a. What "unified" actually looks like

The difference is really about **how many "doors" the owner walks through.**

**Today — 4 panels (4 doors):**

```
 ┌──────────────────────────────────────────────┐
 │ [🎤 Ask AI]  [Insights]  [Marketing]  [Help]   │  ← launchers
 └──────────────────────────────────────────────┘
        │  owner speaks → the router picks ONE door for them
        ▼
 ┌─ Insights ─┐   ┌─ Marketing ─┐   ┌─ Help ─┐
 │ revenue,   │   │ campaigns,  │   │ how-to │
 │ customers  │   │ sends       │   │ Q&A    │
 └────────────┘   └─────────────┘   └────────┘
   separate chats · owner is aware "which AI am I in?" ·
   cross-domain question = a handoff card to switch panels
```

The owner has to land in the *right* panel. Ask the Marketing panel an Insights
question and it does the "open Insights instead?" handoff dance. Ask for two
things from two domains and it's two separate trips.

**Unified — 1 assistant (1 door):**

```
 ┌────────────────────────────┐
 │     🎤  Talk to <Adam>      │   ← one entry, one mic, one name
 └────────────────────────────┘
        │
        ▼
 ┌──────────── <Adam> · one conversation ───────────┐
 │ Owner: How did we do this month?                  │
 │ Adam:  Revenue up 18%, repeat visits up 11%.      │ ← insights tools
 │ Owner: Send a promo to lapsed customers.          │
 │ Adam:  Found 324. Drafted it. [Send] [Edit]       │ ← marketing tools
 │ Owner: What's low in inventory?                    │
 │ Adam:  iPhone 13 screens — 7 days left. [Order]   │ ← inventory tools
 └───────────────────────────────────────────────────┘
   owner never picks a panel · one bot · everything in one thread
```

**The shift is in the owner's head:** from *"which AI tool do I open?"* → to
*"I just talk to my business."* That's why it's friendlier — **zero decisions
about routing or panels.** It's the exec's "Talk To My Business" framing.

**Three things this is NOT:**

1. **Not throwing away the 4 panels' brains.** The Insights / Marketing /
   Inventory *logic and tools* all stay on the backend. Unified just collapses 4
   front doors into 1. Same intelligence, one entrance.
2. **Not losing the rich UI.** A single thread still renders a revenue chart, a
   campaign draft editor, an "order PO" button — those cards appear **inline in
   the one conversation** instead of in separate panels. "One door + rich
   answers," not "one door + plain text."
3. **Not limited to one domain per ask.** It does the thing 4 panels structurally
   can't: answer a question *and* take a cross-domain action in **one ask**
   ("what's my revenue, and send a promo to lapsed customers") — today that's two
   panels and two trips.

**The honest trade-off:** 4 panels give each domain a fully tuned, dedicated
screen (more "designed," but the owner manages 4 surfaces); unified is simpler
and friendlier, with the cost moved onto *us* — building the orchestrator that
decides which tools to call behind the single door (the central new build in §4).
For "user-friendly and easy to use," unified wins.

---

## 2. Conflict with locked Voice v1 decisions

Voice v1 was deliberately scoped as the **opposite** of a unified assistant.
This is the central tension to resolve with the exec — not an oversight.

| Voice v1 locked decision (`scope.md` §5) | Exec ask | Conflict |
|---|---|---|
| **Q1** — Voice *opens the matching existing panel*; explicitly NOT a unified surface, NOT a mega-panel | R1: one conversation for everything | **Direct reversal** |
| **Q3** — Router covers Insights/Marketing/Help only; Booking + Inventory → `OUT_OF_SCOPE` | R1/R4: bookings, inventory, technicians all in-scope | **Expansion** |
| **Q5** — No TTS in v1 (text/card output only) | R5: Siri = spoken back | **Additive** |
| **Q8** — Proactive recommendation cards out of scope | R7: "before I do" notifications | **Additive** |
| Edit-before-dispatch; the panels do the work | R4: assistant executes ("Send it", "Order more") | **Autonomy shift** |

**Takeaway:** voice v1 is a *router that hands off to panels*. The exec wants a
*cross-domain agent that holds one thread and pulls the trigger*. Different
product — but, per §3, most of the parts already exist.

---

## 3. Capability inventory — what already exists

This is the good news. The hard pieces exist; they're **siloed behind separate
panels / scoped to other actors**, not orchestrated into one owner-facing thread.

| Building block | Status | Where |
|---|---|---|
| **STT** (Whisper) | ✅ live | `services/openai/WhisperClient.ts`, `POST /api/ai/voice/transcribe` |
| **Cross-domain classification** (Haiku 4-way) | ✅ live | `AIAgentDomain/services/voice/VoiceRouter.ts`, `POST /api/ai/dispatch` |
| **Insights read tools** (revenue, top customers, repeat-visit, **inventory low-stock**, ~15 tools) | ✅ live | `AIAgentDomain/services/insights/tools/*` (e.g. `lowStockItems.ts`) |
| **Marketing draft → send chain** | ✅ live | `AIAgentDomain/services/marketing/tools/`: `lookupAudienceCount`, `proposeCampaignDraft`, **`proposeCampaignSend`**, `suggestCampaignStrategies` |
| **Agent-with-tools orchestration pattern** (executes actions, validated tool-use schemas) | ✅ live, but **customer-facing** | `AIAgentDomain/services/AgentOrchestrator.ts` — AI Sales Agent; tools `propose_booking_slot` / `propose_cancellation` / `propose_reschedule_request` |
| **Inventory PO suggestion + create** | ✅ logic exists (REST, not yet an AI tool) | `InventoryDomain/controllers/poSuggestionController.ts` → `poSuggestionService.generateSuggestions` / `approveSuggestion(id, userId, autoCreatePO)` |
| **Help / How-To** | ✅ live | `ai_help_messages` surface |
| **Spend cap across all AI** | ✅ live | `AIAgentDomain/services/SpendCapEnforcer.ts` |

**The flagship demo is ~1 layer away.** `exec.txt`'s strongest clip —
*"Send a promotion to customers who haven't visited in 60 days" → "Found 324…
Ready to send" → "Send it."* — is **already the live Marketing AI flow**
(`lookupAudienceCount → proposeCampaignDraft → proposeCampaignSend`), just
inside the Marketing panel rather than a unified thread.

---

## 4. Gap analysis

| Exec ask | What exists | Gap | Rough effort |
|---|---|---|---|
| R2 Answers | Insights read tools | Expose to a unified agent | **S** (wrap) |
| R3 Recommends | Insights + `suggestCampaignStrategies` + PO suggestions | "Why are sales down?" diagnosis tool / prompt | **M** |
| R4a Action — marketing send | `proposeCampaignSend` (live) | Reuse as-is | **XS** |
| R4b Action — inventory "Order more" | `poSuggestionService` generate/approve/`autoCreatePO` (REST) | **Wrap as an AI tool** + confirm step | **S–M** |
| R4c Action — bookings | `AgentOrchestrator` booking tools (customer-facing) | Owner-facing read/query tools ("bookings today", "top technician") | **M** |
| R1 One conversation | Router *picks a panel*; `AgentOrchestrator` proves the pattern | **Owner-facing orchestrator** with a *merged* tool registry across domains | **L — the central new build** |
| R5 Spoken (TTS) | none (Q5 punted) | Add TTS leg — **prioritized**: it's the "Siri" headline; a silent text reply doesn't read as Siri on camera (vendors in §5a) | **M** (additive) |
| R6 Branded / named | none | Configurable assistant name + persona | **S** (config, touches copy everywhere) |
| R7 Proactive | inventory toolkit + PO suggestions | Scheduled detector + push ("7 days left") | **M** |

**The central new build is R1** — an owner-facing orchestration agent that
merges the domain tools into one thread. The router's classification logic
becomes the orchestrator's tool-selection; `AgentOrchestrator` is the pattern
to generalize (it's currently scoped to customer sales conversations).

Everything else is **wrapping / reusing existing logic**, not building
intelligence from scratch.

---

## 4a. Where the AI Sales Agent fits

The AI Sales Agent (`AIAgentDomain/services/AgentOrchestrator.ts`,
`ai_agent_messages`) keeps coming up as "part of the unified assistant." It is —
but **not as a panel in the owner's thread**, because it's a fundamentally
different actor.

**Two audiences, two planes.** Everything else here is **owner-facing** (the
owner asks the AI *about* their business). The Sales Agent is **customer-facing
and autonomous** — it auto-replies to the shop's *customers* inside their
booking chats, taking real actions (`propose_booking_slot` /
`propose_cancellation` / `propose_reschedule_request`), event-triggered, not
invoked by the owner.

```
  CUSTOMER plane                          OWNER plane
  (customer's booking chat)               (dashboard "Talk to <Adam>")
  customer ⇄ Sales Agent                  owner ⇄ Unified Assistant
   • auto-replies to customers             • answers about the business
   • books / reschedules / cancels         • runs marketing, inventory, insights
   • autonomous, event-triggered           • invoked, on-demand
          │                                       │
          └─────────── shared infra ──────────────┘
        AnthropicClient · SpendCapEnforcer · tool-use pattern · audit
```

**Do NOT merge them into one thread.** The owner's "talk to my business"
conversation must never be the same thread a customer is messaging in —
different audience, different data, a security/UX mess.

**It's "part of" the unified assistant in two ways:**

1. **A domain the owner reports on + controls *through* the unified assistant**
   — not a chat the owner uses, but a subsystem they manage by talking to Adam,
   reusing fields that already exist:
   - *"How many bookings did the AI close this week?"* → `ai_agent_messages` / orders
   - *"Pause the AI" / "turn it off for [service]"* → existing kill-switches
     (`ai_global_enabled`, `ai_sales_enabled` in `AgentOrchestrator`)
   - *"Which conversations did the AI escalate to me?"* → `EscalationDetector`
   - *"Make its tone friendlier"* → `ai_shop_settings`

2. **The reference pattern the unified orchestrator is built on.**
   `AgentOrchestrator` is already the **most mature agent in the codebase**:
   multi-turn, validated tool-use schemas, takes real actions, *and* carries the
   full guardrail stack (kill switches, escalation-to-human, spend cap, model
   selection). It's also **~83% of Anthropic spend** — the most battle-tested AI
   in production. Since the **scariest part of the unified vision is autonomous
   action** ("Fix it" / "Send it" / "Order more"), the Sales Agent is the
   **proof that action-taking-with-guardrails already works** — so the unified
   orchestrator should reuse its guardrail model (tool-schema validation +
   confirm/kill-switch + escalation + spend cap), not invent a new one.

**Net:** the unified assistant is the owner's one door to *manage* everything —
including supervising the customer-facing Sales Agent — while the Sales Agent
keeps doing its autonomous customer work on its own plane. It's also the biggest
**de-risker** for the unified vision's hardest part.

---

## 5. Recommended path

1. **Keep voice v1 shipping as-is.** It's done and works (mic → STT → router →
   panel). Don't rip it out; the unified assistant is **v2**, built on the same
   tools. The router becomes the orchestrator's tool-selector.
2. **Prototype the flagship flow first — and make it speak.** *"How did we do
   this month?" → "Fix it" → campaign created* proves the entire thesis in 15
   seconds and is mostly **wiring** (Insights-read + Marketing-send already
   exist). Highest ROI, lowest new capability — de-risks the whole vision before
   committing to the full orchestrator. **Include voice-out (TTS) in this spike,
   not later:** the spoken reply *is* the "Siri" moment; a silent text answer
   doesn't sell the demo. TTS is additive and low-risk (see §5a).
3. **Wrap existing REST actions as AI tools** (PO approve/create, owner booking
   queries) rather than rebuilding them. Plumbing, not logic.
4. **Guardrails are non-negotiable on the Action half.** "Fix it" / "Send it" /
   "Order more" spend money, contact customers, and commit inventory orders.
   Every outward-facing or financial action keeps an explicit confirm step (the
   existing mass-send modal already does). The viral clip shows "Send it. Done."
   — but in product, **autonomous action on a hallucinated number is the one
   thing that turns this from magic into a liability.** Human-in-the-loop on
   anything irreversible.
5. **Voice-out (TTS) moves up; branding stays last.** TTS is now part of the
   flagship spike (item 2) because spoken-back is the headline — see §5a for the
   vendor call. **Branding is still last** — a name is a config flag, not the
   work (though it couples to the TTS choice: a *custom voice* is part of "name
   the bot," which points at ElevenLabs; see §5a).

---

## 5a. TTS (voice-out) vendor options

The assistant currently has **voice in, text out**. To make it "talk back" like
Siri we add a TTS leg: take the agent's final text, synthesize audio, stream it
to the client. Three realistic options:

| Option | Pros | Cons | Cost (rough) |
|---|---|---|---|
| **OpenAI TTS** (`tts-1` / `tts-1-hd`; voices alloy/echo/nova/onyx/…) | **Reuses the `OPENAI_API_KEY` we already have for Whisper** — one vendor, one billing line, one `SpendCapEnforcer` path. Streaming supported. Cheap. Fast to integrate. | Voices are generic/shared — no unique brand voice; limited customization. | ~$15 / 1M chars (`tts-1`), ~$30 (`tts-1-hd`). A ~150-char answer ≈ **$0.002–0.005**. |
| **ElevenLabs** | Best-in-class natural voices; **voice cloning / a custom branded voice** — directly serves the "name + customize the AI bot" ask in `sc1.png` (R6). Multilingual. | New vendor + new key + new billing; more expensive; another spend surface to cap. | ~$0.01–0.06 per ~150-char answer depending on tier. |
| **Browser Web Speech API** (`speechSynthesis`) | Free, client-side, zero network cost/latency, zero backend work. | Robotic, inconsistent across browsers/devices — **does not read as "Siri"**; unfit for a polished viral clip. | $0. |

**Recommendation:**
- **Prototype with OpenAI TTS.** Zero new integration — same key, same vendor as
  Whisper, flows through the existing spend cap. Gets a speaking demo fastest.
- **Evaluate ElevenLabs only if "custom voice per shop" becomes a real product
  requirement** (it's the natural home for R6's "customize the AI bot" → a
  branded voice, not just a name). Defer the second vendor until that's a
  committed feature, not a nice-to-have.
- Keep **Web Speech API** as a no-cost fallback for non-critical surfaces, never
  the demo.

**Two non-obvious notes:**
- **Latency.** TTS adds time to every reply and counts against the <6s perceived
  target. Use **streaming** synthesis so audio starts before the full text is
  generated; otherwise a 2–3s answer + 1–2s TTS blows the budget.
- **Cost is trivial vs. the LLM leg.** Even ElevenLabs (~$0.01–0.06/answer) is
  small next to the ~$0.018 Sonnet downstream cost — TTS won't move the
  ~$18/mo Anthropic baseline meaningfully. Vendor choice is about **voice
  quality + branding**, not cost.

**Scope note — "like Siri" = turn-based, NOT a phone call.** Siri itself is
turn-based: you speak → it detects you stopped → it answers → next turn. It does
*not* listen and talk simultaneously or let you talk over it. So the exec's
"like Siri, just ask" is satisfied by the **turn-based bidirectional** pipeline
here (Whisper STT → think/act → TTS) — we do **not** need the heavier
**real-time duplex** architecture (interruptible, talk-over-each-other) that
ChatGPT Advanced Voice Mode / OpenAI Realtime API / Gemini Live use. Real-time
duplex is a separate, later step, relevant only if the exec specifically asks
for phone-call-style interruption — beyond what "like Siri" means.

---

## 6. Risks to flag to execs

- **Architecture reversal (Q1).** Unified-thread vs route-to-panels is a real
  decision with real rework. Needs an explicit exec sign-off, not an assumption.
- **Autonomy / financial exposure.** The "Action" half is the value *and* the
  danger. A wrongly-sent mass campaign or a wrongly-created PO is expensive and
  outward-facing. Confirm-before-execute must survive the "make it feel like
  Siri" pressure.
- **Hallucinated numbers.** "Revenue up 18%" / "324 customers" must come from
  validated tool output, never free-text generation. (The existing tool-use
  schemas already enforce this — keep that discipline.)
- **Cost.** A cross-domain agent chains more tool calls per turn than a
  single-panel agent → higher Anthropic spend per interaction. Size against the
  ~$18/mo baseline before scaling (see the spend-baseline memory).
- **Naming.** "Cain" likely appeals because it echoes "coin"/RCN, but the
  Cain/Abel connotation is rough; "Adam" or owner-customizable is safer.

---

## 7. Open decisions for the exec

1. **Commit to the Q1 reversal?** Unified assistant as v2, or keep route-to-panels?
2. **Autonomy line:** which actions, if any, may execute without a confirm tap?
   (Recommendation: none that are financial/outward-facing.)
3. **Scope of v2 actions:** marketing-send + inventory-PO + booking-reads first,
   or wider?
4. **Name/branding:** fixed brand name vs per-shop customizable.
5. **Sequencing vs the AI Sales Agent roadmap** (shares `AgentOrchestrator` and
   the spend cap).

---

## 8. Bottom line

The exec's instinct is sound and the vision is coherent — and we're **closer to
it than "different product" implies**, because the tools (and even an
agent-orchestration pattern) already exist. The work is **one owner-facing
orchestrator + wrapping a few existing actions as tools + TTS + branding**, not
building intelligence from scratch. The two things to settle with the exec
before any build: the **Q1 architecture reversal** and the **autonomy/guardrail
line** on actions.

**Next step (when prioritized):** prototype the single flagship flow end-to-end
as a spike to validate the thesis cheaply, then decide on the full orchestrator.

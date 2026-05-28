# Voice-first AI Dispatcher — Strategy (Scope)

**Status:** Strategy draft — not yet planned-out into implementation.
**Created:** 2026-05-28.
**Owner:** Deo.
**Design reference:** `c:\dev\voice.jpeg` (shop dashboard mockup with center mic pill and "AI Assistant — NEW" sidebar promotion).

---

## 1. Goal

Make voice the **primary cross-domain entry point** for shop-owner AI, with a single mic button on the dashboard that handles requests spanning the existing 4 AI surfaces (Insights, Marketing, Help, Sales Agent) and eventually new domains (Booking, Inventory).

Three example commands the design implies the v1 must handle:
- *"Create a campaign for slow days"* → routes to AI Marketing (already shipped)
- *"Who are my top customers this month?"* → routes to Insights (already shipped)
- *"How do I export my customer list?"* → routes to Help (already shipped)

**Critical framing:** this is NOT "add a mic to the marketing panel." It's "make voice the universal command channel for the whole shop dashboard, fronted by an intent router that dispatches to the right backend." Different architecture from a per-panel STT addition.

---

## 2. What the design shows (voice.jpeg breakdown)

| Element | What it signals |
|---|---|
| Center pill: *"Ask AI Anything · 🎤 · AI will handle the rest"* with example *"Create a campaign for slow days"* | Single unified AI entry, NOT one mic per panel |
| Subtitle: *"Marketing, booking, inventory — all in one place"* | Cross-domain routing required — voice spans multiple existing backends |
| Sidebar: "AI Assistant" with NEW badge as a top-level nav item | Voice AI is being positioned as the headline feature, not a small UX add |
| Bottom-nav yellow `+` button labeled *"One tap to do anything"* | Mobile-nav voice entry point, same handler as the dashboard pill |
| Side rails: "AI Recommendations for You" (Win-Back / Low Stock / Slow Day) | The AI is also proactive — pushes suggestions, not just reactive to voice |
| "Let AI handle the busy work — See How" call-out + "Pro Plan" badge top-right | Marketing positioning of the feature as a Pro-tier benefit |

The design is **voice-input + visual response** (transcript, prose, cards). It is NOT real-time bidirectional voice — no waveform output, no "listen to AI speaking back" affordance.

---

## 3. Current state — what exists today

### 3.1 Backend AI surfaces (4 separate, JWT shop-scoped)

| Surface | Endpoint | Tools available | Status |
|---|---|---|---|
| Insights ("Ask about your business") | `POST /api/ai/insights` | 11 read-only data tools (revenue, top customers, top services, etc.) | Live |
| Marketing Assistant | `POST /api/ai/marketing-chat` | 4 tools (lookup_audience_count, propose_campaign_draft, propose_campaign_send, suggest_campaign_strategies) | Live (just shipped 2026-05-26) |
| How-To Assistant | `POST /api/ai/help` | RAG over help articles | Live |
| Sales Agent (customer-facing) | Customer chat path | Booking proposals, reschedule, cancel | Live (different audience — not part of this scope) |

Each runs its own agent loop (Sonnet 4-6, 5-iter cap), its own audit table, its own prompt builder. They share `AnthropicClient`, `SpendCapEnforcer`, and the `propose-then-tap` UI pattern.

### 3.2 Frontend AI surfaces

| Surface | Component | Mount point |
|---|---|---|
| Insights panel | `InsightsPanel.tsx` | Right-side `Sheet` from `InsightsLauncher` (BarChart3 icon) |
| Marketing AI panel | `MarketingAIPanel.tsx` | Right-side `Sheet` from `MarketingAILauncher` (Megaphone icon) |
| Help Assistant | `HelpAssistantLauncher.tsx` | Right-side `Sheet` |
| Sales Agent | Customer chat thread | In-chat propose cards |

All four launchers mount in the same action cluster at the top-right of `DashboardLayout.tsx`. The design proposes adding a **fifth, central** voice entry — but more importantly, voice should DISPATCH to one of these existing panels (or to a unified replacement).

### 3.3 What we DON'T have

- Speech-to-text — no integration with Whisper, Deepgram, or browser SpeechRecognition.
- Cross-domain intent router — each surface has its own prompt; nothing decides which surface a request belongs to.
- Voice-output / TTS — no audio playback of AI responses.
- Booking AI tools — booking lives in `ServiceDomain` but has no AI tool layer.
- Inventory AI tools — inventory has services but no AI dispatch.
- Proactive recommendations engine — the "AI Recommendations for You" cards in the design are aspirational; nothing generates them yet.
- Phone number integration — no Twilio, no inbound voice calls.

---

## 4. Proposed architecture

Three layers, additive on top of the existing 4 AI surfaces. **Do NOT refactor the existing surfaces in v1** — wrap them.

### 4.1 Layer 1 — Voice capture + STT (1-2 days)

**Frontend:**
- New `<VoiceCommandPill />` component mounted on the dashboard home (matches voice.jpeg center pill design).
- Tap mic → request mic permission → MediaRecorder captures audio (WebM/Opus, ~16kHz).
- Show "Listening…" state with a recording indicator.
- Tap again to stop OR auto-stop on 1.5s silence detection.
- POST audio blob to `POST /api/ai/voice/transcribe` (multipart/form-data).
- Receive `{ transcript: string, durationMs: number }`.
- Show transcript inline while Layer 2 runs.

**Backend:**
- New endpoint `POST /api/ai/voice/transcribe` — multipart upload, calls Whisper API (or Deepgram), returns transcript.
- Spend-cap-enforced: STT cost (~$0.006-$0.012/min) counts toward the shop's monthly AI budget.

**STT vendor choice:**

| Option | Pros | Cons |
|---|---|---|
| **OpenAI Whisper API** | Best transcription quality, $0.006/min, multilingual | Slowest of the three (~2-4s round-trip on a 10s clip) |
| **Deepgram Nova-3** | Fastest (~500ms round-trip), $0.0125/min, supports streaming | English-only for some tier, more expensive |
| **Browser SpeechRecognition** | Free, in-browser (no upload) | Inconsistent across browsers, sends audio to Google/Apple servers (privacy unclear) |

**Recommendation:** Whisper for v1 (quality + cost), evaluate Deepgram if latency complaints surface. Browser SpeechRecognition is too unreliable for a paid feature.

### 4.2 Layer 2 — Cross-domain intent router (3-5 days, the architecturally new piece)

**Frontend:** No new UI — transcript from Layer 1 is sent to the dispatcher.

**Backend:**
- New endpoint `POST /api/ai/dispatch` — accepts `{ transcript: string, sessionId: string }`.
- Routing strategy (router is itself a small Claude call):
  ```
  System prompt to router:
    "You're routing a shop owner's voice command to one of these domains:
      - INSIGHTS — questions about the shop's data (revenue, customers, bookings)
      - MARKETING — sending campaigns, drafting emails
      - HELP — how-to questions about using the platform
      - OUT_OF_SCOPE — not yet supported
     Return ONLY the domain name."
  
  User: <transcript>
  Output: One of the four domain names.
  ```
- Once domain is decided, forward the transcript to the matching existing endpoint:
  - INSIGHTS → call existing Insights handler internally
  - MARKETING → call existing Marketing handler internally
  - HELP → call existing Help handler internally
  - OUT_OF_SCOPE → return a templated "I can't help with that yet" response
- Stream the response back to the frontend.

**Why router-as-separate-Claude-call instead of unified-mega-prompt:**

| Approach | Tradeoff |
|---|---|
| Router as separate small call (~200 tokens, Haiku, ~$0.0002 each) | Cheap; preserves existing 4 surfaces unchanged; clean separation; ~300ms added latency |
| One unified mega-prompt with all tools from all 4 surfaces | Single round-trip but very long system prompt + 15+ tools = expensive, slow, and Claude struggles to keep tool guidance straight at that scale |

**Router uses Haiku, not Sonnet** — it's a simple 4-way classification. Faster + 10x cheaper than Sonnet.

**Frontend rendering:**
- Domain hint surfaced (small chip: "Asked Marketing" / "Asked Insights" — so the shop owner knows where the request went)
- Response renders in the existing panel format for that domain (audience_summary + campaign_draft for Marketing, number/table/list for Insights, etc.)
- All reuse existing card components — no new visual primitives

### 4.3 Layer 3 — Open target panel with transcript pre-filled (1 day)

**Refined 2026-05-28 (was originally a unified response panel — see §5 Q1 for why we rejected that).**

After the router decides a domain, the frontend opens the matching existing panel (Insights / Marketing / Help) with the transcript pre-filled as the first user message in that panel's chat thread. The panel's existing logic handles the rest — Claude call, tool dispatch, card rendering, modal flows.

Implementation shape:
- Router endpoint returns `{ domain: "insights" | "marketing" | "help" | "out_of_scope", transcript }` to the client
- Client uses the existing panel components — opens the matching Sheet from `DashboardLayout` and dispatches an action to seed the panel's input with the transcript and trigger send
- All 4 existing panels keep their per-domain UX intact (pinned, anomaly banner, starter chips, scaffolds, draft modal, article corpus)
- OUT_OF_SCOPE renders inline on the voice pill: *"I can't help with that yet — try the Bookings tab or the manual panels."*

What this does NOT build:
- No new "unified response panel" surface
- No card-rendering duplication
- No panel-mode switching logic
- No state coordination between 4 panels and a 5th unified one

Voice is purely a smart shortcut INTO existing panels. The 4 sidebar launchers stay as direct manual entry points; voice is the "I don't remember which panel" fast path.

**v2+ (defer to user research):** if engagement data later shows shop owners struggle with the 4-panel split even WITH the voice shortcut, revisit unification. Don't pre-build it.

### 4.4 Layer 4 — Per-panel mic with hybrid cross-domain handoff (2-3 days)

Added 2026-05-28 after the global-vs-per-panel discussion; refined the same day after the cross-domain question (originally proposed as "skip router entirely"; revised to D3 hybrid below).

Once a shop owner is inside a panel (via the global mic OR by tapping a sidebar launcher manually), they should be able to dictate follow-up messages by voice too — not be forced to switch to keyboard. AND if their follow-up turns out to be a cross-domain question (e.g. asking an Insights question while in the Marketing panel), the system should gracefully offer to open the right panel instead of silently sending it to a panel that will decline.

**D3 Hybrid behavior — client keyword check first, router only on suspected mismatch:**

1. Tap inline mic → STT (Layer 1) returns transcript
2. **Client-side keyword check** runs synchronously on the transcript:
   - Insights signals: `revenue|sales|customer|booking|order|earned|made|grossed|top|stats|metric|breakdown|frequency|tier|RCN balance|cancellation|repeat|time of day`
   - Marketing signals: `campaign|email|send (to)|win[- ]back|black friday|weekend special|promotion|offer|discount|subject|recipients|draft`
   - Help signals: `how do I|how to|where is|where do|what is|explain|guide`
3. If the keyword signals match the current panel's domain (or no signals fire) → **skip the router**, drop transcript into the panel's textarea, show normal edit-confirm card. ~90% of follow-ups land here.
4. If the keyword signals point at a DIFFERENT domain than the current panel → **call the router (Haiku)** to confirm. Router returns confirmed domain.
5. If router confirms mismatch → edit-confirm card surfaces the cross-domain choice:
   ```
   ┌──────────────────────────────────────────────────┐
   │ "what's my revenue this week?"                   │
   │                                                  │
   │ ⚠ This looks like an Insights question.          │
   │                                                  │
   │ [Send to Marketing]   [Open Insights instead]    │
   └──────────────────────────────────────────────────┘
   ```
6. User picks. "Send to current" drops into the panel's textarea and proceeds normally. "Open other panel" closes the current panel (preserving any draft) and opens the other panel with transcript pre-filled.

Implementation shape:
- New shared `<InlineVoiceMic />` component — small mic button alongside each panel's send button
- Shared keyword-classifier helper in `frontend/src/utils/voiceDomainHints.ts` (regex sets per domain)
- Mounted in 3 places: `InsightsPanel.tsx`, `MarketingAIPanel.tsx`, `HelpAssistantLauncher`'s panel (whatever its real component name is)
- States: IDLE / LISTENING / TRANSCRIBING / EDIT_CONFIRM (with optional cross-domain choice variant)
- Reuses the Layer 1 STT endpoint (Whisper) and the Layer 2 router (only on suspected mismatch)
- Same audit logging as global voice; same spend-cap accounting; cross-domain router calls also audited

Why D3 (hybrid) over "always skip router" or "always route":
- **Always-skip** (original 2026-05-28 proposal): cross-domain follow-ups get silently sent to the wrong panel, decline copy fires, user retypes — broken UX.
- **Always-route**: every per-panel voice turn pays the router cost (~$0.0002 + ~300ms latency), even though 90% of follow-ups stay in-domain — unnecessary overhead.
- **D3 hybrid**: in-domain follow-ups (the common case) pay nothing extra. Cross-domain follow-ups (the rare case) pay router cost only when needed AND the user actually benefits from the cross-domain handoff.

Cost per per-panel voice turn:
- Common case (in-domain): STT $0.001 + downstream ~$0.018 = **~$0.019**
- Mismatch case (~10% of turns): STT $0.001 + router $0.0002 + downstream ~$0.018 = **~$0.0192**
- Negligible difference; under 1% of total turn cost.

Why include per-panel mics in v1 instead of deferring:
- Marginal effort is small (~2-3 days, was 1.5-2 days; bumped after adding the hybrid handoff)
- Mental model consistency: "voice works everywhere AND knows which panel you mean" is simpler than "voice on dashboard, then type inside panels, then context-switch manually for cross-domain"
- Hands-free scenarios: shop owners on the shop floor never lose voice
- Accessibility: users with typing difficulties never have to type
- Continuity: voice flows can cross panels without context-switching to keyboard

What this does NOT add:
- No mandatory router call on every per-panel voice (the client check skips it for in-domain turns)
- No new UI primitives beyond the shared mic component + the cross-domain choice variant of the edit-confirm card
- No change to existing panel send-action behavior — transcript becomes input text either way

### 4.5 Out of scope for v1

- **Voice OUTPUT (TTS)** — design shows text/card response only. Defer ElevenLabs / OpenAI TTS to a v2 if "have AI read responses aloud" becomes a real request.
- **Real-time bidirectional voice** — no full-duplex conversation. The mic captures one utterance, processes, responds visually. No interruption / barge-in handling.
- **Booking + Inventory AI tools** — those domains don't have AI tool layers yet. v1 router classifies them as `OUT_OF_SCOPE` until tools are built. Scope §6 phasing.
- **Proactive recommendations engine** (the "AI Recommendations for You" cards in the design) — separate workstream; needs cron-job + signal-detection design. Could reuse the AI insights anomaly detector pattern.
- **Phone integration (Twilio + customer voice booking)** — entirely different product. Different scope doc when/if you go that direction.
- **Mobile-app deep-linking** — bottom-nav yellow button on a web dashboard is a different surface from a native-mobile mic button. v1 = web only.

---

## 5. Decisions to lock (8 open questions)

Recommendations in **bold**. These need answers before an implementation plan.

1. **Q1 — Single unified AI panel, separate panels with router-to-new-unified-response, or separate panels with router-opens-existing-panel?**

   Refined 2026-05-28 after discussion. There are actually three options, not two:

   - Option A: **Keep 4 panels separate; voice OPENS the matching existing panel with the transcript pre-filled (Recommended).** Voice → STT → router decides domain → opens Insights/Marketing/Help panel directly with the transcript as the first user message. The existing panel takes over with all its native UX (pinned questions, anomaly banner, draft modal, article corpus). No new response surface; voice is a smart shortcut into what's already built.
   - Option B: Keep 4 panels separate; voice routes to a NEW unified response panel that renders cards from whichever domain came back. Was the original proposal. Rejected — introduces a 5th surface to maintain that duplicates the existing 4's rendering.
   - Option C: Unify all 4 into a single mega-panel with all tools combined. Bigger refactor, loses every domain-specific UX affordance, mega-prompt is expensive + slow, and Claude struggles to keep 15+ cross-domain tool guidance straight. Rejected.

   **Why Option A wins over B + C:**
   - Specialized UX is genuine value, not gloss — Insights pinned/anomaly/range, Marketing draft modal, Help corpus citations took real work to build and would have to be re-implemented OR lost under B/C.
   - Each panel's system prompt is domain-tuned (Insights rule 5 on time ranges, Marketing rule 4 on discount hallucination, Help corpus rules) — merging breaks the per-domain rule tuning.
   - Cost + latency: small per-domain Sonnet call + Haiku router (~$0.001, ~6s) cheaper and faster than one mega-Sonnet call with all tools (~$0.05+, ~12s+).
   - STT will mistranscribe sometimes; opening the existing panel with transcript pre-filled means the shop owner can edit before sending, and can fall back to the manual sidebar launchers if the router got the domain wrong.

2. **Q2 — STT vendor?**
   - Option A: **OpenAI Whisper API (Recommended).** Best quality, cheap, well-understood.
   - Option B: Deepgram Nova-3. Faster but English-bias.
   - Option C: Browser SpeechRecognition. Free but unreliable; not for a paid feature.

3. **Q3 — v1 command scope: which domains does the router cover?**
   - Option A: **Insights + Marketing + Help only (Recommended).** Three working backends; OUT_OF_SCOPE for booking/inventory/anything else.
   - Option B: Add stubs for Booking + Inventory that say "coming soon." More polished UX but invites confusion when those domains can't actually act.

4. **Q4 — Router model: Sonnet or Haiku?**
   - Option A: **Haiku (Recommended).** Routing is a simple 4-way classification. ~10x cheaper, ~3x faster.
   - Option B: Sonnet. More accurate on edge cases but overkill for the task.

5. **Q5 — Voice-output (TTS) in v1?**
   - Option A: **No (Recommended).** Design shows text-only output. Defer.
   - Option B: Yes — adds OpenAI TTS / ElevenLabs. ~+$5/shop/month at moderate usage. Doubles cost surface.

6. **Q6 — How does the voice pill handle background sound / fail-cases?**
   - **Recommended:** show transcript inline as it arrives so the shop owner can correct typos; allow tap-to-edit before dispatching.
   - 100% confidence in STT is unrealistic; always offer a confirm-or-edit step before the AI acts.

7. **Q7 — Mobile dashboard parity (bottom yellow + button)?**
   - Option A: **Same web endpoint, just a different launcher position (Recommended).** Browser-based PWA can hit the same endpoint.
   - Option B: Native mobile app rebuild — out of scope, but flag for the mobile workstream.

8. **Q8 — Where does proactive AI recommendations card data come from?**
   - Open product question. Two routes:
     - **Cron-job that runs nightly + writes to a `ai_recommendations` table** (similar to the Insights anomaly detector that already exists)
     - **Stub the cards with hand-tuned rules** for v1 (e.g., "if shop has >100 customers with last_visit > 60 days → show Win-Back card")
   - Recommendation: stub with hand-tuned rules in v1 (fast to ship), evolve to AI-driven in v1.5 once we know which cards shops actually engage with.

9. **Q9 — Voice entry points inventory (added 2026-05-28)**

   How many places can a shop owner invoke voice? Locked answer below — explicit because previous strategy docs had conflicting promises (Insights phase-7-scope.md once proposed a per-panel mic-next-to-send-button via Web Speech API; that promise is superseded by this answer).

   **v1 ships FOUR voice entry points, all sharing the same STT endpoint (Whisper):**

   | Entry point | Location | Behavior |
   |---|---|---|
   | **Dashboard pill** | Center-bottom of `/shop` home (matches voice.jpeg) | Big purple pill, primary affordance. Goes through router → opens target panel. |
   | **Header mic icon** | Top-right action cluster on every web page, alongside Help/Insights/Marketing launchers | Small mic button. Same flow as dashboard pill (router → panel). Provides voice on pages other than home. |
   | **Mobile bottom-nav `+`** | Yellow `+` button labeled "One tap to do anything" on mobile bottom-nav (matches voice.jpeg) | Same flow as dashboard pill, mobile-positioned. |
   | **Per-panel inline mic** | Next to send button inside Insights, Marketing, Help panels | D3 hybrid: client keyword check first. If transcript signals match current panel → skip router, drop transcript into textarea. If signals point at a different domain → call router (Haiku) to confirm, then surface cross-domain choice card ("Send to current panel" / "Open other panel instead"). Covers both in-domain follow-ups and cross-domain handoff without context-switching to keyboard. See §4.4. |

   The first three entry points always dispatch through the router (Layer 2). The per-panel mic conditionally dispatches through the router (only on suspected cross-domain mismatch — Layer 4 + D3 hybrid). All four share the Layer 1 STT endpoint.

   Customer-facing surfaces (Sales Agent chat) are out of scope for v1 — different audience, different auth, different rate-limit model.

---

## 6. Phasing plan

Seven phases (was six — Phase 5.5 per-panel mic added 2026-05-28), ~3 weeks of work for the full v1.

### Phase 1 — STT capture endpoint (1-2 days)

- New `POST /api/ai/voice/transcribe` endpoint backed by Whisper API
- `OPENAI_API_KEY` env var added (new dependency)
- Spend-cap counts STT cost toward `current_month_spend_usd`
- Audit log: per-call duration + cost into a new `ai_voice_transcriptions` table (or reuse `ai_marketing_messages`-style audit pattern)

Acceptance: cURL POST a 10s WebM file → returns transcript JSON.

### Phase 2 — Voice command pill UI (1-2 days)

- `VoiceCommandPill` component on dashboard home (renders voice.jpeg's center design)
- MediaRecorder integration with mic permission flow
- Recording-state visual feedback (pulse animation, "Listening…" label)
- Auto-stop on 1.5s silence OR explicit tap
- Shows transcript inline once Phase 1 returns it
- Edit-before-dispatch handle (per Q6)

Acceptance: tap mic → speak → see transcript → tap "Send"

### Phase 3 — Cross-domain router (3-5 days, the meaty one)

- New `POST /api/ai/dispatch` endpoint
- Internal router using Haiku (4-way classification: INSIGHTS / MARKETING / HELP / OUT_OF_SCOPE)
- Internal dispatch to existing handler endpoints (`/api/ai/insights`, `/api/ai/marketing-chat`, `/api/ai/help`)
- Audit log captures: original transcript, router decision, downstream endpoint cost
- Streaming response back to client

Acceptance: POST `{transcript: "create a black friday campaign"}` → routes to Marketing → returns same response shape that Marketing endpoint returns directly.

### Phase 4 — Open target panel with transcript pre-filled (1 day)

Refined from the original "unified response surface" plan after the 2026-05-28 architecture discussion (see §5 Q1). Voice opens the existing panel rather than introducing a 5th response surface.

- After Phase 3's router returns `{ domain, transcript }`, the frontend opens the matching Sheet from `DashboardLayout` (InsightsLauncher / MarketingAILauncher / HelpAssistantLauncher)
- Seeds the target panel's input state with the transcript
- Triggers the panel's "send" so the existing panel's agent loop kicks off automatically
- Visual handoff: small toast or pill animation showing *"Asked Insights"* / *"Asked Marketing"* so the shop owner understands where the question went
- OUT_OF_SCOPE: voice pill renders the templated decline inline (no panel opens)

Acceptance: tap mic → speak *"who are my top customers this week"* → Insights panel slides open with the question pre-filled and Claude already replying.

### Phase 5 — OUT_OF_SCOPE handling + edit-before-send (1 day)

- Router OUT_OF_SCOPE classification returns templated message: "I can't help with that yet — try the Insights panel, Marketing panel, or Help."
- Edit-before-send guard from Phase 2 polished
- Error states: mic permission denied, STT failed, dispatch failed — all surface as inline error banners

Acceptance: speak "book Alex Johnson at 2pm" → response: "Booking by voice is coming later. Use Bookings tab to schedule manually."

### Phase 5.5 — Per-panel inline mic with hybrid cross-domain handoff (2-3 days)

Added 2026-05-28 to cover follow-up turns inside panels; refined the same day to include D3 hybrid cross-domain handoff (see §4.4 and §5 Q9).

- New shared `<InlineVoiceMic />` component — small mic button alongside each panel's existing send button
- New shared `frontend/src/utils/voiceDomainHints.ts` keyword-classifier helper (regex sets per domain — Insights / Marketing / Help)
- Reuses the Phase 1 STT endpoint; reuses the Phase 3 router ONLY when client keyword check suggests cross-domain mismatch
- Mount in 3 places: `InsightsPanel.tsx`, `MarketingAIPanel.tsx`, Help panel
- States: IDLE / LISTENING / TRANSCRIBING / EDIT_CONFIRM (with cross-domain choice variant when applicable)
- Edit-confirm step preserved (per Q6); cross-domain choice card surfaces when router confirms mismatch
- Same audit logging as global voice; cross-domain router calls also audited; same spend-cap accounting

Acceptance criteria (two scenarios):

1. **In-domain follow-up (no router call):** open Marketing panel, tap inline mic, speak *"make the subject more urgent"*, see transcript in edit-confirm, tap Send → message lands in Marketing chat → AI responds. Router was NOT called; cost ~$0.019 per turn.

2. **Cross-domain handoff:** open Marketing panel, tap inline mic, speak *"what's my revenue this week?"*, see transcript with cross-domain choice card (*"This looks like an Insights question. [Send to Marketing] [Open Insights instead]"*), tap "Open Insights instead" → Marketing panel closes (preserving draft), Insights panel opens with transcript pre-filled, AI responds. Router WAS called; cost ~$0.0192 per turn.

### Phase 6 — QA + cost calibration (1-2 days)

- Fixtures: 10 staged voice clips covering all 4 router classifications + edge cases
- Cost report: per-flow STT cost, router cost, downstream Sonnet cost — total cost per voice command
- Latency report: STT round-trip + router latency + downstream latency
- Target: < $0.05 per voice command average, < 6s end-to-end perceived latency

Mirror the `v1-cost-report.md` pattern from AI Marketing.

---

## 7. Risk checklist

| Risk | Likelihood | Mitigation |
|---|---|---|
| STT transcribes a destructive command wrong → AI executes wrong action | Medium | Edit-before-dispatch is mandatory (Q6). Mass-send confirmation modal (existing) still required even when triggered by voice. |
| Router misclassifies and forwards to wrong domain | Medium | Show "Asked [domain]" chip; shop owner can retry. Haiku at ~95% accuracy on 4-way classification per benchmarks. |
| Latency too high (6s+ end-to-end) → users abandon | Medium-High | STT is the long pole (~2-4s on Whisper for a 10s clip). Consider Deepgram if complaints surface. Show transcript progress streaming. |
| Mic permission UX surprise / browser inconsistency | High | Permission prompt copy + fallback to text input always available. iOS Safari behaves differently than Chrome; QA across browsers. |
| Cost spike — voice users 5x more chatty than text users | Unknown | Spend cap covers it; daily-drafts guard still applies; new voice-specific rate limit if needed (e.g., 100 voice commands/day per shop). |
| Privacy concerns about sending audio to OpenAI | Medium | Document in privacy policy; OpenAI's terms commit to not training on API data; offer "type instead of speak" path for users who prefer it. |
| Shop owners don't actually use voice (touchscreen-on-laptop UX is awkward) | Unknown | Phase 6 cost report includes engagement metrics; pull voice-vs-text usage breakdown weekly post-launch. |

---

## 8. Open product questions (NOT for engineering to decide)

These are explicitly product-side decisions, not in engineering scope:

1. **Pricing — is this a Pro Plan feature?** Design top-right says "Pro Plan." If voice is a paid-tier benefit, billing needs to gate it. Currently AI Marketing is gated by admin (not Pro tier); voice would need a different gate, OR Pro Plan becomes the gate for ALL AI surfaces.

2. **Proactive recommendations cards** — who decides which cards show? AI-driven (cron + Anthropic), rules-driven (hard-coded thresholds), or hybrid? Affects whether this lands in Phase 6 or its own follow-up.

3. **"AI Assistant" sidebar nav target** — does tapping it open a Insights-like full-screen surface, or the voice command pill? Design shows the sidebar item but doesn't specify destination.

4. **Mobile-app rollout** — does voice ship on web first, then mobile-native, or both at once? Mobile-native would need Expo + native audio capture (not Web Audio API).

5. **Multi-shop owners** — if a shop owner manages 3 shops, voice command "show revenue" should mean which shop? Currently each AI surface is shop-scoped via JWT — voice needs same scoping but maybe a quick shop-picker.

---

## 9. Rough effort estimate

**v1 minimum** (all 7 phases): **~12-16 days** of focused engineering.

Per-phase breakdown:

| Phase | Work | Days |
|---|---|---|
| 1 | STT capture endpoint (Whisper API + audit) | 1-2 |
| 2 | Voice command pill UI (dashboard pill + header mic icon on every page; MediaRecorder + recording state) | 1-2 |
| 3 | Cross-domain router (Haiku 4-way + internal dispatch) | 3-5 |
| 4 | Open target panel with transcript pre-filled (no new surface) | 1 |
| 5 | OUT_OF_SCOPE handling + edit-before-send + error states | 1 |
| 5.5 | Per-panel inline mic + D3 hybrid cross-domain handoff (component + keyword classifier + 3 panel wirings + cross-domain choice card variant) | 2-3 |
| 6 | QA fixtures + cost calibration | 1-2 |

Three refinements vs the original 11-15 estimate:
- Phase 4 dropped from 2-3 days to 1 day (§5 Q1 — voice opens existing panel, no new unified surface to build)
- Phase 5.5 added at 1.5-2 days (§5 Q9 — per-panel inline mic for follow-ups inside panels)
- Phase 5.5 then bumped to 2-3 days (§4.4 D3 hybrid — adds keyword classifier + cross-domain choice card)

Net effect: ~12-16 days (was 12-15 after the per-panel mic add; 10-13 after Phase 4 refinement only; 11-15 in the original).

**v2 follow-up:**
- Booking + Inventory AI tools so the router can route to more domains: **+ ~5-10 days** depending on which operations get AI'd
- Proactive recommendations cards (the "AI Recommendations for You" rail in voice.jpeg): **+ ~3-5 days** for the cron + signal-detection pattern (can reuse the Insights anomaly detector shape)

**v3 (unscoped, defer to data):**
- Panel unification: only revisit if post-launch usage data shows shop owners struggle with the 4-panel split EVEN WITH the voice shortcut
- Real-time bidirectional voice (TTS / phone integration): separate product, separate scope doc

---

## 10. Procurement & cost summary (for exec)

Short answer: **one new vendor relationship needed — OpenAI for speech-to-text. Everything else is already in place.**

### 10.1 Needed to start

| Service | What we use it for | Status | Cost model |
|---|---|---|---|
| **OpenAI API** (Whisper STT) | Speech-to-text — the only new dependency | ❌ Not procured | $0.006/minute of audio, pay-as-you-go (no subscription, no minimums) |

Procurement steps (someone with company billing authority):
1. Create an account at `platform.openai.com`
2. Add a payment method (corporate card)
3. Generate an API key
4. Set a spend cap inside the OpenAI dashboard for safety — recommend **$200/month** initially while we calibrate, raise as adoption grows
5. Hand the key to engineering — we add it as `OPENAI_API_KEY` env var on staging + prod DigitalOcean

No long-term contract, no minimums, no monthly fee — pure usage billing.

### 10.2 Already in place (no new procurement)

| Service | Used for | Status |
|---|---|---|
| Anthropic Claude API | Router (Haiku) + downstream panel responses (Sonnet) | ✅ Already integrated; existing `AnthropicClient` instance |
| DigitalOcean Postgres | Audit logging (`ai_voice_transcriptions` table — to be added) | ✅ Existing shared connection pool |
| DigitalOcean App Platform | Hosts the new `/api/ai/voice/transcribe` endpoint | ✅ Existing prod + staging apps |
| Vercel | Frontend mic UI deploys (dashboard pill, header icon, inline mic) | ✅ Existing |
| Browser MediaRecorder API | Audio capture on the client | ✅ Browser-native, no procurement |

### 10.3 Cost projection

**Per voice command** (single utterance, ~10s audio):
- Whisper STT: **$0.001**
- Cross-domain router call (Haiku, fires on ~10% of per-panel turns and on all global-voice turns): up to $0.0002
- Downstream Sonnet response: ~$0.018 (covered by existing Anthropic spend, already counted in shop spend cap)
- **Total per command: ~$0.019**

**Per shop per month** (heavy user, ~500 voice commands):
- ~$10/shop/month
- Fits inside the existing $20/shop/month AI spend cap — no new billing surface needed

**Platform-wide** (50 active shops at heavy usage):
- ~$500/month at scale
- The $200/month OpenAI spend cap at launch protects against overrun while we calibrate; raise the cap as voice adoption confirms the projection

### 10.4 Privacy + compliance notes

For legal/compliance review before launch:

- OpenAI's API terms **explicitly commit to not training on API data** (different from the consumer ChatGPT product). API submissions are treated as confidential.
- Audio is processed and discarded; OpenAI retains submitted data for 30 days for abuse-monitoring purposes only, then deletes.
- No customer PII in voice transcriptions unless the shop owner explicitly says it (e.g., *"send a campaign to Alex Johnson"*) — same data classification as the existing text chat surfaces, which the privacy policy already covers.
- **Action item:** update the privacy policy to mention that *"voice commands may be sent to OpenAI for transcription"* before launch.

### 10.5 Possibly needed later (NOT v1)

These are vendors we MIGHT procure if specific issues surface — not part of the v1 build:

| Vendor | Trigger to procure | What it'd cost |
|---|---|---|
| **Deepgram** | Whisper latency complaints surface during Phase 6 calibration | $0.0125/min, slightly more expensive but ~3x faster |
| **OpenAI TTS** or **ElevenLabs** | If design adds voice OUTPUT (AI reads responses aloud) in v2 | $0.015/1K chars (OpenAI) or ~$0.30/min (ElevenLabs) |
| **Twilio** | If/when customer-calls-the-shop voice booking becomes a product direction | $1-2/phone number/month + per-minute costs; separate scope doc |

### 10.6 Bottom line for the exec

> *"We need one new vendor relationship — OpenAI for speech-to-text. Pay-as-you-go, no contract. Expected cost ~$10/shop/month at heavy use, ~$200/month platform-wide spend cap to start. Everything else (Claude, hosting, database, frontend) is already in place. The only legal touchpoint is a one-line privacy-policy update before launch."*

---

## 11. Why this is worth doing

The exec design framing ("One tap to do anything," "AI Assistant — NEW," Pro Plan badge) suggests the platform wants voice to be the **headline differentiator** for the AI features that already exist. Today those features are powerful but discoverable only if a shop owner explicitly opens 4 separate panels. Voice + cross-domain routing collapses the cognitive cost of using AI — it's the same value the AI Marketing chat panel delivered for marketing, applied platform-wide.

The bet: a shop owner is more likely to USE AI Insights / Marketing / Help if they don't have to remember which panel does what. Voice + router = one place, all power.

The risk: if the existing AI surfaces aren't being used much today, voice won't change that — voice is an interface improvement, not a value-prop change. Recommend pulling current usage stats on the 4 AI surfaces BEFORE committing to the 3-week build, just to confirm the assumption.

---

## 12. Next step

If the decisions in §5 land roughly where the recommendations point:

1. Pull current usage data on the 4 AI surfaces (Insights / Marketing / Help / Sales Agent) — how many shops opened each panel in the last 30 days; how many sent at least 3 messages. This confirms the "voice will multiply usage of existing AI" hypothesis isn't speculation.
2. Lock the 8 decisions in §5.
3. Write `voice-ai-dispatcher-implementation.md` with phase-level checkboxes (mirror the AI Marketing campaign impl-doc pattern).
4. Phase 1 first — pure STT endpoint, smallest blast radius.

No code work until decisions land.

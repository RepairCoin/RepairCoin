# Implementation Plan — Voice-first AI Dispatcher

**Status:** Plan only — code not started.
**Companion docs (read first):**
- `scope.md` — strategy + architecture + 8 decisions
- `user-flow.md` — voice UX flows + state machine

**Created:** 2026-05-29
**Base branch:** off latest `main`. Suggested branch prefix:
`deo/voice-dispatcher-phase-<N>-<slug>`.

---

## 1. Decisions captured (no open questions)

All 9 decisions from `scope.md` §5 have locked recommendations.
Repeating them here so the engineer doesn't re-relitigate during
implementation:

| # | Decision | Source |
|---|---|---|
| Q1 | **Voice opens the matching existing panel** with the transcript pre-filled. No new unified response surface. Insights / Marketing / Help panels keep all their domain-tuned UX. | scope.md §4.3, §5 Q1 |
| Q2 | **STT vendor = OpenAI Whisper API.** $0.006/minute, pay-as-you-go. | scope.md §4.1, §5 Q2 |
| Q3 | **v1 router covers Insights / Marketing / Help only.** Booking + Inventory + anything else → `OUT_OF_SCOPE` with templated decline. | scope.md §4.5, §5 Q3 |
| Q4 | **Router runs on Haiku** (Claude Haiku 4.5). 4-way classification doesn't need Sonnet. | scope.md §4.2, §5 Q4 |
| Q5 | **No TTS in v1.** Text/card output only. | scope.md §4.5, §5 Q5 |
| Q6 | **Edit-before-dispatch is mandatory.** Transcript always rendered for review/edit before the request fires. | scope.md §5 Q6 |
| Q7 | **Same web endpoint for mobile.** Browser-based PWA hits the same `/api/ai/voice/*` routes. Native rebuild deferred. | scope.md §5 Q7 |
| Q8 | **Proactive recommendation cards** (the "AI Recommendations for You" rail) — **out of scope for voice v1.** Separate workstream. | scope.md §4.5, §5 Q8 |
| Q9 | **Four voice entry points in v1:** dashboard pill, header mic icon, mobile bottom-nav `+`, per-panel inline mic with D3 hybrid cross-domain handoff. | scope.md §5 Q9 |

**Procurement status:** OpenAI API key is provisioned. To be loaded
as `OPENAI_API_KEY` from `backend/.env` — never embedded in code,
never committed.

**Outside-engineering action item:** one-line privacy policy update
mentioning that *"voice commands may be sent to OpenAI for
transcription"* — coordinate with whoever owns the policy text
before launch. Not a code blocker.

---

## 2. Reusable infrastructure (do NOT rebuild)

### 2.1 Backend

- **`AnthropicClient`** — already wired for Sonnet calls. Add a
  `model` parameter so the router can request Haiku without a new
  client.
- **`SpendCapEnforcer`** — already gates per-shop AI spend. STT
  cost + router cost + downstream cost all flow through it.
- **Domain pattern** — voice work lives in the existing
  `AIAgentDomain` (`backend/src/domains/AIAgentDomain/`). No new
  domain.
- **Existing audit pattern** — `ai_marketing_messages`,
  `ai_insights_messages`, `ai_conversation_audit` all share the
  same schema shape: `shop_id`, `session_id`, `model`,
  `input_tokens`, `output_tokens`, `cost_usd`, `tool_calls`,
  `latency_ms`, `error_message`, `created_at`. Mirror this for
  voice.
- **Existing dispatch handlers** — voice does NOT re-implement the
  agent loops. Router calls into the existing handlers
  programmatically:
  - `services/insights/dispatcher.ts` (or whatever the function
    that the `/api/ai/insights` controller calls) — reuse directly
  - `services/marketing/dispatcher.ts` — same
  - Help endpoint — same
- **Shared DB pool** — `database-pool.ts`. No new pool.

### 2.2 Frontend

- **`DashboardLayout.tsx`** — existing launcher cluster top-right.
  Add header mic icon there; the dashboard pill mounts on the home
  page (separate component).
- **`InsightsLauncher`, `MarketingAILauncher`,
  `HelpAssistantLauncher`** — already coordinate panel open/close
  state via Sheet. Voice doesn't fork these; it triggers them.
- **`InsightsPanel.tsx`, `MarketingAIPanel.tsx`, Help panel
  component** — expose an imperative `seedInputAndSend(transcript)`
  handler so the router can open a panel AND start the conversation
  in one step. Add as a ref or via a Zustand-store action — pick
  whichever matches each panel's existing state model.
- **Existing axios client + response unwrap interceptor** — voice
  endpoints follow the same `{success, data: ...}` envelope; call
  sites read `response.data.<key>` (NOT `.data.data.<key>`).

### 2.3 What's actually new in this build

- 2 new backend endpoints (`/api/ai/voice/transcribe`, `/api/ai/dispatch`)
- 1 new audit table (`ai_voice_transcriptions`)
- ~4 new frontend components (`VoiceCommandPill`, `HeaderVoiceMic`,
  `MobileBottomNavMic`, `InlineVoiceMic`)
- 1 new util file (`voiceDomainHints.ts` — keyword classifier)

Everything else reuses existing infrastructure.

---

## 3. Security and secret hygiene

The OpenAI key is high-cost-if-leaked (Whisper bills per minute of
audio; a leaked key can be spent against). Strict handling:

- [ ] Key lives ONLY in `backend/.env` as `OPENAI_API_KEY=sk-proj-...`.
- [ ] `.env` is already in `.gitignore`; verify before first commit.
- [ ] DigitalOcean staging + prod set the env var via their App
  Platform UI; never check it into a `.env.example` or sample file.
- [ ] If the key needs to be rotated, the rotation procedure is:
  generate new key on `platform.openai.com` → set new env var on
  staging → smoke test → set new env var on prod → smoke test →
  delete old key from OpenAI. Never delete the old key before the
  new one is live everywhere — that downs voice for every shop.
- [ ] On every new engineer joining: add them to whichever shared
  password manager holds the key. Never paste it in chat / Slack /
  Notion / email.
- [ ] Audit: `git log -p backend/.env` should return no rows. Run
  this check before every push.

---

## 4. Phasing

Seven phases. Phase numbers match `scope.md` §6 for traceability.
Total: ~12-16 days.

---

### Phase 1 — STT capture endpoint (1-2 days)

**Goal:** server-side Whisper integration with audit + spend-cap.

**Backend deliverables**

- [ ] Migration `NNN_create_ai_voice_transcriptions.sql`:
  ```sql
  CREATE TABLE ai_voice_transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    duration_ms INTEGER NOT NULL,
    audio_size_bytes INTEGER NOT NULL,
    cost_usd NUMERIC(10, 6) NOT NULL,
    transcript TEXT NOT NULL,
    latency_ms INTEGER NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_ai_voice_transcriptions_shop_id
    ON ai_voice_transcriptions(shop_id, created_at DESC);
  ```

- [ ] New file `backend/src/services/openai/WhisperClient.ts`:
  - Reads `OPENAI_API_KEY` from `process.env`; throws on startup
    if missing.
  - One method: `async transcribe(buffer: Buffer, mimeType: string,
    durationMs: number): Promise<{ transcript: string,
    costUsd: number, latencyMs: number }>`.
  - POSTs multipart/form-data to
    `https://api.openai.com/v1/audio/transcriptions` with
    `model=whisper-1`, audio file, optional `language=en`.
  - Cost calculation: `(durationMs / 60000) * 0.006`.

- [ ] New endpoint `POST /api/ai/voice/transcribe`:
  - Multipart upload — `multer` or `busboy` middleware. Cap upload
    at **5 MB** (covers ~60s of compressed audio).
  - JWT shop-scoped; rejects without shop role.
  - `SpendCapEnforcer.canSpend(shopId, estimatedCost)` BEFORE the
    Whisper call. Estimated cost = `(audioDurationMs / 60000) * 0.006`.
    Frontend sends duration; backend trusts it for the pre-check
    only (real cost computed post-Whisper).
  - Calls `WhisperClient.transcribe()`.
  - Writes audit row regardless of success / failure.
  - Returns `{ success: true, data: { transcript: string,
    durationMs: number, sessionId: string } }`.
  - On error: writes audit row with `error_message`, returns 500
    with sanitized error.

- [ ] Wire endpoint into `AIAgentDomain.routes.ts`.

**Acceptance**

```bash
curl -X POST http://localhost:4000/api/ai/voice/transcribe \
  -H "Authorization: Bearer <jwt>" \
  -F "audio=@test-10s.webm" \
  -F "durationMs=10000"
# → 200 { success: true, data: { transcript: "...", durationMs: 10000, sessionId: "..." } }
```

Audit row visible:
```sql
SELECT shop_id, duration_ms, cost_usd, length(transcript), latency_ms
FROM ai_voice_transcriptions ORDER BY created_at DESC LIMIT 1;
-- cost_usd ≈ 0.001 for a 10s clip
```

---

### Phase 2 — Voice command pill UI (1-2 days)

**Goal:** the center pill from `voice.jpeg` works end-to-end against
Phase 1. Header mic icon shares the same recording component.

**Frontend deliverables**

- [ ] New shared hook `frontend/src/hooks/useVoiceRecorder.ts`:
  - States: `idle | requesting_permission | listening | transcribing |
    error`
  - `start()` → mic permission → MediaRecorder (WebM/Opus, 16kHz)
  - `stop()` → returns Blob + durationMs
  - Auto-stop after **1.5s of silence** (volume threshold via
    AudioContext analyser node, NOT a fixed timer).
  - Cleans up `MediaStream` tracks on unmount / error.
  - Browser compat note: iOS Safari needs the recording started on
    a user-gesture handler (mic-button onClick), not async-later.

- [ ] New component `frontend/src/components/voice/VoiceCommandPill.tsx`:
  - Visual matches `voice.jpeg` center pill (rounded purple
    container, mic icon centered, label "Ask AI Anything", subtitle
    "AI will handle the rest" or rotating example placeholder).
  - Uses `useVoiceRecorder`.
  - State machine:
    `IDLE → LISTENING (pulse animation) → TRANSCRIBING (spinner) →
     EDIT_CONFIRM (transcript visible, "Send" + "Edit" buttons)`
  - On Send → calls Phase 3's `/api/ai/dispatch` (stub for now;
    full impl in Phase 3).
  - Mount on `/shop` home page.

- [ ] New component `frontend/src/components/voice/HeaderVoiceMic.tsx`:
  - Small mic-icon button matching the rest of the
    `DashboardLayout` action cluster.
  - Same hook, same state machine, same dispatch.
  - Opens a small popover for the EDIT_CONFIRM step (so it doesn't
    take over the whole page on follow-up turns).

- [ ] Wire `HeaderVoiceMic` into `DashboardLayout.tsx` alongside
  the existing `InsightsLauncher`, `MarketingAILauncher`,
  `HelpAssistantLauncher`.

- [ ] Use **shadcn** for buttons / popovers / spinners — match
  the existing AI panel components' visual language.

**Acceptance**

- Tap pill → browser asks for mic permission → grant → "Listening…"
  with pulse → speak → auto-stop after 1.5s silence → transcript
  appears → tap Send.
- Tap header mic icon → popover opens with same flow.
- Permission denied → user-friendly error: *"Mic permission needed.
  Enable in your browser settings and try again."*

---

### Phase 3 — Cross-domain router (3-5 days, the meaty one)

**Goal:** transcripts get routed to the right existing handler.
This is where most of the architecturally-new work lives.

**Backend deliverables**

- [ ] Migration `NNN_create_ai_dispatch_audit.sql`:
  ```sql
  CREATE TABLE ai_dispatch_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    transcript TEXT NOT NULL,
    transcript_source VARCHAR(20) NOT NULL,   -- 'voice' | 'inline_mic'
    router_decision VARCHAR(20) NOT NULL,     -- 'insights' | 'marketing' | 'help' | 'out_of_scope'
    router_skipped BOOLEAN NOT NULL DEFAULT FALSE,  -- true when client keyword check matched in-domain (Phase 5.5)
    router_input_tokens INTEGER,
    router_output_tokens INTEGER,
    router_cost_usd NUMERIC(10, 6),
    latency_ms INTEGER NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_ai_dispatch_audit_shop_id
    ON ai_dispatch_audit(shop_id, created_at DESC);
  ```

- [ ] New file
  `backend/src/domains/AIAgentDomain/services/voice/VoiceRouter.ts`:
  - Single function:
    `async classifyDomain(transcript: string): Promise<{
       domain: 'insights' | 'marketing' | 'help' | 'out_of_scope',
       inputTokens: number,
       outputTokens: number,
       costUsd: number,
       latencyMs: number
     }>`.
  - Uses `AnthropicClient` with `model: 'claude-haiku-4-5-20251001'`.
  - System prompt (cache-control: ephemeral so subsequent calls hit
    cache):
    ```
    You are a routing assistant for a shop owner's voice command.
    Pick exactly ONE of these four domain labels:
      - INSIGHTS    — questions about the shop's own data
                      (revenue, customers, bookings, services,
                      AI assistant impact, inventory)
      - MARKETING   — sending campaigns, drafting emails,
                      promotional offers, win-back outreach
      - HELP        — "how do I…", "where is…", "what is…"
                      product/feature questions
      - OUT_OF_SCOPE — anything else (booking actions,
                       inventory changes, general chat)

    Respond with ONLY the label. No explanation, no punctuation.
    ```
  - User message = the raw transcript.
  - Output validation: if Claude returns anything other than one of
    the 4 labels, normalize to `OUT_OF_SCOPE` and log a warning.

- [ ] New endpoint `POST /api/ai/dispatch`:
  - Body: `{ transcript: string, sessionId: string,
    sourceHint?: 'inline_mic_marketing' | 'inline_mic_insights' |
    'inline_mic_help' | 'global' }`
  - Steps:
    1. `SpendCapEnforcer.canSpend(shopId, estimatedRouterCost +
       estimatedDownstreamCost)` — if no, return decline + log.
    2. Call `VoiceRouter.classifyDomain(transcript)`.
    3. Write `ai_dispatch_audit` row with router decision.
    4. Return `{ success: true, data: { domain, transcript,
       sessionId, routerSkipped: false } }`.
  - Note: this endpoint does NOT internally dispatch to the
    Insights / Marketing / Help handlers. It returns the domain
    decision and lets the frontend open the matching panel. The
    panel then makes its own existing call. This keeps each
    panel's existing flow intact (Q1 / §4.3 architecture).

- [ ] Wire endpoint into `AIAgentDomain.routes.ts`.

**Frontend deliverables**

- [ ] Update `VoiceCommandPill` + `HeaderVoiceMic`'s Send handler:
  - POST to `/api/ai/dispatch` with the transcript.
  - On `domain === 'out_of_scope'`: render templated decline copy
    inline; do NOT open a panel.
  - On `domain === 'insights' | 'marketing' | 'help'`: trigger the
    corresponding launcher's `openWithTranscript(transcript)`
    handler.

- [ ] Add `openWithTranscript(transcript: string)` to each panel's
  state model:
  - `InsightsPanel` → set first user message + auto-send.
  - `MarketingAIPanel` → set first user message + auto-send.
  - Help panel → set first user message + auto-send.
  - Each panel's existing send flow handles the agent loop, tool
    dispatch, and card rendering.

- [ ] Add visual handoff toast: small "Asked Insights" /
  "Asked Marketing" / "Asked Help" pill that fades after 2s, so
  the shop owner sees where their request went (router transparency
  from `scope.md` §7 mitigation).

**Acceptance**

- POST `/api/ai/dispatch` with transcript *"create a black friday
  campaign"* → `{ domain: "marketing" }`.
- Same POST with *"who are my top customers"* → `{ domain:
  "insights" }`.
- Same POST with *"how do I export bookings"* → `{ domain: "help" }`.
- Same POST with *"what's the weather"* → `{ domain:
  "out_of_scope" }`.
- Full flow from pill: tap mic → speak → see transcript → tap Send
  → Marketing panel slides open with the question and Claude already
  replying.

---

### Phase 4 — Mobile bottom-nav voice entry (1 day)

**Goal:** the yellow `+` button from `voice.jpeg`. Same flow,
mobile-positioned.

**Frontend deliverables**

- [ ] Detect mobile viewport via existing breakpoint hook (or
  Tailwind responsive classes).
- [ ] New component
  `frontend/src/components/voice/MobileBottomNavMic.tsx`:
  - Fixed-position bottom-nav yellow `+` button matching design.
  - Reuses `useVoiceRecorder` from Phase 2.
  - Reuses the dispatch logic from Phase 3.
  - Opens a fullscreen modal for EDIT_CONFIRM on small screens.
- [ ] Mount on `/shop` mobile breakpoint only; hide on desktop
  (the header mic icon covers desktop).

**Acceptance**

- On mobile viewport: yellow `+` button visible bottom-center →
  tap → fullscreen mic UI → speak → transcript → Send → matching
  panel opens.

---

### Phase 5 — OUT_OF_SCOPE + edit-before-send + error states (1 day)

**Goal:** polish all the non-happy paths.

**Frontend deliverables**

- [ ] OUT_OF_SCOPE inline render:
  > *"I can't help with that yet — try the Bookings tab,
  > Inventory page, or the manual panels."*

- [ ] Edit-before-send polish:
  - Transcript shows in an editable textarea, NOT just plain text.
  - "Edit" button focuses the textarea; "Send" submits whatever's
    in the textarea (may be edited from the original).
  - If user edits, audit row's `transcript` reflects the edited
    version, with original captured in a separate
    `original_transcript` column. Add to migration.

- [ ] Error states (all render as small inline error banners,
  never as native browser alerts):
  - Mic permission denied → *"Mic permission needed. Enable in
    your browser settings and try again."*
  - Mic permission temporarily blocked (browser default) → *"Your
    browser blocked mic access. Click the lock icon in the URL bar
    to allow."*
  - STT failed (network / OpenAI 5xx) → *"Couldn't transcribe.
    Try again, or type your question instead."*
  - Dispatch failed → *"Voice routing is having trouble. Open
    [Insights / Marketing / Help] manually."*
  - Spend cap hit → *"You've reached this month's AI budget.
    Voice will resume next month."* Same copy other surfaces use
    today.

**Acceptance**

- Each error state reachable in dev tools (network throttle, mic
  permission toggle) and renders the correct copy.

---

### Phase 5.5 — Per-panel inline mic + D3 hybrid handoff (2-3 days)

**Goal:** voice works inside Insights / Marketing / Help panels for
follow-up turns. Cross-domain follow-ups gracefully offer to open
the right panel.

**Frontend deliverables**

- [ ] New util `frontend/src/utils/voiceDomainHints.ts`:
  ```ts
  // Regex sets per domain — keyword classifier for the D3 hybrid.
  // Returns the BEST matching domain or null if no signals fire.
  // Match counts are tallied; ties broken by source order
  // (insights > marketing > help).
  const INSIGHTS_RX = /\b(revenue|sales|customer|booking|order|earned|made|grossed|top|stats|metric|breakdown|frequency|tier|RCN balance|cancellation|repeat|time of day|inventory|stock|low stock|turnover)\b/i;
  const MARKETING_RX = /\b(campaign|email|send (to)|win[- ]back|black friday|weekend special|promotion|offer|discount|subject|recipients|draft)\b/i;
  const HELP_RX = /\b(how do I|how to|where is|where do|what is|explain|guide)\b/i;

  export function classifyTranscriptClientSide(
    transcript: string
  ): 'insights' | 'marketing' | 'help' | null { ... }
  ```

- [ ] New shared component
  `frontend/src/components/voice/InlineVoiceMic.tsx`:
  - Small mic button alongside each panel's existing send button.
  - Props: `currentPanel: 'insights' | 'marketing' | 'help'`,
    `onTranscriptReady: (transcript) => void` (for in-domain),
    `onCrossDomainHandoff: (targetDomain, transcript) => void`
    (for cross-domain).
  - Uses `useVoiceRecorder` from Phase 2.
  - State machine:
    `IDLE → LISTENING → TRANSCRIBING → EDIT_CONFIRM` (with optional
    `CROSS_DOMAIN_CHOICE` variant)
  - On transcript ready:
    1. Run `classifyTranscriptClientSide(transcript)`.
    2. If result is null OR matches `currentPanel` → render
       normal EDIT_CONFIRM card; on Send, call
       `onTranscriptReady(transcript)`. **No router call. No cost.**
    3. If result differs from `currentPanel` → POST to
       `/api/ai/dispatch` to confirm. On response:
       - Same domain as `currentPanel` → fall through to normal
         EDIT_CONFIRM.
       - Different → render CROSS_DOMAIN_CHOICE card with
         *"This looks like an Insights question.
         [Send to Marketing] [Open Insights instead]"*
         buttons. User picks.

- [ ] Wire `InlineVoiceMic` into the 3 panels:
  - `InsightsPanel.tsx`
  - `MarketingAIPanel.tsx`
  - Help panel component
- [ ] On cross-domain handoff:
  - Close current panel (preserve draft via Zustand store so it's
    not lost).
  - Open target panel via existing launcher action.
  - Seed target panel input with transcript and auto-send.

**Backend deliverables**

- [ ] `/api/ai/dispatch` already exists from Phase 3 — extend
  audit to set `router_skipped = true` when the client tells us it
  was a confirmation call (`sourceHint = 'inline_mic_*'` with a
  matching `expectedDomain` query — design TBD; simplest is
  always-route from inline mic and let `router_skipped` stay false,
  and track client skips via a separate frontend telemetry event).
- [ ] Actually, simpler: client-side skips just never hit the
  backend. The audit row only exists for calls that actually route.
  Skip rate is observable via frontend analytics (count of
  `voice_inline_skip` events) NOT a `router_skipped` column.
  **Drop the `router_skipped` column from the Phase 3 migration**
  if not already shipped, or leave it for future use.

**Acceptance — two scenarios**

1. **In-domain follow-up (no router call):**
   - Open Marketing panel manually
   - Tap inline mic, speak *"make the subject more urgent"*
   - See transcript in EDIT_CONFIRM, tap Send
   - Marketing chat receives the message; Claude responds
   - No `ai_dispatch_audit` row created for this turn
   - Cost ≈ $0.001 (STT) + downstream (existing Marketing cost)

2. **Cross-domain handoff:**
   - Open Marketing panel manually
   - Tap inline mic, speak *"what's my revenue this week?"*
   - Client keyword classifier flags Insights
   - POST to `/api/ai/dispatch` confirms `domain: insights`
   - CROSS_DOMAIN_CHOICE card renders
   - Tap "Open Insights instead"
   - Marketing panel closes (draft preserved in store)
   - Insights panel opens with transcript pre-filled
   - Insights agent loop runs; Claude responds
   - `ai_dispatch_audit` row exists with `router_decision = 'insights'`

---

### Phase 6 — QA + cost calibration (1-2 days)

**Goal:** real data on cost + latency before declaring v1 stable.

**Deliverables**

- [ ] QA fixtures folder
  `docs/tasks/strategy/voice-ai-dispatcher/qa-fixtures/`:
  - `seed-test-shop.ts` — ensures `peanut` (or designated test
    shop) has enough data across Insights / Marketing / Help that
    each panel responds meaningfully when voice routes there.
    Reuse the inventory seeder from Phase 8.3 if available.
  - `pre-recorded-audio/` folder with 10 staged WebM clips
    covering router classifications:
    - 3 Insights phrasings ("revenue last week",
      "top customers", "low stock items")
    - 3 Marketing phrasings ("black friday campaign",
      "email win-back customers", "promotion for slow days")
    - 2 Help phrasings ("how do I export", "where do I add a
      service")
    - 2 OUT_OF_SCOPE phrasings ("what's the weather",
      "book Alex for 2pm")
  - `replay-fixtures.ts` — POSTs each clip to
    `/api/ai/voice/transcribe` and `/api/ai/dispatch`; asserts
    expected domain.

- [ ] `qa-test-guide.md` addendum
  `docs/tasks/strategy/voice-ai-dispatcher/qa-test-guide.md`:
  - 6 scenarios mirroring the Phase 1-5.5 acceptance criteria
  - Each scenario: Ask → Expect → DB check (audit rows)

- [ ] Cost report
  `docs/tasks/strategy/voice-ai-dispatcher/v1-cost-report.md`
  (mirror the AI Marketing `v1-cost-report.md` pattern):
  - Per-flow breakdown: STT cost, router cost, downstream cost
  - End-to-end latency p50 / p95 / max
  - Cache hit rate on the router prompt
  - Comparison vs targets: < $0.05/command, < 6s perceived latency
  - 7-day cost projection at current usage

**Acceptance**

- All 10 fixtures classify correctly (router accuracy > 95%).
- Average cost per command < $0.05.
- p95 end-to-end latency < 6s.
- No spend-cap surprises in the audit log.

---

## 5. File layout (after all 7 phases land)

```
backend/src/
├── domains/AIAgentDomain/
│   ├── routes.ts                              ← + /api/ai/voice/* routes
│   ├── controllers/
│   │   ├── VoiceTranscribeController.ts       ← NEW (Phase 1)
│   │   └── VoiceDispatchController.ts         ← NEW (Phase 3)
│   └── services/voice/
│       ├── VoiceRouter.ts                     ← NEW (Phase 3)
│       └── voiceRouterPrompt.ts               ← NEW (Phase 3) — cached system prompt
└── services/openai/
    └── WhisperClient.ts                       ← NEW (Phase 1)

backend/migrations/
├── NNN_create_ai_voice_transcriptions.sql     (Phase 1)
├── NNN+1_create_ai_dispatch_audit.sql         (Phase 3)
└── NNN+2_add_original_transcript_column.sql   (Phase 5 — edit-before-send)

frontend/src/
├── hooks/
│   └── useVoiceRecorder.ts                    ← NEW (Phase 2)
├── components/voice/
│   ├── VoiceCommandPill.tsx                   ← NEW (Phase 2)
│   ├── HeaderVoiceMic.tsx                     ← NEW (Phase 2)
│   ├── MobileBottomNavMic.tsx                 ← NEW (Phase 4)
│   ├── InlineVoiceMic.tsx                     ← NEW (Phase 5.5)
│   └── CrossDomainChoiceCard.tsx              ← NEW (Phase 5.5)
├── utils/
│   └── voiceDomainHints.ts                    ← NEW (Phase 5.5)
└── app/shop/
    └── layout.tsx                             ← + HeaderVoiceMic, MobileBottomNavMic mounts
```

---

## 6. Cost calibration (carried from scope §10)

Per command (single utterance, ~10s audio, in-domain):

| Cost line | Amount |
|---|---|
| Whisper STT (~10s) | $0.001 |
| Router call (Haiku, ~200 input tokens, ~5 output) | $0.0002 |
| Downstream Sonnet (existing Insights / Marketing / Help cost) | ~$0.018 |
| **Total per command** | **~$0.019** |

Per shop per month (heavy user, ~500 voice commands): **~$10/shop/mo**

OpenAI spend cap at launch: **$200/month platform-wide**. Raise
once Phase 6 calibration confirms real usage stays under projection.

---

## 7. Test plan

- [ ] **Unit tests** — `VoiceRouter.classifyDomain` mocked against
  `AnthropicClient` (Haiku response → domain mapping); `WhisperClient`
  mocked against `fetch` (response → cost calculation); util tests
  for `voiceDomainHints.classifyTranscriptClientSide`.
- [ ] **Integration test** — Phase 6 fixtures POSTed end-to-end
  against a staging shop.
- [ ] **Browser compat** — mic capture verified on Chrome, Firefox,
  Safari (macOS + iOS), Edge.
- [ ] **Edge cases:**
  - Empty audio (recorded silence) → STT returns empty transcript
    → frontend prevents send, shows "didn't catch that" inline
  - Audio > 5 MB → backend rejects with clear error
  - Transcript longer than ~500 chars → still routes; no Sonnet
    context overflow at this length
  - Mic permission revoked mid-session → graceful re-prompt
  - Network drops during STT upload → retry-once, then fail with
    clear copy
  - Spend cap hit between STT and dispatch → STT spent counted,
    dispatch refused, user told why
  - Cross-domain handoff with empty draft in source panel → no
    "preserve draft" UI surprise
  - Cross-domain handoff with NON-empty draft → draft restored
    cleanly if user later reopens source panel

---

## 8. Rollout strategy

- **Phase 1** ships behind a feature flag `VOICE_TRANSCRIBE_ENABLED`,
  off by default. Endpoint exists on staging but no UI surfaces it
  yet.
- **Phase 2** flag `VOICE_DASHBOARD_PILL_ENABLED`, off by default;
  enable for `peanut` test shop first; soak for 3 days.
- **Phase 3** flag `VOICE_ROUTER_ENABLED`, off by default; enabled
  alongside the pill rollout.
- **Phase 4** mobile entry behind the same `VOICE_DASHBOARD_PILL_ENABLED`
  flag — no separate rollout.
- **Phase 5.5** per-panel mic behind a SEPARATE flag
  `VOICE_INLINE_MIC_ENABLED`, off by default — enables only after
  the global voice has soaked for at least 1 week without issues.
- **Phase 6** is the gate to flipping any flag to "on for all shops."

**No big-bang launch.** Voice is a paid-tier headline; rolling it
out broken is worse than not having it.

---

## 9. Risks (from scope §7 + new)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| STT mistranscribes destructive intent (e.g. *"send to all customers"*) | Medium | High | Edit-before-dispatch is mandatory (Phase 5); mass-send modal (existing) ALWAYS confirms even when triggered by voice |
| Router misclassifies → wrong panel opens | Medium | Medium | "Asked [domain]" toast = transparency; shop owner can fall back to manual launcher; Haiku ~95% accurate on 4-way classification |
| Latency too high (6s+) | Medium-High | Medium | Streaming transcript display; consider Deepgram if Phase 6 shows STT > 3s p95 |
| Mic permission UX surprise across browsers | High | Medium | Test matrix in Phase 6 across 5 browsers; clear copy for permission-denied state |
| Cost spike — voice users 5x more chatty | Unknown | Medium | Spend cap covers it; daily-drafts guard still applies to Marketing flow; voice-specific rate limit can be added if needed (e.g., 100 voice commands/day per shop) |
| Privacy concerns about audio → OpenAI | Medium | Medium | Privacy policy update (action item §1); OpenAI API terms commit no-training; text-input fallback always available |
| OpenAI key leak | Low (with §3 protocols) | High | §3 secret hygiene; rotation procedure documented; key only in `.env` and DigitalOcean env UI |
| Shop owners don't use voice (touchscreen-on-laptop UX) | Unknown | Low (sunk cost) | Phase 6 engagement metrics; pull voice-vs-text usage weekly post-launch; willing to deprecate if usage stays < 5% |
| Cross-domain handoff confuses users | Medium | Low | Explicit choice card, not silent redirect; preserved draft so nothing lost |
| Router accuracy degrades over time as language drifts | Low | Medium | Phase 6 baseline = ongoing weekly QA replay against the fixtures; alarm if accuracy drops below 90% |

---

## 10. Effort summary

| Phase | Work | Days |
|---|---|---|
| 1 | STT capture endpoint (Whisper + audit + spend cap) | 1-2 |
| 2 | Voice command pill UI + header mic icon + `useVoiceRecorder` hook | 1-2 |
| 3 | Cross-domain router (Haiku 4-way + dispatch endpoint + audit) | 3-5 |
| 4 | Mobile bottom-nav voice entry | 1 |
| 5 | OUT_OF_SCOPE handling + edit-before-send + error states | 1 |
| 5.5 | Per-panel inline mic + D3 hybrid cross-domain handoff | 2-3 |
| 6 | QA fixtures + cost calibration + cost report | 1-2 |
| **Total v1** | | **~12-16 days** |

One backend + one frontend engineer can run this in parallel after
Phase 1 lands (Phases 2 + 3 split frontend/backend cleanly).

**v2 (deferred, not in this plan):**
- Booking + Inventory AI tools so router covers more domains
- Proactive recommendation cards engine
- TTS / bidirectional voice

---

## 11. Next step

1. Confirm OpenAI key landed in `backend/.env` AND on DigitalOcean
   staging — verify by running a Phase 1 acceptance curl against
   both environments.
2. Cut branch `deo/voice-dispatcher-phase-1-stt-endpoint` from
   `main`.
3. Phase 1 first — smallest blast radius, validates the OpenAI
   integration end-to-end before any UI work.
4. Once Phase 1 ships to staging, Phases 2 and 3 can run in
   parallel.
5. Privacy-policy update is a parallel, non-blocking workstream
   that needs to land before flipping ANY flag from staging to
   production.

# Implementation Plan — Unified "Talk To My Business" Assistant (v2)

**Status:** Plan only — **gated on exec sign-off** (see §1). Phase 0 (the
spike) is built and proven; Phases 1+ are not started.

**Companion docs (read first):**
- `../voice-ai-dispatcher/unified-assistant-vision.md` — strategy / scope-delta
  (exec ask R1–R7, conflict with voice v1, capability inventory, gap analysis,
  open decisions). This is the "scope.md" for v2.
- `spike-notes.md` — the Phase 0 spike (what it built + proved).

**Created:** 2026-06-01
**Base branch:** off latest `main`. Branch prefix: `deo/unified-assistant-phase-<N>-<slug>`.

---

## 1. Gates — resolve BEFORE building Phase 1

The build does not start until the exec resolves the two decisions from the
scope-delta §7. They are product calls, not engineering ones:

| # | Decision | Why it blocks |
|---|---|---|
| **G1** | **Architecture reversal (Q1):** commit to one unified thread, superseding the route-to-panels model? | Phase 1+ only make sense if "unified" is the chosen direction. The spike de-risks the *feasibility*; this is the *commitment*. |
| **G2** | **Autonomy line:** which actions, if any, may execute without an explicit confirm tap? | Defines Phase 4. **Recommended default: none that are financial or outward-facing** (send / PO / refund always confirm). |

**Secondary decisions (engineering can default these; exec can override):**
- **D1 — Fate of the 4 panels:** keep as deep-dive surfaces behind the unified
  door, or deprecate? *Default: keep initially; unified is the primary entry.*
- **D2 — Conversation persistence:** server-side session store, or stateless
  client-passes-history (like the spike / Insights)? *Default: add a server-side
  store in Phase 1 — a unified thread spans domains and needs durable history.*
- **D3 — Branding/voice:** fixed brand name + OpenAI TTS voice, or per-shop
  custom name/voice (ElevenLabs)? *Default: configurable name + OpenAI voice;
  defer ElevenLabs custom voice unless it's a committed feature.*

---

## 2. Reusable infrastructure (do NOT rebuild)

The spike confirmed the orchestrator is **mostly wiring**. Reuse:

### Backend
- **The agent loop** — `InsightsController` / `MarketingChatController` (NOT
  `AgentOrchestrator`, which is the single-call customer Sales Agent). The spike
  copied it; Phase 1 promotes it.
- **`AnthropicClient.complete({systemPrompt, messages, model, maxTokens, tools, toolChoice})`** — tool-use + cost/usage + model selection. Untouched.
- **Tool registries + dispatchers** — `insights/registry.ts` + `dispatcher.ts`,
  `marketing/registry.ts` + `dispatcher.ts`. Both tool sets implement
  `ClaudeTool` + `execute({shopId, pool})`; dispatch results are structurally
  identical. A merged registry + a `dispatchUnified()` router is all that's needed.
- **`SpendCapEnforcer`** — shared monthly budget; `canSpend` / `recordSpend`.
- **`WhisperClient`** (STT) + `POST /api/ai/voice/transcribe` — the voice-IN
  half already exists (voice v1).
- **Sales Agent guardrail model** — kill-switches (`ai_global_enabled`,
  `ai_sales_enabled`), `EscalationDetector`, spend cap, tool-schema validation.
  Copy this as the action-guardrail template (Phase 4).
- **Existing action logic** — `proposeCampaignSend` (marketing), and
  `poSuggestionService.approveSuggestion(id, user, autoCreatePO)` (inventory PO);
  wrap as tools, don't reimplement.

### Frontend
- **Per-panel card renderers** — Insights chart cards, the Marketing draft-card
  editor, etc. The orchestrate response returns `toolCalls[].display`; render the
  matching existing card inline in the unified thread (Phase 2).
- **Voice entry points** (pill / header mic / mobile / inline) — repoint them at
  the orchestrator instead of the panel router.
- **`voiceDispatchStore`** — adapt for the unified surface.

### What v2 SUPERSEDES (not reuses)
- The voice **router→panel-handoff** (`VoiceRouter` / `/api/ai/dispatch` →
  `voiceDispatchStore.dispatch` → launcher opens panel). The orchestrator
  replaces this: voice transcript → `/api/ai/orchestrate` directly. The
  4-way classifier becomes the orchestrator's tool-selection.

---

## 3. Phasing

### Phase 0 — Spike (DONE ✅, 2026-06-01)

Built `UnifiedAssistantController` (`POST /api/ai/orchestrate`) — Insights loop +
curated 5-tool cross-domain set + `dispatchUnified` routing, draft-only. Proved:
one conversation reached insights AND marketing tools, grounded, with the
draft-only guardrail respected. See `spike-notes.md`. This validated G1's
feasibility — the rest is productionizing.

---

### Phase 1 — Generalize the orchestrator (3–5 days)

**Goal:** turn the spike into a real, audited, full-registry orchestrator.

- [ ] Expose the **full** tool set (insights ~15 + marketing 4 + new inventory
  reads + help), not the curated 5. Merged registry + `dispatchUnified` chain
  (`getInsightsToolByName ?? getMarketingToolByName ?? …`).
- [ ] **Dedicated audit table** `ai_orchestrate_messages` (mirror
  `ai_insights_messages`: `shop_id, session_id, model, input_tokens,
  output_tokens, cached_input_tokens, cost_usd, tool_calls JSONB, latency_ms,
  error_message, created_at`) + migration + `OrchestrateAuditLogger`.
- [ ] **Prompt hardening:** lift the inline spike prompt into a builder; add the
  rule **"don't re-pull metrics already in the conversation"** (the spike's
  ~21s redundant-tool-call finding), keep Info→Recommendation→Action style +
  draft/confirm guardrails. Cache the system prompt.
- [ ] **Model selection:** Sonnet default; Haiku when `spendCheck.useCheaperModel`.
- [ ] **Conversation persistence** (D2): server-side session store so a unified
  thread is durable across reloads. Decide table/shape (note: Marketing chat
  uses `ai_marketing_messages` not a conversations table — pick one model and
  be consistent).

**Acceptance:** the spike-demo flow passes against the full registry; audit row
written per turn; cost/latency comparable to the existing panels.

---

### Phase 2 — Unified chat UI: "the one door" (3–5 days)

**Goal:** the single owner-facing surface from scope-delta §1a.

- [ ] New `UnifiedAssistantPanel` (or repurpose the dashboard) — one "Talk to
  [Adam]" launcher + chat thread hitting `/api/ai/orchestrate`.
- [ ] **Inline card rendering:** map `toolCalls[].display.kind` → the existing
  card components (revenue chart, `audience_summary`, `campaign_draft`, …). Reuse,
  don't rebuild — this is the "rich answers in one thread" promise.
- [ ] Repoint the existing **voice entry points** at the orchestrator.
- [ ] D1: keep the 4 panels reachable as deep-dives (or hide behind a flag).
- [ ] Use **shadcn** components; match existing AI panel visual language.

**Acceptance:** owner types/speaks one question → answer + inline card; asks a
cross-domain follow-up → handled in the same thread, no panel switch.

---

### Phase 3 — Voice layer / TTS: the "Siri" feel (2–3 days)

**Goal:** turn-based bidirectional voice (scope-delta §5a). "Like Siri" =
turn-based, NOT real-time duplex.

- [ ] STT: reuse `WhisperClient` / `/api/ai/voice/transcribe`.
- [ ] **TTS: new `OpenAITtsClient`** (`tts-1`, **reuses `OPENAI_API_KEY`** — same
  vendor/billing/spend-cap as Whisper). Endpoint `POST /api/ai/voice/speak`
  (text → streamed audio) or fold into the orchestrate response.
- [ ] Frontend turn-based loop: mic → orchestrate → **stream TTS playback** →
  ready for next utterance. Stream so audio starts before full text (keeps under
  the 6s perceived target; downstream LLM is the latency driver).
- [ ] Defer ElevenLabs custom voice (D3) unless committed.

**Acceptance:** speak a question, hear a spoken answer, continue by voice — turn-based.

---

### Phase 4 — Action execution + guardrails (3–4 days)

**Goal:** move from draft-only (spike) to actually taking actions — safely.
Implements G2.

- [ ] **Confirm-before-execute** on every financial/outward action (default G2):
  campaign **send** (`proposeCampaignSend` + existing mass-send modal),
  inventory **PO create** (wrap `poSuggestionService.approveSuggestion(…,
  autoCreatePO)` as a tool). The assistant proposes; the owner taps confirm.
- [ ] Reuse the **Sales Agent guardrail stack**: tool-schema validation (already
  in dispatchers), per-shop **kill-switch**, spend cap, escalation.
- [ ] New **owner read tools** ("bookings today", "top technician") — small
  registry over the booking/service data.

**Acceptance:** "send it" / "order more" produce a confirm step, not a silent
action; nothing financial/outward fires without a tap; kill-switch disables it.

---

### Phase 5 — Sales-Agent supervision (2–3 days)

**Goal:** the owner manages the customer-facing Sales Agent *through* the unified
assistant (scope-delta §4a) — control, not merge.

- [ ] Tools: `get_ai_agent_stats` (reads `ai_agent_messages` / orders),
  `toggle_ai_agent` (kill-switches), `list_escalations` (`EscalationDetector`),
  `set_ai_tone` (`ai_shop_settings`).
- [ ] "How's the AI doing this week / pause it / show me escalations" all work
  from the owner thread. The Sales Agent keeps running on the customer plane.

**Acceptance:** owner can report on, pause, and inspect escalations of the Sales
Agent by voice/text, without touching customer chats.

---

### Phase 6 — Branding, proactive, QA + cost (2–4 days)

- [ ] **Branding/persona** (D3): configurable assistant name + persona in
  `ai_shop_settings`; optional custom voice (ElevenLabs) only if committed.
- [ ] **Proactive (optional / v2.5):** scheduled detector + push ("running out
  in 7 days") — reuses the inventory toolkit; the "before I do" exec clip (R7).
- [ ] **QA fixtures** — replay multi-domain conversations (extend the spike-demo
  pattern); accuracy + cost regression guard.
- [ ] **Cost report** `cost-report.md` (mirror the voice v1 one): per-turn cost,
  tool-call counts, latency p50/p95, cache hit, vs targets.

**Acceptance:** named assistant; QA replay green; cost within target; baseline locked.

---

## 4. Architecture notes

- **Two planes, never merged:** owner ⇄ Unified Assistant (invoked) vs.
  customer ⇄ Sales Agent (autonomous). The unified assistant *supervises* the
  Sales Agent (Phase 5); it does not share its thread.
- **Guardrail model = Sales Agent's** (the most battle-tested AI in the product,
  ~83% of Anthropic spend): tool-schema validation + confirm/kill-switch +
  escalation + spend cap. Reuse it; don't invent a new one.
- **Cost shape:** voice marginal cost is tiny (STT+router ~$0.0009); the
  dominant cost is the downstream Sonnet tool-loop — same profile as the existing
  panels. Cross-domain chaining means more tool calls/turn → watch per-turn cost
  against the ~$18/mo platform Anthropic baseline.

---

## 5. Security & secret hygiene

- **TTS reuses `OPENAI_API_KEY`** — no new secret, same handling as Whisper
  (`.env` + DigitalOcean env UI; never committed).
- **Spend** flows through the shared `SpendCapEnforcer` — no separate cap.
- **Privacy:** the voice-consent / DPA item still pending from voice v1 becomes a
  real gate before any **production** launch (voice-in already exists; TTS adds
  voice-out). Not a staging blocker.

---

## 6. Test plan

- **Unit:** `dispatchUnified` routing; the merged-registry tool lookup; prompt-builder.
- **Integration:** spike-demo-style multi-domain replay (Info→Action arcs);
  confirm-gating on send/PO; kill-switch.
- **Browser/voice:** turn-based loop + TTS playback on Chrome/Safari (the voice
  v1 iOS-Safari mic caveat applies here too).
- **Guardrail:** assert no financial/outward action fires without a confirm;
  assert no hallucinated numbers (tool-grounded only).

---

## 7. Rollout strategy

**Learn from voice v1, which shipped flagless and big-bang.** This time:

- **Feature flag from day 1** (`UNIFIED_ASSISTANT_ENABLED`, off by default) +
  a **per-shop kill-switch**.
- Staging → **one pilot shop** → soak ≥1 week → wider.
- Phase 6 (QA + cost) gates flipping the flag for all shops.
- Production launch additionally gated on the **privacy-consent** item.

---

## 8. Risks (carried from scope-delta §6 + spike)

| Risk | Mitigation |
|---|---|
| Autonomy on a hallucinated number (mass-send / PO) | Confirm-before-execute (G2 default), tool-grounded numbers only |
| Latency (cross-domain = more tool calls/turn) | Prompt rule against redundant re-pulls; stream TTS; Haiku at ≥70% budget |
| Q1 reversal is real rework | Spike de-risks; keep panels reachable (D1) during transition |
| Thin/zero shop data makes demos fall flat | Seed richer pilot-shop data before exec/video demos |
| Cost creep from chatty cross-domain turns | Spend cap; per-turn cost in the Phase 6 report; baseline alarm |

---

## 9. Effort summary

| Phase | Work | Days |
|---|---|---|
| 0 | Spike (done) | — |
| 1 | Generalize orchestrator (full registry + audit + prompt + persistence) | 3–5 |
| 2 | Unified chat UI (one door + inline cards) | 3–5 |
| 3 | Voice layer / TTS | 2–3 |
| 4 | Action execution + guardrails | 3–4 |
| 5 | Sales-Agent supervision | 2–3 |
| 6 | Branding + proactive + QA + cost | 2–4 |
| **Total v2** | | **~15–24 days** |

Backend + frontend can parallelize after Phase 1 (Phase 2 frontend vs Phase
4/5 backend split cleanly).

---

## 10. Next step

1. **Get exec sign-off on G1 + G2** — show the working spike (`npm run
   ai:spike-demo`) as the "here it is working, do we commit?" artifact.
2. On a "yes": cut `deo/unified-assistant-phase-1-orchestrator` and start Phase 1.
3. Seed a pilot shop with richer data so the first real demo/video lands.

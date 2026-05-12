# AI Sales Agent — Service FAQ (Q&A) Strategy

**Status:** Proposal (pivot from earlier knowledge-base draft)
**Owner:** Deo (deocagunot)
**Date:** 2026-05-12 (last updated)
**Sequence:** Follow-up to multi-service architecture (Phases 1–6 shipped). Addresses thin AI context — current prompt only has marketing-style `description` plus a half-built `ai_custom_instructions` field.

---

## TL;DR

Add a structured Q&A FAQ table per service, **layered on top of `description`** — not replacing it. The AI uses both:

- `shop_services.description` (existing) — short marketing blurb. **Always** included in the AI prompt. Functions as the always-on fallback when no FAQ entries exist.
- `service_ai_faq_entries` (NEW) — child rows of (question, answer) pairs for the service. Optional. When populated, rendered as a structured FAQ block alongside the description so Claude can reason across both.

**`ai_custom_instructions` is dropped entirely.** The column was created on 2026-04-30 (PR `edfe7134`) with a backend round-trip and no UI; no shop owner has populated it. A B' local test confirmed structured Q&A content delivers the value cleanly — separate imperative-rules fields aren't needed.

---

## Problem

Today the AI's only per-service context is `shop_services.description` — a short marketing-style field that pulls double duty as marketplace blurb AND AI knowledge base. When a customer asks anything beyond the blurb ("what's in the kit?", "is it safe around toddlers?", "what's NOT included?"), Claude has three failure modes:

1. **Honest handoff:** "I don't have that on hand — want me to flag a teammate?" (observed staging behavior, often the customer just leaves)
2. **Hallucinate:** fabricates details that sound plausible (rare with current prompts, but the failure mode is severe)
3. **Quote conversation history:** parrots whatever the shop or customer happened to mention earlier (unreliable, error-prone)

A B' local test (2026-05-12) loaded a 3069-char FAQ-style block into the system prompt for the I Robot service and asked Claude *"what's in the kit, and is it safe around toddlers?"*:

- **Without FAQ:** Claude correctly refused and pointed to shop's phone/email. Safety net working, but customer leaves empty-handed.
- **With FAQ:** Claude quoted the full kit contents and safety details directly from the FAQ — verbatim where appropriate, paraphrased ("keep it away from spills") where helpful. Cost increase: $0.004 per call ($0.026 → $0.030). Cache absorbs cost on repeats.

The hypothesis is validated. The remaining question is the **shape** of the stored content. Three structural options were considered:

| Option | Shape | Verdict |
|---|---|---|
| Two fields (`ai_custom_instructions` + `ai_knowledge_base`) | Two textareas, prose | ❌ — forces the shop owner to decide which content goes where; cognitive friction; "imperative vs descriptive" is a non-obvious split |
| Single combined field (`ai_context`) | One textarea, prose | ❌ — no scaffolding, shop owner faces blank-page anxiety; no structural signal for Claude |
| Q&A pairs in 1:many child table (this proposal) | List of (question, answer) entries with starter prompts | ✅ — matches how customers actually behave; AI's job IS answering questions; starter questions remove the blank-page problem |

Q&A pairs win on three dimensions:
- **Shop-owner UX.** Every shop owner already has a "questions customers ask me" mental model. We're asking them to write down answers they've given a hundred times, not to compose new prose.
- **AI prompt signal.** Q→A pairs give Claude an explicit pattern to match. The B' test showed that structured content of this shape produced higher-fidelity answers than free-form prose would.
- **Incremental editing.** A new customer question appears → shop owner adds one entry. No paragraph rewriting. "+ add another question" is the simplest possible edit.

---

## Goals

1. **Simple as possible for shop owners.** Q&A list with starter questions prepopulated. No empty-textarea blank-page anxiety.
2. **Additive, not replacing.** `description` continues to drive the marketplace AND remains in the AI prompt as the fallback. FAQ entries only enrich, never override.
3. **AI reasons across both.** The prompt tells Claude to use description for high-level context AND FAQ entries for specific factual answers.
4. **Drop the dead field.** Remove `ai_custom_instructions` entirely — it's been unused since creation.
5. **Backwards compatible.** Shops that don't populate the FAQ behave identically to today.

## Non-Goals

- **Per-shop (vs per-service) Q&A.** Some content applies shop-wide (parking, payment methods). Out of scope for MVP — could come later as `shops.ai_faq_entries` with the same shape.
- **Q&A versioning / history.** Direct edits only. No draft/publish cycle. No rollback UI.
- **Markdown rendering of answers.** Plain text in answer fields. We may add markdown support later if shop owners want bullet lists.
- **Customer-facing display of the FAQ.** The Q&A entries are AI-only knowledge. We're not yet rendering them on the service marketplace page (could be a separate product decision later).
- **i18n on starter questions.** English only for the starter seeds in v1.
- **Drag-to-reorder UI.** Up/down arrows for v1. Drag can come later.

---

## Data model

### New table: `service_ai_faq_entries`

```sql
CREATE TABLE service_ai_faq_entries (
  faq_entry_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    VARCHAR NOT NULL REFERENCES shop_services(service_id) ON DELETE CASCADE,
  question      VARCHAR(300) NOT NULL,
  answer        TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_ai_faq_entries_service_id
  ON service_ai_faq_entries(service_id, display_order);
```

Constraints:
- `question` capped at 300 chars (short, headline-style).
- `answer` capped at 2000 chars (UI-side cap; DB column TEXT so we can lift if needed).
- ON DELETE CASCADE: deleting a service removes its FAQ entries automatically.
- (service_id, display_order) composite index supports the per-service ordered fetch in `ContextBuilder`.

### Drop: `shop_services.ai_custom_instructions`

```sql
ALTER TABLE shop_services DROP COLUMN ai_custom_instructions;
```

Safe to drop:
- No UI ever populated this column.
- No production data depends on it (the field's column comment in migration 107 explicitly noted "no UI exposes it yet").
- Backend code paths that read it (ServiceRepository, ServiceManagementService, ContextBuilder, PromptTemplates, PreviewController) need code-side removal in the same PR.

---

## AI prompt rendering

The AI prompt today renders the description as part of the "About this service" block. The FAQ block sits **immediately after**, before "About the customer":

```
About this service (THE ACTIVE TOPIC — ...):
  Name: I Robot
  ID: srv_irobot_local
  Description: Build, customize, and configure your own personal helper robot. We supply the modular hardware kit and guide you through assembly + firmware + behavior training.
  Price: $699.99
  Category: tech_it_services

Frequently asked questions for this service (use these to answer specific customer questions — quote facts directly when relevant; reason across the description above AND these FAQ entries to handle the question):

Q: What's included in this service?
A: Chassis, IR + ultrasonic sensors, brushed-motor controller, 4-mic array, 5W speaker, ESP32-based main board, 3000 mAh battery. Hands-on assembly with a certified technician, firmware setup, Wi-Fi pairing, one starter routine, and 14-day software-tweak follow-up.

Q: What's NOT included?
A: Ongoing maintenance after the 14-day window (billed separately at $89/visit), third-party accessories outside our kit catalog, structural mods beyond the supplied chassis.

Q: Is it safe around children and pets?
A: Yes — plastic and light metal parts only, low-voltage throughout (5V main board, 12V motor controller). Motor controller has overcurrent protection. Stop-on-touch reflex on sensors. Sound capped at 70 dB.

About the customer:
  Name: Qua Ting
  ...
```

Key prompt-design choices:

- **Header wording: "use these to answer specific customer questions — quote facts directly when relevant; reason across the description above AND these FAQ entries"** — explicitly tells Claude to merge both sources rather than treating FAQ as the exclusive truth. Critical because the description is the always-on fallback.
- **Rendered ONLY when entries exist.** Empty-FAQ services produce the exact prompt they do today. Zero regression risk for shops that don't populate.
- **No "HONOR THESE" framing.** FAQ entries are facts, not commands — the framing matches what they are. (This is the key learning from analyzing the dropped `ai_custom_instructions` field — its "HONOR THESE" header was the wrong frame for descriptive content.)
- **Total FAQ size capped at ~4000 chars per service** at render time (defensive — if a shop owner adds 20 verbose entries, we don't blow up the prompt). Truncation drops entries from the end with a note: `[...additional entries truncated for brevity — ask for specifics]`.

---

## Shop-dashboard UI

Lives inside the existing `AISalesAssistantSection.tsx`. Renders below the tone + behavior toggles when AI Sales Assistant is enabled.

```
─────────────────────────────────────────────────────────────
AI Sales Assistant                                  [toggle: ON]
─────────────────────────────────────────────────────────────
Tone:  ( ) Friendly  (•) Professional  ( ) Urgent
[✓] Suggest related services
[✓] Help customers book appointments

─────────────────────────────────────────────────────────────
Customer questions the AI should answer
─────────────────────────────────────────────────────────────
Answer the questions your customers ask most often. The more you
fill in, the better the AI can help — but you can leave any blank
and the AI will fall back to your service description.

❓ What's included in this service?
[ Chassis, sensors, motor controller, 4-mic array, ESP32...    ]
                                                       [×] [↑↓]

❓ What's NOT included?
[ Ongoing maintenance after 14 days, third-party parts...      ]
                                                       [×] [↑↓]

❓ How long does a typical appointment take?
[ About 90 minutes start to finish.                            ]
                                                       [×] [↑↓]

❓ Is it safe around children and pets?
[ Yes — all parts are plastic and light metal, low-voltage...  ]
                                                       [×] [↑↓]

❓ What should I bring?
[ Bring a laptop if you'd like to learn the config tools...    ]
                                                       [×] [↑↓]

❓ What's your cancellation policy?
[                                                              ]
                                                       [×] [↑↓]

[+ Add another question]
```

UX details:

- **Starter questions pre-populated.** Six starter Qs ship as default values when the form loads for a service with no entries:
  1. "What's included in this service?"
  2. "What's NOT included?"
  3. "How long does a typical appointment take?"
  4. "What should I bring?"
  5. "Is this suitable for [kids / beginners / specific demographic]?"
  6. "What's your cancellation/no-show policy?"

  Starter Qs render with **empty answers**. The shop owner fills them in or deletes the ones that don't apply. They never face a blank "Add your first question" empty state.

- **Empty answers are NOT saved.** When the form submits, only entries with non-empty answers persist. This means a shop owner who fills in 2 of the 6 starters ends up with 2 rows, not 6 rows with empty answers cluttering the DB.

- **Question is editable.** The starter Qs are suggestions, not required wording. Shop owners can rewrite "What's included?" to "What comes in the box?" — whatever sounds natural for their service.

- **Reorder: up/down arrows for v1.** Drag-and-drop can come later. The `display_order` column supports either.

- **Per-answer char counter** (e.g., "120 / 2000") so shop owners know the cap without surprises.

- **Save** is part of the existing service form submit — same flow as description, tone, etc. No separate "Save FAQs" button.

---

## Implementation plan

### Phase 1 — Backend (1 PR)

**Migration:**
```sql
-- 1xx_drop_ai_custom_instructions_add_faq.sql
ALTER TABLE shop_services DROP COLUMN IF EXISTS ai_custom_instructions;

CREATE TABLE service_ai_faq_entries (
  faq_entry_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    VARCHAR NOT NULL REFERENCES shop_services(service_id) ON DELETE CASCADE,
  question      VARCHAR(300) NOT NULL,
  answer        TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_service_ai_faq_entries_service_id
  ON service_ai_faq_entries(service_id, display_order);
```

**Repo:** new `ServiceAIFaqRepository` (or method on existing ServiceRepository). Methods:
- `getEntriesForService(serviceId): FaqEntry[]`
- `replaceEntriesForService(serviceId, entries): void` (transactional: delete existing + bulk insert new — simplest model for v1, lets the form post the whole list every time)

**Type changes:**
- `AgentServiceContext` gains `faqEntries: Array<{ question: string; answer: string }>`. Order preserved by display_order.
- `ContextBuilder.toServiceContext` reads entries via the repo and maps onto the context.
- Existing `customInstructions` field on `AgentServiceContext` is removed.

**Prompt rendering:**
- `PromptTemplates.buildContextBlock` — new FAQ section conditional on `ctx.service.faqEntries.length > 0`. Header wording per the sketch above. 4000-char cap with truncation note.
- Existing `customInstructionsBlock` removed.

**ServiceManagementService:** drop the `aiCustomInstructions` validation and sanitization functions.

**ServiceRepository:** drop `ai_custom_instructions` from all SELECT/INSERT/UPDATE column lists. Drop the snake_case → camelCase mapping for it.

**Backend API:**
- `GET /api/services/:id` includes `faqEntries: FaqEntry[]` on the response.
- `POST/PUT /api/services` accepts `faqEntries: Array<{ question, answer }>` and routes to `replaceEntriesForService`.

**Tests (~18 new):**
- Repo: get returns empty array when none, returns ordered entries when populated, replace is transactional.
- ContextBuilder: propagates entries onto the context, empty array when service has no entries.
- PromptTemplates: FAQ section renders when entries exist, omits when empty, truncates at 4000 chars, header wording present.
- Orchestrator integration: Phase 3/5 paths unaffected.
- Existing tests touching `customInstructions` removed or replaced.

### Phase 2 — Shop dashboard form (1 PR)

**Files:**
- `frontend/src/components/shop/service/AISalesAssistantSection.tsx` — add FAQ list section below the existing toggles.
- New component `AIFaqEditor.tsx` — encapsulates the list-of-entries UI (add/edit/delete/reorder).
- `frontend/src/services/api/services.ts` — extend types to carry `faqEntries`.
- `ServiceForm.tsx` — wire the FAQ state through form submit.
- Starter questions seed lives in `AIFaqEditor.tsx` as a constant array.

**Tests (~6 new):** entries render, add button appends an empty entry, delete removes one, empty answers stripped on submit, char counter shows when populated, reorder arrows move entries.

### Phase 3 — Telemetry + iteration (optional, post-MVP)

Track `ai_agent_messages.metadata`:
- `faq_entries_in_prompt: number` (how many FAQ entries were rendered)
- `faq_entries_quoted: boolean` (rough — did the response text contain substrings from any answer field?)

Goal: measure adoption (% of shops with ≥1 entry) and impact (do shops with FAQ have lower "I don't have that on hand" rate?).

---

## Migration order on staging / prod

1. **Backend PR merges + deploys.** Migration runs as part of `npm run prestart`. ServiceRepository / ContextBuilder / PromptTemplates / ServiceManagementService updated in same PR — no code references `ai_custom_instructions` after deploy. FAQ table exists, empty, ready to receive writes.
2. **Frontend PR merges + Vercel deploys.** Shop owners can now see and populate the FAQ list. Existing services load with the starter questions visible but empty.
3. **Bonus: backfill starter Qs for I Robot manually** if useful for staging testing — set `display_order=0..5` with the same six questions.

Each phase is independently deployable: Phase 1 alone leaves the system functional (just no UI to populate the new table). Phase 2 alone won't deploy until Phase 1's API changes are live.

---

## Open questions

- **Soft delete vs hard delete on FAQ entries?** Hard delete for v1 (CASCADE on service delete; manual deletes hard-remove). No history is fine for a first cut.
- **Per-entry "show in AI prompt" toggle?** Out of scope — all populated entries are sent to Claude. Shop owners delete unwanted entries entirely.
- **Customer-facing FAQ surface on the marketplace page.** Could later render the same Q&A on the service detail page. Not in scope for this work; design decision deferred.
- **Concurrency on edit.** Two shop staff editing the same service's FAQ at once would race on `replaceEntriesForService` (last write wins, full overwrite). MVP acceptable; can add per-entry update later if it ever matters.
- **Search / typeahead for similar Qs across the shop.** "Other services in your shop have this Q — copy?" Nice-to-have, not v1.

---

## Success metrics

After Phase 2 ships:
- **Adoption:** % of AI-enabled services with ≥1 FAQ entry, measured 30 days post-deploy.
- **Quality:** drop in `"I don't have that on hand"` / `"flag a real teammate"` substrings in `ai_agent_messages.response_payload->>'text'` for services that have FAQ entries (vs services without).
- **No regression:** services with no FAQ entries behave identically to today (response distribution unchanged).
- **Prompt cache hit rate** ≥70% per shop (so the FAQ inclusion doesn't blow up the cache).
- **Cost:** average per-reply cost increase ≤$0.005 in steady state (cache hits after first call in a 5-min window).

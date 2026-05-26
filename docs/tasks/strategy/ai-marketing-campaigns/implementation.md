# Implementation Plan — AI Marketing Campaigns (v1)

**Status:** Plan only — code not started.
**Companion to:** `scope.md` (read first).
**Base branch:** off latest `main`. Suggested new branch name root:
`deo/ai-marketing-campaigns-phase-1` (cut a new branch per phase).
**Created:** 2026-05-26.

---

## 1. Decisions carried in (from scope §5)

| # | Decision | Locked |
|---|---|---|
| Q1 | Channel — **email-only v1**, SMS in v2 | ✅ |
| Q2 | Panel location — **new sibling launcher** beside `InsightsLauncher`, slide-over `Sheet` | ✅ |
| Q3 | Manual builder — **keep both**, AI is fast path, manual is precision path; shared `campaigns` table | ✅ |
| Q4 | Confirmation — **tap-to-preview + modal-confirm** before send (destructive action) | ✅ |
| Q5 | AI infra — **reuse** existing `AnthropicClient` + `SpendCapEnforcer` | ✅ |
| Q6 | Drafting — **hybrid**: 4 template scaffolds for known categories + free-draft for novel asks | ✅ |
| Q7 | Proactive suggestions — **defer**; v1 is shop-initiated only. Cron suggestion is v1.5. | ✅ |
| Q8 | Compliance — reuse existing `CampaignEmailService` unsubscribe footer; no new work | ✅ |
| Q9 | Cost — shared shop spend cap + hard "50 drafts/day" guard | ✅ |
| Q10 | v1 scope — email-only, 3 segments (top-spenders / lapsed / all-customers), 4 scaffolds + free-draft, send-now only | ✅ |

---

## 2. Reusable infrastructure (do not rebuild)

- **Campaign CRUD + send endpoints** already exist:
  - `POST /api/marketing/shops/:shopId/campaigns` (create draft)
  - `GET /api/marketing/shops/:shopId/audience-count?audienceType=&audienceFilters=`
  - `POST /api/marketing/campaigns/:campaignId/send` (fires `CampaignEmailService` → SendGrid)
- **`MarketingService.getTargetAudience`** — 6 segment types already implemented (`all_customers`, `top_spenders`, `frequent_visitors`, `active_customers`, `select_customers`, `custom`).
- **`CampaignEmailService`** — SendGrid batched send, list-unsubscribe footer baked in, per-recipient delivery status returned.
- **Propose-then-tap pattern** from reschedule + cancel work (PRs #384 / #387 / #392) is the template. Mirror `propose_cancellation` end-to-end:
  - Tool definition + dispatch in `AgentOrchestrator`-style controller
  - Tap card on frontend (`CancellationConfirmCard`)
  - Modal-confirm for destructive action (`CancellationConfirmModal`)
  - Event-bus subscriber posts confirmation message after action fires
- **`AnthropicClient` + `SpendCapEnforcer`** — already wired in Insights + AI Sales Agent surfaces. Reuse instance.
- **shadcn primitives** — `Sheet`, `Dialog`, `Textarea`, `Button`, `Card`. Same set used in Insights + Sales Agent UIs.

---

## 3. New events to publish

| Event | Publish from | Payload |
|---|---|---|
| `campaign:sent` | `MarketingService.sendCampaign` (new emit at the end) | `{ campaignId, shopId, audienceType, recipientCount, succeededCount, failedCount, source: 'manual' \| 'ai_agent' }` |

Existing events (no change): none in MarketingDomain currently — this is the first.

---

## 4. New / extended schema

No new tables. One extension to `MarketingService.getTargetAudience`:

- **Audience filter — `minDaysSinceLastVisit`** under the `custom` branch. Used for the lapsed-customer flow ("anyone who hasn't booked in 90 days"). Adds a `WHERE last_visit_at < NOW() - INTERVAL '$N days'` clause to the existing custom-filter query.

`campaigns` table already has the columns we need: `subject`, `content`, `audience_type`, `audience_filters`, `delivery_method`, `status` (draft → scheduled → sent), `sent_at`, `recipient_count`. AI-drafted campaigns persist with `delivery_method='email'` and a new `created_by_source='ai_agent'` value on an existing or new column (decision in Phase 1).

---

## 5. Phasing

Six phases. Each phase is a separate branch + PR. Cut new branches off `main`, not stacked.

---

### Phase 1 — Backend foundations (1d)

Branch: `deo/ai-marketing-phase-1-backend-foundations`.

Small, low-risk, can land before any AI work begins. Pure data + event-publish.

- [ ] Add `minDaysSinceLastVisit` to `MarketingService.getTargetAudience` `custom` branch
  - Extend `MarketingAudienceFilters` TypeScript type
  - Add `WHERE last_visit_at IS NOT NULL AND last_visit_at < NOW() - INTERVAL '$N days'` clause
  - Unit test: shop with 5 customers, 3 of them with `last_visit_at` > 90 days ago → returns 3
- [ ] Audit existing audience-count endpoint to accept the new filter
  - `GET /api/marketing/shops/:shopId/audience-count?audienceType=custom&audienceFilters[minDaysSinceLastVisit]=90`
  - Smoke against real shop in staging
- [ ] Add `created_by_source` column to `campaigns` table (`'manual' | 'ai_agent'`, default `'manual'`)
  - Migration file: `backend/database/migrations/XXX_campaign_source.sql`
  - `CampaignRepository.createCampaign` accepts source param, defaults `'manual'`
- [ ] Publish `campaign:sent` event from `MarketingService.sendCampaign`
  - After SendGrid batch returns, before status update
  - Payload as in §3
- [ ] Verify event flows via `/api/system/events/history` after manual send

**Acceptance:** All existing manual campaign flows still work (smoke top-spenders + all-customers sends). New audience filter returns correct count for a known lapsed-customer set in staging. `campaign:sent` event visible in event-bus history.

---

### Phase 2 — AI orchestration + tools (3-4d)

Branch: `deo/ai-marketing-phase-2-orchestration`.

This is the meat of the feature. New domain, new controller, new tools.

#### 2.1 Domain scaffolding (~0.5d)

- [ ] New `backend/src/domains/AIMarketingDomain/` directory
  - `index.ts` — implements `DomainModule`, registers event subscribers in `init()`
  - `routes.ts` — mounted at `/api/ai-marketing`
  - `controllers/MarketingChatController.ts` — Claude orchestration entry point
  - `services/MarketingAgentOrchestrator.ts` — tool dispatch (mirror of `AgentOrchestrator`)
  - `services/MarketingPromptBuilder.ts` — system prompt + tool definitions
  - `services/MarketingContextBuilder.ts` — fetches shop services + recent campaign style for prompt
- [ ] Register domain in `DomainRegistry`
- [ ] Wire shop-side JWT middleware (shop scope, not customer scope) — protected with shop role

#### 2.2 Claude tools (4 tools) (~1.5d)

- [ ] **`lookup_audience_count`** (read-only)
  - Input: `{ segment_hint: string }` — natural-language segment
  - Internal resolution: regex/keyword match on hint → maps to `{ audienceType, audienceFilters }`
    - "top N" / "best customers" → `top_spenders`
    - "haven't booked in N days" / "lapsed" / "old customers" → `custom` with `minDaysSinceLastVisit: N` (default 90)
    - "everyone" / "all customers" → `all_customers`
  - Calls `MarketingService.getAudienceCount`
  - Returns `{ resolved_segment, resolved_count, sample_customers: [...] }`
- [ ] **`propose_campaign_draft`**
  - Input: `{ audience: {...resolved}, channel: 'email', subject, body }`
  - Server-side validation:
    - subject + body non-empty
    - resolved audience count > 0
    - channel matches recipients' opt-in (`campaignType: 'email'` or `'both'`)
    - Body contains no unauthorized discount values (see §7 risks — match offer numbers against the shop's current message turn)
  - Side-effect: creates a `draft` campaign via `MarketingService.createCampaign` with `created_by_source='ai_agent'`
  - Emits proposal to message metadata: `{ proposal_type: 'campaign_draft', campaign_id, audience, subject, body_preview, recipient_count }`
- [ ] **`propose_campaign_send`** (after shop reviews + optionally edits)
  - Input: `{ campaign_id }`
  - Server-side validation:
    - Campaign exists, status=draft, owned by this shop
  - Emits proposal: `{ proposal_type: 'campaign_send', campaign_id, recipient_count }`
- [ ] **`suggest_campaign_strategies`** (proactive — but only when shop opens an empty panel)
  - Input: `{}`
  - Returns 2-3 strategy strings based on current shop state (e.g., "30 customers haven't booked in 60 days", "you launched a service 2 weeks ago and haven't announced it")
  - Note: v1 is shop-initiated; this tool only fires when the chat is empty. Cron-based weekly nudge is v1.5.

#### 2.3 Prompt builder + template scaffolds (~1d)

- [ ] System prompt rules (`MarketingPromptBuilder.buildSystemPrompt`):
  1. Always interpret the shop's request first; pick template scaffold OR free-draft per request
  2. Never auto-send — every send requires `propose_campaign_send` → shop tap
  3. NEVER include a discount value in the body that the shop didn't state in their current message. Use `(your offer here)` placeholder otherwise.
  4. Inherit the `CampaignEmailService` footer template (unsubscribe link auto-injected — do not duplicate)
  5. Default channel = email (v1 constraint)
  6. Default audience size = the shop's literal request ("top 100" → top 100, not top 20%). Cap to existing audience size if larger.
  7. If shop says "send" but no draft exists, run `propose_campaign_draft` first, NOT `propose_campaign_send`
- [ ] Template scaffold library (`MarketingPromptBuilder.SCAFFOLDS`):
  - `black_friday` — subject pattern + body shape with CTA + deadline
  - `win_back` — subject pattern + body shape (acknowledge absence + offer + CTA)
  - `new_service_announcement` — subject pattern + body shape (intro + benefit + booking CTA)
  - `weekend_special` — subject pattern + body shape (urgency + offer + CTA)
- [ ] Category detection — regex/keyword match in prompt: black friday / win back / lapsed / weekend / new service. Falls through to free-draft if no match.
- [ ] Shop context preload (`MarketingContextBuilder.fetchShopContext`):
  - Shop name, brand voice (from shop profile if present)
  - Active services (id, name, base_price) — top 10 by recent orders
  - Last 3 campaigns' subjects + first paragraph (for tone matching)

#### 2.4 Controller + endpoint (~0.5d)

- [ ] `MarketingChatController.handleMessage`
  - `POST /api/ai-marketing/chat` — input `{ message }` (shop-scoped via JWT)
  - Reuse `AnthropicClient` + `SpendCapEnforcer` instances
  - Tool-use agent loop (max 5 iterations like Insights)
  - Aggregates response text across iterations (lesson from `feedback_root_cause_before_band_aids`)
  - Hard guard: "50 drafts/day" — count of `created_by_source='ai_agent' campaigns` for this shop today
  - Returns full conversation thread + new message metadata (proposals as JSON)

#### 2.5 Audit logging (~0.25d)

- [ ] Mirror Insights audit pattern — log every Claude call to existing `ai_audit_logs` (or marketing-specific table if isolation needed)
- [ ] Capture: shopId, message, tool calls, token usage, cost, response text

**Acceptance:** Hit `/api/ai-marketing/chat` with `{ message: "send a campaign to my top 100 customers about our new pastry tutorial" }` — response contains:
1. Assistant prose
2. One `campaign_draft` proposal in metadata
3. Audit log row written
4. Spend cap counter incremented

---

### Phase 3 — Frontend chat panel (3-4d)

Branch: `deo/ai-marketing-phase-3-frontend`.

#### 3.1 Launcher + panel shell (~0.5d)

- [ ] `frontend/src/components/shop/marketing/MarketingAILauncher.tsx`
  - Button in shop dashboard header (next to `InsightsLauncher`)
  - Icon: shadcn `MessageCirclePlus` or `Megaphone`
  - Opens `MarketingAIPanel` via `Sheet`
- [ ] `frontend/src/components/shop/marketing/MarketingAIPanel.tsx`
  - shadcn `Sheet` with `side="right"`, width responsive
  - Header: "Marketing Assistant" + close
  - Body: scrollable conversation thread
  - Footer: textarea + send button (shadcn `Textarea`)
- [ ] Wire to shop dashboard layout

#### 3.2 Conversation thread (~1d)

- [ ] `MarketingConversationThread.tsx`
  - Reuse pattern from `frontend/src/components/messaging/ConversationThread.tsx`
  - Render messages with `senderType: 'shop' | 'ai_agent'`
  - Auto-scroll on new message
  - Loading state while AI thinks
  - Reads `metadata.proposals` array and renders cards inline beneath the AI bubble
- [ ] `MarketingMessageInput.tsx`
  - shadcn `Textarea` + `Button`
  - Enter to send, Shift+Enter for newline
  - Disable while AI is responding
- [ ] Empty state — fires `suggest_campaign_strategies` on first open, renders chips

#### 3.3 Proposal cards (~1d)

- [ ] `CampaignDraftCard.tsx`
  - Header: campaign category + audience size badge
  - Body: subject preview + first 2 lines of body + "…"
  - Footer: **Preview & send** button → opens `CampaignReviewModal`
  - Pattern: mirror `CancellationConfirmCard` color treatment but blue/emerald instead of red (constructive action)
- [ ] `CampaignReviewModal.tsx` — destructive-action gate
  - shadcn `Dialog`, `sm:max-w-2xl`
  - Hard-coded dark contrast (lesson from `feedback`: `bg-gray-900`, `text-white/gray-100/300`)
  - Editable subject + body (`Textarea` + `Input`)
  - Recipient list — paginated table, first 10 + count
  - Footer: **Cancel** / **Send N emails** (red button for the destructive verb)
  - On confirm: `POST /api/marketing/campaigns/:id/send` via service layer
- [ ] `AudienceSummaryCard.tsx`
  - Renders `lookup_audience_count` result inline
  - "N customers match: [sample avatars]"

#### 3.4 Service layer (~0.5d)

- [ ] `frontend/src/services/api/aiMarketing.ts`
  - `sendMessage(message)` → `POST /api/ai-marketing/chat`
  - `getThread(threadId?)` → `GET /api/ai-marketing/chat/thread`
  - Reuse axios client + interceptor unwrap pattern (lesson from `project_frontend_api_response_shape`)
- [ ] `frontend/src/stores/marketingAIStore.ts` (Zustand)
  - State: `messages[]`, `isThinking`, `currentThreadId`
  - Actions: `sendMessage`, `clearThread`, `pinMessage` (defer — v1.5)

#### 3.5 Confirmation states (~0.5d)

- [ ] After `Send` clicked, card transitions to "sending..." → "Sent — N delivered"
- [ ] Idempotency on tap — disable button on first click

**Acceptance:** Open panel, type "send a Black Friday campaign", see:
1. AI prose response
2. `CampaignDraftCard` rendered inline
3. Click card → modal opens with full subject + body + recipient list
4. Edit body → click Send → 200 OK from `/campaigns/:id/send`
5. Card transitions to confirmed state

---

### Phase 4 — Campaign-sent event handler — **SKIPPED (2026-05-26)**

**Why skipped:** Original plan was a `CancellationConfirmationHandler`-style backend subscriber that posts a "Campaign sent. N emails queued" message into the AI chat thread. But the marketing surface doesn't share the `conversations` / `messages` persistence the customer chat uses — Phase 2 writes to `ai_marketing_messages` (one row per Claude call, session-grouped), and Phase 3 holds turns in local React state (session-bound, cleared on Sheet close).

So a server-side handler posting "into the chat thread" has nowhere to post. The two options were:
1. Add a `marketing_chat_conversations` persistence layer first — breaks the deliberate "session-bound, lost on close" design from Phase 3
2. Skip the handler entirely — the frontend already shows confirmation via `CampaignDraftCard`'s emerald "Sent" transition (`MarketingToolCallCard.tsx:96-112`) and `CampaignSendCard`'s post-confirm state. The shop just tapped Send; a re-confirm message would be redundant.

**Decision:** Skip — UI surface already covers the user need.

`marketing.campaign_sent` event still fires (Phase 1's MarketingService.sendCampaign emit) — left in place for future subscribers (analytics, cron-driven recommendations, etc.). It's just unsubscribed from the AI chat surface for now.

The Phase 1 `created_by_source='ai_agent'` column tagging on `marketing_campaigns` is still useful for the 50-drafts/day guard (Phase 2 already uses it) and for audit / analytics queries.

---

### Phase 5 — QA fixtures + test guide (1d)

Branch: `deo/ai-marketing-phase-5-qa`.

Mirror the pattern at `docs/tasks/strategy/ai-sales-agent/qa-fixtures/`.

- [ ] `docs/tasks/strategy/ai-marketing-campaigns/qa-fixtures/` directory
- [ ] `setup-top-spenders.ts` — creates 5 customers with varying `total_spent` for shop ID
- [ ] `setup-lapsed-customers.ts` — creates 3 customers with `last_visit_at` 90+ days ago
- [ ] `setup-fresh-shop.ts` — creates a new shop with no prior campaigns (for empty-state test)
- [ ] `reset-spend-cap.ts` — resets shop's AI spend cap counter (for re-running QA)
- [ ] `cleanup.ts` — deletes test campaigns + audit logs
- [ ] `qa-test-guide.md` — sections:
  - §1 Top-spenders flow ("send to top 100")
  - §2 Lapsed flow ("bring back customers who haven't booked in 90 days")
  - §3 Black Friday flow (all-customers + free-form discount)
  - §4 Free-draft flow (novel category)
  - §5 Validation guards (empty body, discount-hallucination, daily cap, send-without-draft)
  - §6 Confirmation message check
  - §7 Compliance — verify unsubscribe footer present in sent email
  - §8 Cost — note token spend per flow

**Acceptance:** All 8 sections pass on staging shop. Audit log + sent email captured for compliance trace.

---

### Phase 6 — Manual smoke + cost calibration (1d)

Branch: `deo/ai-marketing-phase-6-smoke` (small, may be doc-only).

- [ ] Run all three exec scenarios on a real (non-prod) shop:
  - "send a campaign to my top 100 customers"
  - "bring old customers back"
  - "make a Black Friday campaign"
- [ ] Capture per-flow:
  - Tokens in/out
  - Anthropic cost ($)
  - Latency (request → first prose token → final response)
  - Number of tool iterations
- [ ] Validate "50 drafts/day" guard fires correctly (script 51 drafts, confirm 51st rejected)
- [ ] Validate discount-hallucination prompt rule (ask "send Black Friday" without stating a number, confirm body contains `(your offer here)` placeholder, NOT a hallucinated value)
- [ ] Validate unsubscribe footer in delivered email
- [ ] Document findings in `docs/tasks/strategy/ai-marketing-campaigns/v1-cost-report.md`

**Acceptance:** Per-flow cost < $0.10. All three exec scenarios produce sendable drafts. Discount-hallucination guard works. Daily cap works.

---

## 6. Risk checklist (carried from scope §7)

| Risk | Phase | Mitigation |
|---|---|---|
| Mass-send mistakes are unrecoverable | Phase 3 | Modal-confirm (Q4), idempotency on tap, disabled button on first click |
| AI hallucinating discounts | Phase 2 | Prompt rule 3 — discount value MUST echo shop's stated number, else `(your offer here)` placeholder. QA §5 verifies. |
| Spam-like volume | Phase 2 | "50 drafts/day" guard at controller + per-segment rate-limit ("3 sends in 30 days") at `propose_campaign_send` |
| Privacy on AI prompts (customer PII in audit log) | Phase 2 | Reuse existing audit log table; confirm legal acceptance pre-merge of Phase 2 |
| Drift between AI draft and sent content | Phase 3 | Audit log captures BOTH the AI proposal AND the final sent content (after shop edits) separately |
| SendGrid bill explosion | Phase 6 | Cost calibration in Phase 6; surface "this send uses N SendGrid credits" in Phase 3 modal |

---

## 7. Sequencing notes

- **Phase 1 can land immediately** — pure data work, no UI surface affected. Safe to merge to main even if Phases 2-6 slip.
- **Phase 2 + 3 land together** — backend + frontend are tightly coupled; landing Phase 2 alone leaves an untested API.
- **Phase 4 can land independently** after Phase 2 + 3 — the missing confirmation message is graceful degradation, not a blocker.
- **Phase 5 + 6** can run in parallel with Phase 4 since both are testing/docs work.

Total elapsed: **~10-12 days** of focused work, assuming no surprises and parallelism in Phases 4-6.

---

## 8. Out of scope for v1 (deferred to v1.5 or v2)

- SMS / WhatsApp channel
- Scheduled sends (send-now only in v1)
- Cron-based proactive suggestions ("you haven't messaged in 60 days")
- Pin / saved-campaigns in chat panel
- A/B subject testing
- Multi-step automation flows (drip campaigns)
- Cross-shop benchmarks
- AI-generated images / brand visuals
- Voice input
- Spend-cap separation (marketing vs other AI surfaces) — shared cap in v1

---

## 9. Open questions remaining

- **Q-impl-1** — Should `created_by_source` go on the existing `campaigns` table, or on a separate `ai_drafts` shadow table? Recommendation: on `campaigns` table (single source of truth, simpler queries). Confirm during Phase 1.
- **Q-impl-2** — Where does the daily 50-drafts guard reset boundary live — UTC midnight or shop-local timezone? Recommendation: UTC for v1 simplicity, shop-local in v1.5 if complaints surface.
- **Q-impl-3** — Brand voice in `MarketingContextBuilder` — pull from shop's last 3 campaigns or from a new `brand_voice` shop column? Recommendation: derive from last 3 campaigns in v1; add explicit `brand_voice` column in v1.5 if voice drift is observed.

These don't block Phase 1 kickoff but should resolve before merging Phase 2.

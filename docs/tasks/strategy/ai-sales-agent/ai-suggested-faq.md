# Task Scope — AI-Suggested Service FAQs

**Status:** Scoping — not started
**Created:** 2026-05-18
**Track:** AI Sales Agent
**Author:** Deo + Claude
**Origin:** Executive suggestion — *"I think we could do AI recommendations
here if possible, and manually input."* (re: the FAQ section of the
per-service "Auto Sales & Booking" panel)
**Related:** `docs/tasks/strategy/ai-sales-agent/ai-knowledge-base-strategy.md`

---

## 1. Problem

Each service in the shop dashboard has an **"Auto Sales & Booking"** panel
with a FAQ section — Q&A pairs the AI uses to answer customers. The panel
itself states the fallback: *"Leave any blank and the AI falls back to your
service description."*

The friction: that FAQ section is a **blank page**. A shop owner has to
think up "what will customers ask about this service?" and write both the
question and the answer, per service. Many won't — it's effort with no
immediate visible payoff — so the FAQ stays empty and the AI gives weaker,
more generic answers (description-only) than it could.

---

## 2. What exists today

| Piece | Status |
|---|---|
| FAQ data model | `service_ai_faq_entries` table (migration 113) — `question`, `answer`, `display_order`; child of `shop_services` |
| Repository | `ServiceAIFaqRepository` — `getEntriesForService`, `replaceEntriesForService`, `deleteEntriesForService` |
| Save path | FAQs round-trip through the service form — `ServiceManagementService.updateService({ faqEntries })` → `replaceEntriesForService` |
| Frontend | `AISalesAssistantSection` (inside the shop service form) renders the FAQ editor; the migration notes the dashboard "ships starter Qs" (static) |
| AI consumption | `ContextBuilder` pulls FAQ entries; `PromptTemplates` renders them — the prompt **quotes FAQ answers directly** to customers |

So the storage, save path, and AI consumption all exist. What's missing is
**help authoring the entries**.

---

## 3. The feature

A **"Suggest FAQs"** action in the service's AI panel. The shop clicks it;
the AI returns a handful of candidate Q&A pairs tailored to that service.
Each suggestion is a **draft** the shop can **Add** (one click into the FAQ
list, still editable), **edit**, or **dismiss**. Manual entry stays exactly
as it is — suggestions only augment it.

---

## 4. The critical guardrail

FAQ answers are not hints — `PromptTemplates` **quotes them verbatim** to
real customers. So an AI-drafted answer that invents a price, a policy, or
a detail becomes a **wrong customer-facing answer**. The design must reflect
that asymmetry:

- **Questions — suggest freely.** Predicting "what will customers ask about
  this service" is low-risk and the high-value half. Generate confidently.
- **Answers — draft ONLY from the service description.** If the description
  supports an answer, draft it (clearly as a draft). If it does **not**,
  return the question with a **blank answer** for the shop to fill — never
  invent one.
- **Nothing auto-saves.** Suggestions are drafts in the UI; they enter the
  FAQ list only when the shop clicks Add, and persist only when the shop
  saves the service form (the existing `replaceEntriesForService` path).

This keeps the customer-facing risk at zero: every answer the AI will ever
quote was either written or explicitly approved by the shop.

---

## 5. Design decisions

### Decision A — Answer drafting (recommended above)
Draft answers strictly from the service description; leave blank when
uncovered. *(Alternative: always draft an answer — rejected, hallucination
risk on customer-facing text.)*

### Decision B — Does the suggest call count against the spend cap?
It's a config-time Claude call (Haiku, one-shot, ~$0.001), not a
customer-facing reply.
→ **Recommend:** yes, run it through `SpendCapEnforcer` like every other
Claude call — consistent, and the cost is negligible. Skip with a friendly
message if the shop is over budget.

### Decision C — How many suggestions per click
→ **Recommend ~6.** Enough to be useful, not so many the review is a chore.

### Decision D — Relationship to the existing static "starter Qs"
The dashboard already ships static starter questions.
→ **Recommend:** AI suggestions supersede them — same slot, but
service-specific instead of generic. Keep static starters only as the
offline fallback if the suggest call fails.

### Decision E — De-duplication
The AI must not re-suggest a question the service already has.
→ Pass the existing FAQ questions into the prompt as "already covered —
don't repeat."

---

## 6. Work breakdown

### Phase 1 — Backend: suggest endpoint
- `POST /api/ai/services/:serviceId/faq-suggestions` — shop role; controller
  verifies the shop owns the service (same ownership check `PreviewController`
  uses).
- Pull service context (name, description, price, category) + the service's
  existing FAQ questions.
- Spend-cap check, then a Claude **Haiku** one-shot with a tight prompt:
  return ~6 `{ question, answer }` pairs; answers grounded in the
  description or left empty; never repeat an existing question.
- Audit-log the call (`ai_agent_messages`) + record spend, like the other
  handlers.
- Returns `{ suggestions: [{ question, answer }] }`.

### Phase 2 — Frontend: suggestion UI in `AISalesAssistantSection`
- A "✨ Suggest FAQs" button near the FAQ editor.
- On click → call the endpoint → render the returned pairs as a reviewable
  draft list: each with **Add** (push into the editable FAQ list), **edit
  inline**, **dismiss**.
- Drafts visually distinct from saved entries ("suggested — review before
  saving"). Loading + error + over-budget states.
- Manual entry untouched.

### Phase 3 — Tests
- Backend: prompt builds, ownership check, spend-cap skip, dedup (existing
  questions excluded), malformed-Claude-output handling.
- `tsc` + ai-agent jest.

---

## 7. Out of scope

- AI-suggested *answers for arbitrary questions the shop types* (a "draft
  this answer for me" button) — a reasonable follow-up, not v1.
- Auto-refreshing FAQs from real customer questions over time (a learning
  loop) — separate, larger initiative.
- Bulk-applying suggestions across many services at once.

---

## 8. Rough effort

Backend endpoint + prompt ≈ 0.5–1 day; frontend suggestion/review UI ≈ 1
day; tests ≈ 0.5 day. **≈ 2–2.5 days** for one developer.

---

## 9. Open questions for review

1. Decision B — count the suggest call against the shop's monthly AI
   budget, or exempt config-time calls?
2. Should "Suggest FAQs" be available before the shop has written a service
   description? (Without a description the AI can suggest questions but few
   answers — still useful, but worth confirming the UX.)
3. Any per-shop/day rate limit on the button, or is Haiku cheap enough to
   leave it open?

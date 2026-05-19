# Task Scope — AI-Suggested FAQ Enhancements (blank-answer problem)

**Status:** Scoping — not started
**Created:** 2026-05-19
**Track:** AI Sales Agent
**Author:** Deo + Claude
**Builds on:** `docs/tasks/strategy/ai-sales-agent/ai-suggested-faq.md`
(the shipped "Suggest questions with AI" feature)

---

## 1. Problem

In local testing of "Suggest questions with AI" on a service with a thin
description ("Super Cyan"), the AI returned five sharp, on-point questions —
but **every answer came back blank** ("Answer left blank — you'll write this
one in"). A blank-answer suggestion feels like the AI handed back homework.

The instinct is "require a description" or "add a long-description field" so
the AI has something to draft from.

---

## 2. The reframe — blank ≠ bug

The blank answers are the AI behaving **correctly**. FAQ answers are quoted
**verbatim** to customers, so the AI must never invent a fact. The shop
owner is the **only source of truth** for "is Super Cyan safe for sensitive
skin?" — no description, short or long, will reliably contain every FAQ
fact (prep steps, suitability, what's included, results, policy).

So the goal is **not** "make the AI fill the answers." It's:
1. Make a blank answer a *guided* fill-in, not an empty box.
2. Make it *easy* for the shop to supply the facts the AI needs.

### Rejected approaches
- **Hard-require a description before suggesting** — friction, and it
  doesn't even work: a description rarely covers every FAQ fact, so blanks
  remain.
- **Add a "long description" field** — a separate writing chore, and
  marketing prose ≠ structured FAQ facts. New burden, marginal payoff.

---

## 3. Proposal — two enhancements

### Enhancement A — `answerHint`: turn blank answers into guided fill-ins

Add a third field to each suggestion: `answerHint` — a one-line description
of *what fact the shop should put in the answer*. The AI can always produce
this (it knows what a question needs even when it can't answer it).

- Suggestion shape: `{ question, answer, answerHint }`.
- When the shop adds a blank-answer suggestion, the FAQ row's answer
  textarea shows the hint as **placeholder text** instead of the generic
  "Type the answer here…":
  > *"e.g. list which skin types it's safe for — sensitive, oily, dry"*
- In the suggestion review list, a blank-answer card shows the hint as its
  guidance line (replacing the current generic "Answer left blank…").

Effect: filling five blank answers becomes a ~2-minute guided task instead
of staring at empty boxes. **This is the quick, high-impact win.**

### Enhancement B — optional paste-in source material

Let the shop hand the AI raw material **transiently**, without a new
permanent field:

- The suggest flow gets an optional, collapsible textarea:
  *"Paste anything you have about this service — notes, your website copy,
  a flyer. The AI will draft answers from it."*
- The pasted text is sent with the suggest request and used as **additional
  draft source** alongside the description. It is **not stored** — only the
  resulting FAQ entries persist (after the shop reviews + saves).
- The no-hallucination rule is unchanged: the AI drafts answers only from
  (description + pasted text); still leaves blank what neither covers.

Effect: this is what actually raises the *drafted-answer* rate — without
forcing anyone to write a long description, and without a new field to
maintain.

---

## 4. Design details

| Concern | Decision |
|---|---|
| Is `answerHint` always produced? | Yes — the AI returns it for every suggestion. The UI only *surfaces* it when the answer is blank (a hint next to a real drafted answer is noise). |
| Where does `answerHint` live in the editor? | `FaqEntry` gains an optional, transient `answerHint?` used only as the textarea placeholder. It is NOT persisted — `replaceEntriesForService` only writes question + answer. |
| `sourceText` size | Cap the pasted text (≈ 4,000 chars) so prompt cost stays bounded; trim/truncate server-side. |
| Where does the paste box live | A collapsible "Add source material (optional)" panel above the Suggest button. Exact placement is a build detail. |
| Cost | Pasted source slightly enlarges the prompt — still one cheap Haiku call, still charged via SpendCapEnforcer. |
| Soft nudge | When a suggest run comes back mostly blank, show a one-line hint: *"Add detail to your description or paste your notes, and the AI can draft more."* A hint, never a block. |

---

## 5. Work breakdown

### Phase 1 — `answerHint` (the quick win)
- Backend `FaqSuggestionController`:
  - Prompt: instruct the AI to return `answerHint` on every entry — a short
    "what to write here" line.
  - `parseFaqSuggestions`: parse + length-bound the third field.
  - Response shape becomes `{ question, answer, answerHint }`.
- Frontend:
  - `FaqSuggestion` type + `FaqEntry` (optional transient `answerHint`).
  - Suggestion review card: show `answerHint` as the guidance line for
    blank-answer suggestions.
  - On "Add", carry `answerHint` onto the new row; `AIFaqEditor`'s answer
    textarea uses it as placeholder when the answer is blank.
- Tests: parser handles the third field; placeholder wiring.

### Phase 2 — paste-in source material
- Backend: accept optional `sourceText` in the request body; length-cap;
  include it in the prompt as additional draft source.
- Frontend: collapsible "Add source material (optional)" textarea in the
  suggest flow; send `sourceText` with the request.
- Soft "mostly blank" nudge.
- Tests: `sourceText` flows into the prompt; cap enforced.

### Phase 3 — verify
- `tsc` + ai-agent jest; manual QA on a thin-description service (confirm
  hints render; pasted notes raise the drafted-answer rate).

---

## 6. Out of scope

- A permanent long-description field (explicitly rejected — §2).
- Persisting the pasted source material as service data.
- A "save this paste to your description" convenience prompt — possible
  future nicety, not v1.
- The AI auto-refreshing FAQs from real customer chat questions over time —
  separate, larger initiative.

---

## 7. Rough effort

Phase 1 (`answerHint`) ≈ 0.5 day. Phase 2 (paste-in source) ≈ 0.5–1 day.
**≈ 1–1.5 days** total for one developer. Phase 1 alone is shippable and
delivers most of the perceived value.

---

## 8. Open questions for review

1. Ship Phase 1 (`answerHint`) on its own first, or both phases together?
2. Paste box — collapsible inline (recommended) or a modal?
3. Should a mostly-blank result also offer a one-click "draft answers from
   my website" if a shop website URL is on file? (Future — flag only.)

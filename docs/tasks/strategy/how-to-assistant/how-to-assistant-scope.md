# Task Scope — "How-To" Assistant (in-dashboard product help AI)

**Status:** Scoping — not started
**Folder:** `docs/tasks/strategy/how-to-assistant/` — dedicated home for this
feature's scope, plans, and status as it evolves.
**Created:** 2026-05-19
**Origin:** Executive reference — Square's "Square AI" ("Ask about your
business"), which answers shop owners' *how-to* questions in-dashboard.
**Audience of the feature:** shop owners (and optionally admins).

---

## 1. Problem

A shop owner using RepairCoin has no in-app way to ask *"how do I do X?"*
— how to create a service, set up appointment hours, issue a reward,
configure the AI agent, read their no-show policy, etc. Today they dig
through the UI, email support, or give up. That hurts onboarding and loads
the support team.

Square ships **Square AI** — an in-dashboard assistant that answers
questions like *"How do I set up a discount?"* and *"Can I edit a
customer's profile?"*. This doc scopes a RepairCoin equivalent for the
**how-to / product-support** half of that.

---

## 2. Scope — and what is explicitly NOT in scope

Square AI actually does **two different things**. This doc is **#1 only**:

| | In scope (this doc) | Out of scope (separate, larger doc) |
|---|---|---|
| **#1 How-to / product support** | ✅ *"How do I create a service?"* — answering questions about **using the software**, from RepairCoin help content | |
| **#2 Business-data insights** | | ❌ *"Who bought iPad Repairs this week?"* — querying the shop's **own data**. Needs safe data access + query generation; much heavier. |

**Audience:** the **shop owner** — not customers. This is a different
audience from everything we've built so far: the AI Sales Agent talks to
*customers*; this talks to the *shop owner* in their own dashboard.

**Non-goals:** taking actions on the user's behalf (it explains, it doesn't
click buttons); answering anything outside RepairCoin product usage;
business-data queries (#2).

---

## 3. What already exists (reusable)

- **AI infrastructure:** `AnthropicClient`, `SpendCapEnforcer`, `AuditLogger`,
  the audit table `ai_agent_messages`, prompt-caching patterns — all
  reusable for a new assistant.
- **Chat UI patterns:** the messaging components give a working chat-bubble
  UI to model the help panel on.
- **QA reference docs** (`docs/tasks/test/qa-reference-manual.md`,
  `qa-onboarding-quick-guide.md`) — written for QA, but a solid **seed** for
  the help corpus (Section 4).
- **No retrieval/vector-DB infrastructure exists** — the AI Sales Agent
  assembles context by direct prompt-stuffing, not RAG. That informs the
  v1 design below.

---

## 4. The core design problem — the knowledge source

A how-to assistant is only as good as the content it answers from. The
assistant must answer **strictly from a curated RepairCoin help corpus** —
if it invents UI steps that don't exist, wrong instructions are worse than
no answer.

**Recommended v1: a curated, version-controlled help corpus, prompt-stuffed.**
- A set of short how-to articles (markdown), kept in the repo (e.g.
  `docs/help/` or a `help_articles` table) — e.g. "Create a service",
  "Set appointment hours", "Issue a reward", "Configure the AI agent",
  "Read your no-show policy".
- v1 loads the relevant corpus into the system prompt and Claude answers
  grounded in it. With **Anthropic prompt caching**, a stable corpus of a
  few thousand tokens is cheap per call.
- **No vector DB / RAG for v1.** Add retrieval only if the corpus grows
  past what fits comfortably in a cached prompt.

This mirrors how the AI Sales Agent already works (prompt-stuffed context,
no RAG) — consistent and low-infrastructure.

---

## 5. Design decisions

| # | Decision | Recommendation |
|---|---|---|
| A | Knowledge source | Curated markdown help articles, version-controlled in the repo. Prompt-stuffed v1; retrieval later only if it outgrows the prompt. |
| B | Hallucination guardrail | Answer ONLY from the corpus. If a question isn't covered → *"I don't have a guide for that — here's how to reach support."* Never invent UI steps. |
| C | Out-of-domain questions | If asked a business-data question (#2) or anything non-product → politely decline and point to Reports / support. |
| D | Conversation shape | Multi-turn chat (follow-ups matter for how-to). A lightweight session, distinct from customer↔shop conversations. |
| E | Where it lives | An in-dashboard help widget — a "?" / "Help" launcher + slide-over panel, available across the shop dashboard (Square puts it behind a persistent button). |
| F | Audience | Shop owners for v1. Admins are a natural fast-follow; customers are out of scope. |
| G | Cost control | Haiku is sufficient for grounded how-to Q&A. Gate by a spend cap (its own small budget, or reuse `SpendCapEnforcer`). Audit-log to `ai_agent_messages`. |
| H | Deep-linking | Nice-to-have: answers could link to the relevant dashboard tab ("…in **Settings → AI Assistant**"). v1 can do plain text references; real deep-links are a polish follow-up. |

---

## 6. Work breakdown

### Phase 1 — Help corpus (the content)
- Author a starter set of how-to articles (markdown) covering the common
  shop tasks. Seed from the QA reference manual + the actual UI.
- Decide the home: `docs/help/` in-repo (simplest) vs a DB table (editable
  without a deploy). **This is the largest and most ongoing effort** — it's
  partly a content/writing task, not just engineering.

### Phase 2 — Backend: help-assistant endpoint
- A new endpoint (e.g. `POST /api/ai/help`) — shop/admin role.
- Builds a system prompt: the help corpus + the hard guardrails (answer
  only from the corpus; decline out-of-domain; never invent steps).
- Calls Claude (Haiku), spend-capped, audit-logged. Supports multi-turn
  (the request carries prior turns).

### Phase 3 — Frontend: in-dashboard help widget
- A persistent "Help" / "?" launcher on the shop dashboard → a slide-over
  chat panel ("Ask how to use RepairCoin").
- Suggested starter questions (like Square's), loading/error states.

### Phase 4 — Tests + polish
- Backend: guardrail behavior (declines out-of-domain, no-answer fallback),
  spend-cap skip. `tsc` + jest. Manual QA on real how-to questions.

---

## 7. Rough effort

Engineering (endpoint + widget + tests) ≈ **3–4 developer-days**. The
**help corpus is the real cost** — an initial pass is ~1–2 days of focused
writing, and it's an **ongoing maintenance commitment** (the corpus must
track UI changes, or the assistant gives stale instructions).

---

## 8. Resolved decisions

These were open questions; recommendations below are the working decisions
for v1 (revisit only if a reason surfaces).

1. **Corpus home → markdown in-repo for v1.** Fastest to ship (no CMS
   editor to build), changes get PR review (wrong how-to steps are worse
   than none), and git history tracks every edit. Biggest win: a PR that
   changes a shop-facing flow can update the matching help article *in the
   same PR*. A DB-backed `help_articles` table is its own feature (needs an
   editor UI) — defer until non-devs need frequent edits.
2. **Audience → shop only for v1.** The onboarding/support pain is on the
   shop dashboard. Admin how-to would need a separate admin corpus — clean
   fast-follow, not v1.
3. **Corpus owner → process + a named owner.** With the corpus in-repo,
   make "update the help article" part of the Definition of Done for any
   shop-facing UI change (PR checklist item), and nominate a single owner
   (product or support lead) for periodic accuracy audits. **Do not ship
   without a named owner** — an unowned corpus goes stale and the assistant
   misleads people.
4. **Conversation shape → multi-turn for v1.** How-to is inherently
   conversational ("ok, and then?"); single-shot loses context on every
   follow-up. Cheap to do — the request carries prior turns; the panel
   holds the conversation in client state, no DB persistence needed for v1.
5. **Launcher → separate from the customer-facing chat.** The shop owner
   and the customer are in different dashboards entirely. A distinct,
   clearly-labeled "Help / ?" launcher on the shop dashboard, so a shop
   owner never confuses "help using the app" with "chat with my customers."

---

## 9. Relationship to other docs

- **Separate from the AI Sales Agent** (`../ai-sales-agent/`) — that is
  customer-facing sales chat; this is shop-owner-facing product help.
- **#2 Business-data insights** (the other half of Square AI) is **not**
  scoped here — it warrants its own doc when prioritized.

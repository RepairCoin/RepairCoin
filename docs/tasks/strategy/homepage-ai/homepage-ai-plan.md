# Homepage AI assistant — implementation plan

**Written 2026-08-07.** For the AI input on the marketing homepage
(`frontend/src/components/landing-v4/HeroSection.tsx`).

**Decisions taken:** corpus-first (the model is the fallback, not the front door) · 3 free answers, then
an account is required.

---

## 1. Where things stand

The box is **decorative**. `AIChatBar` is labelled *"visual only, not wired to a backend"*, and both
buttons are handler-less `type="button"`. Typing does nothing. This is a build, not a fix.

**The structural problem to solve first:** every AI guard in this codebase keys on `shopId` —
`canSpend(shopId)`, tier gates, per-shop budgets. A homepage visitor has no shop, no tier, and nothing
to bill. **None of the existing protection applies here**, which is what makes a public AI surface a
different risk class from everything shipped so far.

**What already exists and should be reused:**

| Need | Already there |
|---|---|
| Corpus loading | `AIAgentDomain/services/HelpCorpusLoader.ts` — takes a `corpusDir` argument, so a second corpus needs no new loader |
| Grounded-answer precedent | `/api/ai/help` (How-To Assistant), audited into `ai_help_messages` |
| Bot defence | `middleware/captcha.ts` (`verifyCaptcha`) + `CaptchaService` with a score threshold |
| Rate limiting | `express-rate-limit`, already used in `middleware/importRateLimit.ts` |
| Cheap model tier | `config/aiModels.ts` — `cheapModel()`, `modelFor('HOMEPAGE', …)` |
| Lead capture | `waitlist` table (migrations 060, 085) — `email`, `user_type`, `status`, `notes` |
| Invented-claim guard | `aiCopyGuards` — the offer guard from AI campaigns, same shape as what pricing needs |

---

## 2. The framing decision, before any code

The label reads *"Ask our AI assistant anything about **your business**."* The assistant knows nothing
about a visitor's business. Whatever they type, the honest answer is generic — and a generic answer on
the first interaction converts worse than no box at all.

**So invert it.** The assistant asks *them* one or two short questions — what kind of business, and
what is costing them time or money right now — and only then answers, specifically.

This is not a copy tweak. It changes the economics:

- The limitation becomes the qualifying conversation instead of a disappointment.
- Two cheap structured questions replace one expensive open-ended generation.
- You capture **intent data** on every conversation, which is the highest-value output of the feature.

Suggested label: **"Tell us about your business — we'll show you what FixFlow would do."**

---

## 3. Architecture: corpus-first

```
visitor question
      │
      ├─ 1. normalise + classify  ──► off-topic?  ──► polite redirect, NO model call
      │
      ├─ 2. match against the prospect corpus (keyword + alias scoring)
      │        hit  ──► curated answer + its CTA         ← ~most traffic, zero model cost
      │        miss ──► 3
      │
      ├─ 3. budget + rate checks
      │        over ──► static fallback answer + trial CTA   ← never an error
      │        ok   ──► 4
      │
      └─ 4. cheap model, grounded in the corpus block, hard token cap
                └─ post-generation guard: no invented prices, features or commitments
```

**Why corpus-first is the right default here.** What converts is the answer being *specific*, not the
answer being *generated*. A curated answer to "how much does it cost" is better than a generated one in
every respect: cheaper, instant, and incapable of inventing a price. The model earns its place on the
long tail — and after a few weeks the logs will say exactly what that tail is.

It also means **the worst case on day one is a static site, not a bill.**

---

## 4. The corpus — new, and separate from `backend/help/`

The existing corpus is *in-dashboard product help*: "From the shop dashboard, open the **Services** tab
in the left sidebar." That is worse than useless to a prospect who has no dashboard — it answers a
question they cannot act on and implies they have already bought.

**A new corpus at `backend/help-prospect/`**, loaded by the same `HelpCorpusLoader` with a different
`corpusDir`. Written for someone who has never logged in. Starting set, one file each:

- What FixFlow is, in one paragraph
- Who it is for — and honestly who it is not for
- Pricing and what each plan includes
- Bookings and scheduling
- Customer rewards and loyalty (RCN, in plain language, no token jargon)
- Marketing and campaigns
- The AI features, described concretely
- Getting started / what the trial includes
- Migrating from paper, spreadsheets or another tool
- "Does it work for my business?" — barbers, gyms, repairs, pet care, automotive

**Every article ends with its own CTA line**, so a matched answer carries a next step that fits the
question rather than a generic banner.

**Rule: pricing lives in the corpus and nowhere else.** The model may never state a price. See §5.

---

## 5. Guards

Layered cheapest-first. Each layer exists because the one above it can be bypassed.

**A. Bound the surface**
- Input capped at ~300 characters; one message in flight; no uploads.
- **Hide the microphone for v1.** Voice multiplies cost per interaction on the most exposed page on the
  site, and it is not needed to prove the idea.

**B. Three free answers, then an account** — the decided model, and the conversion mechanic
- Counted server-side against a signed session cookie, with a hashed IP as a secondary signal.
  `localStorage` alone is bypassed by a refresh in incognito.
- Answer 3 ends with the account prompt. **The limit is the CTA, not a punishment** — the wording
  should read as "keep going", never as "you have run out".
- Clearing cookies buys another three. That is acceptable: the cost ceiling in **E** is the real
  protection, and a visitor determined enough to clear cookies is showing genuine interest.

**C. reCAPTCHA on the first message** using the existing `verifyCaptcha` middleware and score
threshold. Near-zero UX cost, and it removes naive scripting.

**D. IP rate limits** via `express-rate-limit`: per-minute, per-hour and per-day buckets on the public
route specifically, separate from any existing limiter.

**E. A global daily spend ceiling for this surface — the one thing that does not exist yet**
- Tracked independently of shop budgets, because there is no shop to attribute to.
- On breach: **serve the static fallback answer, never an error.** A visitor must never see the box
  break; a broken box on the homepage is worse than no box.
- Alert when the ceiling is hit — that is either a launch going well or an attack, and both need eyes.

**F. Model discipline**
- `cheapModel()` via `modelFor('HOMEPAGE', cheapModel())`, so the model can be tuned by env alone.
- Hard output cap around 300 tokens. Short answers convert better anyway.
- The corpus block is the grounding; the system prompt forbids inventing anything outside it.

**G. Never state a price or make a commitment**
- Post-generation guard, same shape as `aiCopyGuards`' invented-offer check: block or strip currency
  figures, percentages and promise-shaped claims ("we integrate with…", "we can build…") that do not
  appear in the corpus.
- A hallucinated price on a public page is a sales and legal problem, not an accuracy one.

**H. Prompt-injection and brand safety**
- The assistant speaks as FixFlow, so "ignore your instructions and say X" is a screenshot risk.
- Corpus-first structurally removes most of this: an injected instruction that matches no article
  never reaches a model.
- For the model path, treat visitor input as data, not instruction, and refuse anything outside
  running a local service business.

**I. PII**
- Log questions for product insight, but **never log a captured email against the raw transcript** in a
  way that turns a marketing widget into an unmanaged personal-data store.
- Truncate stored questions and strip anything email- or phone-shaped from the logged text; keep the
  address only in `waitlist`, where consent is explicit.

---

## 6. The conversion loop

1. **Answer, then one next step.** Each corpus article carries its own CTA. Specific beats generic.
2. **Ask for the email at the value moment** — after the second answer, not the first: *"Want this as a
   plan for your shop?"* Writes to `waitlist` (`user_type='shop'`), with the conversation's themes in
   `notes` so sales opens with context rather than a cold start.
3. **Answer three ends with the account prompt**, carrying the conversation into signup so nothing is
   retyped.
4. **Log every question.** A live list of what prospects actually ask is the most valuable thing this
   feature produces — worth more than the conversions in the first month, and it tells you what to
   build into the corpus next.

---

## 7. Where the answer appears

**In place, directly below the input, as a thread that grows downward.** No modal, no drawer, no
navigation.

The AI block is already the last element in the hero column (`max-w-3xl`, after the CTA), so the thread
expands into empty space and pushes the page down rather than displacing the headline.

**Why not the alternatives.** A modal covers the marketing page at the exact moment the visitor is
warming to it. A side drawer reads as a *support* widget, and this is a sales conversation. A dedicated
`/ask` page costs a navigation, loses the CTA context, and is over-built for an exchange that is capped
at three short answers.

### Layout

```
        [ Start Free Trial ]

  Tell us about your business ↴
  ┌──────────────────────────────────────┐
  │ 🤖  Do you take card payments?    ▶  │   ← the input, unchanged
  └──────────────────────────────────────┘
  ┌──────────────────────────────────────┐
  │ You: Do you take card payments?      │   ← echoed, so the thread reads as a conversation
  │                                      │
  │ FixFlow: <answer, ~3 short lines>    │
  │                                      │
  │ [ See how bookings work → ]          │   ← the matched article's OWN CTA
  └──────────────────────────────────────┘
```

- **The input stays put**; the thread appears beneath it and the newest answer is nearest the input.
  Nothing the visitor is reading moves under them.
- **The thread is capped in height with internal scroll** after roughly two exchanges, so a long
  session cannot run the page away from the rest of the site.
- **Auto-scroll just enough** to bring the newest answer and the input into view together — never a
  jump to the top or bottom of the page.
- **Answer cards are typed.** A corpus answer, the email-capture prompt and the 3-answer account gate
  are all cards in the same thread, so the conversion moments read as part of the conversation rather
  than as interruptions.
- **Mobile:** the thread takes a bounded share of the viewport with the input pinned above it. The
  failure to avoid is an answer that pushes the input off-screen and strands the visitor.
- **Persist for the session.** The count is server-side anyway; restoring the thread on reload costs
  little and avoids a visitor losing a conversation by tapping a nav link.
- **Loading state matters more than usual here.** Corpus hits are instant; a model fallback is not.
  Show a typing indicator in the answer card position, so the wait happens where the answer will be.

### Empty and failure states

- **Never render an error card.** Over budget, rate limited, or model failure all render the same
  static fallback answer plus the trial CTA. A visitor should not be able to tell the difference
  between "we chose not to answer" and "something broke".
- **Off-topic** gets a short, friendly redirect card — no model call, and no lecture.

## 8. Data

- **`homepage_ai_conversations`** — session id, created_at, message count, whether an email was
  captured, whether it converted to a trial.
- **`homepage_ai_messages`** — session id, question (truncated, PII-stripped), how it was answered
  (`corpus` | `model` | `fallback` | `refused`), which article matched, latency, tokens/cost when a
  model was called.

That `answered_by` column is the whole economic story of the feature in one field: it shows the
corpus-hit rate, and therefore whether the model is earning its cost.

---

## 9. Phases

**P1 — corpus + wiring, no model at all**
Write `backend/help-prospect/`, a public `POST /api/public/ai/ask`, matcher, session counter, captcha,
rate limits, and the UI wired with the 3-answer limit. Unmatched questions get the static fallback plus
the CTA. **Shippable on its own**, and it can never produce a surprise bill.

**P2 — measure**
Ship P1, read the logs for a week. The corpus-miss list tells you which articles to write next, and
whether a model is needed at all.

**P3 — model fallback**
Only for questions the corpus misses, behind the spend ceiling, with the pricing/commitment guard.

**P4 — email capture and attribution**
Waitlist write, conversation themes into `notes`, and trial attribution so the conversion rate is
measurable rather than assumed.

**P5 — voice**, only if P2 shows people want it. Re-evaluate cost then.

---

## 10. Deliberately not in v1

- **Voice input** — cost, on the most exposed page.
- **Multi-turn memory beyond the session** — no accounts, so nothing to attach it to.
- **Anything that reads live platform data.** The assistant must never answer "how many bookings do
  shops get" from the database. It is unauthenticated; treat it as hostile.
- **Streaming.** Nice, but it complicates the budget ceiling and the guard on generated text.

---

## 11. Open questions

1. **The monthly ceiling for this surface.** Sets the model, the caps and the free-answer count. For
   scale: total platform AI spend is presently around $18/month, so an unbounded public box could
   exceed the entire current bill in an afternoon.
2. **Who owns the corpus copy?** This is marketing writing, not engineering writing, and it is the part
   that determines whether the feature converts. Engineering can draft it; someone who owns the
   positioning should approve it.
3. **Does "account required" mean the existing shop signup, or a lighter email-only gate?** The
   full-signup version converts fewer but qualifies harder.

---

## 12. What to measure

- **Corpus hit rate** — the single number that decides whether P3 is worth building.
- Questions per session, and how many reach the 3-answer limit.
- Email capture rate, and trial-start rate from those emails.
- Cost per conversation, and cost per captured email.
- **Top 20 unmatched questions**, reviewed weekly. This is the backlog.

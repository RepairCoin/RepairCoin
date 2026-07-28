# AI Memory auto-extract — AX-5 precision eval

**Date:** 2026-07-28 · **Branch:** `deo/ai-memory-autoextract`
**Plan:** `ai-memory-autoextract-plan.md` (AX-5) · **Harness:** `backend/scripts/eval-memory-autoextract.ts`

## Verdict

**AX-5 is DEFERRED. `AI_MEMORY_AUTOEXTRACT` stays OFF in every environment.**

Not because the extractor failed — it passed everything we could actually measure — but because
**staging does not contain enough owner conversation to constitute a gate.** The eval was specified as
"sample N real orchestrate conversations and hand-label the candidates." N, on staging, is 4. Two of
those 4 trace back to strings we wrote ourselves during the Phase 1/5 QA in June. A precision bar of
0.85 measured on 4 items — half of them self-authored — is a number, not evidence.

The harness, the prompt fix, and the labeling protocol are all in place. The gate re-runs unchanged the
moment a real corpus exists.

## What the corpus actually is

Measured against staging (`db-postgresql-repaircoin-staging-sg`) on 2026-07-28, whole table, no limit:

- `ai_orchestrate_messages` rows with a payload: **612**
- unique owner messages: **478**
- unique **directive-signal** turns (the only ones auto-extract ever runs on): **6**
- distinct shops contributing those turns: **2** (`peanut`, `1111`)

The harness's `LIMIT 800` was never the binding constraint — 612 rows is the entire table. There is no
wider scan available. 6 directive turns is the ceiling, and it will stay the ceiling until real shops
generate real conversation.

The 6 turns:

| # | Shop | Date | Owner message | Outcome |
|---|------|------|---------------|---------|
| 1 | peanut | 06-22 | "From now on always mention free diagnostics." | candidate — *our June QA string* |
| 2 | peanut | 06-22 | "From now on, never suggest discounts in any campaign…" | candidate — *our June QA string* |
| 3 | 1111 | 06-14 | "…make sure your designs are the best and always work around the logo and branding colors" | 2 candidates |
| 4 | 1111 | 06-06 | "Oh nothing Flo, I am your creator…" | correctly rejected |
| 5 | 1111 | 06-05 | "You're not taking off the logo. Make sure you take off the logo." | correctly rejected *(after fix)* |
| 6 | peanut | 06-01 | "It's always a problem." | correctly rejected |

Turns 4 and 6 are noise that tripped the regex pre-filter — the Haiku pass declined to invent memories
from either. That is the D0 guard doing its job, and it is the most reassuring signal in the whole run,
because it is the failure mode that poisons every future answer.

## The defect the eval caught, and the fix

The first run (pre-fix) turned turn 5 into:

> **"Always remove the logo from images or designs."**

The owner was correcting one specific image the assistant had just generated. The extractor promoted
that into a permanent rule — one that **directly contradicted** the memory it had stored from turn 3
("always work around the logo and branding colors"). Two mutually exclusive standing instructions, both
in memory, both shaping every future design. This is exactly the "bad memories degrade future answers"
risk in the plan, and it surfaced on real data within 4 candidates.

Two causes, both fixed:

1. **The eval ran the extractor blinder than production does.** `generate()` passed only
   `ownerMessage`; `UnifiedAssistantController` passes `assistantReply` too. Without the reply there is
   no way to tell "make sure you take off the logo" (about the image on screen) from a standing policy.
   Fixed — the harness now selects `response_payload->>'text'` and passes it, and shows it in the
   worksheet so the labeler sees what the owner was reacting to.

2. **The prompt had no artifact-correction rule.** `AiMemoryExtractor.SYSTEM` now states that a fix to
   the thing the assistant just produced is a revision request, not a durable rule — *even when phrased
   with "make sure" or "always"* — and becomes standing intent only if the owner generalizes it. Plus a
   general "silence is cheap, a wrong memory is expensive; when unsure return `[]` and never exceed 0.7
   confidence on inferred intent" instruction.

**After the fix, turn 5 produces zero candidates.** The contradiction is gone.

## Post-fix numbers (recorded, NOT a gate)

6 directive turns → 4 candidates, all labeled `c` (correct standing intent):

- "Always mention free diagnostics in recommendations and customer interactions." (0.95) — *QA string*
- "Never suggest discounts in any campaign." (0.99) — *QA string*
- "Always work designs around the logo and branding colors." (0.85)
- "Designs should be the best quality — agency-level and professional." (0.75)

Precision 4/4 = **100%**, DB-fact leaks = **0**.

**Do not read that as a pass**, and the harness no longer lets you: sample size is now part of the gate
(`MIN_SAMPLE = 30`), so this run reports

```
GATE: INCONCLUSIVE ⚠ — quality bar met (precision 100.0%, zero fact-leak) but the sample is
too small: n=4, need ≥ 30. Keep the flag OFF and re-run when the corpus has grown.
```

Before that change it printed `GATE: PASS ✅ — Safe to turn AI_MEMORY_AUTOEXTRACT on`, which is exactly
the trap this eval exists to avoid: a 100% ratio over four items, two of them our own QA strings and one
shop supplying all the organic material. The quality bar clears; the evidential bar does not.

One real observation from the organic sample: a single owner sentence produced **two** memories
(candidates 3 and 4 both come from turn 3). Not incorrect — both are genuine standing preferences — but
it points at memory bloat from over-splitting one utterance. Worth watching once volume exists; not
worth tuning against n=1.

## The pre-filter was the bigger problem (fixed 2026-07-28)

The eval measured what the extractor did with turns it *saw*. It never measured what the pre-filter
threw away first — and that turned out to be most of the feature.

`hasDirectiveSignal` matched a list of directive words (`always|never|from now on|make sure|…`). Run
against 20 ordinary ways a shop owner states a standing rule, it caught **7**. It missed
"Don't mention discounts in my emails", "Please keep campaign emails short", "Stop using emojis",
"Keep it under 100 words", "Sign off as Peanut, not RepairCoin". Note the shape of that failure: the
filter recognised the stiff register of someone *deliberately dictating a rule* and missed ordinary
speech — backwards for a feature whose promise is learning from normal conversation. And a miss is
**silent**: nothing stored, nothing said, owner assumes it was noted.

Rebuilt to match instruction SHAPE rather than vocabulary. Two rules, both learned by measuring
against real staging traffic (which is largely voice-transcribed and rambling):

1. **A negation only counts when it opens a clause.** "Don't mention discounts" is an instruction;
   "I don't know if I'm in their target" is narration. Bare `/don't/` matches both.
2. **A preference must name a category, not the artifact on screen.** "I hate long emails" is a rule;
   "I love it" is applause for the draft just produced — hence the pronoun lookahead.

Both rules came from real data: an intermediate candidate that matched bare `don't` and `i like`
swallowed *"i like it lets send it"*, *"I love it. Let's go ahead and send it."*, *"No! You will escape
me again!"* — every one a paid Haiku call and a chance to store a bogus rule.

Result: **18/20 caught, 0 false fires against 16 real noise samples, fire-rate on 479 real owner
messages moves only 1.5% → 1.7%.** Recall up ~2.5x for essentially no extra spend — the old filter
wasn't buying the cost saving it appeared to.

Known gap: evaluative phrasings with no imperative — "Casual tone is better for my shop", "My customers
prefer text over email" — are still missed. The patterns that would catch them also match
"whatever you suggest is better to do", which is real staging traffic. Left uncaught deliberately.

This raises the value of every future AX-5 run: the corpus now accumulates from ordinary speech, not
just formal directives, so the ~40-turn bar should be reached far sooner — and the eval will finally be
measuring the extractor rather than the keyword list in front of it.

## What un-defers this

Re-run the harness — unchanged — once staging or prod has **~40+ unique directive-signal turns across
≥5 distinct shops**, none of them ours:

```bash
cd backend
npx ts-node scripts/eval-memory-autoextract.ts --limit 40      # writes autoextract-eval-worksheet.md
# hand-label each LABEL: line  →  c | f | o | w
npx ts-node scripts/eval-memory-autoextract.ts --score autoextract-eval-worksheet.md
```

Gate: **precision ≥ 0.85 AND zero `f` AND n ≥ 30**. A single DB-fact leak is a hard fail (D0); too few
candidates reports `INCONCLUSIVE` rather than passing.

To check whether the corpus has grown enough to bother, the row counts above come from a throwaway
query against `ai_orchestrate_messages` — count the distinct owner messages matching
`DIRECTIVE_SIGNALS` (exported from `AiMemoryExtractor.ts`).

Note the worksheet contains real customer conversation snippets and is **gitignored** — the tool is
committed, its output is not.

## Status of the code

Shipped and dormant. `AI_MEMORY_AUTOEXTRACT` defaults OFF, under `ENABLE_AI_MEMORY` and the Business
tier gate, so none of this executes anywhere today. Business tier continues to ship the explicit
(`remember_this`) memory that Phases 1/2/5 delivered.

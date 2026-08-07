# Prospect corpus

Source of truth for the **homepage AI assistant** — the box in the hero on the
public marketing site. It answers questions from people who have **never logged
in** and may never have heard of FixFlow.

Deliberately separate from `backend/help/`, which is in-dashboard *how-to* help
("open the Services tab in the left sidebar"). That corpus is worse than useless
here: it answers questions a prospect cannot act on and assumes they have
already bought.

Plan: [`docs/tasks/strategy/homepage-ai/homepage-ai-plan.md`](../../docs/tasks/strategy/homepage-ai/homepage-ai-plan.md).

---

## Who is reading these

Someone comparing options, on a phone, with about twenty seconds of patience.
They are not looking for documentation. They are deciding whether to keep
reading.

Write for a barber, a gym owner, a phone-repair shop. Not for an engineer, and
not for someone who already knows what RCN is.

---

## The contract

1. **One topic per file**, kebab-case. The filename is the stable identifier the
   matcher and the logs use — don't rename casually.

2. **Every article ends with `## Next step`** — a single, specific call to
   action that fits *that question*. A generic "Start free trial" bolted onto
   every answer converts worse than one line that follows from what was asked.

3. **`## People ask this as`** lists the real phrasings. This is not decoration:
   the matcher scores against these lines, so an unlisted phrasing is a corpus
   miss. Add to it whenever the logs show a question the corpus should have
   caught.

4. **Never claim a feature that does not exist.** The whole reason this corpus
   is corpus-first is that a curated answer cannot hallucinate. If we put a
   false claim in here, we have thrown that away and made it worse — the model
   would now cite it.

5. **Prices live here and nowhere else.** The model is forbidden from stating a
   price; it can only repeat one from these files. So a stale number here
   becomes a stale number on the homepage, said with confidence, to someone
   deciding whether to buy. **When pricing changes, this folder changes in the
   same PR.**

6. **Short.** Answers render in a card under the hero input, on a phone. Three
   or four short lines, then the next step. If it needs more, it is the wrong
   thing to say here.

7. **Honest about limits.** "Who it is not for" earns more trust than another
   paragraph of benefits, and it stops us paying for trials that were never
   going to convert.

---

## Status

**DRAFT — not approved.** These files were written by engineering from the
product's actual configuration (`subscriptionPlans.ts`, `featureTiers.ts`) and
from the live service-category data. The facts should be right; the
**positioning is not engineering's to own.** Whoever owns messaging should edit
freely before this goes near the homepage.

Two things to check first:

- **Pricing.** Taken from `SUBSCRIPTION_PLANS` on 2026-08-07. Note that
  `CLAUDE.md` still says "$500/month", which is `LEGACY_MONTHLY_AMOUNT` and no
  longer the offer — evidence of exactly how fast this drifts.
- **Tier contents.** Taken from `FEATURE_TIERS`. Accurate to the code, but the
  code gates some features dark behind rollout flags, so what a shop can *use*
  today may differ from what the sheet promises.

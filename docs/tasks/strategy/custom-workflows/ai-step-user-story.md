# Custom Workflows — "Let AI write it": user story and flows

**Status:** built and deployed 2026-08-03. Not yet verified in a browser.
**Action key:** `ai_step`

---

## User story

> **As a** repair shop owner,
> **I want** the message written at the moment the workflow runs,
> **so that** my customers get something current and natural instead of a template I wrote months ago
> and forgot to update.

**Supporting story — the shop this is actually for:**

> **As an owner who is not a copywriter,** I want to describe what the message should *achieve* rather
> than compose it, so that I can automate a follow-up I would otherwise never get round to writing.

## Acceptance criteria

- I can pick "Let AI write it" as a workflow action without writing any message myself.
- I can optionally give a short brief describing what it should say.
- The message uses my shop's brand voice.
- Each customer's name and my shop name appear correctly in what they receive.
- It never spends more of my monthly AI allowance than the workflow is worth.
- If the message can't be written, nothing is sent — I don't get a half-message, and customers don't
  get something I didn't intend.

---

## Flow A — an event trigger, one customer at a time

*Marco's Auto Repair wants to thank customers after a repair.*

**Setup, once**

1. **Automation → Create workflow**
2. Trigger: **Event → Booking Completed**, delay 2 hours
3. Action: **Let AI write it**
4. Brief: *"Thank them warmly, remind them the warranty is 90 days"*
5. Save as Draft, then Publish

**When Ada's brake job is completed**

1. Two hours later the workflow fires — for Ada, and only Ada.
2. The message is written from Marco's brand voice, the fact that this was a completed booking, and
   his brief.
3. Ada receives something like:

   > Hi Ada, thanks for trusting Marco's Auto Repair with your brakes today. You're covered by our
   > 90-day warranty — just shout if anything feels off.

4. Grace's booking completes that afternoon. **She gets a freshly written message** — same intent,
   different words, about her repair rather than Ada's.

**Cost:** one generation per completed booking. At 40 repairs a month, 40 short generations.

## Flow B — a sweep, a whole audience at once

*Marco wants to win back customers who have drifted away.*

**Setup, once**

1. Trigger: **Event → Inactive 30 Days**
2. Target audience: **Inactive (30+ days)**
3. Action: **Let AI write it**
4. Brief: *"Friendly nudge, mention we're open Saturdays now"*

**When it runs**

1. The audience resolves — say 34 lapsed customers.
2. **One message is written for that run:**

   > Hi {{customerName}}, it's been a while! We're open Saturdays now at {{shopName}} if weekdays are
   > tricky. Anything we can look at?

3. All 34 receive it, each with their own name filled in.
4. Next month it runs again and writes **different copy**, because it is written that month rather
   than stored.

**Cost:** one generation for the whole run, not 34.

---

## Why the two flows differ

This is the part that shapes the feature and is invisible on screen.

The engine runs an action **once per customer** on the paths that resolve an audience — scheduled
rules, and the two sweeps (`inactive_30_days`, `low_bookings`). Writing per person there would mean
up to 50 generations in a single hourly tick, roughly 1,500 a month for a daily rule, against a
monthly AI allowance of **$10 on Growth**. That is a large share of a shop's budget for one
automation they set and forgot — and once the cap is reached the messages simply stop.

So on those paths the copy is written **once per run** and reused, with `{{customerName}}` and
`{{shopName}}` carrying the per-person parts. That is what "written at send time" is actually for:
copy that reflects *this month*, not copy unique to each person.

Every other event trigger is handed **exactly one customer** — `handleEventTrigger` takes a single
customer address. Writing per person there costs one generation per event either way, so pooling
would save nothing and would hand the second customer a message written about somebody else's
repair. Those generate fresh every time.

*(This split was corrected on 2026-08-04. The first version pooled on every trigger, which was right
for sweeps and wrong for events.)*

## What happens when it can't write the message

Nothing is sent, and it is logged.

The expected cause is the shop exhausting its monthly AI allowance — the spend cap refuses rather
than overspending. Sending nothing is the right outcome; sending something the shop neither wrote nor
budgeted for would be worse. Failures are deliberately **not** cached, so one transient error cannot
silence the workflow for the rest of the run.

## Known gaps

Both are worth knowing before recommending this to a shop:

- **No sample before publishing.** The owner is approving a *behaviour*, not a message. A "show me an
  example" control would fix this cheaply — the generation path already exists and could be called
  once on demand.
- **No approval step.** It writes and sends in one motion. Brand voice settings and the brief are the
  only steering. That is the point of automation, but it should be a conscious choice rather than a
  surprise.

Related: `scope.md` §9.2, `qa-workflow-actions-triggers-staging-checklist.md` (test 4).

# Custom Workflows — management change request (2026-07-30)

Source: WhatsApp message, "A few ideas to make it even stronger". Four asks:

1. **Estimated results** under each template — "Typically increases repeat bookings by 12–18%".
2. **One-click activation** — a "⚡ Use Template" affordance, opening the editor prefilled.
3. **AI recommendations** — "You had 18 customers who haven't returned in 45 days. I recommend enabling
   the Win Back workflow."
4. **Analytics per workflow card** — Sent / Opened / Booked / Revenue Generated. "Now the workflow becomes
   measurable, not just configurable."

Closing line: *"work flows looks really good for people that have no idea how to implement them selfs"* —
that is the actual product thesis, and it's the right one. All four asks serve it. The ordering below
follows from what already exists, not from the order they were written.

---

## 1. Audit against the code first

The four asks are not four builds.

| Ask | Reality |
| --- | --- |
| #2 Use Template | **~90% built.** Gallery exists, auto-opens at zero workflows, cards already prefill the builder. Missing only the visible CTA. |
| #3 AI recommendations | **~80% built.** The recommendations system shipped (9 detectors, registry, service, phraser, Growth+ gate). `lapsedCustomersDetector` already computes the exact number in the example. Missing only a destination. |
| #1 Estimated results | Needs a decision, not a build. The percentages have never been measured. |
| #4 Analytics | **The real work.** Three of four metrics are derivable today; one is not measurable as written. |

### The dependency management's list doesn't show

**#1's real version is downstream of #4.** "Typically increases repeat bookings by 12–18%" cannot be
published until something has been measuring outcomes, and nothing has. So #1 ships as an honest
substitute now and upgrades later — it is not a one-shot task.

---

## 2. Decisions

### D1 — Estimated results: benefit line + the shop's OWN number

**Rejected: shipping the percentages as static copy.** They are quantitative outcome claims about a
feature with zero collected outcomes. Two staging shops have automations. If a paying shop asks where
12–18% comes from, there is no answer — and the number would sit in the product indefinitely, becoming
the thing quoted back at us in a refund argument.

**Chosen**, per template:
- a **qualitative benefit** ("Helps recover cancelled appointments") — delivers what the ask is actually
  for, "helps owners decide which to enable first";
- plus a **computed, per-shop relevance line** — "You had **18** customers who haven't returned in 45
  days", "**12** cancellations last month".

The second is strictly stronger than a generic average: it converts "this typically works" into "this
applies to you, here is your number". And it is true.

**Upgrade path:** once #4 has a corpus, replace the generic benefit with a real platform benchmark —
gated on a minimum sample. See [[feedback-eval-must-mirror-production-input]] for the sibling lesson:
a number published off a 3-shop sample manufactures its own credibility problem.

**Integrity rule inherited from the recommendations feed:** copy may only interpolate values something
actually computed. `RecCandidate.evidence` exists for exactly this reason. Template relevance lines follow
the same rule — no line renders if its number wasn't computed for this shop.

### D2 — Analytics: attributed, 14-day window, definition on screen

Per metric:

- **Sent** — fact. `auto_message_sends WHERE status='sent'`. Already surfaced as Total enrolled.
- **Opened** — **not measurable as written.** Workflows write in-app conversation messages, not email;
  there is no open pixel. But `messages.is_read` / `read_at` exist and `auto_message_sends.message_id`
  links to them, so we report **Read** — a true receipt, and a *stronger* signal than an email open
  estimate. Rename the metric rather than fake it.
- **Booked** — attributed: a `service_orders` row for that customer created within **14 days** of the
  send. Buildable; attribution is a judgement, not a fact.
- **Revenue** — same window, summing order value.

**The risk is labelling, not feasibility.** "Revenue Generated" asserts causation. A shop that ran a
win-back workflow and had a good month will read $4,320 as *caused*, and we cannot defend that. So the
window is named in the label and the rule is visible on hover: *"Revenue from bookings made within 14 days
of a workflow message. Correlation, not proof of cause."*

Why 14 days: it is the shortest window that covers a normal "I'll book it next payday" delay without
sweeping in a customer's ordinary next visit. It is a product judgement and is written down here so the
number always has one definition.

### D3 — "One-click activation" adds the button, keeps the gate

A template can issue real RCN and message real customers. A4 (Draft/Published, migration 253) exists
because a rule used to go live on Save — a shop could pick a template and start paying 25 RCN per booking
having never pressed anything called "activate". So:

**"⚡ Use Template" → prefilled editor → Save (Draft) → Publish.**

That is one click to *start*, which is what the ask is for. It is deliberately not one click to *go live*.

### D4 — Recommendations point at workflows, not the assistant

`lapsedCustomersDetector` already says what it wants and can't have:

> *"Intended destination is the campaign composer prefilled with this audience, but CampaignBuilderModal
> only prefills from an explicit address list — there is no audience-key entry point yet. Until that
> exists this opens the assistant."*

Management is asking for a **better** destination than the missing one. A workflow is the durable version
of a campaign: a campaign is one send, a workflow keeps running. And the workflow gallery already prefills.

So: a new `RecAction` kind — `{ kind: 'workflow'; templateId: string }` — deep-linking the Automation tab
with that template preselected. One action kind, one frontend handler, then detectors repoint.

This is the highest-leverage change of the four and it is what makes the system "feel intelligent", which
is the stated goal of the ask.

---

## 3. Phasing

**Status: M1, M2 and M3 BUILT 2026-07-30.** M4 waits on data that M3 has only just started collecting.

**M1 — Template decision support** (D1, D3) ✅
- `benefit` on all 10 templates.
- `WorkflowRelevanceService` + `GET /auto-messages/template-relevance` → counts keyed by METRIC, not by
  template, because several templates read the same number and the phrasing belongs with the copy.
- Each template owns a `relevance(r)` returning null below its own floor. `payment-recovery` has none at
  all — `service_orders` has no `payment_status`, so failed payments aren't countable, so it shows no line.
  That is the integrity rule working, not an omission.
- "⚡ Use template" CTA on each card.
- Live check: `peanut` gets exactly one line (4 low-stock items; its 3 lapsed customers are below the floor
  of 5), `dc_shopu` gets one (8 lapsed). Sparse and true beats decorated.

**M2 — Recommendations → workflows** (D4) ✅
- `RecAction` gained `{ kind: 'workflow'; templateId }`; frontend deep-links `?tab=automation&template=<id>`
  and `WorkflowsList` opens that template prefilled, then strips the param so a later refresh doesn't
  reopen the builder over whatever the owner is doing.
- **Not a straight repoint.** Two constraints collided: detectors may not consider tier, and the feed is a
  flat `.slice(0, limit)`. Repointing `action` outright would strip these cards from Growth shops (who can
  still act via the campaign composer); adding parallel workflow detectors would crowd the feed with
  near-duplicates. So `RecCandidate` gained `preferredWorkflow`, which the SERVICE promotes into `action`
  only when the shop has `customWorkflows` — one card, best destination that shop can reach.
  Under-promoting during a dark rollout is the safe failure; the alternative sends someone to a hidden screen.
- Applied to `lapsedCustomers` (win-back), `slowPeriod` (slow-week), `reviewRequests` (post-repair).
  **`lowStock` deliberately left alone:** the inventory table genuinely IS the answer to "what's low right
  now" — the workflow answers a different question ("tell me next time"), and churning a good destination
  for a worse one is not an improvement.

**M3 — Workflow analytics** (D2) ✅
- `WorkflowMetricsService` — Sent / Read / Booked(14d) / Revenue(14d) per rule, one query, no new tables.
- `GET /auto-messages/metrics` returns the window ALONGSIDE the numbers, so the label states the same
  figure the data was built from. Two hardcoded copies of "14 days" is how a label drifts from its data.
- Rendered as a subtitle line, not four more columns on an already seven-wide table.
- **Two traps found while building it:**
  - Without `DISTINCT` on `order_id`, a drip sequence re-attributes the SAME order once per step,
    inflating count and revenue by the number of steps. Verified on live data.
  - A `notify_staff` rule stores `customer_address = NULL`, so counting those as undelivered messages
    would park a working workflow at 0% read forever. Read is divided by `delivered`, not `sent`, and a
    rule with no customer sends reports "Ran N times" instead.
- Live cross-check against staging: `peanut` shop-scoped rule → `sent:1, delivered:0` (correctly excluded);
  `7777` → `sent:6, delivered:6, read:3, booked:4, revenue:880`; `dc_shopu` rule with `sent:1, booked:2`
  (one customer, two genuine orders in the window — not a double count).

**M4 — Real benchmarks** (unlocks D1's upgrade)
- Only once M3 has run long enough for a defensible sample across shops.
- Explicit minimum-sample gate; below it, keep the qualitative line.

## 4. What this does NOT change

- The engine. All four asks are presentation, decision support, and measurement. No trigger, action or
  scheduler change — which is why this is safe to do right after a week of engine fixes.
- Draft→Publish. See D3.
- Tier gating. `customWorkflows: 'business'`; recommendations stay Growth+ via `requiredFeature`.

Related: [[project-custom-workflows-state]], [[project-ai-recommendations-state]],
[[project-lapsed-audience-data-model]].

# QA — the four new workflow actions and triggers, on staging

**Scope:** staging only. **Shops:** `peanut` and `dc_shopu`. **Time:** ~20 minutes.

Covers everything built 2026-08-03 after the first QA pass:

| What | Commit | Verified so far |
| --- | --- | --- |
| `run_campaign` action | `566b80bf9` | backend only |
| `ai_step` action | `caf7a2450` | unit tests only |
| `draft_reorder` action | `76987f05e` | unit tests only |
| `new_ad_lead` trigger | `1d86ad70f` | unit tests only |

All four pass typechecks and 2,693 unit tests. That is exactly the coverage that missed four
real bugs last time — the previous pass found revenue counting orders that never happened,
recommendations frozen since first detection, an unvalidated empty audience, and a dropdown
lying about its own value. None of those were visible below the browser.

> ### ⚠️ Read before you start
>
> These actions do real things. Unlike the last pass, three of them have side effects that cost
> money or leave records:
>
> - **`run_campaign` sends real email** to a real audience. Use a **draft** campaign.
> - **`ai_step` spends the shop's monthly AI allowance** on every run.
> - **`draft_reorder` writes purchase-order suggestions.** Reversible — reject them afterwards.
>
> **Keep every test workflow as a Draft** unless a step says otherwise. A draft never runs. That
> gate exists precisely because a workflow can now email customers, spend AI budget and draft
> purchase orders.
>
> Delete the test workflows when you're done.

---

## 1. The action picker

- [ ] Open **Automation → Create workflow**

**Expect six actions**, in two rows of three:

- Send a message · Issue an RCN reward · Notify my team
- Send a campaign · Let AI write it · Draft a reorder

**🚩 Red flag** — only three or four. The picker grid was widened from `grid-cols-3`; a stale
bundle shows the old set. Hard-reload before reporting it.

- [ ] Click each of the three new ones and confirm the panel below changes:
  - **Send a campaign** → a campaign dropdown
  - **Let AI write it** → a "What should it say?" textarea **and a "Show me an example" button**
  - **Draft a reorder** → an explanatory box with no fields

**🚩 Red flag — a Message Template box still showing** for any of those three, or the placeholder
chips, the A/B toggle or the drip toggle. None of them composes a message here: a campaign carries
its own, an AI step writes one at send time, a reorder messages nobody. The form used to accept text
there and silently discard it at submit. Same for **Target Audience** or **Max sends per customer**
appearing on *Send a campaign* or *Draft a reorder* — both are shop-scoped, so neither is consulted.

- [ ] On **Let AI write it**, press **Show me an example**

**Expect** — a sample message, labelled as an example rather than a preview, with a note that the
real message is written when the workflow runs. Each press spends a little of the shop's AI
allowance, so it must never fire while typing.

**🚩 Red flag** — a panel that doesn't change, or a message-body box still showing. None of these
three stores a message template; if the composer is still there, `NO_TEMPLATE_ACTIONS` isn't
being read on this surface.

---

## 2. Draft a reorder — the safest real run

**Use `peanut`.** It has **4 items at or below reorder level**, so this will actually do something.

- [ ] Create a workflow: trigger **Event → Low Stock (shop alert)**, action **Draft a reorder**
- [ ] Save it

**Expect**
- The action panel says it drafts a PO for approval, never places an order
- **Target Audience** and **Max sends per customer** are both absent
- Row badge reads **Draft**

- [ ] Now **Publish** it, and wait for the next hourly tick (or trigger a stock change)
- [ ] Go to **Inventory → PO suggestions**

**Expect** — draft purchase-order suggestions for the low items, awaiting approval.

**🚩 Red flag — duplicates.** If the same item appears twice, de-duplication broke.
`createSuggestion()` is supposed to return the existing suggestion per item rather than making
another, and the action deliberately adds no second throttle on top.

**🚩 Red flag — an actual purchase order**, rather than a suggestion. The workflow must never
place an order or spend money.

- [ ] Reject the suggestions, then **delete the workflow**

> **Why this one first:** it's the only new action whose side effects are fully reversible from
> the UI.

---

## 3. Send a campaign — check that it CLONES

**Use `dc_shopu`.** It has campaigns. **Pick a draft campaign as the target.**

- [ ] Create a workflow, action **Send a campaign**
- [ ] Open the campaign dropdown

**Expect** — dc_shopu's campaigns listed, drafts marked `(draft)`. If the shop had none, the
dropdown would read "No campaigns yet — create one in Marketing".

**🚩 Red flag** — an empty list on a shop that has campaigns. The list is fetched lazily, only
when the action is selected, using the shop id from the auth store; empty here means that lookup
failed.

- [ ] Pick one, save as a **Draft**, reopen it

**Expect** — the same campaign still selected. (The last pass found a dropdown that showed a
placeholder over a correct stored value; this is the same class of check.)

**If you want to see it actually fire** — publish it against a trigger you can cause, then:

- [ ] Go to **Marketing → Campaigns**

**Expect**
- A **new** campaign named `<original> — via <workflow name>`, status **sent**
- The **original still exactly as it was** — same status, same recipient and open counts

**🚩 Red flag — the original was marked sent, or its stats changed.** The configured campaign is
meant to be a *template*: `sendCampaign` throws on `status === 'sent'`, so reusing the row would
make the workflow work exactly once and then throw forever after.

**🚩 Red flag — more than one clone per firing.** A campaign resolves its own audience; one clone
per recipient would mean fifty campaigns to fifty people.

**Also worth confirming:** the clone should carry the campaign's content and audience but **no
RCN rewards**. That's deliberate — a recurring workflow firing a reward campaign is a standing
order against the shop's balance nobody re-approves. It's the open decision on this action.

---

## 4. Let AI write it — the cost behaviour

This is the one where the interesting property isn't visible on screen.

- [ ] Create a workflow, action **Let AI write it**, leave the brief blank
- [ ] Save as a **Draft**, reopen

**Expect** — the panel explains the copy is written fresh each run, one version per run, with
`{{customerName}}` filled in per customer.

- [ ] Add a brief ("friendly nudge, mention we're open Sundays"), save, reopen

**Expect** — the brief persisted.

**If you publish it and let it run**, the thing to check is in the data, not the UI:

- [ ] Look at the messages it produced for that run

**Expect** — every recipient in one run gets the **same body**, with their own name substituted.

**🚩 Red flag — a different body per recipient.** That means it's generating per customer, which
is one Claude call per person: up to 50 a tick and roughly 1,500 a month for a daily rule against
a $10 Growth allowance. The whole design is one generation per rule per run.

**🚩 Red flag — the workflow runs and no messages appear, with nothing in the logs.** Generation
failure is expected once a shop exhausts its allowance, but it must log loudly; silence is the
failure mode this feature is built to avoid.

- [ ] Check **Admin → AI Usage** afterwards and confirm the spend is one generation, not fifty

---

## 5. New ad lead — builder only

**Not fully testable on staging today.** The trigger fires from `ads:lead_captured`, and all
`ADS_META_*` flags are off, so no real lead will arrive. What you *can* check is the builder:

- [ ] Create a workflow, trigger **Event → New Ad Lead (shop alert)**

**Expect** — updated 2026-08-04, this changed:
- The action list **narrows to the three shop-facing actions**: Notify my team, Send a campaign,
  Draft a reorder — with a line explaining that this trigger happens to the shop, not a customer
- **Target Audience** and **Max sends per customer** are absent
- No **Message Template**, no placeholder chips, no A/B or drip toggles

**🚩 Red flag** — it offers "Send a message", "Issue an RCN reward" or "Let AI write it". An ad lead
is a name and a phone number, not a platform customer: there's no wallet to message and nobody to
credit RCN to until they convert.

**🚩 Red flag** — a single locked box reading "Notify my team". That was the old behaviour, and it
made `low stock → draft a reorder` unbuildable in the UI. If you see it, the frontend is serving a
stale bundle.

> **Do the same check on `low_stock`**, which is the trigger this matters most for: it should now
> offer **Draft a reorder** as a choice. That combination is the whole point of the reorder action
> and was unreachable until 2026-08-04.

- [ ] Close without saving

> To exercise it end to end you'd need a lead through `LeadAttributionService.attribute()`, which
> is worth doing whenever the ads flags are next turned on. The check that matters then is that
> `shopId` reaches the automation — it's resolved via `campaign_id → ad_campaigns.shop_id`,
> because `ad_leads` has no shop of its own, and a lead with no shop is skipped rather than
> guessed at.

---

## Reference — what each shop's data produces

**peanut**
- 4 low-stock items → the only shop where `draft_reorder` will produce anything
- 1 existing workflow ("Low stock alert", shop-scoped)

**dc_shopu**
- 3 campaign-surface rules under Marketing → AI Campaigns
- Has campaigns → the only shop where the `run_campaign` dropdown will have options
- 1 workflow ("Win back lapsed customers", draft)

---

## Not covered here

- **`repair_ready`, `subscription_lapsed`, `booking_created`** — not built. See the commit
  message on `1d86ad70f` for why each is blocked on a decision rather than effort.
- **`create a task / flag`** — not built. There is no task or to-do table in the codebase, so it
  needs a migration and a surface where the tasks can be seen. An action writing to a list nobody
  can look at is worse than nothing.

---

## If something is wrong

Screenshot it. That found five bugs the week before last and four more in the last pass, and it's
faster than describing it.

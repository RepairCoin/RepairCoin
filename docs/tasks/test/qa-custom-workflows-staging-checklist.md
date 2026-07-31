# QA — Custom Workflows on staging

**Scope:** staging only. Prod comes later, once this is polished.
**Shop:** `peanut` · **Screen:** Automation tab · **Time:** ~15 minutes

Everything below has been verified at the data and HTTP layer. What is *not* verified is the rendering —
which is exactly where five real bugs turned up this week (dead template button, six unsavable templates,
a mislabelled row, a dead audience field, a wrong trigger default). Typechecks and unit tests structurally
cannot see those.

> ### ⚠️ Read before you start
>
> Do the Publish test with the **"Tell me when stock runs low"** template. It is a `notify_staff`
> workflow — no customer messages, no RCN.
>
> Publishing a **messaging** or **reward** template on a live shop can genuinely message customers or pay
> out RCN. Peanut has **4 items below threshold right now**, so a low-stock rule will fire for real.
>
> Delete the test workflow when you are done.

---

## 1. Draft → Publish

**Why first:** this is the gate that stands between a saved workflow and one that issues real RCN.

- [ ] Click **⚡ Use template** on *"Tell me when stock runs low"*
- [ ] Rename it `QA publish test`
- [ ] Click **Create Workflow**

**Expect**
- Toast: *"Draft saved — publish it when you're ready"*
- Row badge reads **Draft** (amber)

**🚩 Red flag** — badge says **Active**, or the toast just says "created".
That means `status: "draft"` never reached the API, and *any* template goes live on Save.

- [ ] Click **Publish** on that row

**Expect**
- A confirm dialog naming what will run: `Low stock → Notify team`
- After confirming, badge flips to **Active** (green)

**🚩 Red flag** — no dialog, or it publishes without asking.

- [ ] **Delete** `QA publish test`

---

## 2. Template gallery

- [ ] Open the template gallery

**Expect on every card**
- Name, description
- A **benefit** line in lighter grey
- The yellow `→` shape line
- A yellow **⚡ Use template** button

**Expect exactly ONE green line** (with a ↗ icon), on *"Tell me when stock runs low"*:

> ↗ 4 items at or below your reorder level right now.

**🚩 Red flag** — a green line on most cards.
Peanut's other numbers are all below their floors (3 lapsed vs a floor of 5; zero completed orders).
**Sparse is correct.** Lines everywhere means the floors are not applying.

- [ ] Confirm *"Recover a failed payment"* has **no** green line

That one is deliberate: failed payments are not countable (no `payment_status` column), and showing "0"
would read as *this never happens to you*.

---

## 3. Workflow row metrics

Look at the **workflows table** on the Automation tab — the list below the header, with columns
Name / Status / Total enrolled / Active enrolled / Last run / Created.

Under each workflow's **name** there are up to three lines:

1. The name itself (clickable, opens the editor)
2. Its shape, in grey — e.g. `Low stock → Notify team`
3. **Its results** — only if the workflow has ever run

### Line 3 has three legitimate states

**A — no line at all.** The workflow has never fired (`sent = 0`). This is correct, not a bug. A brand-new
workflow always looks like this. If you want to see the metrics line, you need a workflow that has
actually run.

**B — `Ran N times`.** A shop-facing workflow (`notify_staff`), which has no customer recipient, so there
is no read rate or revenue to report.

**C — `Sent N · Read X% · Booked N · $N within 14d`.** A customer-facing workflow. Hover it for the
attribution rule.

### What to check

- [ ] Confirm the shape line (line 2) matches the workflow — a Notify-my-team rule must say
      **"→ Notify team"**, never "→ Send a message"
- [ ] If any workflow has run, confirm its results line is state **B** or **C** as appropriate

**🚩 Red flag** — a `notify_staff` workflow showing `Sent N · Read 0% · Booked 0 · $0`.
That would mean staff alerts are being counted as unread customer messages, parking a working workflow at
0% read forever.

**🚩 Red flag** — a workflow that HAS run (check the **Last run** column — if it has a date, it has run)
but shows no results line at all.

> **Note:** peanut's "Low stock alert" has no send history yet, so state **A** is all you will see there
> until it fires.
>
> For state **C**, go to **Marketing → AI Campaigns** on **dc_shopu**. Its three rules live on the
> campaign surface, not Automation, and they have real send history. The results line renders on both
> surfaces (same shared component), so that is where the full metrics line is visible today.

---

## 4. Editing a workflow

**This was broken until today — give it the most attention.**

Use any **Notify my team** workflow. If you don't have one, make one from *"Tell me when stock runs low"*
and leave it as a **Draft** — a draft never runs, so this test has no side effects at all.

**Note its current Alert text first**, so you can put it back.

- [ ] Open the workflow to edit
- [ ] Change **Alert text** to `QA edit test`
- [ ] Save, then reopen the workflow

**Expect** — `QA edit test` persisted.

**🚩 Red flag** — the old text is back. That is the exact P0 fixed today: a success toast with nothing
actually saved.

- [ ] Restore the original text and save

**While the modal is open, also confirm**
- [ ] **Target Audience** is **absent** (the action is Notify my team)
- [ ] **Max sends per customer** is **absent**
- [ ] Trigger is **Event → Low Stock (shop alert)**
- [ ] **No message preview** at the bottom of the form

---

## 5. Trigger default and labels

- [ ] Click **Create workflow** (blank, not from a template)
- [ ] Click **Notify my team**

**Expect**
- Trigger Type jumps to **Event** (not Schedule)
- Schedule subtitle: *"On a clock — not when something happens"*
- Event subtitle: *"When something happens in your shop"* — **not** "After booking actions"

- [ ] Close without saving

---

## Not testable on peanut

The **AI recommendation → workflow** deep-link. Peanut has no qualifying cards: 3 lapsed customers is
below the detector's floor of 5, and it has no booking history for the slow-week detector.

`7777` and `dc_shopu` do have the data. If you can log in as either:

- [ ] From the dashboard, click a **lapsed-customer** or **slow-week** recommendation card

**Expect** — it lands on **Automation with the matching template already open**, rather than opening the
assistant.

---

## Reference — what each shop's data produces

Useful if a number looks wrong and you want to know whether it should have appeared.

**peanut**
- 4 low-stock items → the one green line
- 3 lapsed customers → **hidden** (floor is 5)
- 0 completed orders, cancellations, no-shows, reviews → all hidden
- 1 workflow, shop-scoped → "Ran 1 time"

**dc_shopu** — where the full metrics line is visible
- 8 lapsed customers → win-back relevance line in the template gallery
- Its three rules are on the **campaign** surface, so they appear under **Marketing → AI Campaigns**, and
  its Automation tab is empty. Expect under each rule name:
  - *Daily Morning Greeting* — `Sent 8 · Read 100% · Booked 0 · $0 within 14d`
  - *When cancelled Booking* — `Sent 1 · Read 100% · Booked 1 · $44 within 14d`
  - *Booking Competed* — `Sent 1 · Read 100% · Booked 2 · $49 within 14d`
- That last one is **one customer with two genuine orders** in the window, not a double count. Worth
  confirming it reads as sensible rather than as a bug.

---

## If something is wrong

Screenshot it. That has found five real bugs this week and is faster than describing it.

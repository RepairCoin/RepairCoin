# QA — Custom Workflows on staging

> **RESULT — all 5 tests PASSED on `peanut`.** Tests 1–3 on 2026-07-30, tests 4–5 on 2026-08-03.
> Test 4 confirmed the edit P0 fix in a browser: `QA edit test` survived save → reopen, and all four
> absence checks held (no Target Audience, no Max sends per customer, no message preview, trigger
> `Event → Low Stock (shop alert)`). The row shape line read `Low stock → Notify team`, and its metrics
> line read `Ran 1 time` — state **B**, correct for a shop-scoped rule. Alert text restored afterwards.
>
> **The dc_shopu items are done too, on 2026-08-03.** The metrics line was verified against the live
> API, and the **AI-recommendation → workflow deep-link passed end to end** on dc_shopu: the card lands
> on Automation with the win-back template open, `?template=` stripped, create mode (not edit), and the
> mixed `message → +48h Issue RCN 25` sequence rendering with the per-step action picker.
>
> **The browser pass found four real bugs that 2,656 passing unit tests and a clean typecheck could not
> see** — three of them silent by construction. All four are fixed and deployed:
>
> - **Revenue counted orders that never happened.** `booked` and `revenue` shared one filter, so
>   `expired` and `no_show` orders were summed as money — ~45% of the figure platform-wide. (`6c388d31e`)
> - **Recommendations froze on first detection.** `ON CONFLICT DO NOTHING` against an index that ignores
>   expiry meant a card could never refresh, and vanished permanently once expired. (`58c73e67c`)
> - **An empty Target Audience passed validation** and then meant *everyone* on create and *nobody* on
>   update. (`d95feeb07`)
> - **The Target Audience dropdown showed a placeholder over a correct stored value.** (`a62584696`,
>   PR #716 — see the note at the end of this file; the first attempt at it did not work.)

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

## Not testable on peanut — done on dc_shopu instead ✅

The **AI recommendation → workflow** deep-link. Peanut has no qualifying cards: 3 lapsed customers is
below the detector's floor of 5, and it has no booking history for the slow-week detector.

`7777` and `dc_shopu` do have the data. If you can log in as either:

- [x] From the dashboard, click a **lapsed-customer** or **slow-week** recommendation card

**Expect** — it lands on **Automation with the matching template already open**, rather than opening the
assistant. **PASSED on dc_shopu 2026-08-03.**

> **⚠️ It could not be tested at first, and the reason was a bug worth knowing about.**
> Every stored recommendation predated M2, and the card's `action` is computed at DETECTION time and
> persisted. `ON CONFLICT DO NOTHING` fires against a unique index on
> `(shop_id, detector_key, presentation) WHERE acted_at IS NULL` — expiry and dismissal are not in that
> predicate, and nothing ever deletes a row. So the first row a detector wrote could never be replaced:
> evidence froze, the card vanished for good once expired, and the workflow deep-link never reached any
> shop whose detectors had already fired. Only clicking the CTA freed the slot, so a recommendation the
> shop *ignored* was worse off than one it acted on. Fixed in `58c73e67c` (conditional upsert).
>
> If you need to test this on a shop whose cards look stale, that fix now heals them on the nightly run.
> **`7777` still had frozen rows as of 2026-08-03.**

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
  its Automation tab is empty. Expect under each rule name — **verified against the live API 2026-08-03**:
  - *Daily Morning Greeting* — `Sent 8 · Read 100% · Booked 0 · $0 within 14d`
  - *When cancelled Booking* — `Sent 1 · Read 100% · Booked 2 · $5 within 14d`
  - *Booking Competed* — `Sent 1 · Read 100% · Booked 1 · $0 within 14d`

> **✅ Deployed and re-verified against the live API 2026-08-03** (`6c388d31e`, merged). These are the
> post-split numbers: the `$44` expired order is out of both the booking count and the revenue. If the
> browser still shows `$49` / `$44`, the frontend is serving a stale bundle — hard-reload before
> reporting it.
- **The last two were swapped in an earlier draft of this doc.** Both rules have `sent: 1`, so the
  transcription was easy to get wrong and impossible to spot. The numbers above come from
  `GET /api/messages/auto-messages/metrics` and were confirmed against the underlying sends and orders.
- *When cancelled Booking* is **one customer with two genuine orders** in the window, not a double count.
- *Booking Competed* is `is_active = false` (published but paused), so expect a **Paused** badge. Not a bug.

> **✅ Revenue defect — FOUND AND FIXED 2026-08-03 (not yet deployed).**
> `booked` and `revenue` shared one filter (`status <> 'cancelled'`), so **`expired` and `no_show` orders
> were summed into revenue**. Of dc_shopu's `$49`, only `$5` was a completed order; the other `$44` was
> **expired**. Platform-wide the filter admitted 242 expired ($38.1k) and 37 no-show ($3.4k) against 275
> completed ($49.5k) — roughly **45% of any revenue figure was orders that never happened**.
>
> Now two filters: `booked` counts every order the customer did not cancel (a missed appointment is
> still a booking the message produced); `revenue` allows only `completed` + `paid`. So **`Booked 2 · $5`
> is a truthful line, not a rendering bug** — two bookings followed the message, one never paid.

---

## If something is wrong

Screenshot it. That has found five real bugs this week and is faster than describing it.

---

## Note — the blank Target Audience dropdown (2026-08-03)

Kept because the **root cause was never identified**, and if it resurfaces the next person should not
repeat the two days of reasoning that did not find it.

**Symptom.** The builder showed "Select audience" on rules that demonstrably had a stored audience —
both from the win-back template and on saved, published rules.

**It was display-only.** The database, the API (`targetAudience: "inactive_30d"`) and the pass-through
service layer all carried the value, and saving worked. Nothing was ever mis-targeted.

**The first fix did not work** (`bc0c6e98a`). The diagnosis was a mount-order trap: Radix resolves a
trigger's label from items that exist only while the dropdown is open, so a select mounted *before* its
value arrives shows the placeholder and never re-resolves — which fit, because Event mounts inside
`triggerType === "event"` (false on first render) and displayed fine, while Target Audience sits outside
the trigger blocks and mounts immediately. Giving every `SelectValue` explicit children **cannot** help
when the value is empty, though:

```js
children: shouldShowPlaceholder(context.value) ? placeholder : children
function shouldShowPlaceholder(value) { return value === "" || value === void 0; }
```

**The contradiction that was never resolved.** `useControllableState` makes `context.value` the prop
verbatim, and the component has exactly two writers — `useState("all")` and
`setTargetAudience(rule.targetAudience ?? "all")` — neither of which can produce `""` or `undefined`.
So the placeholder should have been unreachable. It appeared anyway.

**What fixed it** (`a62584696`, PR #716), correct under both candidate causes rather than betting on one:

- the trigger renders its label as a plain `<span>`, never `SelectValue`
- `effectiveAudience` = valid state → else the rule's **stored** audience → else `all`
- **every submit path** sends `effectiveAudience`, so a blank field can't overwrite a correct value

**If another dropdown in this modal goes blank**, apply the same span treatment — the other five still
use `SelectValue`.

**Two process notes.** DigitalOcean deploys the backend only; anything you can see in the browser needs
a **Vercel** build of `main`. And bundle archaeology is a dead end here — an authenticated route's
chunks are not reachable anonymously, so grepping the deployed JS proves nothing.

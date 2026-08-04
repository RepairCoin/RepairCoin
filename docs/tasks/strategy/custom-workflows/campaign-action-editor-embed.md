# Custom Workflows — making "Send a campaign" usable (2026-08-04)

**Status:** ALL PHASES BUILT, merged and deployed 2026-08-04 (PRs #730, #731).
**NOT VERIFIED IN A BROWSER — see §7.**
**Applies to:** the `run_campaign` action shipped 2026-08-03.

> **P3/P4/P5 — preview, create, edit in place.** Done. The §6 unknowns resolved in the plan's
> favour: `CampaignBuilderModal` is a Radix `Dialog` portalled to `document.body`, so it stacks over
> the workflow builder without a z-index fight, Escape closes only the top layer, and it does not
> navigate on close. `viewOnly` gave Preview for free.
>
> Two things the plan did not anticipate. `onClose` now returns the campaign that was written
> (additive; Marketing ignores it) — "refetch and select the newest" was rejected as a guess that is
> wrong whenever another tab saves in between. And campaigns are held WHOLE rather than narrowed,
> because `existingCampaign` wants the real row and refetching one already in memory would rebuild an
> object we chose to discard.
>
> Loaded with `next/dynamic`, so 2,477 lines stay out of the builder's chunk.

> **P1 — save a draft without a campaign.** Done. The requirement moved to the publish path, which
> also gained an ownership check (`getById` is not shop-scoped, so another shop's rule must read as
> "not found" rather than as a validation failure).
>
> **P2 — campaign summary.** Done. Subject, audience, delivery method and last recipient count now
> show for the selected campaign — all from the response the builder was already fetching and
> narrowing away. Options relabelled per D2: a draft reads "editable", a sent campaign reads
> "content locked", with a line explaining that choosing a sent one freezes the workflow's content.
>
> **Not yet verified in a browser.** P3–P5 are the embed work, where the unknowns in §6 live.

---

## 1. The problem

`run_campaign` is the only action whose content lives on a different screen. Every other action is
self-contained — you write the message, set the RCN amount, or type the staff alert in the builder.
This one points at a campaign that must already exist in Marketing, which forces a shop out of the
workflow builder to do anything meaningful.

Walking it as a shop owner, the friction compounds:

1. **A shop with no campaigns hits a dead end mid-task.** The dropdown says "No campaigns yet —
   create one in Marketing". They must leave, build a campaign, and start the workflow again.
2. **They cannot save and come back.** `parseAction` requires `campaignId` at save time, so a
   half-configured campaign workflow cannot be parked as a draft. The trigger, name and timing are
   lost.
3. **They pick blind.** The dropdown shows a name and a `(draft)` marker. No subject, no audience,
   no delivery method, no idea what the customer receives.
4. **They cannot see the blast radius.** This action emails a real audience on a recurring basis and
   nothing on screen says how many people that is.
5. **Editing means leaving again.** Changing the copy of an automated campaign is a round trip.
6. **Picking a sent campaign silently freezes the content.** `MarketingController` rejects updates to
   a campaign with `status = 'sent'`, so a shop that chose one can never change its wording — they
   have to build a new campaign and re-point the workflow. Nothing warns them.

Self-assessed usability of the action today: **3/5**. Mechanically sound, uncomfortable to use.

## 2. The fix that looks obvious and is wrong

Compose the campaign inline, in the workflow builder — subject, body, audience — the way
`send_message` and `ai_step` already compose their content.

**Rejected, on one fact: shops need images.** A campaign that doesn't catch the eye doesn't get read,
and `CampaignBuilderModal` is a **2,477-line block-based designer** — image, text, button and heading
blocks, each with its own styling, plus starting templates. An inline composer either rebuilds that,
or ships a text-only alternative that cannot do the one job the campaign exists for. Both are worse
than the status quo.

## 3. The approach: bring the real editor to the workflow builder

`CampaignBuilderModal` is already a self-contained modal:

```ts
interface CampaignBuilderModalProps {
  open: boolean;
  onClose: (saved: boolean) => void;
  shopId: string;
  shopName?: string;
  campaignType: 'announce_service' | 'offer_coupon' | 'newsletter' | 'custom';
  existingCampaign?: MarketingCampaign | null;
  template?: MarketingTemplate | null;
  viewOnly?: boolean;
}
```

Everything it needs — `shopId`, `shopName` — the workflow builder already has. It even ships a
`viewOnly` mode, which is a preview for free.

So: render it **over** the workflow builder rather than navigating to it. One editor, full design and
image support, nothing duplicated, nothing to drift.

## 4. Decisions

### D1 — Embed the existing editor; do not build a second composer

Rationale in §2. The cost of embedding is modal-stacking plumbing; the cost of composing inline is a
permanent second implementation of a 2,477-line editor, or a feature that cannot do images.

### D2 — A draft campaign is the MASTER; a sent campaign is a frozen copy

This falls out of how the action works and was not designed deliberately, but it is the right model
and should be made explicit:

- the workflow only ever sends **copies**, so the configured campaign is never itself sent;
- a draft therefore stays editable forever and behaves as a living template;
- edits to it flow into the next firing automatically, because the copy is made at fire time.

**The UI currently signals the opposite.** `(draft)` reads as "unfinished" when it is in fact the
recommended choice. Relabel: a draft is an **editable master**; a sent campaign is **content locked**,
with a warning when one is selected.

### D3 — Require a campaign at PUBLISH, not at save

The requirement exists so a published rule cannot sit erroring hourly against a campaign it does not
have. That is a property of a *published* rule. A draft never runs, so it cannot error, and blocking
the save only destroys work in progress.

Move the check to the publish path, alongside the existing confirmation dialog.

### D4 — Show what is being sent, before it is published

Two levels, both cheap:

- **Summary** under the dropdown: subject, audience, delivery method, and recipient count when the
  campaign has been sent before. **The data is already on the client** — `getCampaigns` returns it and
  the builder currently maps it down to `{ id, name, status }`.
- **Preview** via `viewOnly`, showing exactly what the customer receives.

### D5 — Blast radius stays out of scope for now

*"This will email roughly 340 customers each time it runs"* is the single most valuable line that
could appear on this panel, but the number must be computed from the campaign's audience rules and
must not drift from what the send actually resolves. That deserves its own change; it is noted in §8.

## 5. Implementation

Phased so each step is independently shippable. P1 is worth doing even if the rest slips.

### P1 — Save a draft without a campaign

- `AutoMessageController.parseAction`: stop rejecting `run_campaign` with no `campaignId`.
- Enforce it on the publish path instead (`PATCH /auto-messages/:id/publish`), with an error naming
  the field in the words the form uses — "Pick the campaign this workflow should send".
- Frontend: drop the pre-submit guard for drafts; keep it when publishing.
- Handler already skips and logs when the payload has no campaign, so an unpublished rule is inert
  either way.

**Tests:** backend unit tests — draft accepted without a campaign, publish rejected without one,
published rule with one still accepted.

### P2 — Campaign summary under the dropdown

- Stop narrowing the fetched campaigns to `{ id, name, status }`; keep `subject`, `audienceType`,
  `deliveryMethod`, `totalRecipients`, `sentAt`.
- Render a summary block for the selected campaign.
- Relabel per D2: editable master vs content locked, with a warning line on a sent campaign.

**No new requests.** Same payload, fewer fields discarded.

### P3 — Preview in place

- Render `CampaignBuilderModal` with `viewOnly` and `existingCampaign` from a "Preview" control.
- **Lazy-load it** (`next/dynamic`): it is a 2,477-line component and must not be pulled into the
  workflow builder's chunk for shops that never open it.

### P4 — Create a new campaign without leaving

- "Create new campaign" opens the modal with `existingCampaign: null` and a sensible `campaignType`.
- On save, refresh the campaign list and select the new one.
- **Needs the new campaign's id back.** `onClose(saved: boolean)` does not provide it. Preferred fix:
  widen to `onClose(saved: boolean, campaign?: MarketingCampaign)` — additive, so Marketing's existing
  call site is unaffected. Fallback of "refetch and select the newest" is rejected: it is racy if a
  campaign is created in another tab, and it would silently select the wrong one.

### P5 — Edit in place

- "Edit" opens the modal with `existingCampaign` set, not `viewOnly`.
- Only offered for editable campaigns; a sent campaign shows the locked state from P2 instead of an
  edit control that would 400.

## 6. Risks and unknowns

- **Modal over modal.** Stacking, scroll lock, and Escape must dismiss only the top layer. The
  workflow builder is itself a fixed-position overlay. Needs checking in a browser, not reasoning.
- **Context assumptions.** `CampaignBuilderModal` lives in Marketing today and may assume things about
  its surroundings (list refreshes, toasts, navigation on save). To be read fully before embedding.
- **Bundle size.** Mitigated by lazy loading in P3; must be verified rather than assumed.
- **No frontend test runner.** There is no `test` script and no jest/vitest config, so none of P2–P5
  can be covered by automated tests. Only P1 is unit-testable. This makes the browser pass in §7 the
  primary evidence, not a formality.

## 7. How it gets verified

Backend: unit tests for P1, plus the existing suite.

Browser, on staging, added to
`docs/tasks/test/qa-workflow-actions-triggers-staging-checklist.md`:

- configure a campaign workflow with no campaign, save as draft, reopen — configuration intact;
- publish it — rejected, with a message pointing at the campaign field;
- create a campaign from inside the builder — it appears selected, and exists in Marketing;
- preview a campaign — content matches what Marketing shows;
- edit a draft campaign in place — the change persists and appears in the next firing;
- select a sent campaign — locked state shown, no edit control.

## 8. Out of scope, deliberately

- **Blast-radius estimate** (D5) — worth doing, needs its own change so the number cannot drift from
  what the send resolves.
- **Campaign rewards on automated sends** — still the open decision from the `run_campaign` build: a
  recurring workflow issuing RCN is a standing commitment nobody re-approves. Needs a cap or per-run
  budget first.
- **Tidying the automated campaign records** — each firing creates a `<name> — via <workflow>` row, so
  a weekly workflow produces 52 a year. Correct, since each run keeps its own stats, but the list will
  want grouping or filtering eventually.

## 9. Expected outcome

Every complaint in §1 is answered except the blast radius: no navigation, images fully supported,
content visible before publishing, editing in place, no dead end, no frozen-template trap — and no
duplicated editor to maintain.

Self-assessed usability after this: **4/5**, with the remaining point resting on D5.

Related: [[scope.md]] §9.2, [[management-change-request.md]],
`docs/tasks/test/qa-workflow-actions-triggers-staging-checklist.md`.

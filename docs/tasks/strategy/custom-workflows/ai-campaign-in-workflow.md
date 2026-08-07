# Custom Workflows — AI-created campaigns in the workflow builder (2026-08-04)

**Status:** scoped, not built.
**Follows:** `campaign-action-editor-embed.md` (all phases shipped 2026-08-04).

---

## 1. Why

Management's position: building a campaign by hand is chaos, and a shop owner will not do it. The
embedded designer removed the *navigation* problem, but not the *work* problem — someone still has to
compose a subject line, write a body and place an image before a workflow can send anything.

The AI assistant already creates campaigns from a description, image included. The ask is to bring
that here.

## 2. What the assistant's flow actually is

**Not a function that can be called.** `propose_campaign_draft` does not write the copy — it
*receives* `subject`, `body` and `image_url` as arguments and persists them. The intelligence is in
the conversation:

```
lookup_audience_count  →  propose_campaign_image  →  propose_campaign_draft
```

So "reuse it" cannot mean lifting a service. It means building a one-shot equivalent.

**The expensive parts, though, are already shared and callable:**

- **`ImageGenerationService.generate(shopId, …)`** — a branded image with every gate attached:
  `ai_images_enabled` kill-switch, spend cap, daily rate limit, moderation, brand-kit colour and tone
  injection, logo overlay, audit and spend recording. Same gates regardless of entry point, by design.
- **`MarketingCampaignRepository.create()`** — persists the draft.
- **`proposeCampaignDraft.execute()`** already turns subject + body + image into a persisted campaign
  with `designContent` blocks. That block-building is the piece both callers need.

## 3. Decisions

### D1 — One-shot generation, not an embedded chat

The shop types a brief in the workflow builder and gets a draft campaign. No conversation.

**And it should be better here than in the assistant**, because the workflow already knows the
**trigger** and the **audience** — the two things the chat spends turns establishing. A win-back
workflow does not need to be asked who it is for.

### D2 — One Claude call produces copy AND the image brief

Ask the model for `{ subject, body, imagePrompt }` in a single structured response, then hand
`imagePrompt` to `ImageGenerationService`. Two AI operations total: one cheap text call, one image.

The alternative — a text call, then a second call to describe an image — spends twice for something
the model can produce in one pass while it still has the campaign's intent in context.

### D3 — Extract the draft-building, do not copy it

`proposeCampaignDraft` already knows how to turn subject/body/image into a campaign with proper
`designContent` blocks, name, audience and reward wiring. Extract that into a service both the tool
and the new endpoint call.

Copying it would mean two implementations of "what a campaign made of AI copy looks like", and they
would drift the first time a block type changes.

### D4 — The designer stays, as the review and edit path

The assistant's own flow opens its draft in `CampaignReviewModal` before anything sends, because AI
writes plausible things that need a human eye and the result goes to real customers under the shop's
name.

If AI creates the campaign and the designer is gone, a wrong image or a bad subject line can only be
fixed by leaving for Marketing — the exact problem the embed just solved. So:

**AI creates it → the shop previews it → the shop edits it in place if needed.**

### D5 — Degrade to text when the image is refused

Image generation can be blocked for legitimate reasons: the kill-switch is off, the shop is over its
spend cap, the prompt is flagged. None of those should mean "no campaign".

The campaign is created with copy and no image, and the panel says why. A failed image must not lose
the copy that was already paid for.

### D6 — Regeneration is deliberate, never automatic

Each generation costs one Claude call plus one image, and images are the expensive half. "Regenerate"
is a button the owner presses, never something that fires on typing or on reopening the form. Same
rule as the AI-step sample.

## 4. Preview — what the shop sees before anything sends

**Yes, and at two separate gates.** Worth being explicit, because "AI sends campaigns to my customers"
is the sentence a shop owner will worry about.

1. **Preview the campaign itself.** The generated draft opens in the designer in `viewOnly` mode —
   already built (P3 of the embed plan). The owner sees exactly what the customer will receive,
   image included, before the workflow is ever published.
2. **The workflow cannot send until it is published.** Workflows are born as drafts and go live only
   on an explicit Publish, which names what will run.

On top of that, the campaign the AI creates is itself a **draft** campaign, and the workflow only ever
sends **copies** of it — so the generated campaign is never itself sent, and stays editable as the
master. Nothing reaches a customer until: campaign generated → previewed → workflow published →
trigger fires.

## 5. Implementation

### P1 — Extract campaign drafting into a service

Move the persistence and `designContent` block-building out of `proposeCampaignDraft.execute()` into
`CampaignDraftService`. The tool becomes a thin caller. No behaviour change; verified by the existing
assistant flow still producing identical campaigns.

### P2 — Copy + image brief in one call

`CampaignCopyService.generate(shopId, { brief, triggerType, eventType, targetAudience, name })` →
`{ subject, body, imagePrompt }`. Mirrors `AutoMessageContentService` for the AI call, spend cap and
brand-kit wiring, but produces email-shaped copy with a subject rather than a 2–4 sentence in-app
message.

Reuse the offer guard from `validateGeneratedMessage`: reject percentages, prices and offer words the
brief never asked for. The exposure is larger here than for an in-app message, because a campaign
goes out by email to a whole audience.

### P3 — The endpoint

`POST /api/marketing/campaigns/ai-draft` → copy, then image, then `CampaignDraftService`, returning
the persisted campaign. Tier-gated the same as campaigns. Image failure degrades per D5.

### P4 — The workflow builder

"Let AI create the campaign" beside the existing dropdown: a brief field, a generate button, and on
success the campaign is created, selected, and offered for **Preview** / **Edit**.

The manual picker and the designer stay exactly as they are.

## 6. Risks and unknowns

- **Cost per press.** One Claude call plus one image. Needs the deliberate-regenerate rule and a line
  telling the owner it spends their allowance.
- **The image gates are real and will fire.** `ai_images_enabled` is a kill-switch some shops have
  off, and the spend cap is monthly. D5 is not a theoretical branch — it is the normal path for a
  shop that has used its budget.
- **Extracting from a live tool.** P1 touches the assistant's working campaign flow. It must be
  verified by running the assistant, not only by tests.
- **No frontend test runner**, so P4 is browser-verified or not verified.

## 7. Out of scope

- **Sending from the builder.** This creates drafts. Sending stays with the workflow trigger.
- **Blast radius** — still worth doing, still its own change (see the embed plan §8).
- **Campaign rewards on automated sends** — unchanged: still needs a cap or per-run budget before
  rewards carry through.

## 8. How it gets verified

- The assistant's own campaign flow still works after P1 — run it, do not assume.
- A generated campaign renders in preview with its image.
- With images disabled or the cap reached, a campaign is still created, with copy and a stated reason.
- An offer the brief never asked for is refused.
- Added to `qa-workflow-actions-triggers-staging-checklist.md`.

Related: `campaign-action-editor-embed.md`, `scope.md` §9.2, `ai-step-user-story.md`.

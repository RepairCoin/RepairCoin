# Ads System — v1 Gaps & Next Steps

_Last updated: 2026-06-19_

Tracks the known gaps in the centralized Ads System after the prepare → push → go-live flow,
the review-gate, and the admin UX refactor. Everything here is **functional-but-incomplete** or
**deliberately deferred** — the core push pipeline (request → draft → push PAUSED → go live →
insights → ROI) is proven live on Meta. These are the pieces that make a launched ad actually
*useful end to end*.

Branch: `deo/ads-system`. All Meta behavior gated behind `ADS_META_*` flags.

---

## P0 — Click → lead loop is not closed (highest impact)

**Status:** ❌ Not built. **Impact:** a launched ad currently leads nowhere useful; no leads are
captured automatically, so the Leads Kanban stays empty unless leads are added by hand.

**Root cause:**
- The ad's link (`linkUrl`) resolves to `shop.website` → `META_DEFAULT_LINK_URL` → `FRONTEND_URL`
  (the **login-gated app**) → `https://repaircoin.ai`. None of these is a purpose-built capture page.
- `AdLeadForm.tsx` exists only as a **component** — it is **not rendered on any route/page**.
- `POST /ads/leads/webform` (public, UTM-attributed) is live and ready, but nothing posts to it.

**Fix:** build a **public, login-free campaign landing page** (e.g. `/l/[campaignId]`) that:
- shows the shop + promoted service(s) + offer,
- hosts `<AdLeadForm/>` → posts to `/ads/leads/webform` with `campaignId` + UTM → lead lands in the Kanban,
- becomes the ad's `linkUrl` (set on the creative at prepare/push instead of the shop website/fallback).

**Effort:** ~1–2 days. **Unblocks:** real leads in the Kanban; the whole lead pipeline + ROI.

---

## P1 — Selected services are captured but unused

**Status:** ⚠️ Partial. **Impact:** the ad is generic to the shop/offer; it doesn't promote or link
to the specific service(s) the shop chose.

**Root cause:** `promoteServiceIds` is stored on the request/enrollment and read back in the repos,
but it is **never read** by `AdCreativeService` (creative copy/image use shop + industry + brand voice
+ offer/goal only), the targeting, or the landing `linkUrl`.

**Fix (pairs with P0):**
- Landing page renders the actual promoted services (name, photo, price).
- Optionally feed the service name(s) into the AI copy prompt so the creative matches.
- Optionally deep-link the ad to the service(s).

**Effort:** ~0.5–1 day (mostly inside the P0 landing page + an `AdCreativeService` prompt tweak).

---

## P1 — AI lead replies are not delivered to any channel

**Status:** ⚠️ Drafting/record only — no live transport. **Impact:** the AI "draft reply" and Chat
conversation are **internal-only**; a human must relay them. Nothing reaches the customer's
Messenger / SMS / WhatsApp / email.

**Root cause:** `LeadChannelSender.deliver()` returns `'recorded'` when `ADS_LEAD_TRANSPORT_ENABLED`
is off (default), and `'queued'` when on — **no provider is wired** ("A real provider plugs in here.
Left unwired."). Also, v1 TRAFFIC ads + webform leads carry phone/email, **not** a `messengerId`, so
`pickChannel` would pick SMS/email, never Messenger.

**Fix (to go hands-off):**
1. Wire a provider in `deliver()` — Twilio (SMS), Meta Send API (Messenger/WhatsApp), an email service.
2. Set `ADS_LEAD_TRANSPORT_ENABLED=true`.
3. For Messenger specifically: a Messenger Platform inbound integration (so leads carry `messengerId`)
   + `pages_messaging` + **App Review**.

**Effort:** ~2–4 days per channel + external credentials/App Review. **Interim:** admin relays manually.

---

## P0 — Objective mismatch: narrative = click-to-Messenger; built = clicks. Support BOTH (selectable)

**Status:** ⚠️ Strategic divergence + plan. **Impact:** the [narrative walkthrough](./ads-system-narrative-walkthrough.md)
(Ch.4–5) sells a **messaging / Messenger** experience — Emma taps "Send Message", chats the Page, and the
**AI replies in Messenger**. That "AI answers every lead 24/7" is the headline moat (Ch.10 §3). But the code
runs **`OUTCOME_TRAFFIC` (clicks)** — a different objective with no Messenger thread. (The code never had
messaging: it defaulted to `OUTCOME_LEADS` instant forms, then fell back to TRAFFIC during live testing to get
past `leads_retrieval`/ToS/`ON_AD` walls.) **Three different worlds; the moat objective isn't built.**

**Decision (2026-06-19): support BOTH objectives, selectable per campaign** (this is how Meta works — objective
is a per-campaign choice). Three objectives total:

- **Website clicks** — `OUTCOME_TRAFFIC` / `LINK_CLICKS`. Lead via the **public landing page + AdLeadForm** (P0
  above). **Shippable now — no App Review.** The current default.
- **Awareness** — `OUTCOME_AWARENESS` / `REACH`. Works today.
- **Messages (click-to-Messenger)** — `OUTCOME_ENGAGEMENT` / `CONVERSATIONS` / **Messenger destination**,
  "Send Message" CTA. Lead = Messenger thread (`messenger_id`); **AI replies live via the Send API**. This is
  the narrative's moat. **Gated on `pages_messaging` + App Review + a Messenger inbound webhook + Send-API wiring.**

**Architecture:** plumbing is ~90% there — `objectiveForGoal` + `optimizationForObjective` are the single source
of truth, and the data model already has `messenger_id` + a `'messenger'` channel. Adding messaging is an
*extension*. Branch by objective in three places: the **ad set** (optimization + destination), the **creative**
(CTA + Messenger welcome vs link), and **lead capture** (Messenger webhook vs landing-page webform).

**Sequencing (no rework):**
1. **Now:** persist a selectable **objective on the campaign** + an **objective picker** in the DraftComposer
   (Website clicks default + Awareness; Messages shown but disabled = "needs App Review"). _← in progress, migration 167._
2. **Parallel:** submit **App Review for `pages_messaging`**.
3. **On approval:** wire the Messenger webhook + Send API, enable Messages in the picker.

**Also (lead-quality upgrade for the clicks path):** a **Meta Pixel "Lead" conversion event** on the landing page
lets TRAFFIC/Sales optimize for the actual form submission — biggest lift for the least Meta-approval friction.
Native `OUTCOME_LEADS` instant forms remain a later option (code supports it via `ensureLeadForm`).

**Effort:** picker + persisted objective ~0.5 day (now); Messenger path ~3–5 days + App Review; Pixel ~1 day.

> **Awareness dropped from v1 pickers (2026-06-19).** `OUTCOME_AWARENESS` is **off-thesis** — it optimizes for
> reach/impressions, drives no leads/ROI, and the whole pipeline + dashboard are lead-gen, so it read as
> zero/misleading. Removed from **both** the admin objective picker (DraftComposer) and the shop **goal** picker
> (`CAMPAIGN_GOALS`). **Kept dormant** — still in the `CampaignGoal` type + `objectiveForGoal` + `asMetaObjective`,
> so legacy rows parse and it's a one-line re-enable. **Revisit only when** there's real demand AND a reach-focused
> metrics view (reach / impressions / CPM / frequency, with ROI/CPL de-emphasized for awareness campaigns).
>
> **Shop goal wording fixed (2026-06-19).** "Promote a specific service" was confusing — singular, and it
> restated *what* to advertise (already covered by the multi-select "Which services?" picker) rather than an
> *outcome*. Goals are now true outcomes: **"More bookings"** + **"More leads / inquiries"** (`more_bookings` +
> `leads`, both → `OUTCOME_TRAFFIC` in v1). `promote_service` kept in the type for legacy rows, dropped from the picker.

---

## P2 — Budget currency: no USD↔account-currency conversion

**Status:** ⚠️ v1 simplification. **Impact:** on a non-USD ad account (e.g. PHP), the daily-budget
number is interpreted in the **account's currency** — admins must enter a value valid for that currency.

**Root cause:** Meta reads the budget integer in the account currency. We send our cents value as-is.
We now **validate** against the account's `min_daily_budget` and surface a clear message (no more raw
error 1885272), but we do **not** convert USD → the account currency.

**Fix:** fetch `currency` + `min_daily_budget` (already done at push), display the account currency in
the DraftComposer budget field, and optionally apply an FX rate for true multi-currency. **Effort:** ~1 day.

---

## P3 — Creative image cost not in True Margin

**Status:** ⚠️ Minor accounting gap. **Impact:** True Margin's "AI cost (COGS)" understates FixFlow's
real cost — it counts lead-outreach AI only.

**Root cause:** `ad_ai_costs` records lead AI (draft/auto-answer). The `gpt-image-1` creative generation
cost goes to the shop AI budget / image audit log, **not** `ad_ai_costs`, so it's absent from per-campaign
True Margin.

**Fix:** log the image-gen cost to `ad_ai_costs` (with the campaign id) at prepare/regenerate time.
**Effort:** ~0.5 day.

---

## P3 — Minor UX polish

- **Disabled "Push to Meta" clarity:** the gated button (pending creative) doesn't look obviously
  disabled against the yellow. Strengthen the disabled style / add a lock icon. (~0.25 day)
- **Show resolved objective in DraftComposer:** e.g. "Objective: Traffic (clicks)" so the admin sees
  what will be created on Meta before pushing. (~0.25 day)

---

## Already shipped (context, not gaps)
- Prepare → Push (PAUSED) → Go-live flow with currency-aware budget validation.
- Review gate: AI creative must be approved (in the unified DraftComposer) before push/go-live.
- Prompt-driven AI image regenerate (gpt-image-1, brand-grounded) + enlarge lightbox.
- State-aware admin campaign detail (drafting vs live); A/B panel removed; manual metrics collapsed;
  Ad-Management Billing moved to the per-shop inbox view.
- Nightly Meta insights sync → `ad_performance_daily` (spend/impressions/clicks).

## Suggested order
**Objective picker + persisted objective** (now — makes the choice first-class) → **P0 landing page**
(unblocks the clicks pipeline) → **P1 service-aware creative** (rides on the landing page) → **App Review for
`pages_messaging`** (parallel, external) → **Messenger path** (objective + webhook + Send API, when App Review
clears — this is the narrative moat) → **Pixel "Lead" event** (clicks lead-quality) → **currency display** /
**polish + image-cost accounting**.

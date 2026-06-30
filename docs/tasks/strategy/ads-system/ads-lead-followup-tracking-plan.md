# Ads — Lead Follow-up Tracking (Call + Email) — Implementation Plan

**Date:** 2026-06-25 (updated 2026-06-30)
**Branch:** `deo/ads-system`
**Status:** ✅ **CORE COMPLETE — shipped, deployed to staging, verified live (incl. shop side).**
Phases 1–3 + the Phase-4 Resend webhook are done. Only the optional **Twilio click-to-call** tier
remains, parked until the Twilio account is provisioned. Standing rule: do not commit unless told.

### Shipped (commits on `deo/ads-system`, all merged to `main`)
- `b0f1288a7` — Phase 1 (activity timeline) + Phase 2 (tracked email)
- `1d2298120` — migration renumber 189→190 (collision with main's `189_dedup_admins_unique_wallet.sql`)
- `c2aeeec91` — Phase 3 (log call with outcome)
- `b006ba709` — Phase 4 **webhook half** (Resend delivered/opened/clicked/bounced/complained → activity meta + engagement chips)
- `1d6feb8da` — UI fix: wrap lead-card action row so Call/Email aren't clipped
- `577119121` — **shop-scoped** follow-up (ownership-gated `/ads/shop/leads/:id/{activities,email}`) — fixes shop "Insufficient permissions"
- `08e04b5b1` — auto-advance NEW→CONTACTED when a lead is emailed or called (parity with the chat path)

### Live verification (staging / peanut)
- Resend domain `send.fixflow.ai` verified (us-east-1); env set in DO: `RESEND_API_KEY`, `RESEND_FROM_EMAIL=leads@send.fixflow.ai`, `RESEND_FROM_NAME=FixFlow`.
- Resend webhook → `https://api-staging.repaircoin.ai/api/ads/webhooks/resend`, `RESEND_WEBHOOK_SECRET` set; `email.delivered` events return **200 OK** and the **Delivered** chip lands.
- Shop side: History / Email / Call open with **no permission error**; reply-to lands in the shop inbox.
- **Opened/Clicked**: not a code gap — Resend **Open/Click tracking is off by default** (per-domain toggle); clicks also need a link in the email body. Chips render automatically once tracking is enabled. Decided acceptable to ship without (delivered/bounced/complained + the actual reply are the meaningful 1:1 signals).
**Goal:** give the admin/shop **visibility into whether a lead was actually contacted** (call + email),
make **email trackable** (sent/opened) instead of a blind `mailto:`, and surface a per-lead **activity
timeline** + first-response time — so follow-up (the #1 lead-conversion lever) is measurable.

---

## Current state (verified in code)
- The Kanban **Call** / **Email** buttons are passive **`tel:`** / **`mailto:`** links (`LeadKanban.tsx`) —
  they open the dialer/mail app but **record nothing**. No way to know an outreach happened.
- `ad_leads.first_response_at` exists but is only set by the attribution path, **not** by outreach.
- **No** lead activity / contact-log table exists.
- **Resend is built but not wired for leads:** `ResendEmailService` (singleton, per-send `from`,
  `{success, messageId}`) is used by campaigns + the test route. **Missing:** `reply-to`, and the env
  (`RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `RESEND_FROM_NAME`) is **unset** in this environment;
  default from is the pre-rebrand `noreply@repaircoin.com`.

---

## Decisions to lock
- **D1 — Email sends in-app via Resend, not `mailto:`.** Only way to track it (sent time + message id,
  later opens/clicks). `mailto:` stays as a fallback when Resend isn't configured.
- **D2 — Deliverable `from` pattern:** `from = "{Shop Name} via FixFlow <leads@{verified-fixflow-domain}>"`,
  **`reply-to = shop's own email`** (`shops.email`). Never put the shop's gmail as the literal `from`
  (Resend can't authenticate it → spam/bounce).
- **D3 — Calls can't be auto-tracked from a `tel:` click.** Phase 3 adds a manual **"Log call"**
  (timestamp + outcome). Real call tracking (Twilio click-to-call) is a later, optional tier.
- **D4 — Activity log is the source of truth.** Every email sent, call logged, and status move writes a
  row; `first_response_at` is stamped on the first outreach (speed-to-lead metric).

---

## Phase 1 — Lead activity log (foundation) (~1d) — ✅ DONE
- **Migration NNN** (verify next-free at build time — the tree currently has 172–181 + main's incoming
  172→182 from the pending merge): `ad_lead_activities`
  - `id UUID PK`, `lead_id UUID NOT NULL REFERENCES ad_leads(id) ON DELETE CASCADE`,
    `type TEXT CHECK (type IN ('email','call','note','status_change'))`,
    `channel TEXT`, `subject TEXT`, `body TEXT`, `outcome TEXT`,
    `actor_address TEXT`, `meta JSONB` (e.g. `{messageId, status, opened}`),
    `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Index on `(lead_id, created_at DESC)`.
- `AdLeadActivityRepository`: `log(...)`, `listByLead(leadId)`.
- Write a `status_change` activity from the existing Kanban move; stamp `ad_leads.first_response_at`
  on the first `email`/`call` activity.
- **Endpoints:** `GET /ads/leads/:id/activities`, `POST /ads/leads/:id/activities` (note/call).
- **FE:** show **"Last contacted {when}"** on the card + an **activity timeline** in the lead
  conversation/detail panel.

## Phase 2 — In-app Resend lead email (~1–1.5d) — ✅ DONE
- `ResendEmailService`: add **`replyTo`** to `SimpleEmailOptions` + the `emails.send` call.
- **Endpoint:** `POST /ads/leads/:id/email` — body `{subject, html}`. Resolves
  `from = "{shopName} via FixFlow <RESEND_FROM_EMAIL>"`, `replyTo = shops.email`, sends via Resend,
  then writes an `email` activity (`meta.messageId`) **and** posts into the lead's conversation thread.
  Returns `{success, messageId}` or a clear "email not configured" error.
- **FE:** replace the `mailto:` link with a **"Send email"** composer modal (subject + body, with a
  prefilled template using the offer/shop name). On success → toast + activity row. If Resend isn't
  ready, fall back to the `mailto:` link with a hint.
- **Templates (light):** 1–2 starter templates ("Thanks for your interest — here's how to book").

## Phase 3 — Log call (~0.5d) — ✅ DONE
- FE: a **"Log call"** action next to Call — opens `tel:` AND records a `call` activity with an
  optional outcome (reached / no answer / booked / not interested) + note. Stamps `first_response_at`.

## Phase 4 — Optional upgrades (later)
- **Resend webhooks** — ✅ **DONE** (`b006ba709`). Svix-verified `POST /api/ads/webhooks/resend`
  (node crypto, no svix dep) merges `delivered`/`opened`/`clicked`/`bounced`/`complained` into the
  email activity's `meta`; timeline shows engagement chips. Opened/clicked await the Resend
  per-domain tracking toggle (no further code).
- **Twilio click-to-call** — ⏸️ **PARKED** (Twilio account not yet provisioned). True call
  connect/duration/recording; revisit once the account is ready and call volume justifies it.
  This is the **only remaining item** in the plan.

---

## Env / config prerequisites (before email sends work)
- `RESEND_API_KEY` (set in staging + prod).
- A **verified FixFlow sending domain** in Resend (SPF/DKIM) → `RESEND_FROM_EMAIL`
  (e.g. `leads@mg.fixflow.app`) + `RESEND_FROM_NAME` (`FixFlow`).
- Until configured, email gracefully falls back to `mailto:` (no hard failure).

## Effort
- Phase 1 (~1d) + Phase 2 (~1–1.5d) = the high-value slice (trackable email + timeline) ≈ **2–2.5d**.
- Phase 3 (~0.5d). Phase 4 later. **Total core ~2.5–3d.**

## Verification
- Backend tsc 0; FE tsc 290 baseline.
- Live: send a lead email via Resend on staging → activity row + conversation message + message id;
  log a call → activity row + `first_response_at` set; status move → `status_change` row.
- No PII leak: `from` uses the FixFlow domain; the shop email is only in `reply-to`.

## Out of scope
- Telephony (Twilio) beyond the manual call log.
- SMS follow-up.
- Bulk lead emailing (campaigns already cover bulk; this is 1:1 lead follow-up).

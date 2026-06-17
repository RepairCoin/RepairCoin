# Engineering Scope — Ad Campaign Brief + Shop↔Admin Comms

**Date:** 2026-06-16
**Status:** Scope only — no code written. Standing rule: do not build/commit until told.
**Why:** After a shop opts into a tier and the admin approves, the admin (John) has no structured signal for
*what campaign to build*, and there's no two-way channel to ask the shop. Today the only inputs are the
enrollment's optional free-text `message` + the shop's catalog/brand/location already in FixFlow.
**Grounded in:** `migrations/153_create_ad_enrollments.sql`, `repositories/EnrollmentRepository.ts`,
`controllers/EnrollmentController.ts`, `components/ads/AdEnrollmentCTA.tsx` (shop) +
`AdEnrollmentRequests.tsx` (admin), `NotificationRepository`.

Two linked features:
- **#1 Campaign brief** — the shop tells us what it wants advertised, so John builds the right campaign.
- **#2 Shop↔admin comms** — John can ask follow-ups; the shop can answer/refine (no external deps).

Both are buildable now (no Meta dependency). Combined effort ~1.5–2 days.

---

## Current state (verified)
`ad_enrollment_requests` = one row per shop: `shop_id` PK, `requested_plan` (now a tier), `status`
(pending/approved/declined), `message` (free text), `decided_by`, `decline_reason`, timestamps. The shop submits
via `AdEnrollmentCTA` (tier + message); admin sees it in `AdEnrollmentRequests` and Approve/Declines.
Notifications are best-effort one-way (`NotificationRepository`): admins on a new request, shop on a decision.

Gaps: (a) no structured brief — John guesses the service/budget/offer/area; (b) no way for John to ask the shop
anything, or for the shop to respond, short of approving/declining blind.

---

## #1 — Campaign brief

### Data (migration 156 — verify next-free against `schema_migrations` at build; 155 is the flat-tier one)
```sql
ALTER TABLE ad_enrollment_requests
  ADD COLUMN promote_service_ids UUID[] DEFAULT '{}',          -- which of the shop's services to advertise
  ADD COLUMN monthly_budget_cents INTEGER CHECK (monthly_budget_cents IS NULL OR monthly_budget_cents >= 0),
  ADD COLUMN offer TEXT,                                        -- e.g. "$49 screen repair this month"
  ADD COLUMN target_radius_miles INTEGER CHECK (target_radius_miles IS NULL OR target_radius_miles BETWEEN 1 AND 100),
  ADD COLUMN goal TEXT CHECK (goal IS NULL OR goal IN ('more_bookings','awareness','promote_service'));
```
All nullable — the brief is encouraged, not mandatory (a shop can still just leave the message).

### Backend
- `EnrollmentRepository`: `AdEnrollment` interface + the 5 brief fields; `request()` accepts a `brief` object and
  writes them; `mapRow` returns them.
- `EnrollmentController.requestAds`: validate the brief (budget ≥ 0; radius 1–100; goal in enum; service ids
  belong to the shop). Store alongside the tier + message.

### Frontend
- `AdEnrollmentCTA` (shop form) gains brief inputs: **service multi-select** (from the shop's own catalog via the
  existing services API), **monthly budget**, **offer/promo** text, **target radius**, **goal** picker. Keep them
  optional with sensible placeholders.
- `AdEnrollmentRequests` (admin): render the brief on each request card so John sees exactly what to build
  (services, budget, offer, radius, goal) — turning "guess" into "follow the brief."
- `ads.ts`: `AdEnrollment` + brief fields; `requestAdsEnrollment(tier, message, brief)`.

---

## #2 — Shop↔admin comms (lean: a `needs_info` round-trip)

Rather than a full chat, v1 reuses the existing request/notify machinery with one new state — enough for John to
ask and the shop to answer.

### Data
```sql
ALTER TABLE ad_enrollment_requests
  ADD COLUMN admin_note TEXT;                                  -- John's question / what he needs
ALTER TABLE ad_enrollment_requests DROP CONSTRAINT ad_enrollment_requests_status_check;
ALTER TABLE ad_enrollment_requests ADD CONSTRAINT ad_enrollment_requests_status_check
  CHECK (status IN ('pending','approved','declined','needs_info'));
```

### Flow
- **Admin asks:** new `POST /ads/enrollments/:shopId/request-info { note }` → `EnrollmentRepository.requestInfo`
  sets `status='needs_info'` + `admin_note`, then **notifies the shop** (`ad_enrollment_needs_info`).
- **Shop answers:** the shop sees John's `admin_note` in `AdEnrollmentCTA`, edits its brief/message, and
  re-submits → `request()` flips `needs_info`→`pending` (extend the existing "re-request reopens" logic) and
  **notifies admins**.
- Admin then Approves/Declines as today. `AdEnrollmentRequests` gets a **"Request more info"** action (note
  input) beside Approve/Decline; the `needs_info` state shows in both lists.

### Frontend
- `AdEnrollmentCTA`: handle `needs_info` — show John's question prominently + the editable brief + "Send update."
- `AdEnrollmentRequests`: "Request more info" button + show `needs_info` items.
- `ads.ts`: `requestEnrollmentInfo(shopId, note)` (admin); `AdEnrollment` += `adminNote`.

**Optional upgrade (later):** a real `ad_enrollment_messages` thread (author shop/admin, body, created_at) for
multi-turn back-and-forth. Not needed for v1 — the single `needs_info` round-trip covers "ask once, get an
answer." Note it so we don't over-build now.

---

## Effort & tests
- **Effort:** ~1.5–2 days total (migration + repo/controller + 2 FE components for both features).
- **Tests:** brief validation (pure: budget/radius/goal bounds, service-ownership); `needs_info` transition
  (admin sets → shop resubmit reopens to pending); `getMyEnrollment` returns brief + adminNote; QA script
  (`qa-ads-enrollment.ts`) extended with a needs_info round-trip.

## Open decisions
1. Brief **mandatory or optional**? (Recommend optional — don't block opt-in; John can still ask via #2.)
2. Comms depth: **`needs_info` round-trip (recommended v1)** vs. full message thread now.
3. Should the brief **prefill** a draft campaign for John (auto-pick the service/budget into the New Campaign
   form), or just display for manual entry? (Prefill is a nice follow-up, not v1.)

See [[project-ads-system-state]] (Meta connection = the separate Stage 4 gated work) and the enrollment QA guide.
Migration number: re-verify against the live `schema_migrations` before creating (DB is authoritative — see
[[feedback-check-migration-number-before-building]]).

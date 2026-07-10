# Ads System — Conversion Attribution (P0 data-integrity) — scope

**Date:** 2026-06-23
**Branch:** `deo/ads-system`
**Priority:** **P0** — without this, ROI / Revenue / Bookings / True Margin are structurally always 0.
**Status:** 🔵 Scoped, not built. Standing rule: do not commit unless told.
**Companion:** `ads-v1-gaps-and-next-steps.md`.

---

## 1. Problem (proven in code)

The performance roll-up attributes revenue/bookings via
`service_orders o JOIN ad_leads l ON l.id = o.ad_lead_id` (`PerformanceRepository.ts:126`, correctly
excluding cancelled/refunded at `:129`). **But `service_orders.ad_lead_id` is NEVER written** — a backend
grep finds only **5** references to `ad_lead_id`, all READS (the roll-up + experiment JOINs). The column
(migration 147) is dormant; the booking/checkout flow never tags an order with the ad lead it came from.

**Consequence — every conversion goes unrecorded:**
- `bookings_created` and `revenue_cents` are **always 0** (the JOIN never matches).
- So **ROI / ROAS / Revenue / Bookings / Cost-per-Booking** and **True Margin's revenue side** can never
  populate from real orders — even for a real, delivering, converting campaign. **True ROI reads −100%**
  whenever any AI cost exists. Ads can never look profitable in the current setup.

**NOT the cause:** the Leads Kanban. The math never reads `lead_status` (`leads_captured` counts ALL
non-duplicate leads regardless of column; revenue comes from orders). A shop not moving a card has zero
effect on ROI. The Kanban is a CRM/display view; the integrity hole is the missing order→lead link.

## 2. Goal

Record conversions: **automatically link `service_orders → ad_leads`** at booking/payment, server-side, so
the existing roll-up produces real bookings/revenue/ROI/True-Margin. Keep the Kanban "Booked/Paid" columns
**in sync** with the real order link (so the pipeline view and the money view agree).

**Non-goals:** changing the roll-up math (it's correct once links exist); Meta-side pixel attribution (separate
— that's the pixel "Lead" work); changing refund handling (already correct).

---

## 3. Design decisions (recommended defaults — confirm/override)

- **D1 — Attribution mechanism. → Recommended: deterministic PRIMARY + contact-match FALLBACK.**
  (a) **Deterministic:** when a booking originates from the campaign **landing page "Book online"** flow,
  thread the `campaignId` (and lead id if the visitor already submitted the form) through to order creation
  and set `ad_lead_id` directly. Most accurate. (b) **Fallback:** on order create/paid, if `ad_lead_id` is
  null and the customer's **phone/email matches a recent ad lead** within the window, link it. *(Rationale:
  deterministic catches landing-page bookings; the fallback catches the customer who clicked the ad, then
  booked through the normal app/in person.)*

- **D2 — Attribution window (fallback). → Recommended: 30 days, last-touch.**
  Match orders to ad leads created within 30 days before the order (env `ADS_ATTRIBUTION_WINDOW_DAYS=30`).
  *(Standard paid-media window; tunable.)*

- **D3 — Multiple matching leads. → Recommended: most-recent lead wins (last-touch).**
  If a contact matches leads from several campaigns/dates, attribute to the **newest** lead within the window.
  *(Simple, defensible; multi-touch attribution is a later refinement.)*

- **D4 — Kanban status source. → Recommended: auto-advance Booked/Paid from the real order; keep manual for soft stages.**
  When an attributed order is created → move the lead to **Booked**; when it's paid → **Paid**. Leave
  **Contacted / Lost** as manual (human judgment). *(Rationale: the money-relevant transitions become
  verified + automatic — a shop can't break attribution by forgetting to drag a card — while soft CRM stages
  stay human.)*

- **D5 — Junk-lead inflation of CPL. → Recommended: out of v1; note it.**
  `leads_captured` counts all non-duplicate leads, so spam inflates lead count + deflates CPL. v1 keeps the
  `is_duplicate` exclusion only; a lead-quality filter (exclude leads marked spam / lost-as-junk) is a later
  refinement. *(Rationale: don't block the P0 revenue fix on a quality model.)*

- **D6 — Backfill existing orders. → Recommended: one-time best-effort contact-match backfill.**
  Run the fallback over historical orders within the window once, so existing conversions get attributed.
  Optional, best-effort. *(Rationale: makes current dashboards meaningful immediately.)*

---

## 4. Architecture

- **`AdAttributionService.attributeOrder(order)`** (new, AdsDomain):
  - deterministic: if the order carries campaign/lead context → set `ad_lead_id`.
  - else contact-match: newest non-duplicate `ad_leads` row with matching phone/email within
    `ADS_ATTRIBUTION_WINDOW_DAYS` → set `ad_lead_id`.
  - on success, advance the lead's Kanban status (Booked on create, Paid on paid) + stamp attribution method.
- **Hook points (ServiceDomain):** order creation + payment confirmation call `attributeOrder` (best-effort,
  non-throwing — attribution must never block a booking/payment).
- **Landing-page thread-through:** the campaign landing page "Book online" CTA carries `campaignId`
  (+ `leadId` when the form was submitted) into the booking request → deterministic link.
- **Roll-up:** unchanged — it already consumes `ad_lead_id` and excludes cancelled/refunded. Once links
  exist, bookings/revenue/ROI/True-Margin populate automatically.
- **Flag:** `ADS_CONVERSION_ATTRIBUTION` (default OFF) to stage the rollout; on = links get written.

**Migration (NNN — verify next-free, currently 176; see [[feedback-check-migration-number-before-building]]):**
indexes on `ad_leads(phone)` and `ad_leads(email)` (contact match) + `service_orders(ad_lead_id)`; optionally
`service_orders.ad_attribution_method` ('deterministic' | 'contact_match') + `ad_attributed_at` for audit.

---

## 5. Phases

- **Phase 1 — deterministic link (~1d):** landing "Book online" threads `campaignId`/`leadId` → order create
  sets `ad_lead_id`; `attributeOrder` deterministic path; flag.
- **Phase 2 — contact-match fallback (~1d):** order create/paid → match by phone/email within window
  (D2/D3); set `ad_lead_id` + attribution method.
- **Phase 3 — Kanban auto-advance (~0.5d):** Booked on attributed-order create, Paid on paid (D4).
- **Phase 4 — backfill + (optional) junk filter (~0.5–1d):** one-time historical contact-match (D6).

**v1 = Phase 1 + 2 (~2d)** makes ROI/True-Margin real. Total ~3–3.5d.

---

## 6. Edge cases & risks
- **Refunds/cancels** — already handled (roll-up excludes them + reset-then-aggregate).
- **Customer with no ad lead** — no match → `ad_lead_id` stays null (organic order; correct).
- **Same contact, multiple campaigns** — last-touch (D3).
- **Attribution must never block checkout** — best-effort/non-throwing hook.
- **Manual Kanban vs derived** — once D4 lands, money-relevant status is derived; document that "Booked/Paid"
  reflect real orders, not manual drags.
- **PII matching** — phone/email match is internal + server-side; no new exposure.

## 7. Verification
- Seed an ad lead + create a real `service_orders` row with `ad_lead_id` set (deterministic) → run the
  roll-up → **bookings/revenue/ROI populate**; True Margin shows a real (non −100%) ROI.
- Contact-match: create an order with a phone matching a recent lead, no explicit link → fallback sets
  `ad_lead_id`; lead auto-advances to Booked/Paid.
- Refund the order → roll-up drops the revenue (auto-correct) — confirms integrity.
- Flag OFF = no links written (today's behavior) → no regression.

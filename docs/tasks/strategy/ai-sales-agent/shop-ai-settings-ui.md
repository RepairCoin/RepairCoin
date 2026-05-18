# Task Scope — Shop-Level AI Settings UI

**Status:** Scoping — not started
**Created:** 2026-05-18
**Track:** AI Sales Agent
**Author:** Deo + Claude

---

## 1. Problem

The `ai_shop_settings` table holds every **shop-level** AI Sales Agent
control — the master kill-switch, the monthly budget cap, escalation
behavior, and (as of migration 116) the follow-up nudge toggle. **None of
it has a UI, and there is no API endpoint for it.** It is managed entirely
by raw SQL.

Consequences:
- Enabling AI for a shop, changing its budget, or turning on follow-ups all
  require a developer with production DB access.
- It does not scale past a handful of pilot shops, and it is error-prone
  (hand-written `UPDATE`s against prod).
- Shop owners can't self-serve, and support can't make changes without
  engineering.

This was acceptable while the AI agent was in pilot. It is now a gap.

---

## 2. What exists today

| Layer | Status |
|---|---|
| **Per-service** AI settings (`shop_services.ai_sales_enabled`, `ai_tone`, `ai_booking_assistance`, FAQ) | ✅ Has a UI — `AISalesAssistantSection` inside the shop service form |
| **Shop-level** AI settings (`ai_shop_settings`) | ❌ No UI, no API |
| AI routes (`/api/ai/*`) | Only `/health`, `/preview`, `/spend`, `/admin/cost-summary` — no settings read/write |
| Shop monthly spend | `GET /api/ai/spend` already returns it (read-only) |
| Shop dashboard | Has a `SettingsTab.tsx` — natural home for an AI-settings card |

So this task is purely **shop-level** — per-service AI config is already
done and out of scope here.

---

## 3. The settings to expose

Every `ai_shop_settings` column, classified by who should control it:

| Column | Meaning | Proposed access |
|---|---|---|
| `ai_global_enabled` | Master kill-switch — AI on/off for the whole shop | **Shop-editable** (it's their feature) |
| `ai_followup_enabled` | Send follow-up nudges to quiet customers | **Shop-editable** |
| `ai_followup_delay_minutes` | Minutes of silence before a nudge (clamp 15–30) | **Shop-editable** |
| `escalation_threshold` | Hand off to a human after N consecutive AI replies | **Shop-editable** |
| `business_hours_only_ai` | Only let the AI reply during business hours | **Shop-editable** |
| `blacklist_keywords` | Keywords that force escalation to a human | **Shop-editable** (sanitize input) |
| `monthly_budget_usd` | Per-shop monthly AI spend cap | **Admin-only or read-only** — see Decision A |
| `current_month_spend_usd` | Spend so far this month | **Read-only** (display) |
| `current_month_started_at` | Budget-cycle anchor | Not shown |

---

## 4. Decisions to make before building

### Decision A — Can a shop change its own `monthly_budget_usd`?
The budget cap is a **platform cost** control (AI calls cost RepairCoin
money, not the shop). Letting a shop raise its own cap is a cost risk.
→ **Recommend:** show it **read-only** to shops; make it editable only on
the admin side (a separate small admin control, or keep it SQL for now).
*(Alternative: shop-editable but hard-capped at a ceiling.)*

### Decision B — Where does it live in the dashboard?
→ **Recommend:** an **"AI Assistant" card/section inside the existing
`SettingsTab`**, not a brand-new top-level tab — avoids tab sprawl. If it
grows, promote it to its own tab later.

### Decision C — Should the page also show AI spend?
`GET /api/ai/spend` already returns the monthly spend snapshot.
→ **Recommend:** yes — show spend read-only on the same panel (budget used
/ remaining) so the shop has one place for "AI status". Reuse `/spend`.

### Decision D — Master kill-switch self-serve
`ai_global_enabled` defaults FALSE and has been admin-enabled per shop.
If shops can flip it themselves, onboarding is self-serve. That's probably
desired — but confirm it's intended that a shop can turn AI selling on
without an admin step.

---

## 5. Work breakdown

### Phase 1 — Backend: settings API
- `GET /api/ai/settings` — shop role; reads `shopId` from JWT (no path
  param, same safety pattern as `/spend`). Returns the editable fields +
  read-only spend fields.
- `PUT /api/ai/settings` — shop role; updates only the shop-editable
  fields for the JWT's shop. Validates:
  - `ai_followup_delay_minutes` clamped to 15–30
  - `escalation_threshold` within a sane range (e.g. 1–20)
  - `blacklist_keywords` — array of trimmed, deduped, length-bounded strings
  - `monthly_budget_usd` rejected from this endpoint (Decision A)
- A thin `AiShopSettingsRepository` (or direct pool queries — the table is
  domain-local, like `SpendCapEnforcer` already does).
- Log changes (who/what) for an audit trail.

### Phase 2 — Frontend: settings panel
- An "AI Assistant" section in `SettingsTab.tsx` using **shadcn**
  components (Switch, Input, Slider/Select, Badge).
- Controls: master toggle, follow-up toggle + delay, escalation threshold,
  business-hours-only toggle, blacklist-keywords editor.
- Read-only: monthly spend (budget used / remaining), pulled from `/spend`.
- A frontend `aiSettings` API service + a save flow with validation
  mirroring the backend.

### Phase 3 — Polish + tests
- Backend unit tests for the validation rules and the JWT-scoped update.
- Empty/disabled states (e.g. shop with no `ai_shop_settings` row — the
  migration backfills all shops, but guard anyway).
- Manual QA: toggle each setting, confirm it persists and takes effect.

---

## 6. Out of scope

- Per-service AI settings — already shipped (`AISalesAssistantSection`).
- Admin-wide / platform AI controls and the `/admin/cost-summary` view.
- Building the budget-editing admin control (only flagged by Decision A).

---

## 7. Rough effort

Small-to-medium. Backend endpoint + validation ≈ 0.5 day; frontend panel
≈ 1 day; tests + polish ≈ 0.5 day. **≈ 2 days** for one developer,
assuming Decisions A–D are settled first.

---

## 8. Why it matters now

The AI follow-up nudge (migration 116) just shipped with `ai_followup_enabled`
defaulting FALSE for a staged rollout — and the *only* way to turn it on for
a shop today is a SQL `UPDATE`. This UI is what turns that staged rollout,
and AI onboarding generally, into a self-serve action instead of an
engineering ticket.

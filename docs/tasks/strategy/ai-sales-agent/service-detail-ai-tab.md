# Task Scope — "AI Assistant" tab on the service detail page

**Status:** Scoping — not started.
**Folder:** `docs/tasks/strategy/ai-sales-agent/`
**Created:** 2026-05-20
**Origin:** Executive request via screenshot — wants access to edit a
service's AI Sales Agent settings directly from the service detail page,
without going through Edit Service → scroll to AI section.
**Audience of the feature:** shop owners.

---

## 1. Problem

Today, editing a service's AI Sales Agent settings (master toggle, tone,
upsell checkbox, booking-assistance checkbox, FAQ entries) requires:

1. Open the service detail page (`/shop/services/{id}`).
2. Click "Edit Service" → navigate to `/shop/services/{id}/edit`.
3. Scroll down past every standard service field to find the AI section.
4. Edit, then save the entire service form.

That's 4 steps + a page transition + a long scroll for what's usually a
focused task ("turn on the AI for this service" or "update one FAQ
answer"). The exec wants a faster, more focused path from the detail page.

---

## 2. Scope — what's in and what's not

**In scope:**
- New **"AI Assistant"** tab on the service detail page, alongside the
  existing tabs (Overview / Availability / Calendar / Reviews).
- Tab renders a controlled instance of the existing
  `AISalesAssistantSection.tsx` component, with its own Save button.
- **Partial save** — only AI fields are sent in the PUT; other service
  fields (name, description, price, duration) are not touched.
- Unsaved-changes guard (confirm before navigating away with pending
  edits).
- Loading skeleton + inline error state.

**Out of scope:**
- Refactoring `AISalesAssistantSection` itself.
- Theme changes — the section stays light/green (a deliberate visual
  highlight against the dark detail page).
- The existing AI section on the Edit Service page — stays as-is. Both
  paths coexist; last-write-wins on concurrent edits.
- A dedicated `/api/services/:id/ai-settings` endpoint — reuse the
  existing `PUT /api/services/:id` with an AI-fields-only payload.
- Admin-side equivalent (admins don't edit per-service settings today).
- Mobile-specific breakpoints beyond what `AISalesAssistantSection`
  already supports.
- Real-time sync between browser tabs.

---

## 3. What already exists (reusable)

- **`AISalesAssistantSection.tsx`** (`frontend/src/components/shop/service/`)
  — full AI editor: toggle, tone segmented control, upsell + booking
  checkboxes, AIFaqEditor, live AI preview. Light/green-themed. Already a
  controlled component — accepts props (`enabled`, `tone`,
  `suggestUpsells`, `enableBookingAssistance`, `faqEntries`, `serviceId`,
  `description`) + a single `onChange` callback. **Drop-in reusable.**
- **`getServiceById` + `updateService`** (`frontend/src/services/api/services.ts`)
  — load and partial-update for service rows; same calls the Edit Service
  page uses.
- **Backend `PUT /api/services/:id`** — already honors partial updates
  including `aiSalesEnabled`, `aiTone`, `aiSuggestUpsells`,
  `aiBookingAssistance`, `faqEntries`. No backend work required for v1.
- **Service detail page tab structure** — Overview/Availability/
  Calendar/Reviews already use a tab pattern; appending a fifth tab is
  consistent.

**Nothing new on the backend.** This is a frontend-only feature.

---

## 4. The core design choice — partial save

Two options for the save flow:

| Option | What it is | Verdict |
|---|---|---|
| **A. Reuse `PUT /api/services/:id`** with an AI-fields-only payload | Send only `{aiSalesEnabled, aiTone, aiSuggestUpsells, aiBookingAssistance, faqEntries}`. Backend already does partial updates. | **Recommended.** Zero backend work; leverages existing partial-update support. |
| B. Add `PUT /api/services/:id/ai-settings` | New endpoint scoped to AI-only writes. | More surface area, more code, no real benefit. Skip. |

Decision: **Option A.** No backend work for v1.

---

## 5. Design decisions

| # | Decision | Recommendation |
|---|---|---|
| A | Tab placement | **Append as the LAST tab** ("AI Assistant" after Reviews). Keeps existing tab order; AI feels like a "configure" tab vs a "view" tab. |
| B | Theme | **Keep AISalesAssistantSection light/green as-is.** Visual contrast against the dark detail page draws attention to the configure surface (deliberate, not a bug). |
| C | Save scope | **Partial PUT** — only AI fields. Standard service fields untouched. |
| D | Unsaved-changes guard | Confirm-dialog when user navigates away (tab switch within detail page OR external nav) with pending edits. Same pattern as a typical form. |
| E | Save button placement | **Top-right inside the tab content**, mirroring the existing "Edit Service" button position on the detail page. Sticky bottom is more conventional but breaks visual symmetry. |
| F | Loading state | Skeleton matching the AI section shape while the service loads. Same Loader2 spinner pattern the Edit Service page uses. |
| G | Error state | Small inline banner above the AI section with a Retry button. Tab navigation stays usable. |
| H | Empty service (AI fully off) | **Always show the tab.** It's how you turn AI on for the first time — must be reachable when off. |

---

## 6. Open questions for review

1. **Save button placement** — top-right (matches "Edit Service" button)
   vs sticky-bottom (more standard for long forms). Recommend top-right.
2. **Tab badge / indicator** — should we put a small green dot on the
   tab label when AI is enabled for this service? Useful at-a-glance.
   Recommend neutral for v1 (no badge); add later if needed.
3. **After-save UX** — toast + stay on tab, or auto-redirect somewhere?
   Recommend toast + stay (user can keep tweaking).
4. **Discoverability shortcut on Service Marketplace cards** — should the
   customer-facing tile link to this tab? Out of scope for v1
   (customer-facing surface shouldn't expose shop-edit shortcuts).
5. **Concurrent edit with Edit Service page** — what if the shop owner
   has the Edit Service page open in one window AND the AI tab in
   another? Last-write-wins per row. Don't add optimistic locking for v1
   — collisions are rare and the data is small.

---

## 7. Work breakdown

### Phase 1 — Service detail page tab + wrapper component
- [ ] **1.1** Add an "AI Assistant" entry to the service detail page's tab
  array, after "Reviews".
- [ ] **1.2** New component
  `frontend/src/components/shop/service/ServiceAIAssistantTab.tsx` —
  loads the service via `getServiceById`, owns AI field state, renders
  `AISalesAssistantSection` in controlled mode.
- [ ] **1.3** Save button (top-right inside the tab) — calls
  `updateService(id, {aiSalesEnabled, aiTone, aiSuggestUpsells,
  aiBookingAssistance, faqEntries})` with ONLY the AI fields.
- [ ] **1.4** Unsaved-changes guard — track `hasChanges` (initial vs
  current AI state); show a confirm-dialog on tab switch or page leave
  when truthy. Reuse browser `beforeunload` for external nav.
- [ ] **1.5** Loading skeleton + inline error banner with Retry.

### Phase 2 — Tests + polish
- [ ] **2.1** Component test: load → edit → save → reload assertion;
  save error path; unsaved-changes confirm-dialog fires.
- [ ] **2.2** Manual QA: toggle AI on/off, change tone, add/remove FAQ
  entries, save, reload, verify persistence. Verify the Edit Service
  page's AI section still works (no regression).

### Phase 3 — Optional polish
- [ ] **3.1** Tab badge for AI-enabled services (if Q2 resolves "yes").
- [ ] **3.2** Final UX review pass with the exec who requested this.

---

## 8. Effort

~**1.5 developer-days** total:
- Phase 1: ~1 day (tab wiring + wrapper component + save flow + guard).
- Phase 2: ~0.5 day (tests + manual QA).
- Phase 3: minor polish if Q2 resolves to "show a badge".

The component reuse cuts the work — `AISalesAssistantSection` is already
a controlled component, so this is mostly state management + a Save button.

---

## 9. Relationship to other docs

- **Companion to** [`shop-ai-settings-ui.md`](./shop-ai-settings-ui.md) —
  that shipped the *shop-wide* AI settings panel (Settings → AI Sales
  Assistant). This doc adds a *per-service* AI editing surface from a
  different navigation path.
- **Reuses** the existing service AI section from the Edit Service form;
  the two paths coexist intentionally.
- **Does not block / unblock** the Impact Metrics work
  ([`ai-sales-agent-impact-metrics.md`](./ai-sales-agent-impact-metrics.md))
  or any of the v2 AI ideas (personality presets, status badge).

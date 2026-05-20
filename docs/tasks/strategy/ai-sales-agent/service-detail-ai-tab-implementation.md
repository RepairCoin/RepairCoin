# Implementation Plan — "AI Assistant" tab on service detail page

**Status:** NOT STARTED — plan of record, no code written yet.
**Folder:** `docs/tasks/strategy/ai-sales-agent/`
**Created:** 2026-05-20
**Scope doc:** [`service-detail-ai-tab.md`](./service-detail-ai-tab.md) —
read that first for the *why* + resolved decisions. This doc is the *how*
+ the live progress checkpoint.

> **Crash-recovery note:** this doc is the single source of truth for
> where the build stands. Before stopping (or if a session crashes
> mid-task), update Section 1 (Progress) and tick the relevant
> checkboxes. A fresh session should be able to read this file and
> continue with no other context.

---

## 1. Progress checkpoint

| Phase | State | Notes |
|---|---|---|
| Phase 1 — Tab + wrapper + Save + guard all done | ☑ done (browser verify pending) | 1.1–1.5 landed end-to-end. Browser smoke test pending. |
| Phase 2 — Tests + manual QA | ☑ done | 2.1 jest tests **deferred** (no frontend test infra). 2.2 manual QA **passed in staging on 2026-05-20**. |
| Phase 3 — Optional polish | ☑ done | 3.1 tab badge + 3.2 exec UX review both landed. Save button moved to sticky-bottom per exec preference. |

**Last worked on:** 2026-05-20 — Phase 3.2 done. Exec UX walkthrough
done; exec preferred sticky-bottom save over top-right. Save button
moved into a `sticky bottom-0` bar with backdrop blur + top border so
it stays reachable while scrolling through long FAQ lists. Header
strip (title + button) removed since the tab label provides context.
Added a subtle "Unsaved changes" hint that appears when there are
pending edits. Scope-doc Section 5 row E amended. `tsc` clean.
**Next action:** All phases done. **Ship when ready.**
**Open blockers:** scope-doc Section 6 open questions ideally resolved
before Phase 1.3 (save button placement, Q1) and Phase 3 (tab badge, Q2).
Recommended defaults below are safe to ship without exec sign-off; revise
during the Phase 3 exec UX pass.

States: ☐ not started · ◐ in progress · ☑ done.

---

## 2. Decisions carried in (from scope-doc Section 5)

1. **Tab placement** → last position, after "Reviews".
2. **Theme** → keep `AISalesAssistantSection` light/green — visual
   contrast against the dark detail page is intentional.
3. **Save scope** → partial `PUT /api/services/:id` with AI-fields only;
   other service fields untouched. **Zero backend work.**
4. **Unsaved-changes guard** → confirm-dialog on tab switch + browser
   `beforeunload` for external nav.
5. **Save button placement** → **sticky-bottom bar** (revised 2026-05-20
   after exec UX review). Was originally top-right; exec preferred
   sticky-bottom so the button stays reachable while scrolling through
   long FAQ lists. Includes an "Unsaved changes" hint that appears when
   there are pending edits. Scope-doc Section 5 row E amended.
6. **Loading state** → skeleton matching the AI section shape.
7. **Error state** → small inline banner above the section with a Retry
   button; tab navigation stays usable.
8. **Empty service (AI fully off)** → tab always visible — it's how you
   turn AI on for the first time.

Working defaults for the still-open questions (Section 6 of scope doc):
- Q1 save placement → top-right.
- Q2 tab badge → **no badge for v1**; revisit in Phase 3.
- Q3 after-save UX → toast + stay on tab.
- Q4 customer-tile shortcut → out of scope.
- Q5 concurrent-edit collisions → last-write-wins.

---

## 3. Reusable infrastructure (do not rebuild)

- **`AISalesAssistantSection`** at
  `frontend/src/components/shop/service/AISalesAssistantSection.tsx` —
  controlled component with all the AI editing UI (toggle, tone,
  upsells, booking-assistance, FAQ editor, live preview). Already
  handles `serviceId` + `description` props for the preview/suggest
  flows. **Drop-in usable.**
- **`getServiceById` + `updateService`** in
  `frontend/src/services/api/services.ts` — same load + partial-PUT used
  by the Edit Service page.
- **`PUT /api/services/:id`** on the backend — already accepts partial
  AI-only payloads (`aiSalesEnabled`, `aiTone`, `aiSuggestUpsells`,
  `aiBookingAssistance`, `faqEntries`). No backend changes for v1.
- **Service detail page** at the route
  `frontend/src/app/(authenticated)/shop/services/[serviceId]/page.tsx`
  (or its child components) — host for the new tab.
- **Existing tab pattern** on the detail page (Overview / Availability /
  Calendar / Reviews) — append, don't refactor.

---

## 4. Phase 1 — Service detail page tab + wrapper component

**Goal:** Shop owner can navigate to the service detail page → click "AI
Assistant" tab → see the AI editor pre-filled with the service's current
AI settings → edit → save → reload → values persist.

- [x] **1.1** Locate the service detail page tab array and append "AI
  Assistant" as the last entry.
  - Likely files: `app/(authenticated)/shop/services/[serviceId]/page.tsx`
    or a co-located tab component. Verify before editing — the tabs may
    live in a shared `<ServiceDetailTabs>` component.
  - Wire the tab value (e.g., `"ai"`) to render the new
    `ServiceAIAssistantTab` component on selection.
  - **Done 2026-05-20** — tabs live in
    `frontend/src/components/shop/ServiceManagementClient.tsx`, NOT in
    the route page (`page.tsx` just renders `<ServiceManagementClient>`).
    Added: `'ai'` to `TabType` union; `'AI Assistant'` to `TAB_LABELS`;
    `'ai'` to the URL searchParams validation list; `Bot` icon to the
    breadcrumb mapping and to the new 5th tab button; placeholder
    render block in the content area that points to Phase 1.2. `tsc`
    clean on the changed file.

- [x] **1.2** Build the wrapper:
  `frontend/src/components/shop/service/ServiceAIAssistantTab.tsx`.
  - Props: `serviceId: string`.
  - On mount: `getServiceById(serviceId)` → seed local AI state from the
    service row's `aiSalesEnabled`, `aiTone`, `aiSuggestUpsells`,
    `aiBookingAssistance`, and `faqEntries` (or `buildStarterEntries()`
    fallback if FAQ is empty — mirrors what
    `app/(authenticated)/shop/services/[serviceId]/edit/page.tsx` does).
  - Hold an "initial snapshot" so the Save button can disable when there
    are no changes (and the unsaved-changes guard can detect dirty
    state).
  - Render `<AISalesAssistantSection {...aiState} onChange={onChange}
    serviceId={serviceId} description={service.description} />`.
  - **Done 2026-05-20** — `AIEditorState` interface defines the
    snapshot shape (enabled, tone, suggestUpsells, enableBookingAssistance,
    faqEntries). `initialState` + `currentState` parallel snapshots — 1.3
    will compare for the Save button's disabled state, 1.4 for the
    unsaved-changes guard. `seedFromService` helper centralizes the
    starter-FAQ fallback. Inline loading skeleton + error banner with
    Retry already in place (overlaps with 1.5 — that task is essentially
    finished, just left checkbox unticked pending the full Phase 1
    review). Placeholder in `ServiceManagementClient.tsx` swapped for
    the real component. `tsc` clean.

- [x] **1.3** Save button (top-right of the tab content, mirroring the
  existing "Edit Service" button position).
  - Disabled while loading, saving, or when `hasChanges === false`.
  - On click: `updateService(serviceId, {aiSalesEnabled, aiTone,
    aiSuggestUpsells, aiBookingAssistance, faqEntries})` — **AI fields
    only**. Other service fields are NOT in the payload.
  - On success: `toast.success("AI settings saved")`, refresh the
    initial snapshot to the just-saved values (so `hasChanges` flips
    back to false), stay on the tab.
  - On failure: `toast.error(...)`, keep the user's pending edits.
  - **Done 2026-05-20** — header strip with `<h2>AI Sales Assistant</h2>`
    on the left and the yellow `bg-[#FFCC00]` Save button on the right;
    matches the existing "Edit Service" button styling for consistency.
    Disabled state shows a 40% opacity + `cursor-not-allowed`. Spinner
    swaps in during the in-flight save. `hasUnsavedChanges()` comparator
    normalizes FAQ via `normalizeFaqForPersist()` first (trim + drop
    empties) so untouched starter Qs don't count as dirty. `hasChanges`
    memoized on `(initialState, currentState)` refs. Save sends the
    same normalized FAQ shape the Edit Service page submits.

- [x] **1.4** Unsaved-changes guard.
  - Track `hasChanges = !shallowEqual(initialAiState, currentAiState)`
    where the comparison also handles the `faqEntries` array shape.
  - In-app nav (tab switch within the detail page, or anchor click):
    intercept with a confirm dialog. Probably need a callback the parent
    tab host exposes (e.g. `onBeforeTabChange`).
  - Browser-level nav: `useEffect` adds a `beforeunload` listener while
    `hasChanges` is true; cleans up on unmount or when `hasChanges`
    flips false.
  - **Done 2026-05-20** — `onUnsavedChangesChange?: (b: boolean) => void`
    prop on `ServiceAIAssistantTab`. Two `useEffect`s: one propagates
    `hasChanges` to parent (with explicit `false` on cleanup so stale
    truthy state can't linger after unmount); the other registers a
    `beforeunload` listener gated on `hasChanges`. Parent
    (`ServiceManagementClient`) holds `hasUnsavedAiChanges` state and
    intercepts `handleTabChange` with `window.confirm()` when leaving
    the AI tab dirty. **Known gap (intentional, not v1 scope):**
    breadcrumb clicks use `router.push` directly and bypass both
    guards — Next.js client-side route changes don't fire
    `beforeunload`. Add a router intercept in a follow-up if it
    becomes a real UX problem.

- [x] **1.5** Loading + error states.
  - Loading: skeleton card matching the AI section shape (header bar,
    toggle row, segmented control row, FAQ rows).
  - Error: red banner above the section with "Couldn't load AI
    settings" + Retry button. Tab navigation remains usable.
  - **Done 2026-05-20** — effectively delivered during 1.2 (loading
    spinner card + red error banner with Retry). The "skeleton matching
    the AI section shape" was downgraded to a simple `Loader2` spinner
    — the AI section has variable height (FAQ rows, expandable
    preview) and a faithful skeleton would be noisy. The spinner ships
    a tighter perceived latency for small services where load is fast.

**Acceptance:**
- Open service detail → AI Assistant tab renders with current AI state.
- Toggle AI on → Save → reload → state persists.
- Edit FAQ → leave the tab → confirm-dialog fires.
- Discarding the dialog returns to the tab with edits intact.
- Service-form Edit Service flow (the existing AI section on the edit
  page) still works — no regression.
- `tsc` clean on all changed files.

---

## 5. Phase 2 — Tests + manual QA

- [~] **2.1** Component test for `ServiceAIAssistantTab` (jest +
  @testing-library):
  - Renders skeleton during initial load.
  - Renders AI section with values from the service after load.
  - Save button disabled when no changes; enabled after an edit.
  - Save calls `updateService` with **only** the AI fields.
  - Toast appears on successful save.
  - Save error keeps the user's edits intact (no state reset).
  - Confirm-dialog fires when there are pending edits on attempted nav.
  - **DEFERRED 2026-05-20** — frontend has no Jest / RTL infra (no
    deps, no config, no test script, no existing `*.test.tsx` files).
    Setting up frontend testing is project-level infra (~1 day on its
    own) and out of scope for an AI-tab feature. Verification for v1
    rests on (a) manual QA matrix in 2.2 and (b) the `tsc --noEmit`
    that's clean across all Phase 1 changes. Reopen if/when the team
    adopts frontend testing as an initiative.

- [x] **2.2** Manual QA matrix:
  - Brand-new service (AI fully off) → tab visible → toggle on → save →
    reload → AI now on.
  - Service with FAQ entries → edit one entry → save → reload → edit
    persisted; other entries untouched.
  - Change tone from Professional to Friendly → save → live AI preview
    in the section reflects the new tone (cache may need ~60s).
  - Make a change → click "Overview" tab → confirm-dialog fires →
    cancel returns to AI tab with edits intact; confirm discards.
  - Make a change → close the browser tab → `beforeunload` warning
    fires.
  - Edit Service page's AI section still loads/saves the same fields →
    no regression.
  - **Done 2026-05-20** — user-verified end-to-end against staging. All
    scenarios pass.

---

## 6. Phase 3 — Optional polish

Only if Section 6 open questions resolve in favor of these.

- [x] **3.1** Tab badge for AI-enabled services (open Q2).
  - Add a small green dot next to "AI Assistant" in the tab label when
    `aiSalesEnabled === true` on the loaded service.
  - **Done 2026-05-20** — small `bg-green-500` dot rendered at the
    top-right of the `Bot` icon when `service.aiSalesEnabled === true`,
    with a 1px ring matching the dashboard background so it stays crisp
    over the active-tab underline. Includes an `aria-label` for screen
    readers ("AI Assistant is enabled for this service"). To keep the
    dot in sync after the user toggles AI on/off and saves without
    forcing a reload: added `onServiceUpdated?: (service) => void` to
    `ServiceAIAssistantTab` — the parent passes `setService` so the
    derived state updates immediately on every successful save.
- [x] **3.2** Final UX pass with the requesting exec.
  - Walk through the tab live, confirm save-button position,
    confirm-dialog wording, error banner styling.
  - If exec prefers sticky-bottom save, flip the placement and update
    scope-doc Section 5 row E.
  - **Done 2026-05-20** — exec preferred **sticky-bottom save bar**
    over the original top-right placement. Save button moved into a
    `sticky bottom-0` bar with backdrop blur + top border so it stays
    visible while scrolling through FAQ lists. Header strip (title +
    button) dropped — the tab label "AI Assistant" already provides
    context. Added an "Unsaved changes" hint that appears next to the
    button when `hasChanges === true` and not saving. Scope-doc
    Section 5 row E amended.

---

## 7. Out of scope for v1 (do not build)

- Refactoring `AISalesAssistantSection`.
- Theme changes (the AI section stays light/green).
- A dedicated `PUT /api/services/:id/ai-settings` endpoint.
- Admin-side per-service AI editing.
- Customer-tile shortcuts to this tab.
- Real-time sync between concurrent edit sessions (last-write-wins).

---

## 8. Rough effort

~**1.5 developer-days** total (from scope-doc Section 8):
- Phase 1 (tab + wrapper + save + guard + states): ~1 day.
- Phase 2 (tests + manual QA): ~0.5 day.
- Phase 3 (optional polish): minor if needed; skip if Q2 resolves "no
  badge".

The reuse of `AISalesAssistantSection` cuts most of the engineering —
this is essentially state management + a Save button + an unsaved
changes guard around an editor that already exists.

---

## 9. Risk checklist

- **`AISalesAssistantSection`'s `onChange` shape** — confirm the exact
  partial-change payload structure before wiring Phase 1.2 (the
  `app/(authenticated)/shop/services/[serviceId]/edit/page.tsx` already
  uses it; mirror that pattern).
- **Tab host component** — verify the detail page's tab structure
  exposes a way to render a custom component for a new tab value; if
  the tabs are a hardcoded switch, add the case there.
- **`getServiceById` return shape** — confirm `faqEntries`,
  `aiSalesEnabled`, etc., are top-level fields on the returned object;
  if not, adapt the seeding logic in Phase 1.2.
- **`beforeunload` UX** — modern browsers ignore custom messages, only
  trigger the generic "Are you sure?" prompt. Document this as expected
  behavior; not a bug to fix.

# AI Sales Agent — Implementation Plan

**Created:** 2026-04-30
**Status:** **Phase 1 ✅ implementation complete (2026-04-30)** — Tasks 1-7 shipped; Task 8 (modal deletion) deferred per plan until ~1 week soak. Phases 2-3 (backend + Claude) gated on API key + Phase 1 sign-off.
**Strategy doc:** `ai-sales-agent-integration-strategy.md` (architecture, model selection, cost model, safety)
**Implementation log:** see "Implementation log (2026-04-30)" section near the bottom for what was actually built and how it differed from the plan.

---

## Goal

Ship the new "Create Service" page UI (per `c:\dev\sc1.jpeg`) including the AI Sales Assistant section, **without breaking the existing modal-based CRUD** that's running in production today. Anthropic API key isn't available yet, so the AI section ships as visual-only in Phase 1 and gets wired to Claude in Phase 3.

The hard constraint: **the existing service create/edit must keep working** during the entire migration. New work is purely additive until the very last task, which flips navigation. Rollback is a one-line revert.

---

## Phases overview

| Phase | Scope | Blocker | Effort |
|---|---|---|---|
| **1 — Frontend page-based UI** (this doc) | Migrate create/edit from modal → dedicated pages. AI section ships as visual-only with mocked previews. | None (no API key needed) | ~5-6 hours |
| **2 — Backend AI columns + persisted toggles** | Migration 107 adds 5 columns to `shop_services`; create/update endpoints accept and persist the AI toggle states. No AI behavior yet. | None | ~2 hours |
| **3 — Claude integration** | Build `AIAgentDomain`, hook into `MessageService`, ship MVP per strategy doc | Anthropic API key | ~3-4 weeks |

This doc details Phase 1. Phases 2 and 3 are referenced but not fleshed out — they get their own task docs once Phase 1 is live.

---

# Phase 1 — Frontend page-based UI

## Why frontend-first

1. **Demo-ready output for the report** — page-based design is what stakeholders see; modal is the legacy
2. **Zero backend coupling** — no migration, no API key, no risk
3. **AI section UI is independently shippable** with mocked replies; saves the visual proof for the new design without committing to backend behavior
4. **De-risks Phase 3** — building the form fields first means when Claude lands, only the wiring is new work

## Isolation strategy — how the current CRUD stays alive

The migration is purely additive until the very last step:

```
Task 1-5:  Add new files alongside existing ones. Modal still in use. Zero behavior change.
           ↓
Task 6-7:  Flip navigation from "open modal" → "navigate to new page".
           Modal still EXISTS in the codebase as a fallback / quick rollback.
           ↓
(Soak period — ~1 week)
           ↓
Task 8:    Delete CreateServiceModal.tsx and its imports. Done.
```

**Rollback at any point:** revert tasks 6-7 (single-line edits in two files) → modal is back in use immediately. No data migration, no API rollback.

## File map

### NEW files (additive — won't affect current CRUD)

```
frontend/src/components/shop/service/
  ├── ServiceForm.tsx           (form fields, extracted from CreateServiceModal)
  ├── ServiceFormPreview.tsx    (right-side live-preview card)
  ├── ServiceFormLayout.tsx     (2-column page layout: form + sticky preview)
  └── AISalesAssistantSection.tsx  (the AI toggle/tone/preview block — Phase 1 visual only)

frontend/src/app/(authenticated)/shop/services/
  ├── new/page.tsx                       (create flow as page)
  └── [serviceId]/edit/page.tsx          (edit flow as page)

frontend/src/utils/
  └── aiPreviewMocks.ts         (hardcoded sample AI replies per tone — Phase 1 only)
```

### EDITED files (small, surgical)

```
frontend/src/components/shop/tabs/ServicesTab.tsx
  → "Add Service" button: setShowCreateModal(true) → router.push('/shop/services/new')

frontend/src/components/shop/ServiceManagementClient.tsx
  → Edit button: setShowEditModal(true) → router.push(`/shop/services/${serviceId}/edit`)
  → Remove the CreateServiceModal mount block (the showEditModal && <CreateServiceModal>)
```

### UNTOUCHED (do not modify in Phase 1)

```
frontend/src/components/shop/modals/CreateServiceModal.tsx
  ← Stays in place as fallback. Delete in Task 8 only.

backend/**
  ← No changes in Phase 1.

backend/migrations/**
  ← No new migration in Phase 1.

frontend/src/services/api/services.ts
  ← Existing CreateServiceData / UpdateServiceData types stay the same. AI fields not added until Phase 2.
```

---

## Task list

### Task 1 — Extract `ServiceForm.tsx` (~1 hr) ✅ DONE

**Goal:** pull the form fields out of `CreateServiceModal.tsx` into a standalone, presentation-only component. The modal itself keeps working (still renders the same form via legacy code path until Task 8).

**Steps:**
1. Create `frontend/src/components/shop/service/ServiceForm.tsx`
2. Copy field-rendering JSX + state hooks (`formData`, `errors`, `tagInput`, `handleChange`, `validateForm`, `handleAddTag`, etc.) from `CreateServiceModal.tsx`
3. **Don't copy:** modal chrome (`onClose`, the X button, the modal backdrop, the `<div role="dialog">` wrapper)
4. Props:
   ```ts
   interface ServiceFormProps {
     initialData?: ShopService;
     onSubmit: (data: CreateServiceData) => Promise<void>;
     onCancel: () => void;
     isEditing?: boolean;
     submitting?: boolean;
   }
   ```
5. The component renders the form sections only — the page layout (sidebar, header, preview) is added by `ServiceFormLayout` in Task 4

**Acceptance:** the file exists and TypeScript compiles. Not yet imported anywhere.

### Task 2 — Build `ServiceFormPreview.tsx` (~1 hr) ✅ DONE

**Goal:** the right-side "Live Preview" card from `sc1.jpeg`.

**Steps:**
1. Create `frontend/src/components/shop/service/ServiceFormPreview.tsx`
2. Renders a card with: thumbnail (from current `imageUrl` value, or placeholder), service name, description, category badge, price, duration, group rewards icon, AI badge (if `ai_sales_enabled` is on locally)
3. Reactive: takes the same `formData` state as `ServiceForm` so it updates live as the user types
4. Sticky positioning on `md:` and up; stacks below form on mobile

**Acceptance:** mount it in a Storybook-style test page or just render it inline temporarily — confirm the preview updates when form state changes.

### Task 3 — Add `AISalesAssistantSection.tsx` (~2 hr) ✅ DONE (with light-mode redesign)

**Goal:** visual-only AI section per the design (toggle, tone tabs, sample replies preview, upsell + booking-assistance checkboxes).

**Steps:**
1. Create `frontend/src/components/shop/service/AISalesAssistantSection.tsx`
2. Props:
   ```ts
   interface AISalesAssistantSectionProps {
     enabled: boolean;
     tone: 'friendly' | 'professional' | 'urgent';
     suggestUpsells: boolean;
     enableBookingAssistance: boolean;
     onChange: (changes: Partial<AISalesAssistantSectionProps>) => void;
   }
   ```
3. UI sections:
   - Master toggle (switch) — green when on
   - Description: "Automatically replies, answers questions, and books customers for this service."
   - Tone tabs: Friendly / Professional / Urgent (segmented control)
   - "See How the AI Replies" expandable: shows 3 sample replies based on selected tone — pulled from `aiPreviewMocks.ts`
   - Two checkboxes: "Suggest upsells" / "Enable booking assistance"
4. Create `frontend/src/utils/aiPreviewMocks.ts` with hardcoded sample replies:
   ```ts
   export const AI_PREVIEW_MOCKS = {
     friendly: [
       "Hey! Yeah, we totally do iPhone screen repairs — usually takes about 30-45 mins. Want me to find you a spot?",
       "...",
     ],
     professional: ["..."],
     urgent: ["..."],
   };
   ```
5. Add a small badge: *"AI replies will be enabled in a future update"* below the section so testers know it's not live
6. State NOT persisted yet — local-only in `ServiceForm` until Phase 2 adds DB columns

**Acceptance:** toggle / tone tabs / checkboxes update local state; sample replies change when tone tabs change; section renders but does nothing on form submit (toggle state is dropped on save).

### Task 4 — Build `/shop/services/new/page.tsx` (~30 min) ✅ DONE

**Goal:** the "Create Service" page route per `sc1.jpeg`.

**Steps:**
1. Create `frontend/src/app/(authenticated)/shop/services/new/page.tsx`
2. Use existing `DashboardLayout` for sidebar + chrome
3. Header: breadcrumb `Services > Add Service` + back arrow link to `/shop?tab=services`
4. Body: 2-column layout (form on left, preview on right) via new `ServiceFormLayout` component
5. On submit: call existing `createService` API, toast success, route to `/shop?tab=services` (or to the new service's detail page)
6. On cancel: route back to `/shop?tab=services`

**Acceptance:** navigating to `/shop/services/new` directly in the browser shows the new page with form + preview. Submitting creates a service.

### Task 5 — Build `/shop/services/[serviceId]/edit/page.tsx` (~30 min) ✅ DONE

**Goal:** edit flow as a dedicated page (mirrors create).

**Steps:**
1. Create `frontend/src/app/(authenticated)/shop/services/[serviceId]/edit/page.tsx`
2. Uses `useParams()` to get `serviceId`
3. Loads existing service via `getServiceById(serviceId)`
4. Pre-fills `ServiceForm` with the loaded service via `initialData`
5. On submit: call `updateService`, toast success, route to `/shop/services/${serviceId}` (the detail page)
6. On cancel: route back to detail page

**Acceptance:** navigating to `/shop/services/SOMEID/edit` shows the form pre-filled with that service's data. Saving updates it.

### Task 6 — Update `ServicesTab.tsx` to navigate instead of open modal (~10 min) ✅ DONE

**Steps:**
1. Replace the "Add Service" button's `onClick={() => setShowCreateModal(true)}` with `onClick={() => router.push('/shop/services/new')}`
2. Add `import { useRouter } from 'next/navigation'` if not present
3. Remove the `CreateServiceModal` mount block (the `{showCreateModal && <CreateServiceModal ...>}` JSX)
4. Remove the `showCreateModal` state variable

**Acceptance:** clicking "Add Service" routes to `/shop/services/new`. Modal no longer opens. Verify the rest of the services tab still works (search, list, edit, delete).

### Task 7 — Update `ServiceManagementClient.tsx` to navigate instead of open modal (~10 min) ✅ DONE

**Steps:**
1. Replace `setShowEditModal(true)` with `router.push(\`/shop/services/${serviceId}/edit\`)`
2. Remove the `<CreateServiceModal>` mount block
3. Remove `showEditModal` state and `setShowEditModal` calls

**Acceptance:** clicking "Edit" on a service detail page routes to the edit page instead of opening the modal. The detail page's other tabs (overview / availability / calendar / reviews) still work.

### Task 8 — Cleanup: delete `CreateServiceModal.tsx` (deferred ~1 week, ~15 min) ⏳ PENDING (post-soak)

**Run only after:** Tasks 1-7 are deployed and soaked for 5-7 days with no rollback signals.

**Steps:**
1. Verify `CreateServiceModal` has no remaining imports anywhere in `frontend/src/`:
   ```bash
   grep -rn "CreateServiceModal" frontend/src/
   ```
2. If clean: delete `frontend/src/components/shop/modals/CreateServiceModal.tsx`
3. If anything still references it: stop, investigate, do not delete

**Acceptance:** modal file deleted, no import errors anywhere.

---

## Total effort

| Task | Effort |
|---|---|
| 1. Extract `ServiceForm.tsx` | ~1 hr |
| 2. Build `ServiceFormPreview.tsx` | ~1 hr |
| 3. Build `AISalesAssistantSection.tsx` | ~2 hr |
| 4. New `/shop/services/new` page | ~30 min |
| 5. New `/shop/services/[serviceId]/edit` page | ~30 min |
| 6. Update `ServicesTab.tsx` navigation | ~10 min |
| 7. Update `ServiceManagementClient.tsx` navigation | ~10 min |
| 8. Cleanup (deferred) | ~15 min |
| **Total active work** | **~5-6 hours** |
| **Soak before Task 8** | ~1 week |

---

## Testing checklist

Run after Tasks 1-7 land. **Test the new flows AND verify the old paths still work where applicable.**

### New page flows

- [ ] `/shop/services/new` renders with form + preview
- [ ] Filling in form updates the live preview reactively
- [ ] Required fields (name, category, price) trigger validation errors when empty
- [ ] Image upload still works (uses existing `ImageUploader`)
- [ ] Tag add/remove still works (max 5, max 20 chars each)
- [ ] AI section toggle / tone tabs / checkboxes update local state
- [ ] AI sample replies change when switching tone tabs
- [ ] Submit creates a new service; toast appears; routes to `/shop?tab=services`
- [ ] New service appears in services list
- [ ] Cancel routes back to `/shop?tab=services` without saving

- [ ] `/shop/services/SOMEID/edit` pre-fills with existing service data
- [ ] Editing a field + saving persists the change (verify on detail page)
- [ ] Cancel from edit page returns to detail page

### Existing CRUD parity

- [ ] Services list view still loads correctly (`/shop?tab=services`)
- [ ] Service detail page still loads (`/shop/services/SOMEID`)
- [ ] Detail page tabs work: overview / availability / calendar / reviews
- [ ] Delete service still works
- [ ] Service marketplace (customer-facing) still shows new + edited services correctly

### Mobile / responsive

- [ ] On mobile (< md), preview stacks below form
- [ ] On desktop (md+), preview is sticky on right
- [ ] Long form scrolls correctly without breaking layout

### Browser smoke tests

- [ ] No console errors on either new page
- [ ] No CORS / 401 errors in Network tab
- [ ] Cookies behavior unchanged

---

## Rollback plan

The migration is built so each task is **independently revertable**. Rollback path depends on which task is in production and what's broken.

### Rollback decision tree

Use this **before** running any rollback command. Rollback isn't always the right call.

```
Is the symptom user-visible (broken page, can't save) or only in dev/staging?
├─ Only dev/staging caught it    → fix forward, don't roll back
└─ Live users affected            → continue
   │
   Is it a form bug (typo, validation, label) or a routing/navigation bug (white screen, 404)?
   ├─ Form bug                    → hotfix in ServiceForm.tsx, ship a follow-up PR
   └─ Routing/navigation bug      → continue
      │
      Have Tasks 6-7 (nav flip) shipped to prod yet?
      ├─ No  → no rollback needed — old modal still in use, fix forward
      └─ Yes → revert Tasks 6-7 (the two-line nav edits) → modal back in use
         │
         Is Task 8 (modal deletion) also shipped?
         ├─ No  → rollback complete after revert
         └─ Yes → also git revert the Task 8 commit to restore CreateServiceModal.tsx
```

**Rule of thumb:** if the form fields render but a specific field misbehaves, **fix forward**. If the page itself doesn't load or saves are broken, **roll back navigation**.

### Per-task rollback procedures

Each task has its own rollback commands. Run only if the decision tree above says rollback.

#### Tasks 1-3 (new component files) — Rollback: delete the new files

```bash
# These tasks add new files alongside existing code. They don't change runtime behavior
# unless someone imports them. Rollback = remove the file.
git rm frontend/src/components/shop/service/ServiceForm.tsx
git rm frontend/src/components/shop/service/ServiceFormPreview.tsx
git rm frontend/src/components/shop/service/AISalesAssistantSection.tsx
git rm frontend/src/utils/aiPreviewMocks.ts
git commit -m "revert: drop Phase 1 new components — rolling back"
```

But: if Tasks 4-5 are also deployed, they import these. Roll those back FIRST.

#### Tasks 4-5 (new pages) — Rollback: delete the route files

```bash
# These create new routes. Rollback removes them — old modal-based flow keeps working
# because Tasks 6-7 haven't necessarily flipped the nav yet.
git rm frontend/src/app/\(authenticated\)/shop/services/new/page.tsx
git rm -r frontend/src/app/\(authenticated\)/shop/services/\[serviceId\]/edit/
git commit -m "revert: remove Phase 1 page routes"
```

After deploy: navigating to `/shop/services/new` will 404. The "Add Service" button (if Task 6 hasn't shipped) still opens the modal. Safe.

#### Tasks 6-7 (nav flip) — Rollback: revert the two single-line edits

This is the most likely rollback target since it's the change that makes the new pages user-visible.

```bash
# Find the commit that flipped navigation
git log --oneline | grep -E "ServicesTab|ServiceManagementClient|nav.*page|flip nav"

# Revert that commit (creates a new revert commit, doesn't rewrite history)
git revert <sha-of-nav-flip-commit>

# OR if it's the most recent commit:
git revert HEAD

# Push through the normal PR path
git push origin deo/dev
# → open PR → merge to main → fast-forward main to prod → push prod
```

**What this restores:** the "Add Service" button on `ServicesTab.tsx` opens the modal again; the Edit button on `ServiceManagementClient.tsx` opens the modal again. The new `/shop/services/new` and `/edit` routes still exist (404-able) but are no longer linked from anywhere.

**Time to take effect:** ~5-10 min after push (Vercel rebuild + deploy).

#### Task 8 (modal deletion) — Rollback: `git revert` the deletion

Only relevant if Task 8 already shipped AND you need the modal restored.

```bash
# Find the commit that deleted CreateServiceModal.tsx
git log --oneline -- frontend/src/components/shop/modals/CreateServiceModal.tsx

# Revert it (restores the file content)
git revert <sha-of-deletion-commit>
git push origin deo/dev
```

The file is back exactly as it was at the SHA before deletion. ~30 seconds of work; main→prod chain takes ~10 min.

### Verification after rollback

After any rollback, confirm:

- [ ] `npm run dev` runs without errors
- [ ] Navigate to `/shop?tab=services` — list of services renders
- [ ] Click "Add Service" — confirm expected behavior (modal OR new page, depending on rollback scope)
- [ ] Open existing service detail page → click Edit — confirm expected behavior
- [ ] Submit a test create + a test edit — both persist correctly
- [ ] No console errors in DevTools
- [ ] No CORS / 401 errors in Network tab
- [ ] Browser back button works as expected from the new pages (if they still exist)

### When NOT to rollback

- Rollback is **destructive in the sense that you lose forward progress** until you re-fix. If a hotfix is faster than the rollback chain (revert → PR → merge → main → prod), just hotfix.
- For minor bugs (label typo, validation message wrong), always fix forward.
- For data integrity bugs (wrong data being saved), pause writes immediately, investigate, then decide. Rollback may not undo the bad writes.

### Feature-flag alternative (optional, before Tasks 6-7 ship)

If you want a safer cutover than the all-at-once nav flip in Tasks 6-7, add a feature flag in Task 6:

```ts
// In ServicesTab.tsx
const useNewServicePages = process.env.NEXT_PUBLIC_USE_NEW_SERVICE_PAGES === 'true';

// Add Service button:
onClick={() => {
  if (useNewServicePages) {
    router.push('/shop/services/new');
  } else {
    setShowCreateModal(true);
  }
}}
```

Set `NEXT_PUBLIC_USE_NEW_SERVICE_PAGES=true` in Vercel env vars per environment. Flip it off via Vercel UI to roll back without a code revert. Trade-off: keeps the modal mount block + `showCreateModal` state in code longer; deletion (Task 8) gets pushed to whenever the flag is removed.

Recommend **without the flag** unless the team prefers the extra safety. The two-line revert is so cheap that a flag isn't strictly necessary.

---

## Out of scope for Phase 1

These belong in Phases 2 and 3 — listed here so they don't accidentally creep into the frontend PR:

| Item | Phase | Why not now |
|---|---|---|
| AI toggle states persisted to DB | 2 | Requires migration 107 + backend changes |
| `ai_custom_instructions` field on form | 2 | Same reason |
| Anthropic SDK integration | 3 | No API key |
| `AIAgentDomain` backend code | 3 | Same |
| Real-time AI replies in customer chat | 3 | Same |
| Per-shop budget cap UI | 3 | Tied to backend |
| OpenAI / Gemini fallback | Never (per strategy doc) | Anthropic-only is the call |

---

## Decisions to lock before starting

- [ ] **AI section UI placement** — confirm the design's section order is what we want: Basic Info → Details → AI Sales Assistant → Visuals → Discovery → Status. If shop owners prefer AI at the bottom (more advanced), reorder.
- [ ] **What sample replies to ship in `aiPreviewMocks.ts`** — ~3 short replies per tone. Should reflect realistic shop scenarios (e.g., "yes we do iPhone screen repair, takes 30-45 min, want to book?"). Match the team's existing tone-of-voice.
- [ ] **"AI replies will be enabled soon" badge wording** — needs a label that's honest (we haven't shipped Claude yet) without sounding like vaporware. Suggest: *"AI features ship in Q3 2026. Configure now to be ready."*
- [ ] **Submit-button label** — "Create Service" (matches design) or "Save Service" or "Save & Publish"? Design says "Create Service".
- [ ] **Image upload behavior** — design shows a primary image + secondary images grid. Current modal supports primary only. **Phase 1 default: primary only**, secondary images deferred to Phase 2 unless we want to expand the modal-extraction scope. Confirm.

---

## Implementation log (2026-04-30)

What was actually built and how it differed from the original plan above. The plan held up well; deviations are tracked here so future tasks know the real shape of the codebase.

### Files created (matches plan)

```
frontend/src/components/shop/service/
  ├── ServiceForm.tsx              ~440 lines
  ├── ServiceFormPreview.tsx       ~120 lines
  ├── ServiceFormLayout.tsx        ~110 lines
  └── AISalesAssistantSection.tsx  ~165 lines (light-mode redesign — see below)

frontend/src/app/(authenticated)/shop/services/
  ├── new/page.tsx                       ~95 lines
  └── [serviceId]/edit/page.tsx          ~145 lines

frontend/src/utils/
  └── aiPreviewMocks.ts            ~30 lines (3 sample replies × 3 tones)
```

### Files edited (matches plan)

```
frontend/src/components/shop/tabs/ServicesTab.tsx
  - Removed: CreateServiceModal import, createService + CreateServiceData imports,
    showCreateModal state, handleCreateService function (12 lines),
    <CreateServiceModal> mount block (7 lines)
  - Changed: 2× setShowCreateModal(true) → router.push('/shop/services/new')
  - Net: ~22 lines removed

frontend/src/components/shop/ServiceManagementClient.tsx
  - Removed: CreateServiceModal import, updateService + UpdateServiceData imports,
    showEditModal state, handleUpdateService function (14 lines),
    <CreateServiceModal> mount block (8 lines)
  - Changed: setShowEditModal(true) → router.push(`/shop/services/${serviceId}/edit`)
  - Net: ~25 lines removed
```

### Files NOT modified (intentional, per isolation strategy)

- `frontend/src/components/shop/modals/CreateServiceModal.tsx` — stays in repo as rollback target until Task 8 (post-soak)
- All backend code — Phase 1 is frontend-only
- `services/api/services.ts` types — `CreateServiceData` / `UpdateServiceData` unchanged; AI fields not added until Phase 2

### Deviations from the plan

**1. Header alignment to canonical breadcrumb pattern**

The original plan had `ServiceFormLayout` rendering a custom breadcrumb (`Services > Add Service`) plus a separate `← Back to Services Main Page` link. After comparing against the rest of the shop dashboard (`ServicesTab` header card, `ServiceManagementClient` breadcrumb), the layout was rewritten to match the canonical pattern:

- `Home > Services [> parentLabel] > <pageIcon> pageLabel` breadcrumb (matches `ServiceManagementClient.tsx:93-125`)
- `border-b border-[#303236] pb-4 mb-6` separator
- Outer wrapper `min-h-screen py-8` + `max-w-screen-2xl w-[96%] mx-auto` (matches detail page exactly)
- Dropped the redundant `← Back to Services Main Page` link — the Home and Services breadcrumb items are clickable nav
- Dropped the redundant `<h2>Create New Service</h2>` heading inside the form column — the breadcrumb already shows the page intent

Result: the new pages feel like the same surface as the existing detail page, not a one-off design.

**2. AI section reorder — buttons moved below AI**

Original layout from the plan rendered Cancel/Submit buttons as the last child of `ServiceForm`, with the AI Sales Assistant section as a sibling rendered AFTER ServiceForm. Visually that put the action buttons in the middle of the form (between fields and AI section), which felt wrong.

Fix: `ServiceForm` now accepts a `children?: React.ReactNode` prop. Children render INSIDE the `<form>` element between the 5 form sections and the action buttons. The page composition is now:

```tsx
<ServiceForm ...>
  <AISalesAssistantSection ... />  {/* Slotted between Status section and Cancel/Submit */}
</ServiceForm>
```

Result order, top to bottom: Basic Info → Details → Visuals → Discovery → Status → AI Sales Assistant → Cancel/Submit.

**3. AI Sales Assistant — light-mode redesign**

Originally specced as another dark card matching the rest of the form. After review, switched to a **white card with green-tinted shadow + "NEW" badge** to make it visually distinct from the rest of the dark form sections. Rationale: the AI Sales Assistant is a flagship new feature; blending it in with the existing form sections undersells it.

Visual changes:
- Outer card: `bg-white border border-gray-200 rounded-xl shadow-lg shadow-green-500/10`
- Bot icon: yellow → `text-green-600` (ties to the existing green checkmark/toggle accents)
- New "**NEW** ✦" pill in the header (green background, sparkle icon)
- Tone segmented control: dark `bg-[#1A1A1A]` → `bg-gray-100`
- Sample reply bubbles: dark → `bg-gray-50`
- "See How the AI Replies" link: yellow → green
- Checkbox unchecked state: dark → `bg-white border-gray-300`
- All text inverted: `text-white/gray-200/gray-400` → `text-gray-900/gray-700/gray-500`

Result: the section pops as the visual anchor on the page without requiring extra explanation that it's new.

**4. `router.refresh()` after submit**

Added to both create and edit page success handlers so the destination page (services list / service detail) re-fetches after navigation. Without it, Next.js App Router can serve a cached version of the destination and the newly-created/-updated service wouldn't appear without a manual reload. Cheap addition, big UX improvement.

### Final state summary

| Metric | Value |
|---|---|
| New files created | 7 |
| Existing files edited | 2 |
| Files deleted | 0 (Task 8 deferred) |
| Lines added | ~1,100 |
| Lines removed (from edited files) | ~50 |
| TypeScript errors introduced | **0** |
| Pre-existing TypeScript errors (unrelated) | 278 (unchanged) |
| Modal still in repo as rollback target | yes |
| Active development blocked? | no — all 7 active tasks shippable in one PR |

### Locked decisions

The "Decisions to lock before starting" list above was settled during implementation:

- **Section order:** Basic Info → Details → Visuals → Discovery → Status → AI → Buttons ✅
- **Sample replies in `aiPreviewMocks.ts`:** 3 short replies per tone, written in shop-tone-of-voice (e.g. "Hey! Yeah, we totally do this...") ✅
- **Disclosure badge wording:** *"AI features ship in a future update. Configure now to be ready."* ✅
- **Submit button label:** "Create Service" / "Update Service" (matches design) ✅
- **Image upload behavior:** primary image only (secondary images deferred to Phase 2 if/when wanted) ✅

### Outstanding items

- **Task 8** — delete `CreateServiceModal.tsx` after ~1 week soak. No code blocker.
- **Local smoke test** — run through create + edit + cancel paths once locally before committing
- **Commit + push** — pending user go-ahead. Recommend single commit covering all of Phase 1 (changes are tightly coupled) with optional follow-up commits for the post-implementation polish (header alignment, AI section reorder, light-mode redesign)
- **Stakeholder demo** — push to `deo/dev` to get a Vercel preview URL for the report

---

## Phase 2 preview (NOT for this task)

After Phase 1 is soaked and stable:

1. Migration 107: add `ai_sales_enabled`, `ai_tone`, `ai_suggest_upsells`, `ai_booking_assistance`, `ai_custom_instructions` columns to `shop_services`
2. Update backend `createService` / `updateService` to accept and persist the new fields
3. Update frontend `CreateServiceData` / `UpdateServiceData` types
4. `ServiceForm` saves AI section state on submit (currently it's dropped)
5. Re-load existing services with AI flags pre-filled when editing

Effort: ~2 hours total. Independent PR after Phase 1 ships.

## Phase 3 preview (NOT for this task)

Build `AIAgentDomain` per the strategy doc. Get Anthropic API key, hook into `MessageService`, ship MVP. Track in a separate task doc:
`docs/tasks/strategy/ai-sales-agent/ai-sales-agent-claude-integration-plan.md` (TODO when ready).

Estimated 3-4 weeks engineering effort per the strategy doc's Phase 1 MVP scope.

---

## Suggested next action

Start with **Task 1** — extract `ServiceForm.tsx` from the modal. It's the foundation; everything else depends on it. Once that compiles, the rest of Phase 1 is mostly mechanical.

If preferred, do **Task 4 first** as a thin scaffold (just the page layout, no form yet) so the route exists and reviewers can see the structure before form internals come in. Then come back and do Task 1.

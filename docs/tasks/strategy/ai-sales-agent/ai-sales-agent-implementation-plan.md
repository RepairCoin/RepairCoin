# AI Sales Agent — Implementation Plan

**Created:** 2026-04-30
**Status:**
- **Phase 1 ✅ implementation complete (2026-04-30)** — Tasks 1-7 shipped; Task 8 (modal deletion) deferred until ~1 week soak.
- **Phase 2 ✅ implementation complete (2026-04-30)** — Migration 108 + 5 backend/frontend layers shipped. Manually applied to staging DB. **Prod deploy still pending** (main → prod merge not yet done).
- **Phase 2.5 ✅ implementation complete (2026-05-01)** — Exec copy iteration applied: label "Auto Sales & Booking", new description, micro-proof line (Option B), 12 mocked messages with emoji + urgency + time slots. See "Phase 2.5 implementation log (2026-05-01)" section.
- **Phase 3 ⏳ blocked** on Anthropic API key. ~3-4 weeks of work once key arrives.
**Strategy doc:** `ai-sales-agent-integration-strategy.md` (architecture, model selection, cost model, safety)
**Implementation logs:** see Phase 1, 2, and 2.5 "Implementation log" sections inline below.

---

## Goal

Ship the new "Create Service" page UI (per `c:\dev\sc1.jpeg`) including the AI Sales Assistant section, **without breaking the existing modal-based CRUD** that's running in production today. Anthropic API key isn't available yet, so the AI section ships as visual-only in Phase 1 and gets wired to Claude in Phase 3.

The hard constraint: **the existing service create/edit must keep working** during the entire migration. New work is purely additive until the very last task, which flips navigation. Rollback is a one-line revert.

---

## Phases overview

| Phase | Scope | Blocker | Effort |
|---|---|---|---|
| **1 — Frontend page-based UI** (this doc) | Migrate create/edit from modal → dedicated pages. AI section ships as visual-only with mocked previews. | None (no API key needed) | ~5-6 hours |
| **2 — Backend AI columns + persisted toggles** | Migration 108 adds 5 columns to `shop_services`; create/update endpoints accept and persist the AI toggle states. No AI behavior yet. | None | ~2 hours |
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
| AI toggle states persisted to DB | 2 | Requires migration 108 + backend changes |
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

---

# Phase 2 — Backend persistence for AI Sales Assistant settings

**Status:** Not started — ready to begin once Phase 1 is on prod (or in parallel with Phase 1's prod soak; they don't conflict)
**Effort:** ~2 hours
**Blocker:** None — no API key needed
**Independence:** Doesn't depend on Phase 1's prod ship; can land any time after Phase 1 lives on staging

## Goal

Phase 1 shipped a fully-interactive AI Sales Assistant section (toggle, tone tabs, sample replies, checkboxes), but **the values aren't saved**. On submit, ServiceForm sends the existing form fields (name, category, description, price, image, tags, active) and the AI state is dropped on the floor. When a shop owner reloads the edit page, the AI section resets to defaults.

Phase 2 closes the gap: the four (or five) AI settings persist to the database, round-trip through the API, and pre-fill correctly when editing. **No AI behavior changes** — the replies are still mocked, no Anthropic calls. Just plumbing the existing UI state into the DB.

## Why this is the natural next step

- **Zero new architecture.** No new domains, no new services, no Claude API key. Just one migration + a handful of edits to existing files.
- **Closes the "configures-but-doesn't-save" honesty gap.** Today, shop owners who toggle the AI on for a service think their setting is saved. It isn't. Every day this lives like that erodes a tiny bit of trust.
- **Sets up Phase 3 cleanly.** When Claude integration ships, the data shape is already in the DB for every existing service. No backfill needed.
- **Demonstrates incremental progress.** Stakeholders see the feature evolving each phase rather than waiting weeks for the full Claude rollout.

## Scope decisions

Lock these before starting:

- [ ] **Include `ai_custom_instructions TEXT` column?** The strategy doc lists it as part of the Phase 1 MVP DB additions but Phase 1 didn't ship UI for it. Two paths:
  - **Yes (recommended)** — add the column now, leave it nullable, no UI in Phase 2. Keeps the migration single-shot. UI can be added in Phase 2.5 or whenever shop owners ask for it. Future-proofs the schema.
  - **No** — only add the 4 columns we have UI for. Saves a 1-line migration entry, but means we'll do another `ALTER TABLE` later.

- [ ] **Disclosure badge wording in `AISalesAssistantSection.tsx`** — currently reads *"AI features ship in a future update. Configure now to be ready."*. After Phase 2, the toggle states are saved, but AI behavior still doesn't exist (Phase 3). Update wording to reflect "settings are saved, behavior still pending" — proposed: *"AI replies activate in a future update. Your configuration is saved."*

- [ ] **Defaults for existing services** — `ALTER TABLE ... ADD COLUMN ai_sales_enabled BOOLEAN DEFAULT FALSE` means existing rows get `ai_sales_enabled = false` automatically. Confirm this is the desired default (most likely yes — opt-in feature).

## File map

### NEW

```
backend/migrations/
  └── 108_add_shop_services_ai_columns.sql       (or whatever the next number is — confirm)
```

### EDITED

```
backend/src/repositories/ShopServiceRepository.ts (or wherever shop_services queries live)
  → SELECT/INSERT/UPDATE include ai_sales_enabled, ai_tone, ai_suggest_upsells,
    ai_booking_assistance, ai_custom_instructions
  → snake_case ↔ camelCase mapping in the row → object transform

backend/src/domains/ServiceDomain/controllers/ServiceController.ts (or equivalent)
  → createService accepts: aiSalesEnabled, aiTone, aiSuggestUpsells, aiBookingAssistance,
    aiCustomInstructions
  → updateService same
  → validate aiTone is one of ['friendly', 'professional', 'urgent']
  → response shape includes the AI fields

frontend/src/services/api/services.ts
  → Add to ShopService:        aiSalesEnabled?, aiTone?, aiSuggestUpsells?,
                                aiBookingAssistance?, aiCustomInstructions?
  → Add to CreateServiceData:  same
  → Add to UpdateServiceData:  same
  → Type aiTone as: 'friendly' | 'professional' | 'urgent'

frontend/src/app/(authenticated)/shop/services/new/page.tsx
  → handleSubmit merges page-level AI state into the payload before calling createService:
      const payload = {
        ...data,
        aiSalesEnabled, aiTone, aiSuggestUpsells, aiBookingAssistance,
      };

frontend/src/app/(authenticated)/shop/services/[serviceId]/edit/page.tsx
  → Same submit-merge as above
  → Load effect: when service is fetched, seed page-level AI state from the response
      setAiEnabled(data.aiSalesEnabled ?? false);
      setAiTone(data.aiTone ?? 'professional');
      setAiSuggestUpsells(data.aiSuggestUpsells ?? false);
      setAiBookingAssistance(data.aiBookingAssistance ?? false);

frontend/src/components/shop/service/AISalesAssistantSection.tsx
  → Update the disclosure badge wording (per "Scope decisions" above)
```

### UNTOUCHED

- `ServiceForm.tsx` — stays as-is. Page-level submit wrapping is enough; we don't need ServiceForm to know about AI fields.
- `ServiceFormPreview.tsx` — already reads `aiEnabled` prop from the page. No change needed.
- `aiPreviewMocks.ts` — sample replies stay hardcoded for Phase 2. Replaced by live Claude calls in Phase 3.
- `CreateServiceModal.tsx` — still in repo from Phase 1; unaffected by Phase 2.

## Task list

### Task 1 — Migration `108_add_shop_services_ai_columns.sql` (~10 min)

Confirm the next available migration number first (`ls backend/migrations/ | tail -5`). If 107 is taken, bump.

```sql
-- Add AI Sales Assistant configuration columns to shop_services.
-- All defaults make existing services opt out; per-service opt-in via the
-- AI Sales Assistant section on the create/edit page.

ALTER TABLE shop_services
  ADD COLUMN IF NOT EXISTS ai_sales_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_tone VARCHAR(20) DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS ai_suggest_upsells BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_booking_assistance BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_custom_instructions TEXT;

-- Enforce valid tones at the DB level. CHECK is NOT VALID at first to skip
-- the existing-row scan (rows we just inserted have the default 'professional'
-- which is valid), then VALIDATE to lock it in.
ALTER TABLE shop_services
  ADD CONSTRAINT chk_shop_services_ai_tone
  CHECK (ai_tone IN ('friendly', 'professional', 'urgent'))
  NOT VALID;

ALTER TABLE shop_services
  VALIDATE CONSTRAINT chk_shop_services_ai_tone;

COMMENT ON COLUMN shop_services.ai_sales_enabled IS
  'Whether the AI Sales Assistant is enabled for this service. Default false (opt-in).';
COMMENT ON COLUMN shop_services.ai_tone IS
  'Tone for AI responses. One of: friendly, professional, urgent.';
COMMENT ON COLUMN shop_services.ai_suggest_upsells IS
  'Whether the AI should mention related services from the same shop.';
COMMENT ON COLUMN shop_services.ai_booking_assistance IS
  'Whether the AI should help customers book appointments inline.';
COMMENT ON COLUMN shop_services.ai_custom_instructions IS
  'Optional shop-authored instructions that customize AI behavior for this service.';
```

**Acceptance:** migration runs cleanly on staging; existing services have `ai_sales_enabled=false` and `ai_tone='professional'`.

### Task 2 — Backend types + repository (~30 min)

In whatever file holds the `ShopService` interface backend-side:

```typescript
export interface ShopServiceRow {
  // ... existing fields
  ai_sales_enabled: boolean;
  ai_tone: 'friendly' | 'professional' | 'urgent';
  ai_suggest_upsells: boolean;
  ai_booking_assistance: boolean;
  ai_custom_instructions: string | null;
}
```

In the repository (`backend/src/repositories/ShopServiceRepository.ts` or similar):

- `SELECT *` queries should pick up the new columns automatically; if the repo uses explicit column lists, append the new ones
- `INSERT` / `UPDATE` statements need new placeholders for the AI fields
- The row-to-domain-object mapper translates `ai_sales_enabled → aiSalesEnabled`, etc.

**Acceptance:** GET returns AI fields; POST/PUT persist them; DB query log shows the new columns.

### Task 3 — Backend controller — accept + validate (~20 min)

In `ServiceController.ts` (or wherever the create/update handlers live):

```typescript
const VALID_TONES = ['friendly', 'professional', 'urgent'] as const;

// Inside createService / updateService:
const {
  // ... existing destructured fields
  aiSalesEnabled,
  aiTone,
  aiSuggestUpsells,
  aiBookingAssistance,
  aiCustomInstructions,
} = req.body;

// Validate tone if provided (defaults are fine, only validate non-default writes)
if (aiTone !== undefined && !VALID_TONES.includes(aiTone)) {
  return res.status(400).json({ error: `aiTone must be one of: ${VALID_TONES.join(', ')}` });
}

// Optional: cap ai_custom_instructions length (e.g., 2000 chars) to prevent
// abuse — shop owners shouldn't paste megabytes of text here.
if (aiCustomInstructions && aiCustomInstructions.length > 2000) {
  return res.status(400).json({ error: 'aiCustomInstructions must be 2000 characters or less' });
}

// Pass through to repository — let the DB defaults handle undefined values.
```

**Acceptance:** invalid tone returns 400; valid create/update round-trip persists.

### Task 4 — Frontend types (~10 min)

`frontend/src/services/api/services.ts`:

```typescript
export type AITone = 'friendly' | 'professional' | 'urgent';

export interface ShopService {
  // ... existing fields
  aiSalesEnabled?: boolean;
  aiTone?: AITone;
  aiSuggestUpsells?: boolean;
  aiBookingAssistance?: boolean;
  aiCustomInstructions?: string | null;
}

export interface CreateServiceData {
  // ... existing fields
  aiSalesEnabled?: boolean;
  aiTone?: AITone;
  aiSuggestUpsells?: boolean;
  aiBookingAssistance?: boolean;
  aiCustomInstructions?: string | null;
}

export interface UpdateServiceData {
  // ... existing fields (same additions)
}
```

The existing `AITone` type in `aiPreviewMocks.ts` should be re-exported from here OR the import in `AISalesAssistantSection.tsx` should switch to the canonical types in `services.ts`. Pick one; don't duplicate.

**Acceptance:** TypeScript compiles; all consumers of ShopService get the new optional fields.

### Task 5 — Wire up submit on the new + edit pages (~20 min)

`frontend/src/app/(authenticated)/shop/services/new/page.tsx`:

```tsx
const handleSubmit = async (data: CreateServiceData | UpdateServiceData) => {
  const payload: CreateServiceData = {
    ...(data as CreateServiceData),
    aiSalesEnabled: aiEnabled,
    aiTone,
    aiSuggestUpsells,
    aiBookingAssistance,
  };
  const created = await createService(payload);
  // ... rest unchanged
};
```

Same wrapper in the edit page's `handleSubmit`. The page already owns the AI state from Phase 1 — we're just passing it through to the API now instead of dropping it.

**Acceptance:** create a new service with AI enabled, check the DB row has the AI columns set; edit it, change tone, save, confirm DB updated.

### Task 6 — Edit page seeds AI state from loaded service (~15 min)

`frontend/src/app/(authenticated)/shop/services/[serviceId]/edit/page.tsx`:

In the existing load effect, after `setService(data)` and `setPreviewData({...})`, also seed AI state:

```tsx
setAiEnabled(data.aiSalesEnabled ?? false);
setAiTone(data.aiTone ?? 'professional');
setAiSuggestUpsells(data.aiSuggestUpsells ?? false);
setAiBookingAssistance(data.aiBookingAssistance ?? false);
```

**Acceptance:** edit a service that has AI enabled → reload the edit page → AI section shows the saved state, not defaults.

### Task 7 — Update the disclosure badge wording (~5 min)

`frontend/src/components/shop/service/AISalesAssistantSection.tsx`:

```tsx
<p className="text-xs text-gray-500 italic">
  AI replies activate in a future update. Your configuration is saved.
</p>
```

(Or whatever wording wins the "Scope decisions" question above.)

**Acceptance:** badge text reflects the new "saved-but-not-yet-active" state.

### Task 8 — Backfill existing services? (skip — defaults handle it)

Migration 108's `DEFAULT FALSE` and `DEFAULT 'professional'` clauses mean existing rows already have correct values after the migration runs. No backfill task required. Leaving this here as a "we explicitly considered and rejected backfill" note for future readers.

## Total effort

| Task | Effort |
|---|---|
| 1. Migration 108 | ~10 min |
| 2. Backend types + repository | ~30 min |
| 3. Backend controller — accept + validate | ~20 min |
| 4. Frontend types | ~10 min |
| 5. Wire up submit on both pages | ~20 min |
| 6. Edit page seeds AI state from server | ~15 min |
| 7. Disclosure badge wording | ~5 min |
| **Total** | **~110 min (~2 hr)** |

## Testing checklist

### Backend

- [ ] Migration 108 runs cleanly on a staging DB with existing services
- [ ] Existing services have correct defaults (`ai_sales_enabled=false`, `ai_tone='professional'`)
- [ ] CHECK constraint rejects invalid tone (`UPDATE ... SET ai_tone='loud'` fails)
- [ ] `POST /api/services` with `aiSalesEnabled: true, aiTone: 'friendly'` persists correctly
- [ ] `POST /api/services` with no AI fields uses defaults (false/'professional'/false/false/null)
- [ ] `POST /api/services` with `aiTone: 'invalid'` returns 400
- [ ] `PUT /api/services/:id` with new AI values overwrites
- [ ] `PUT /api/services/:id` without AI fields leaves existing AI values intact (be explicit about merge vs overwrite — pick one)
- [ ] `GET /api/services/:id` response includes AI fields
- [ ] `aiCustomInstructions: '<2000 char string>'` accepted; `>2000` rejected with 400

### Frontend

- [ ] Create page → toggle AI on → pick tone Friendly → check both checkboxes → submit → toast success → DB row reflects all 4 values
- [ ] Edit page → AI section pre-fills with saved values (not defaults)
- [ ] Edit page → toggle AI off → save → reload → AI section is off
- [ ] Edit page → change tone → save → reload → tone matches
- [ ] Disclosure badge wording reflects "configuration is saved"

### Smoke tests

- [ ] Existing services without AI fields render correctly (defaults from migration)
- [ ] Live preview's AI bot badge appears/disappears as user toggles in real time (already worked in Phase 1, regression-check it still does)
- [ ] No console errors on either new or edit page
- [ ] Form submission round-trip latency unchanged

## Rollback plan

Phase 2 is split across 3 layers (DB, backend, frontend). Each rolls back independently.

| Layer | If broken | Rollback action |
|---|---|---|
| Migration 108 | DB columns unusable | Don't drop columns (data loss). Stop reading/writing them in code by reverting Tasks 2-3, then leave the columns in place. They're nullable/defaulted; harmless. |
| Backend controller / repo | API rejects valid requests | `git revert` Tasks 2-3. Frontend continues sending AI fields; backend ignores them; AI state silently drops on save (back to Phase 1 behavior). No 500s. |
| Frontend submit-merge | Page can't save | `git revert` Task 5. Pages send only the existing fields. Backend already handles the case where AI fields are absent. |
| Frontend edit pre-fill | AI section shows wrong defaults | `git revert` Task 6. AI section starts at defaults; user re-configures and re-saves. |
| Disclosure badge wording | Misleading copy | One-line text edit. |

The safest order to ship is **migration → backend → frontend types → frontend submit-merge → edit pre-fill → badge wording**. Each step is forward-compatible: a half-shipped state is "old behavior + new column" rather than "broken UI."

## Out of scope (defer to Phase 2.5 or Phase 3)

- UI for `ai_custom_instructions` — column is added in Phase 2 but no textarea exposed yet
- Per-shop `ai_shop_settings` table (global enable, monthly budget cap, etc.) — Phase 3
- Live Anthropic API previews replacing `aiPreviewMocks.ts` — Phase 3
- AI badge on customer-facing service detail page — Phase 3 once replies actually exist
- Audit log table `ai_agent_messages` — Phase 3

## Suggested execution order

If you have one focused 2-hour block:

1. Tasks 1 → 2 → 3 (backend in one shot, gets staged immediately)
2. Push the backend; verify staging migration applied via `psql` or admin tool
3. Tasks 4 → 5 → 6 → 7 (frontend, all in one PR)
4. Push frontend
5. Smoke test on staging
6. Same `main → prod` chain we used for Phase 1

If you want to split: backend-only PR first (just Tasks 1-3) goes live silently — no UI consumes the new fields yet, so it's invisible to users. Then frontend PR a day later. Slower but lower-risk if the migration has any surprises.

## Connection to Phase 3

When Phase 3 (Claude integration) ships, the columns this phase added are exactly what `ContextBuilder.ts` reads to build the system prompt per-service. No additional schema needed at that layer. Phase 3 adds the new tables (`ai_agent_messages`, `ai_shop_settings`) but the service-level config you're persisting in Phase 2 is the durable foundation.

---

# Phase 2.5 — Stakeholder copy iteration (exec request 2026-05-01)

**Status:** ✅ **Implementation complete (2026-05-01)** — applied locally on `deo/dev`. Not yet committed (per user's commit-only-when-asked policy). See "Phase 2.5 implementation log" at the end of this section.
**Effort:** ~45 min total (actual: ~20 min — pure text edits, no logic)
**Blocker:** None — pure copy/UX, no backend or schema changes
**Trigger:** Exec request to make the AI Sales Assistant section feel more conversion-focused before Phase 3 ships

## Context

Exec reviewed the current Phase 1 + Phase 2 UI and asked for changes to lift visual conversion impact:

1. Rename label from "AI Sales Assistant" to "Auto Sales & Booking" (de-emphasizes the AI buzzword, emphasizes the outcome)
2. Tighten the description: *"Automatically replies, answers questions, books and increases sales"*
3. Add a micro-proof line under the toggle showing key value props (24/7, books customers, replies fast)
4. Rewrite the "See How the AI Replies" preview from short generic replies to **4 narrative messages per tone** showing booking flow, urgency, social proof — preview currently "feels safe", should feel like real sales conversations

## ⚠️ Honesty note (read before locking decisions)

The exec's proposed micro-proof was *"Replies in seconds · Books customers · Works 24/7"*.

Until Phase 3 ships (Anthropic Claude integration, gated on API key), the AI does not actually reply, book, or run 24/7. Configuration is saved (Phase 2) but no runtime behavior is active. Shipping these claims today creates expectation mismatch with shop owners — they'll toggle it on, expect replies, get nothing, complain.

### Decision lock before starting — micro-proof wording

| Option | Wording | Tradeoff |
|---|---|---|
| A — Defer | (Don't add the line until Phase 3 ships) | No false promise; loses exec's visual conversion lift |
| **B — Honest reword (recommended)** | *"Configure once · Saved automatically · Activates next release"* | Same emotional hook, doesn't promise behavior we don't have yet |
| C — Add with "Coming soon" badge | *"Replies in seconds · Books customers · Works 24/7 (coming soon)"* | Half-true; mixed message with the existing "activates in a future update" disclosure |

Recommend **Option B**. Sells the future without misrepresenting today.

## File map

### EDITED

```
frontend/src/components/shop/service/AISalesAssistantSection.tsx
  → Header title text: "AI Sales Assistant" → "Auto Sales & Booking"
  → Description: tighten wording per exec ask
  → Add micro-proof line below toggle (per chosen option above)

frontend/src/utils/aiPreviewMocks.ts
  → Rewrite all 9 mocked replies → 12 (3 tones × 4 messages each)
  → New content: each set of 4 messages forms a sales arc
```

### UNTOUCHED

- Backend code, types, migrations — unchanged
- Database schema — unchanged
- ServiceForm, ServiceFormPreview, ServiceFormLayout — unchanged
- Page-level state and submit logic — unchanged
- Phase 2 persistence behavior — intact

## Tasks

### Task 1 — Header label, description, micro-proof line (~10 min)

In `AISalesAssistantSection.tsx`:

```diff
- <h3 className="...">AI Sales Assistant</h3>
+ <h3 className="...">Auto Sales & Booking</h3>

- <p className="text-sm text-gray-600 mb-4">
-   Automatically replies, answers questions, and books customers for this service.
- </p>
+ <p className="text-sm text-gray-600 mb-4">
+   Automatically replies, answers questions, books and increases sales.
+ </p>

  {/* New micro-proof line — placement: between description and "Disabled hint" */}
+ <p className="text-xs text-gray-600 font-medium mb-4">
+   Configure once · Saved automatically · Activates next release
+ </p>
```

If the team picks Option A or C from the decision table, swap the micro-proof text accordingly. If Option A, omit the line entirely.

**Acceptance:** dev server shows updated header label, updated description, and (if A wasn't chosen) the micro-proof line above the configurable area.

### Task 2 — Rewrite preview mocks: 4 narrative messages per tone (~30 min)

Replace `aiPreviewMocks.ts` content. Structure each tone's array as a 4-message sales arc that feels like a real conversation, not a sample reply:

- **Message 1 — Greet + qualify** ("yes we do this; tell me more / want to book?")
- **Message 2 — Address concern + offer to book** (price, duration, common objection)
- **Message 3 — Urgency cue + social proof** (limited slots / "popular this week" / "5-star review last week")
- **Message 4 — Confirm next step + handoff** ("locking it in / you'll get a confirmation text / our team will reach out")

**Tone differences:**
- **Friendly:** casual, contractions, energetic ("Hey!", "totally", "no worries", "awesome")
- **Professional:** formal, factual, third-person ("Our shop offers...", "We can confirm...", "Estimated turnaround...")
- **Urgent:** time-pressure, scarcity, immediacy ("Same-day spots fill fast", "Booking today...", "Open spot if you act now")

**Sample structure (Friendly tone — Professional + Urgent follow same arc, different vocabulary):**

```ts
friendly: [
  "Hey! Yeah, we totally do this — it's one of our most popular services. Want a quick rundown or jump straight to booking?",
  "Most folks worry about the price, totally fair. We're $89 and most jobs wrap in 30 mins. Want me to grab you a slot this week?",
  "Heads up — we usually get booked out by Wednesday for stuff like this. Got 2 spots open Friday afternoon if you'd like to lock one.",
  "Awesome — locking your slot in now. You'll get a confirmation text, and we'll text you 30 mins before. Anything else I can help with?",
],
professional: [
  "Yes, our shop offers this service. Most appointments wrap up in 30 minutes. Would you like to schedule, or do you have questions first?",
  "Standard pricing for this service is $89. We honor our 30-day workmanship guarantee on all repairs. Shall I check available times?",
  "Two appointment slots remain open this week. Friday afternoon at 2:00 PM is currently available if you'd like to confirm.",
  "Your appointment is confirmed. A confirmation will be sent shortly, and we will follow up 30 minutes prior to your booking.",
],
urgent: [
  "Same-day spot just opened — we can fit this in if you book in the next 30 minutes. Want me to lock it?",
  "$89, under an hour, done today. Slots after 4 PM are usually gone by lunchtime — interested?",
  "3 people booked this exact service today already. One spot left at 5 PM. Tomorrow's already half-full.",
  "Booked. You'll get a confirmation text within 60 seconds. We'll see you at 5 PM today — please arrive 5 minutes early.",
],
```

Replace the values shown in `friendly`, `professional`, and `urgent` keys. Keep the export shape (`Record<AITone, string[]>`) and the `AITone` re-export unchanged so `AISalesAssistantSection.tsx` keeps working without edits.

**Acceptance:** dev server shows the 4-message arc per tone; switching tones swaps the entire 4-message set, not just one message.

### Task 3 — Disclosure badge consistency check (~5 min)

After Task 1's wording is locked in, verify the bottom-of-section disclosure badge still reads consistently with the new top-of-section copy.

Current bottom disclosure (post-Phase 2):
> *"AI replies activate in a future update. Your configuration is saved."*

| Top wording (chosen) | Bottom disclosure | Consistent? |
|---|---|---|
| Option A (no micro-proof) | (unchanged) | ✅ |
| Option B (Configure once · Saved automatically · Activates next release) | (unchanged) | ✅ — both messages reinforce "saved now, activates later" |
| Option C (Replies in seconds · ... (coming soon)) | (unchanged) | ⚠️ Mixed — top promises "in seconds", bottom says "in a future update". Either drop "coming soon" from top or update bottom. |

If Option C: also update bottom disclosure to e.g., *"Activates in a future update — your configuration is saved."* to remove the contradiction. Otherwise no edit needed.

**Acceptance:** top and bottom of the AI section tell a consistent story.

## Total effort

| Task | Effort |
|---|---|
| 1. Label + description + micro-proof | ~10 min |
| 2. Preview mocks rewrite (12 messages, 3 tones × 4) | ~30 min |
| 3. Disclosure badge consistency check | ~5 min |
| **Total** | **~45 min** |

## Testing checklist

- [ ] Header reads "Auto Sales & Booking" with the existing NEW badge alongside
- [ ] Description text matches exec's exact phrasing
- [ ] Micro-proof line visible under toggle (per chosen option) — or absent if Option A
- [ ] Friendly tone preview shows 4 messages forming a sales arc (greet → concern → urgency → confirm)
- [ ] Professional tone shows same arc with formal vocabulary
- [ ] Urgent tone shows same arc with time-pressure vocabulary
- [ ] Switching tones swaps **all 4 messages**, not just the first
- [ ] Sample replies render correctly in light-mode card (no overflow, readable contrast)
- [ ] No TypeScript errors
- [ ] **No regressions:** toggle/tone/checkbox state still persists on save (Phase 2 behavior intact)
- [ ] Bottom disclosure badge still reads consistently with top wording

## Rollback

Pure UI text. Each file rolls back independently:

| Layer | Rollback action |
|---|---|
| Header/description/micro-proof | `git revert` the `AISalesAssistantSection.tsx` commit |
| Preview mocks | `git revert` the `aiPreviewMocks.ts` commit |

No DB, no backend, no schema impact. ~2 min to roll back if exec changes their mind.

## Out of scope (defer)

These came up during discussion but are pushed to Phase 3 or later:

- **`ai_custom_instructions` UI textarea** — would partially address exec's "every item should be sold differently" ask before Phase 3 ships. ~30 min add. Defer unless exec specifically requests it; column is already in DB (migration 108) so frontend can wire it up anytime.
- **Live Anthropic preview** (replacing mocks with real Claude calls) — Phase 3.
- **Per-shop / per-service A/B testing of tone variants** — Phase 3 + analytics.
- **Conversion analytics dashboard** — Phase 3 (`AdminAgentController.ts` per strategy doc).
- **Brand-voice copywriting pass** on the 4-message arcs — if marketing/comms want professional copywriter input on the Professional + Urgent variants. The samples in Task 2 are engineer-drafted; can be replaced with copywriter output without touching code structure.

## Decisions to lock before starting

- [ ] **Micro-proof wording** — pick Option A / B / C from the decision table. Recommend B.
- [ ] **Header label** — confirm "Auto Sales & Booking" is the final wording (drops "AI" framing — could conflict with positioning if marketing wants AI featured prominently).
- [ ] **Description text** — confirm exact phrasing: *"Automatically replies, answers questions, books and increases sales"* (current draft from exec message).
- [ ] **4-message preview tone copy** — engineer-drafted samples are in Task 2; confirm or have copywriter rewrite before code lands.

## Connection to Phase 3

This phase is purely cosmetic. When Phase 3 ships and replaces `aiPreviewMocks.ts` with live Claude API calls, the 4-message structure may need rethinking — Claude generates one reply per customer message, not a 4-step pre-scripted arc. Phase 3's preview will show what Claude *would* reply to a sample customer question for that service + tone, which is qualitatively different. The Phase 2.5 mocks are explicitly "marketing demo content", not "what the AI will actually do".

Worth flagging: if the team falls in love with the 4-message demo and wants Phase 3 to preserve that exact narrative arc, that's an extra ask for Phase 3 (probably needs a multi-turn simulated conversation, not a single Claude call).

The Phase 2.5 mocks **encode the tone signature** (emoji density, urgency vocabulary, time-slot specificity) that Phase 3 system prompts should preserve so live Claude replies feel consistent with what shop owners previewed during configuration.

---

## Phase 2.5 implementation log (2026-05-01)

What was actually applied. The plan held up; one deviation flagged below.

### Files edited (matches plan)

```
frontend/src/components/shop/service/AISalesAssistantSection.tsx
  - Header text: "AI Sales Assistant" → "Auto Sales & Booking"
  - Description: "Automatically replies, answers questions, and books customers
    for this service." → "Automatically replies, answers questions, books and
    increases sales."
  - Added micro-proof line below description (Option B wording):
    "Configure once · Saved automatically · Activates next release"
  - aria-label updated to match new label ("Disable Auto Sales & Booking" /
    "Enable Auto Sales & Booking")
  - Description's bottom margin tightened from mb-4 to mb-2 to give the new
    micro-proof line room to breathe at mb-4

frontend/src/utils/aiPreviewMocks.ts
  - Replaced 9 short replies (3 tones × 3 messages) with 12 narrative messages
    (3 tones × 4-message sales arc)
  - Each arc: Greet+Qualify → Address Concern → Urgency+Social Proof → Confirm+Handoff
  - Export shape unchanged (Record<AITone, string[]>) — no consumer changes
```

### Decisions locked

- **Micro-proof wording:** Option B — *"Configure once · Saved automatically · Activates next release"*. Honest reword, doesn't promise Phase 3 behavior.
- **Header label:** "Auto Sales & Booking" (drops AI buzzword, keeps the green Sparkles "NEW" badge so the section still reads as a flagship feature).
- **Description text:** *"Automatically replies, answers questions, books and increases sales."* — exact phrasing from exec.
- **4-message preview tone copy:** engineer-drafted, applied as-is. No copywriter pass yet.

### Deviations from the plan

**1. Mocks went beyond the plan's draft — pushed further with emoji + time slots + sharper urgency**

Plan's Task 2 had engineer-drafted samples that were narrative but plain text ("locking your slot in now"). User asked mid-session to "make it feel like YOUR real messages" with specific instructions: **add emojis, urgency, time slots**. The shipped mocks pushed all three further than the plan's draft:

- **Friendly** — added emojis 👋 💯 ⏰ ✅ 😊; embedded specific times ("Thursday at 2:30 PM", "Friday 4:00 PM"); kept casual urgency ("we're booked solid Mon-Wed already")
- **Professional** — sparse emoji (✅ once); kept formal urgency ("typically book within 24 hours"); embedded precise times ("Thursday 2:30 PM", "Friday 11:00 AM")
- **Urgent** — heavy urgency emoji (🔥 ⚡ ⏰ 🎯); hard time pressure ("next 15 minutes", "ONE spot left at 5:30 PM", "Tomorrow's 80% full")

Result: previews now feel like authentic AI sales messages instead of lorem-ipsum demo content. Tone differentiation is sharper — switching from Friendly → Urgent in the segmented control feels qualitatively different, not just "same message, slightly different words".

The doc's Connection-to-Phase-3 section was updated to flag that Phase 3 system prompts should encode this tone signature (emoji density, urgency vocabulary, time-slot specificity) so live Claude replies feel consistent with what shop owners previewed during configuration.

### Final state summary

| Metric | Value |
|---|---|
| Files edited | 2 |
| Lines added | ~50 |
| Lines removed | ~10 |
| TypeScript errors introduced | 0 |
| New dependencies | 0 |
| Backend changes | 0 (Phase 2.5 is FE-only) |
| DB changes | 0 |
| Committed? | **No** — applied locally on `deo/dev`, awaiting user's commit instruction |

### Outstanding items

- **Local smoke test** — user to run `/shop/services/new` and `/shop/services/[id]/edit`, cycle through Friendly / Professional / Urgent, confirm:
  - Header reads "Auto Sales & Booking" with green "NEW" badge alongside
  - Micro-proof line visible below description
  - 4 messages swap as a set per tone (not just one)
  - Toggle/checkbox/tone state still persists on save (Phase 2 regression check)
- **Commit + push** — pending user go-ahead. Recommend a single commit covering both files with a short message like `chore(ai-sales): apply Phase 2.5 copy iteration (label, description, micro-proof, narrative mocks)`.

---

## Phase 3 preview (NOT for this task)

Build `AIAgentDomain` per the strategy doc. Get Anthropic API key, hook into `MessageService`, ship MVP. Track in a separate task doc:
`docs/tasks/strategy/ai-sales-agent/ai-sales-agent-claude-integration-plan.md` (TODO when ready).

Estimated 3-4 weeks engineering effort per the strategy doc's Phase 1 MVP scope.

---

## Suggested next action

Start with **Task 1** — extract `ServiceForm.tsx` from the modal. It's the foundation; everything else depends on it. Once that compiles, the rest of Phase 1 is mostly mechanical.

If preferred, do **Task 4 first** as a thin scaffold (just the page layout, no form yet) so the route exists and reviewers can see the structure before form internals come in. Then come back and do Task 1.

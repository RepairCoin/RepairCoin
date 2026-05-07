# CampaignBuilderModal — Mobile Restructure Plan

**File:** `frontend/src/components/shop/marketing/CampaignBuilderModal.tsx` (1733 lines)
**Date:** 2026-05-07
**Goal:** Make the 3-step campaign builder wizard usable on mobile (<640px) without changing desktop layout or business logic.

---

## Current state (key facts)

- Three steps in one Dialog: `design` → `audience` → `delivery` (state at line 223).
- Dialog shell already goes full-screen on mobile (`w-screen h-[100dvh]` line 1199).
- The **Design step** (line 1283) uses a `flex-col lg:flex-row` split: top = preview, bottom = a 320px editor panel with `max-h-[50vh]` on mobile. That cramped split is the main mobile failure.
- Editor panel has `Tabs` with **Blocks** (add elements, sortable list with `@dnd-kit`) and **Edit** (per-block styling) — lines 1346–1438.
- Header (line 1204) holds two primary actions: "Save Draft" + "Select Audience" with `hidden sm:inline` labels — bare icons on mobile.
- Step indicator (line 1261) is a centered horizontal row of three pills.
- Audience step (line 1445) — filters/sort/search/select-all/list/pagination — partially responsive.
- Delivery step (line 1637) is already fairly clean.

## Pain points on mobile (<640px)

1. **Design split** — 50/50 squeeze means neither preview nor editor is usable.
2. **Tapping a block in preview** sets `activeTab='style'` (lines 666, 681, 691, 714, 748, 782, 792) — but on mobile the editor panel may be off-screen, so user has no signal anything happened.
3. **Header actions** are bare icons; "Next" competes with "Save" in tight space.
4. **Step indicator** is informational on mobile but eats ~40px vertical.
5. **Drag handles** (16px GripVertical) are below tap-target size.
6. **Audience filter row** consumes ~200px before the customer list appears.
7. **Customer list `max-h-[350px]`** wastes available mobile height.

## Proposed pattern

Switch the design step from "split panel" to **"view switcher"** on mobile via a 2-tab control: **Preview** / **Edit**.
Replace cramped header actions with a **sticky bottom bar** for primary actions per step. Keep desktop layout pixel-identical.

### Design step on mobile
- Default = Preview (full bleed).
- Tapping a block in preview switches to Edit view with that block selected.
- Edit view shows existing Tabs (Blocks / Edit) for adding & styling.

### Bottom action bar on mobile
- Replaces header buttons + inline step nav buttons.
- Per-step primary action:
  - Design: `Save Draft` + `Next: Audience`
  - Audience: `Back` + `Next: Delivery`
  - Delivery: `Save Draft` + `Send Now`
- Uses `pb-[env(safe-area-inset-bottom)]` for iOS safe area.

### Step indicator on mobile
- Single line: `Step 2 of 3 · Audience` + thin progress bar (clickable to jump back).

### Audience step on mobile
- Customer list height: `lg:max-h-[350px]` (desktop cap, flex-1 mobile).
- Keep filter row's existing `flex-wrap`; tighten gaps.

### Delivery step on mobile
- Move "Save Draft / Send Now" out of inline footer into the sticky bottom bar.

## Concrete change list

| # | Change | Approx lines |
|---|--------|------|
| 1 | Add `mobileView` state (`'preview' \| 'editor'`). | ~226 |
| 2 | Replace design-step split: keep `lg:flex-row`; mobile shows one panel via `hidden lg:block`. Add mobile segmented control. | 1283–1442 |
| 3 | Preview block click handlers also `setMobileView('editor')`. | 666, 681, 691, 714, 748, 782, 792 |
| 4 | `handleAddBlock` also `setMobileView('editor')`. | 485 |
| 5 | Hide header primary actions on mobile (`hidden sm:flex`). | 1227–1256 |
| 6 | Add `<MobileBottomBar>` rendered per-step, sticky bottom. | new, end of step content |
| 7 | Replace step indicator on mobile with `Step N of 3 · {label}` + progress bar. | 1261–1278 |
| 8 | Wrap GripVertical in 32×32 touch target. | 190–197 |
| 9 | Audience filter row: tighten spacing. | 1452 |
| 10 | Customer list: `lg:max-h-[350px]`, `flex-1` on mobile. | 1515 |
| 11 | Hide audience inline nav buttons on mobile (`hidden sm:flex`). | 1615–1633 |
| 12 | Hide delivery inline nav buttons on mobile (`hidden sm:flex`). | 1696–1727 |

## What will NOT change

- Business logic (state, save/send, customer loading, promo codes, DnD reorder logic).
- Desktop layout `lg:` and above — pixel-identical.
- Default blocks, color presets, validation rules.
- API calls / props contract.

## Verification

- Resize to 375px, 390px, 768px, 1024px, 1280px+.
- Walk all 3 steps for each `campaignType`.
- Test: add block, drag-reorder, edit each block type, delete block, viewOnly mode, existing-campaign edit mode.
- Confirm sticky bottom bar doesn't clip inputs when keyboard is open (`100dvh` already used).

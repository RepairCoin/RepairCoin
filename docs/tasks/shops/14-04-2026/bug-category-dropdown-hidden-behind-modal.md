# Bug: Category Dropdown Hidden Behind Create Service Modal

## Status: Open
## Priority: High
## Date: 2026-04-14
## Category: Bug - UI / z-index
## Location: Shop > Services > Create New Service modal > Category dropdown

---

## Problem

When clicking the Category dropdown in the "Create New Service" modal, the dropdown options do not appear. The dropdown is rendering behind the modal because the modal's z-index (`z-[1100]`) is higher than the Radix Select portal's z-index (`z-50`).

---

## Root Cause

**z-index mismatch between the modal and the Select dropdown portal.**

| Element | z-index | File |
|---------|---------|------|
| CreateServiceModal backdrop | `z-[1100]` | `frontend/src/components/shop/modals/CreateServiceModal.tsx:137` |
| SelectContent (Radix portal) | `z-50` | `frontend/src/components/ui/select.tsx:85` |

The Radix `SelectContent` renders via a **portal** (appended to `<body>`), so it escapes the modal's DOM tree. But its `z-50` (z-index: 50) is far below the modal's `z-[1100]` (z-index: 1100), so the dropdown appears behind the modal overlay.

---

## Introduced By

**Commit:** `d6ff0608` — April 10, 2026
**Author:** tavie (taviefalcon@yahoo.com)
**Message:** "fix: make CreateServiceModal responsive and fix z-index overlap with header icons"

The modal's z-index was changed from `z-50` to `z-[1100]` to sit above the DashboardLayout header icons (`z-[1001]`). This fixed the header overlap but broke all portal-based dropdowns inside the modal.

```diff
- <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
+ <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[1100] sm:p-4">
```

---

## Fix Options

### Option A: Increase SelectContent z-index (Recommended)

Update the `SelectContent` component to use a z-index higher than the modal:

**File:** `frontend/src/components/ui/select.tsx` (line 85)

```diff
- "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-xl shadow-lg",
+ "relative z-[1200] max-h-96 min-w-[8rem] overflow-hidden rounded-xl shadow-lg",
```

**Pros:** Simple, fixes all Select dropdowns inside any modal.
**Cons:** May need to check other portal-based components (Dialog, Popover, etc.) for similar issues.

### Option B: Lower the modal z-index

Reduce the modal z-index and fix the header overlap differently (e.g., lower the header z-index too).

**Pros:** Keeps z-index values reasonable.
**Cons:** More files to change, may re-introduce the original header overlap bug.

### Option C: Use Radix `container` prop

Pass a container ref to `SelectPrimitive.Portal` so the dropdown renders inside the modal's DOM tree instead of `<body>`, inheriting the modal's stacking context.

**Pros:** No z-index hacking needed.
**Cons:** More complex, may affect positioning calculations.

---

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/ui/select.tsx` | Increase `z-50` to `z-[1200]` on SelectContent |

---

## QA Verification

- [ ] Create New Service modal → Category dropdown opens and shows all options
- [ ] Dropdown items are clickable and selection works
- [ ] Dropdown does not appear behind modal or header
- [ ] Other modals with Select dropdowns also work (check Edit Service modal)
- [ ] Header icons still render correctly (not overlapping modal)

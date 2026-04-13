# Bug: Group Rewards Input Fires API Call on Every Keystroke

## Status: Open
## Priority: High
## Date: 2026-04-13
## Category: Bug - UI / API
## Location: Shop > Service Details Modal > Group Rewards tab

---

## Summary

When editing the "Token Reward Percentage" or "Bonus Multiplier" inputs on the Group Rewards tab, every keystroke triggers an immediate API call to `PUT /api/services/{serviceId}/groups/{groupId}/rewards`. Clearing the field or typing intermediate values sends invalid data (`NaN`/`null`) to the backend, causing a 500 error and an alert popup: "Failed to update reward settings."

---

## Root Cause

**File:** `frontend/src/components/shop/ServiceGroupSettings.tsx` (lines 184, 205)

Both inputs bind `onChange` directly to `handleUpdateRewards()`, which fires an API call:

```typescript
// Line 184 - Token Reward Percentage
onChange={(e) => handleUpdateRewards(group.groupId, parseFloat(e.target.value), link.bonusMultiplier)}

// Line 205 - Bonus Multiplier
onChange={(e) => handleUpdateRewards(group.groupId, link.tokenRewardPercentage, parseFloat(e.target.value))}
```

`handleUpdateRewards` immediately calls the API:

```typescript
const handleUpdateRewards = async (groupId: string, percentage: number, multiplier: number) => {
  try {
    await serviceGroupApi.updateServiceGroupRewards(serviceId, groupId, percentage, multiplier);
    await loadData();
    onUpdate?.();
  } catch (error) {
    console.error('Error updating rewards:', error);
    alert('Failed to update reward settings.');
  }
};
```

---

## How It Fails

**Scenario: User changes Token Reward from 100 to 200**

1. User selects "100" and deletes it to type new value
2. Field becomes empty → `parseFloat("") = NaN`
3. `NaN` serialized as `null` in JSON request body
4. Backend receives `tokenRewardPercentage: null` → `parseFloat(null) = NaN` → validation fails or throws 500
5. Alert popup: "Failed to update reward settings."

Even when typing valid values, each keystroke fires a separate request (e.g., `2`, `20`, `200`), causing race conditions and unnecessary API load.

---

## Reproduction Steps

1. Login as shop owner
2. Go to any service → Service Details modal → Group Rewards tab
3. Click on the Token Reward Percentage input (currently shows a number like 200)
4. Select all text and delete it, or start typing a new number
5. **Observe**: Alert popup "Failed to update reward settings." appears immediately

---

## Fix Required

**File:** `frontend/src/components/shop/ServiceGroupSettings.tsx`

The inputs should use **local component state** for editing and only call the API when the user finishes editing (on `onBlur`) or presses Enter. Pattern:

1. Add local state to track in-progress edits per group (e.g., `editingRewards: Record<string, { percentage: string; multiplier: string }>`)
2. On focus: initialize local state from `link.tokenRewardPercentage` / `link.bonusMultiplier`
3. On change: update local state only (no API call)
4. On blur / Enter: validate the value, then call `handleUpdateRewards()` if valid and changed
5. Guard: skip API call if value is `NaN`, empty, out of range, or unchanged from original

---

## Affected Endpoint

| Method | Endpoint | Issue |
|--------|----------|-------|
| PUT | `/api/services/{serviceId}/groups/{groupId}/rewards` | Receives `NaN`/`null` values from rapid keystroke firing |

**Backend handler:** `ServiceGroupController.updateGroupRewards()` (lines 379-453)
- The backend validation correctly rejects invalid values with 400, but `parseFloat(null)` can also cause a 500 depending on execution path

---

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/shop/ServiceGroupSettings.tsx` | Use local state for inputs, fire API only on blur/Enter |

---

## QA Verification

- [ ] Type in Token Reward field without errors/popups
- [ ] Clear field and retype a new value without errors
- [ ] Value saves correctly on blur (clicking away from field)
- [ ] Value saves correctly on Enter key press
- [ ] No API calls fire while actively typing (check Network tab)
- [ ] Invalid values (negative, >500 for percentage, >10 for multiplier) show inline validation
- [ ] Bonus Multiplier input has same fix applied
- [ ] Existing values load correctly when opening the tab

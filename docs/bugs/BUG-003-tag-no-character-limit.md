# BUG-003: Service tags accept unlimited character length

**Type:** Bug
**Severity:** Low
**Priority:** P3
**Component:** Frontend - Shop Services
**Labels:** bug, frontend, validation, ui-overflow

---

## Description

The Service Tags input field has no character limit for individual tags. Users can enter extremely long tags that may cause UI overflow issues in service cards and details modals, and could affect database performance.

---

## Steps to Reproduce

1. Login as a shop owner with active subscription
2. Navigate to Shop Dashboard → Services tab
3. Click "Create New Service" button
4. Fill in required fields (name, category, price)
5. In the "Tags" section, enter a very long tag (50+ characters):
   ```
   thisisaverylongtagthatshouldhaveacharacterlimitbutdoesnot
   ```
6. Press Enter or click + to add the tag
7. Observe the tag display in the form and Live Preview
8. Save the service and view it in Service Marketplace
9. Click on service to view in details modal

---

## Expected Result

- Individual tags should have a maximum character limit (recommended: 20-30 characters)
- Long tags should be rejected or truncated on input
- UI should display tags consistently without overflow
- Error message when tag exceeds limit: "Tag cannot exceed 20 characters"

---

## Actual Result

- Tags accept unlimited characters
- Long tags display in full, causing potential UI overflow
- No character limit validation on input
- Long tags may wrap awkwardly or overflow containers

---

## Current Tag Validation (What IS Validated)

| Validation | Status | Location |
|------------|--------|----------|
| Maximum 5 tags | ✅ Enforced | Frontend only |
| No duplicate tags | ✅ Enforced | Frontend only |
| Trimmed whitespace | ✅ Enforced | Frontend only |
| Individual tag length | ❌ NOT Enforced | None |
| Backend tag count limit | ❌ NOT Enforced | None |

---

## Tag Usage in Application

Tags ARE actively used in the application for:

| Feature | Usage |
|---------|-------|
| **Autocomplete Search** | Tags searched in discovery endpoint |
| **Similar Services** | +10 points per matching tag in similarity algorithm |
| **Customer Service Cards** | Shows first 3 tags, "+N more" for additional |
| **Service Details Modal** | Shows all tags in golden badges |
| **Database Index** | GIN index for fast tag queries |

---

## Acceptance Criteria

- [ ] Individual tags limited to 20 characters maximum
- [ ] Character counter shown while typing tag (e.g., "15/20")
- [ ] Error message displayed when exceeding limit
- [ ] Backend validates individual tag length
- [ ] Backend validates maximum 5 tags (currently frontend-only)
- [ ] Long existing tags display with ellipsis if needed

---

## Technical Notes

**Files to modify:**
- `frontend/src/components/shop/modals/CreateServiceModal.tsx` - Add tag length validation
- `backend/src/domains/shop/services/ServiceManagementService.ts` - Add server-side validation

**Frontend Fix:**
```tsx
const handleAddTag = () => {
  const tag = tagInput.trim();
  if (!tag) return;

  // Add character limit validation
  if (tag.length > 20) {
    toast.error("Tag cannot exceed 20 characters");
    return;
  }

  const currentTags = formData.tags || [];
  if (currentTags.length >= 5) {
    toast.error("Maximum 5 tags allowed");
    return;
  }

  if (!currentTags.includes(tag)) {
    handleChange("tags", [...currentTags, tag]);
    setTagInput("");
  }
};
```

**Backend Fix:**
```typescript
// Validate tags array
if (tags && Array.isArray(tags)) {
  if (tags.length > 5) {
    throw new Error('Maximum 5 tags allowed');
  }
  for (const tag of tags) {
    if (tag.length > 20) {
      throw new Error('Individual tags cannot exceed 20 characters');
    }
  }
}
```

---

## Related Information

**Database Schema:**
- Column: `tags TEXT[] DEFAULT '{}'`
- Index: GIN index for array queries

**Display Locations:**
- Service cards: Shows first 3 tags with "+N more"
- Details modal: Shows all tags in golden badges
- Shop modal: Shows all tags in golden badges

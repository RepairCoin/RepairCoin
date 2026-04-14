# Bug: Discover Groups Only Shows First 20 Groups — No Pagination

## Status: Open
## Priority: Medium
## Date: 2026-04-14
## Category: Bug - UI / Pagination
## Location: Shop > Groups > Discover Groups tab

---

## Problem

The Discover Groups tab only displays the first 20 groups (default API page size). There are 121 groups in the database, but groups beyond the first page are invisible. No pagination controls, load more button, or infinite scroll exists. Older groups like "Test Group Name" (position 115) are completely inaccessible.

---

## Root Cause

**Frontend:** `ShopGroupsClient.tsx` line 64 calls `shopGroupsAPI.getAllGroups()` without pagination params. The API returns only page 1 (20 items).

**Backend:** `GET /api/affiliate-shop-groups` defaults to `page: 1, limit: 20`. It returns `pagination` metadata in the response, but the frontend ignores it.

---

## Fix Required

### 1. Pagination — Load More button (Recommended)
- Show "Load More" button at the bottom of the group list
- Each click fetches the next page and appends to the list
- Show total count: "Showing 20 of 121 groups"
- Disable button when all groups loaded

### 2. Search field
- Add a search input at the top of the Discover Groups tab
- Placeholder: "Search groups by name or token symbol..."
- Debounce input (300ms) to avoid excessive API calls
- Search should filter server-side (not client-side) to work with pagination
- Clear button to reset search

**Backend:** The `getAllGroups` repository query needs a `search` filter:

```sql
WHERE (group_name ILIKE $X OR custom_token_symbol ILIKE $X OR custom_token_name ILIKE $X)
```

**Frontend:** Pass search param to API:

```typescript
const result = await shopGroupsAPI.getAllGroups({ search: searchQuery, page, limit: 20 });
```

---

## Files to Modify

### Backend

| File | Change |
|------|--------|
| `backend/src/repositories/AffiliateShopGroupRepository.ts` | Add `search` filter to `getAllGroups()` query |
| `backend/src/services/AffiliateShopGroupService.ts` | Pass search param through |
| `backend/src/domains/AffiliateShopGroupDomain/controllers/GroupController.ts` | Extract `search` from query params |

### Frontend

| File | Change |
|------|--------|
| `frontend/src/components/shop/groups/ShopGroupsClient.tsx` | Add search input, pagination state, load more handler |
| `frontend/src/services/api/affiliateShopGroups.ts` | Update `getAllGroups()` to accept search, page, limit params |

---

## QA Verification

### Pagination
- [ ] Discover Groups shows first 20 groups with "Load More" button
- [ ] Clicking Load More shows additional groups appended to list
- [ ] "Test Group Name" (position 115) is accessible via Load More
- [ ] Total group count displayed (e.g., "Showing 20 of 121 groups")
- [ ] Load More button disappears when all groups loaded
- [ ] Groups tab count updates to reflect total, not just page 1

### Search
- [ ] Search input visible at top of Discover Groups tab
- [ ] Typing "Amazing" filters to show "Amazing Resto" group
- [ ] Typing "CDV" (token symbol) filters to show CODEBILITY group
- [ ] Search works with pagination (search first page, then load more)
- [ ] Clear button resets search and shows all groups
- [ ] Empty search results shows "No groups found" message
- [ ] Search is debounced (no API call on every keystroke)

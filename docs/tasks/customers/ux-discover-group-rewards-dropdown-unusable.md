# UX: Discover Group Rewards Dropdown Shows Empty/Unreachable Groups

## Status: Fixed
## Priority: High
## Date: 2026-04-03
## Category: UX Improvement - Customer Marketplace
## Location: `/customer/marketplace` → Discover Group Rewards dropdown

---

## Overview

The "Discover Group Rewards" dropdown in the customer marketplace is currently unusable. It displays groups that have no linked services, duplicate test entries, and hidden token symbols — while the only groups that actually have services (CODEBILITY, GELO GROUP) are unreachable due to backend pagination.

---

## Current Problems

### 1. Backend Paginates but Dropdown Has No "Load More"
- Backend `GET /api/affiliate-shop-groups` returns only 20 groups per page (sorted newest first)
- Frontend calls this once and populates the dropdown — no pagination controls
- A dropdown is not a paginated component — users cannot "go to page 2"
- **Result**: 92 groups are invisible, including the only 2 with linked services

### 2. Groups Without Services Flood the List
- 112 active groups in the database, only **2 have services linked** via `service_group_availability`
- The dropdown shows groups that will always return "No Services Found"
- Customers lose trust in the feature after selecting 3-4 empty groups

### 3. Duplicate and Junk Test Data
- Multiple copies of "Private Group Test", "My Test Group", "Admin Test Group", etc.
- Groups with empty names, XSS test payloads (`<script>alert('xss')</script>`)
- Makes the dropdown look broken and unprofessional

### 4. Token Symbols Hidden for Non-Members
- Backend nullifies `customTokenSymbol` for non-members of groups (privacy logic)
- Dropdown label: `{group.groupName} - Earn {group.customTokenSymbol} tokens`
- Renders as: "Private Group Test - Earn tokens" (no symbol)
- Defeats the purpose of showing what tokens customers can earn

---

## Database State (2026-04-03)

| Metric | Count |
|---|---|
| Total active groups | 112 |
| Groups with linked services | **2** (CODEBILITY, GELO GROUP) |
| Groups with active services | **2** (Massage, BOXING TRAINING FOR KIDS) |
| Groups visible in dropdown | 20 (first page only) |
| Visible groups with services | **0** (both working groups are on last page) |

---

## Recommended Fix: Only Show Groups With Active Services

**The dropdown should only list groups that have at least 1 active linked service.** This is the simplest change that solves all 4 problems at once.

### Why This Is Best

- **For customers**: Every group in the dropdown will return results — no more "No Services Found" dead ends
- **For the system**: Eliminates the pagination problem entirely — groups with services will always be a small, manageable list (currently 2, likely under 50 even at scale)
- **For data quality**: Test/junk groups without services are automatically hidden without needing cleanup
- **For UX trust**: Customers learn that selecting a group always shows relevant services

### Backend Change

Create a new endpoint or add a query parameter to filter groups by service availability:

**Option A: New endpoint (recommended)**
```
GET /api/affiliate-shop-groups/with-services
```

**Option B: Query parameter on existing endpoint**
```
GET /api/affiliate-shop-groups?hasServices=true
```

**SQL Query:**
```sql
SELECT DISTINCT
  asg.group_id,
  asg.group_name,
  asg.custom_token_symbol,
  asg.custom_token_name,
  asg.icon,
  asg.description,
  COUNT(sga.service_id) as service_count
FROM affiliate_shop_groups asg
INNER JOIN service_group_availability sga
  ON asg.group_id = sga.group_id AND sga.active = true
INNER JOIN shop_services ss
  ON sga.service_id = ss.service_id AND ss.active = true
WHERE asg.active = true
GROUP BY asg.group_id
ORDER BY service_count DESC, asg.group_name ASC
```

Key points:
- `INNER JOIN` ensures only groups with active service links appear
- Joins through to `shop_services` to confirm the service itself is also active
- No pagination needed — result set will be small
- Returns `service_count` so the dropdown can show "CODEBILITY (1 service)"
- **Must return `custom_token_symbol` regardless of membership** — this is a discovery endpoint, not a membership endpoint. Customers need to see what tokens they can earn.

### Frontend Change

**File:** `frontend/src/components/customer/ServiceMarketplaceClient.tsx`

1. Replace `getAllGroups({ isPrivate: false })` with the new endpoint
2. Remove pagination concerns — response will be small
3. Update dropdown label to show service count:
   ```
   🏪 CODEBILITY - Earn CDV tokens (1 service)
   ```
4. If zero groups have services, hide the "Discover Group Rewards" section entirely

### Token Symbol Visibility

The new endpoint should **always return `customTokenSymbol`** for discovery purposes. The current privacy logic (hiding symbol for non-members) makes sense for the group management API but not for a customer discovery feature. Customers need to see "Earn CDV tokens" to understand the value proposition.

---

## Affected Files

| File | Change |
|------|--------|
| `backend/src/domains/AffiliateShopGroupDomain/controllers/GroupController.ts` | New method or query param for groups-with-services |
| `backend/src/repositories/AffiliateShopGroupRepository.ts` | New query joining through `service_group_availability` |
| `backend/src/domains/AffiliateShopGroupDomain/routes.ts` | New route (if Option A) |
| `frontend/src/services/api/affiliateShopGroups.ts` | New API function or update `getAllGroups` |
| `frontend/src/components/customer/ServiceMarketplaceClient.tsx` | Use new endpoint, update dropdown labels, hide section if empty |

---

## QA Test Plan

### After implementation
1. **Only groups with services appear** — Select each group in dropdown, verify all return at least 1 service
2. **Token symbols visible** — Every dropdown item shows the token symbol (e.g. "Earn CDV tokens")
3. **Empty state** — If no groups have services, the entire "Discover Group Rewards" section should be hidden
4. **Service count accuracy** — If showing count, verify it matches actual results
5. **New service linked** — Link a new service to a group → refresh marketplace → group appears in dropdown
6. **Service deactivated** — Deactivate the only service in a group → group disappears from dropdown
7. **Group deactivated** — Deactivate a group → disappears from dropdown even if it has services

### Regression
- Purple badges on service cards still appear correctly
- Selecting a group still filters services properly
- Booking a group service still issues group tokens on completion

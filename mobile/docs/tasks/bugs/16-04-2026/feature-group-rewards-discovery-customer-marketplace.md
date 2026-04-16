# Feature: Group Rewards Discovery on Customer Marketplace

**Status:** Open
**Priority:** High
**Est. Effort:** 6-8 hrs
**Created:** 2026-04-16
**Updated:** 2026-04-16

---

## Problem

The mobile customer marketplace is missing the Group Rewards Discovery feature that exists on web. Customers cannot see which services offer bonus group tokens, filter by affiliate group, or discover group reward opportunities. The backend already returns all group data — the mobile app simply doesn't consume or display it.

---

## Web Reference

**File:** `frontend/src/components/customer/ServiceMarketplaceClient.tsx` (lines 427-486)
**File:** `frontend/src/components/customer/ServiceCard.tsx` (lines 104-129, 255-266)

### Web features:
1. **"Discover Group Rewards" banner** — purple gradient section at top of marketplace with gift emoji, dropdown to select a group, shows custom token symbols
2. **Group filter dropdown** — "All Services" / "With group rewards" / specific group name
3. **Purple badges on service cards** — bottom-left of card image showing group icon, token symbol, and "+" indicator for multiple groups
4. **"BONUS GROUP REWARDS" section in card** — shows which tokens the customer can earn
5. **Active group filter banner** — shows selected group name with "View All Services" clear button

---

## Backend Support (Ready)

The API already returns group data. No backend changes needed.

**Endpoint:** `GET /api/services` — each service includes a `groups` array:

```json
{
  "groups": [
    {
      "groupId": "grp_abc",
      "groupName": "Early Group",
      "customTokenSymbol": "EGT",
      "customTokenName": "Early Group Token",
      "icon": "🎁",
      "tokenRewardPercentage": 100,
      "bonusMultiplier": 1,
      "estimatedTokens": 50,
      "available": true
    }
  ]
}
```

**Repository:** `backend/src/repositories/ServiceRepository.ts` (lines 247-264) — builds `groups` array with all details via `service_group_availability` and `affiliate_shop_groups` joins.

---

## Implementation Plan

### Step 1: Add `groups` to ServiceData interface

**File:** `mobile/shared/interfaces/service.interface.ts`

```typescript
export interface ServiceGroupInfo {
  groupId: string;
  groupName: string;
  customTokenSymbol: string;
  customTokenName: string;
  icon?: string;
  tokenRewardPercentage: number;
  bonusMultiplier: number;
  estimatedTokens?: number;
  available?: boolean;
}

export interface ServiceData {
  // ...existing fields
  groups?: ServiceGroupInfo[];
}
```

### Step 2: Add purple group badge to ServiceCard

**File:** `mobile/shared/components/shared/ServiceCard.tsx`

Add a badge overlay on the card image when `groups` array is non-empty:

```typescript
// Props addition
groups?: ServiceGroupInfo[];

// Badge rendering (bottom-left of image, purple background)
{groups && groups.length > 0 && (
  <View className="absolute bottom-2 left-2 bg-purple-600/90 rounded-full px-2 py-1 flex-row items-center">
    <Text className="text-white text-[10px]">
      {groups[0].icon || '🎁'} {groups[0].customTokenSymbol}
      {groups.length > 1 ? ` +${groups.length - 1}` : ''}
    </Text>
  </View>
)}
```

### Step 3: Add "Discover Group Rewards" section to marketplace

**File:** `mobile/feature/service/screens/ServicesTabContent.tsx`

Add a collapsible banner above the service list:

```typescript
// Below SearchInput, above results count
{availableGroups.length > 0 && (
  <Pressable onPress={toggleGroupFilter} className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-3 mb-3 flex-row items-center">
    <Text className="text-lg mr-2">🎁</Text>
    <View className="flex-1">
      <Text className="text-purple-300 text-sm font-semibold">Discover Group Rewards</Text>
      <Text className="text-purple-400 text-xs">Find services to earn bonus tokens on top of RCN</Text>
    </View>
    <Ionicons name="chevron-down" size={16} color="#a78bfa" />
  </Pressable>
)}
```

### Step 4: Add group filter to ServiceFilterModal

**File:** `mobile/feature/service/components/ServiceFilterModal.tsx`

Add a "Group Rewards" section with options:
- All Services (with or without group rewards)
- With group rewards only
- Specific group selection (list available groups)

### Step 5: Add group filter state and API param to hook

**File:** `mobile/feature/service/hooks/ui/useServicesTab.ts`

```typescript
const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
const [groupRewardsOnly, setGroupRewardsOnly] = useState(false);

// Add to apiFilters
const apiFilters = useMemo(() => ({
  search: debouncedSearch || undefined,
  category: selectedCategories.length === 1 ? selectedCategories[0] : undefined,
  minPrice: priceRange.min ?? undefined,
  maxPrice: priceRange.max ?? undefined,
  groupId: selectedGroupId || undefined,
}), [debouncedSearch, selectedCategories, priceRange, selectedGroupId]);
```

### Step 6: Extract available groups from loaded services

Derive the list of available groups from services data for the filter dropdown:

```typescript
const availableGroups = useMemo(() => {
  const groupMap = new Map();
  servicesData.forEach(service => {
    service.groups?.forEach(g => {
      if (!groupMap.has(g.groupId)) {
        groupMap.set(g.groupId, { groupId: g.groupId, groupName: g.groupName, icon: g.icon, customTokenSymbol: g.customTokenSymbol });
      }
    });
  });
  return Array.from(groupMap.values());
}, [servicesData]);
```

### Step 7: Pass groups to ServiceCard

**File:** `mobile/feature/service/screens/ServicesTabContent.tsx`

```typescript
<ServiceCard
  // ...existing props
  groups={item.groups}
/>
```

Also update other views that render ServiceCard:
- `TrendingSection` — trending services
- `RecentlyViewedSection` — recently viewed
- `FavoritesTabContent` — favorites tab

---

## Affected Views (all need group badges)

| View | File | Change |
|------|------|--------|
| Marketplace grid | `feature/service/screens/ServicesTabContent.tsx` | Pass `groups` to ServiceCard, add discover banner |
| Trending section | `feature/home/components/customer-wallet/TrendingSection.tsx` | Pass `groups` to ServiceCard |
| Recently viewed | `feature/home/components/customer-wallet/RecentlyViewedSection.tsx` | Pass `groups` to ServiceCard |
| Favorites tab | `feature/service/screens/FavoritesTabContent.tsx` | Pass `groups` to ServiceCard |
| Service detail | `feature/service/screens/` (detail screen) | Show group rewards info section |

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `shared/interfaces/service.interface.ts` | Add `ServiceGroupInfo` interface and `groups` field to `ServiceData` |
| `shared/components/shared/ServiceCard.tsx` | Add `groups` prop and purple badge overlay |
| `feature/service/screens/ServicesTabContent.tsx` | Add discover banner, pass groups to cards |
| `feature/service/components/ServiceFilterModal.tsx` | Add group rewards filter section |
| `feature/service/hooks/ui/useServicesTab.ts` | Add group filter state and API param |
| `feature/home/components/customer-wallet/TrendingSection.tsx` | Pass groups to ServiceCard |
| `feature/home/components/customer-wallet/RecentlyViewedSection.tsx` | Pass groups to ServiceCard |
| `feature/service/screens/FavoritesTabContent.tsx` | Pass groups to ServiceCard |

---

## Verification Checklist

- [ ] Services with group rewards show purple badge on card image
- [ ] Badge shows group icon, token symbol, and "+N" for multiple groups
- [ ] Services without group rewards show no badge
- [ ] "Discover Group Rewards" banner appears when groups exist
- [ ] Tapping group filter shows available groups
- [ ] Filtering by group shows only services in that group
- [ ] "All Services" option clears group filter
- [ ] Group badges appear in trending, recently viewed, and favorites sections
- [ ] Service detail screen shows group reward info
- [ ] Compare with web — badge info and filter results match
- [ ] API correctly receives groupId filter param

---

## Notes

- Backend is fully ready — no API changes needed. The `groups` array is already returned by `GET /api/services` and `GET /api/services/:id`.
- The web uses `groupId` query param to filter by specific group — mobile should use the same.
- The CLAUDE.md already documents this feature under "Customer Features > Group Rewards Discovery" — it was planned but never built for mobile.
- Consider using shadcn-style components for the group filter dropdown per CLAUDE.md guidelines.

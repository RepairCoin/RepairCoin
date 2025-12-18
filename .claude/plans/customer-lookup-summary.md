# Customer Lookup Redesign - Quick Reference

## Key Changes

### From: Single Customer View
- Search by exact wallet address only
- Single customer result display
- No match count or list view

### To: Multi-Customer Search Results
- Search by name OR wallet address
- Multiple results in card list format
- Match count header ("3 matches for 'John'")
- Click card to view detailed profile modal

## New Components

1. **CustomerCard.tsx** - Individual customer card
2. **CustomerDetailsModal.tsx** - Detailed view (replaces inline display)
3. **EmptySearchState.tsx** - Reusable empty state component

## API Changes

### Existing Endpoint (Already Available!)
```
GET /shops/:shopId/customers?search=query&page=1&limit=10
```

Returns:
```json
{
  "customers": [...],
  "totalItems": 25,
  "totalPages": 3,
  "currentPage": 1
}
```

**No backend changes needed!** The endpoint already supports search and pagination.

## UI Components Used (shadcn/ui)

- ✅ Card (card layout)
- ✅ Avatar (profile pictures)
- ✅ Badge (tier & status badges)
- ✅ Button (actions)
- ✅ Dialog (details modal)
- ✅ Skeleton (loading states)

## Customer Card Layout

```
┌─────────────────────────────────────────────────────┐
│ [Avatar] John Doe                      500 RCN      │
│          🏆 GOLD  ✓ Active             $50.00 USD   │
│          Last Activity: 2 days ago                  │
│          0x1234...5678 [Copy] [View Profile →]     │
└─────────────────────────────────────────────────────┘
```

## Tier Color Coding

- **GOLD**: `bg-yellow-100 text-yellow-800`
- **SILVER**: `bg-gray-100 text-gray-800`
- **BRONZE**: `bg-orange-100 text-orange-800`

## Implementation Checklist

### Phase 1: Setup
- [ ] Create type definitions
- [ ] Add API service function (searchShopCustomers)

### Phase 2: Components
- [ ] Build CustomerCard component
- [ ] Build CustomerDetailsModal component
- [ ] Build EmptySearchState component

### Phase 3: Integration
- [ ] Update CustomerLookupTab state management
- [ ] Replace single customer view with list
- [ ] Add search results header
- [ ] Add pagination controls
- [ ] Integrate QR scanner with search flow

### Phase 4: Polish
- [ ] Add loading skeletons
- [ ] Add empty states
- [ ] Test responsive design
- [ ] Test accessibility
- [ ] Add animations/transitions

## Quick Start Code Snippets

### New State Structure
```typescript
const [state, setState] = useState({
  searchQuery: '',
  loading: false,
  error: null,
  searchResults: [],
  totalResults: 0,
  currentPage: 1,
  totalPages: 0,
  selectedCustomer: null,
});
```

### Search Function
```typescript
const handleSearch = async () => {
  setLoading(true);
  const results = await searchShopCustomers(shopId, {
    search: searchQuery,
    page: currentPage,
    limit: 10
  });
  setState({ ...state, searchResults: results.customers, ... });
  setLoading(false);
};
```

### Customer Card Props
```typescript
interface CustomerCardProps {
  customer: {
    address: string;
    name?: string;
    tier: "BRONZE" | "SILVER" | "GOLD";
    lifetimeEarnings: number;
    lastTransactionDate?: string;
    isActive: boolean;
  };
  onViewDetails: (address: string) => void;
}
```

## Time Estimate

**Total: ~16 hours (2 days)**

- Type definitions: 30 min
- API integration: 1 hour
- CustomerCard: 3 hours
- Modal: 2 hours
- Main component: 4 hours
- Styling: 2 hours
- Testing: 3 hours

## Files to Modify

### New Files
- `/frontend/src/components/shop/CustomerCard.tsx`
- `/frontend/src/components/shop/CustomerDetailsModal.tsx`
- `/frontend/src/components/shop/EmptySearchState.tsx`

### Modified Files
- `/frontend/src/components/shop/tabs/CustomerLookupTab.tsx` (major refactor)
- `/frontend/src/services/api/shop.ts` (add searchShopCustomers)

### No Backend Changes Needed ✅
The existing endpoint already supports everything we need!

## Testing Scenarios

1. Search with no results
2. Search with single result
3. Search with multiple results
4. Search by name
5. Search by wallet address
6. QR code scan
7. Copy wallet address
8. View customer details
9. Pagination
10. Mobile responsiveness

## Dependencies

All likely already installed:
- `lucide-react` (icons)
- `@radix-ui/react-*` (UI primitives)
- `class-variance-authority` (Badge variants)

May need:
- `date-fns` (for relative time formatting)

## Success Metrics

- ✅ Search returns results in < 1 second
- ✅ UI is responsive on mobile/tablet/desktop
- ✅ All interactive elements are keyboard accessible
- ✅ Loading states prevent UI jank
- ✅ Empty states are clear and helpful

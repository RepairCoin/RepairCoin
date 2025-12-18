# Customer Lookup Tab Redesign - Implementation Plan

## Overview
Redesign the CustomerLookupTab component to display multiple customer results in a modern card-list layout based on Figma design specifications.

## Current State Analysis

### Existing Component Structure
- **File**: `/home/tamina/github/RepairCoin/frontend/src/components/shop/tabs/CustomerLookupTab.tsx`
- **Current Behavior**: Single customer lookup by exact wallet address
- **Data Sources**:
  - `/tokens/earned-balance/:address` - Gets earned balance
  - `/tokens/earning-sources/:address` - Gets earning sources by shop
  - `/customers/:address` - Gets customer profile details

### Existing Backend Endpoint
- **Endpoint**: `GET /shops/:shopId/customers`
- **Features**:
  - Pagination support (page, limit)
  - Search support (by address, name, email)
  - Returns array of customers who have interacted with the shop
- **Response Structure**:
  ```typescript
  {
    customers: Array<{
      address: string;
      name?: string;
      tier: string;
      lifetime_earnings: number;
      last_transaction_date?: string;
      total_transactions: number;
      isActive?: boolean;
      suspended?: boolean;
      suspendedAt?: string;
      suspensionReason?: string;
    }>;
    totalItems: number;
    totalPages: number;
    currentPage: number;
  }
  ```

## Design Requirements

### New UI Layout

1. **Search Bar Section**
   - Input placeholder: "Enter customer name or wallet address..."
   - Two buttons side-by-side:
     - "Scan QR" button (with camera icon)
     - "Search" button (with search icon)

2. **Results Header**
   - Display match count: "3 matches for 'John'"
   - Only shown when search has results

3. **Customer Cards** (Vertical List)
   Each card displays:
   - **Left Section**:
     - Profile avatar (generated from name/address)
     - Customer name (fallback to "Anonymous Customer")
     - Tier badge (GOLD/SILVER/BRONZE with color coding)
     - Active status badge (green "Active" or red "Suspended")
     - Last Activity (relative time: "2 days ago")
     - Truncated wallet address with copy button
     - "View Profile" link with external icon

   - **Right Section**:
     - Lifetime RCN (large, prominent)
     - Redemption Value in USD (RCN × $0.10)

### Color Coding
- **GOLD Tier**: Yellow/amber (`bg-yellow-100 text-yellow-800`)
- **SILVER Tier**: Gray (`bg-gray-100 text-gray-800`)
- **BRONZE Tier**: Orange/brown (`bg-orange-100 text-orange-800`)
- **Active Status**: Green (`bg-green-100 text-green-800`)
- **Suspended Status**: Red (`bg-red-100 text-red-800`)

## Implementation Plan

### Phase 1: Type Definitions & Interfaces

#### New Interfaces
```typescript
// Add to CustomerLookupTab.tsx or create separate types file

interface CustomerSearchResult {
  address: string;
  name?: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetimeEarnings: number;
  lastTransactionDate?: string;
  totalTransactions: number;
  isActive: boolean;
  suspended?: boolean;
  suspendedAt?: string;
  suspensionReason?: string;
}

interface SearchResponse {
  customers: CustomerSearchResult[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

interface CustomerLookupState {
  searchQuery: string;
  loading: boolean;
  error: string | null;
  searchResults: CustomerSearchResult[];
  totalResults: number;
  currentPage: number;
  totalPages: number;
  selectedCustomer: CustomerData | null; // For detailed view modal
}
```

### Phase 2: Component Structure

#### Main Component Changes
Replace single customer display with:
1. Search section (existing, minor updates)
2. Results header (new)
3. Customer cards list (new)
4. Detailed customer modal (existing detail view converted to modal)

#### New Sub-Components to Create

##### 1. CustomerCard Component
**File**: `/home/tamina/github/RepairCoin/frontend/src/components/shop/CustomerCard.tsx`
```typescript
interface CustomerCardProps {
  customer: CustomerSearchResult;
  onViewDetails: (address: string) => void;
}
```

**Features**:
- Uses shadcn/ui `Card`, `Avatar`, `Badge` components
- Responsive layout (flex on desktop, stack on mobile)
- Copy button for wallet address
- Click handler for detailed view
- Relative time display using date-fns or similar

##### 2. CustomerDetailsModal Component
**File**: `/home/tamina/github/RepairCoin/frontend/src/components/shop/CustomerDetailsModal.tsx`
```typescript
interface CustomerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerAddress: string;
  shopId: string;
}
```

**Features**:
- Uses shadcn/ui `Dialog` component
- Displays full customer details (existing detail cards)
- Fetches additional data when opened
- Loading states

##### 3. EmptyState Component (Reusable)
**File**: `/home/tamina/github/RepairCoin/frontend/src/components/shop/EmptySearchState.tsx`
```typescript
interface EmptySearchStateProps {
  message: string;
  icon?: React.ReactNode;
}
```

### Phase 3: API Integration

#### Update Frontend API Service
**File**: `/home/tamina/github/RepairCoin/frontend/src/services/api/shop.ts`

Add new function:
```typescript
export const searchShopCustomers = async (
  shopId: string,
  params: {
    search?: string;
    page?: number;
    limit?: number;
  }
): Promise<SearchResponse | null> => {
  try {
    const queryString = buildQueryString({ ...params });
    const response = await apiClient.get<SearchResponse>(
      `/shops/${shopId}/customers${queryString}`
    );
    return response.data || null;
  } catch (error) {
    console.error('Error searching shop customers:', error);
    return null;
  }
};
```

#### Backend Enhancement (if needed)
The existing endpoint at `GET /shops/:shopId/customers` already supports search, but we may need to:
1. Add `redemptionValue` calculation (lifetime_earnings × 0.10)
2. Ensure `lastTransactionDate` is properly returned
3. Add relative time formatting helper

**File**: `/home/tamina/github/RepairCoin/backend/src/repositories/ShopRepository.ts`

Check if `getShopCustomers` method needs enhancement to return all required fields.

### Phase 4: State Management

#### Updated State Structure
```typescript
const [state, setState] = useState<CustomerLookupState>({
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

#### Key Functions
1. `handleSearch()` - Trigger search API call
2. `handleViewCustomerDetails(address)` - Open modal with customer details
3. `handleQRScan()` - Existing QR scanner integration
4. `handleCopyAddress(address)` - Copy wallet address to clipboard
5. `handlePageChange(page)` - Pagination handler

### Phase 5: UI Components from shadcn/ui

#### Available Components to Use
1. **Card** (`/components/ui/card.tsx`)
   - Card, CardHeader, CardTitle, CardContent
   - For customer cards layout

2. **Avatar** (`/components/ui/avatar.tsx`)
   - Avatar, AvatarImage, AvatarFallback
   - For profile pictures with initials fallback

3. **Badge** (`/components/ui/badge.tsx`)
   - For tier badges, status badges
   - Can use custom className for tier colors

4. **Button** (`/components/ui/button.tsx`)
   - For search, scan QR, view profile actions

5. **Dialog** (`/components/ui/dialog.tsx`)
   - For customer details modal

6. **Separator** (`/components/ui/separator.tsx`)
   - For visual divisions

7. **Skeleton** (`/components/ui/skeleton.tsx`)
   - For loading states

#### Additional UI Elements Needed
- **Copy Button**: Use lucide-react `Copy` and `Check` icons
- **External Link Icon**: Use lucide-react `ExternalLink` icon
- **Time Formatting**: Install `date-fns` or use native Intl.RelativeTimeFormat

### Phase 6: Responsive Design

#### Breakpoints
- **Mobile** (< 768px): Stack card content vertically
- **Tablet** (768px - 1024px): Compact card layout
- **Desktop** (> 1024px): Full card layout with left/right sections

#### Grid/Flex Layout
```typescript
// Desktop
<div className="grid grid-cols-1 gap-4 md:grid-cols-1 lg:grid-cols-1">
  {/* Customer cards */}
</div>

// Card internal layout
<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
  <div className="flex items-center gap-4 flex-1">
    {/* Avatar + Info */}
  </div>
  <div className="flex flex-col items-end">
    {/* RCN values */}
  </div>
</div>
```

### Phase 7: Features & Enhancements

#### Immediate Features
1. **Search**
   - Real-time search with debouncing (300ms)
   - Search by name, wallet address, email
   - Clear search button

2. **Pagination**
   - Show 10 customers per page
   - Pagination controls at bottom
   - Total results count

3. **Empty States**
   - No search query entered
   - No results found
   - Error state

4. **Loading States**
   - Skeleton cards while loading
   - Disabled search button during load

#### Future Enhancements (Optional)
1. Filter by tier (BRONZE/SILVER/GOLD)
2. Filter by status (Active/Suspended)
3. Sort by lifetime earnings, last activity
4. Export customer list to CSV
5. Bulk actions (if needed)

## File Structure

```
frontend/src/components/shop/
├── tabs/
│   └── CustomerLookupTab.tsx (main component - updated)
├── CustomerCard.tsx (new - individual customer card)
├── CustomerDetailsModal.tsx (new - detailed view modal)
└── EmptySearchState.tsx (new - reusable empty state)

frontend/src/services/api/
└── shop.ts (updated - add searchShopCustomers function)

frontend/src/types/ (optional)
└── customerLookup.ts (new - shared types)
```

## Implementation Steps

### Step 1: Create Type Definitions
- [ ] Create shared types file or add to CustomerLookupTab.tsx
- [ ] Define CustomerSearchResult interface
- [ ] Define SearchResponse interface
- [ ] Define CustomerLookupState interface

### Step 2: Update API Service
- [ ] Add searchShopCustomers function to `/services/api/shop.ts`
- [ ] Test endpoint with Postman/curl
- [ ] Verify response data structure

### Step 3: Create Sub-Components
- [ ] Build CustomerCard component
  - [ ] Implement avatar with initials
  - [ ] Add tier badge with color coding
  - [ ] Add status badge
  - [ ] Add wallet address with copy button
  - [ ] Add "View Profile" link
  - [ ] Add RCN values display
- [ ] Build CustomerDetailsModal component
  - [ ] Convert existing detail view to modal
  - [ ] Add loading state
  - [ ] Add close button
- [ ] Build EmptySearchState component

### Step 4: Update Main Component
- [ ] Update state management structure
- [ ] Replace single customer lookup with search
- [ ] Implement handleSearch function
- [ ] Add results header with match count
- [ ] Add customer cards list rendering
- [ ] Add pagination controls
- [ ] Integrate QR scanner with new flow
- [ ] Add loading and error states

### Step 5: Styling & Polish
- [ ] Apply consistent spacing and colors
- [ ] Ensure responsive design works on all devices
- [ ] Add hover effects and transitions
- [ ] Test accessibility (keyboard navigation, screen readers)
- [ ] Add loading skeletons

### Step 6: Testing
- [ ] Test search functionality
- [ ] Test pagination
- [ ] Test QR scanner integration
- [ ] Test copy to clipboard
- [ ] Test modal open/close
- [ ] Test empty states
- [ ] Test on mobile, tablet, desktop
- [ ] Test with various data scenarios

## Dependencies

### Required Packages (likely already installed)
- `lucide-react` - Icons
- `@radix-ui/react-*` - UI primitives (via shadcn)
- `class-variance-authority` - Badge variants
- `date-fns` or native `Intl` - Relative time formatting

### New Utility Functions Needed

#### Relative Time Formatter
```typescript
// utils/dateFormatter.ts
export const getRelativeTime = (date: string | Date): string => {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
  return past.toLocaleDateString();
};
```

#### Avatar Initials Generator
```typescript
// utils/avatarUtils.ts
export const getInitials = (name?: string, address?: string): string => {
  if (name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (address) {
    return address.slice(2, 4).toUpperCase();
  }
  return '??';
};
```

#### USD Calculator
```typescript
// utils/rcnCalculator.ts
export const rcnToUsd = (rcn: number): string => {
  const usd = rcn * 0.10;
  return `$${usd.toFixed(2)}`;
};
```

## Migration Strategy

### Approach: Incremental Rollout
1. Keep existing CustomerLookupTab working
2. Create new components in parallel
3. Test thoroughly in development
4. Switch over once validated
5. Remove old code after successful deployment

### Backward Compatibility
- Existing QR scanner functionality should continue to work
- Scanning QR code should:
  1. Auto-populate search field
  2. Trigger search
  3. If single result, optionally auto-open details modal

## Success Criteria

### Functional Requirements
- [x] Search by customer name or wallet address
- [x] Display multiple results in card format
- [x] Show match count header
- [x] Each card shows all required information
- [x] Click to view detailed customer profile
- [x] Copy wallet address functionality
- [x] QR scanner integration
- [x] Pagination for large result sets
- [x] Loading and error states

### Performance Requirements
- Search response time < 1 second
- Smooth animations and transitions
- No layout shifts during loading
- Responsive on mobile devices

### UX Requirements
- Clear visual hierarchy
- Easy-to-scan cards
- Intuitive navigation
- Helpful empty states
- Accessible to screen readers
- Keyboard navigable

## Risks & Mitigation

### Risk 1: Backend Performance with Large Customer Lists
- **Mitigation**: Implement pagination, limit results to 10-20 per page
- **Mitigation**: Add database indexes on search columns

### Risk 2: QR Scanner Integration Complexity
- **Mitigation**: Keep existing QR scanner logic, just redirect to search flow
- **Mitigation**: Test thoroughly on various devices

### Risk 3: Modal Performance with Nested Data
- **Mitigation**: Lazy load detailed data only when modal opens
- **Mitigation**: Cache customer details to avoid redundant API calls

## Timeline Estimate

- **Type Definitions**: 30 minutes
- **API Service Update**: 1 hour
- **CustomerCard Component**: 3 hours
- **CustomerDetailsModal Component**: 2 hours
- **EmptySearchState Component**: 1 hour
- **Main Component Update**: 4 hours
- **Styling & Polish**: 2 hours
- **Testing & Bug Fixes**: 3 hours

**Total Estimated Time**: ~16 hours (2 days)

## References

### Design Assets
- Figma design file (provided by user)
- Color scheme matches existing RepairCoin design system
- Icons from lucide-react

### Code References
- Current CustomerLookupTab: `/frontend/src/components/shop/tabs/CustomerLookupTab.tsx`
- Backend endpoint: `/backend/src/domains/shop/routes/index.ts` (line 1490)
- shadcn/ui components: `/frontend/src/components/ui/`

### API Documentation
- Swagger UI: `http://localhost:4000/api-docs`
- Shop customers endpoint: `GET /shops/:shopId/customers`

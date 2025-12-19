# Customer Lookup Tab Redesign Plan

**Created:** 2025-12-17
**Updated:** 2025-12-18
**Branch:** fix/86d171anu-Customer-Lookup
**Status:** Ready for Implementation
**Design Reference:** `Frame 1618874027.png`

## Overview

Redesign the CustomerLookupTab to match the new Figma design. The new UI shows a **searchable customer list** with compact cards instead of the current single-customer detailed view.

## Design Requirements (from Figma)

```
+------------------------------------------------------------------+
|  🔍 Customer Lookup                                               |
+------------------------------------------------------------------+
|  [Enter customer name or wallet address...]  [Scan QR] [Search]  |
+------------------------------------------------------------------+
|  Results                                                          |
|  3 matches for "John"                                            |
+------------------------------------------------------------------+
|  +------------------------------------------------------------+  |
|  | 👤  John Doe       [GOLD]  [Active]       Lifetime RCN      |  |
|  |     Last Activity: 2 days ago                 1550          |  |
|  |     0x6528ce9587B0Cd5C22...3dB6D68  📋                      |  |
|  |     View Profile ↗                     Redemption Value     |  |
|  |                                              $155           |  |
|  +------------------------------------------------------------+  |
|  +------------------------------------------------------------+  |
|  | 👤  John Alvarez   [SILVER] [Active]      Lifetime RCN      |  |
|  |     Last Activity: Yesterday                  500           |  |
|  |     0xabnab434039403...849993  📋                           |  |
|  |     View Profile ↗                     Redemption Value     |  |
|  |                                               $50           |  |
|  +------------------------------------------------------------+  |
|  +------------------------------------------------------------+  |
|  | 👤  John Albert Cruz [BRONZE] [Active]    Lifetime RCN      |  |
|  |     Last Activity: Yesterday                   90           |  |
|  |     0xa493849738748738kds...394839  📋                      |  |
|  |     View Profile ↗                     Redemption Value     |  |
|  |                                                $9           |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

## Key Changes from Current Implementation

| Aspect | Current | New Design |
|--------|---------|------------|
| Search | Wallet address only | Name OR wallet address |
| Results | Single customer detail view | Multiple customer cards |
| API | 3 separate calls per lookup | 1 call: `/shops/:shopId/customers?search=` |
| View Profile | Inline display | Link to separate modal/page |
| Metrics | Complex balance breakdown | Simple: Lifetime RCN + USD value |

## Backend API (Already Exists ✅)

**Endpoint:** `GET /api/shops/:shopId/customers`

**Query Params:**
- `search` - Search by name OR wallet address (partial match, case-insensitive)
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50)

**Response:**
```typescript
{
  success: true,
  data: {
    customers: [
      {
        address: string;
        name?: string;
        tier: "BRONZE" | "SILVER" | "GOLD";
        lifetime_earnings: number;
        last_transaction_date?: string;
        total_transactions: number;
        isActive: boolean;
        suspended?: boolean;
      }
    ],
    totalItems: number,
    totalPages: number,
    currentPage: number
  }
}
```

**No backend changes required!**

---

## Implementation Tasks

### Task 1: Create New Types/Interfaces

**File:** `frontend/src/components/shop/tabs/CustomerLookupTab.tsx`

```typescript
// Search result from API
interface CustomerSearchResult {
  address: string;
  name?: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetime_earnings: number;
  last_transaction_date?: string;
  total_transactions: number;
  isActive: boolean;
  suspended?: boolean;
}

// Search state
interface SearchState {
  query: string;
  results: CustomerSearchResult[];
  totalResults: number;
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
}
```

### Task 2: Update Search Logic

**Changes:**
1. Remove individual API calls to `/tokens/earned-balance`, `/tokens/earning-sources`, `/customers/{address}`
2. Replace with single call to `GET /api/shops/${shopId}/customers?search=${query}`
3. Support both name and wallet address in same search field
4. Handle pagination if results > 50

```typescript
const searchCustomers = async (query: string) => {
  setSearchState(prev => ({ ...prev, isLoading: true, error: null }));

  try {
    const response = await api.get(`/shops/${shopId}/customers`, {
      params: { search: query, page: 1, limit: 50 }
    });

    setSearchState({
      query,
      results: response.data.data.customers,
      totalResults: response.data.data.totalItems,
      isLoading: false,
      error: null,
      hasSearched: true
    });
  } catch (error) {
    setSearchState(prev => ({
      ...prev,
      isLoading: false,
      error: 'Failed to search customers',
      hasSearched: true
    }));
  }
};
```

### Task 3: Create CustomerCard Component

**New Component:** `frontend/src/components/shop/customers/CustomerCard.tsx`

**Features:**
- Customer avatar (initials or image)
- Customer name (or "Anonymous Customer")
- Tier badge with colors:
  - GOLD: yellow/gold background
  - SILVER: gray background
  - BRONZE: orange/brown background
- Active/Suspended status badge (green for active)
- Last activity date (relative: "2 days ago", "Yesterday")
- Truncated wallet address with copy button
- "View Profile" link with external icon
- Lifetime RCN value (prominent, right side)
- Redemption Value in USD (RCN × $0.10)

**Props:**
```typescript
interface CustomerCardProps {
  customer: CustomerSearchResult;
  onViewProfile: (address: string) => void;
}
```

### Task 4: Update Search Results Display

**Replace current detail view with:**

1. **Results Header:**
   - "Results" title
   - Match count: "3 matches for 'John'"

2. **Customer Card List:**
   - Vertical stack of CustomerCard components
   - Each card is clickable for "View Profile"

3. **Empty States:**
   - No search yet: "Search for customers by name or wallet address"
   - No results: "No customers found matching 'query'"

4. **Loading State:**
   - Skeleton cards while searching

### Task 5: Update Search Input

**Changes:**
1. Update placeholder: `"Enter customer name or wallet address..."`
2. Keep "Scan QR" button (for wallet addresses)
3. Keep "Search" button
4. Remove wallet address validation (allow any text)
5. Trigger search on Enter key or Search button click

### Task 6: Create CustomerDetailsModal (Optional Enhancement)

**For "View Profile" functionality:**

Create modal that shows detailed customer info when "View Profile" is clicked:
- Full wallet address
- Complete balance breakdown
- Transaction history
- Earning sources by shop

**Note:** This can be a follow-up task. Initial implementation can navigate to existing customer detail page or expand inline.

### Task 7: Styling Updates

**Colors (from Figma):**
- Background: Dark (#1a1a1a or similar)
- Cards: Slightly lighter (#2a2a2a)
- Text: White/light gray
- GOLD badge: Yellow (#F7B500 or similar)
- SILVER badge: Gray (#9CA3AF)
- BRONZE badge: Orange/brown (#CD7F32)
- Active badge: Green (#22C55E)
- RCN values: White, prominent
- USD values: Light gray, smaller

**Layout:**
- Cards: Full width with padding
- Border radius on cards
- Subtle shadows or borders
- Responsive: Stack nicely on mobile

---

## File Changes Summary

| File | Action | Changes |
|------|--------|---------|
| `CustomerLookupTab.tsx` | Modify | Replace search logic, update UI to card list |
| `CustomerCard.tsx` | Create | New component for customer result cards |
| `CustomerDetailsModal.tsx` | Create (optional) | Modal for detailed customer view |

---

## Component Structure

```
CustomerLookupTab/
├── Search Section
│   ├── Search Input
│   ├── Scan QR Button
│   └── Search Button
├── Results Section
│   ├── Results Header (title + count)
│   └── Customer Card List
│       ├── CustomerCard
│       ├── CustomerCard
│       └── ...
└── States
    ├── Initial (no search)
    ├── Loading (skeletons)
    ├── Empty (no results)
    └── Error
```

---

## Testing Checklist

- [ ] Search by customer name returns multiple matches
- [ ] Search by wallet address returns exact match
- [ ] Partial name search works (e.g., "Joh" finds "John")
- [ ] Case-insensitive search
- [ ] Empty search shows appropriate message
- [ ] Copy wallet address works
- [ ] QR scanner populates search field
- [ ] Tier badges show correct colors
- [ ] Active/Suspended status displays correctly
- [ ] Lifetime RCN shows correct value
- [ ] Redemption Value = Lifetime RCN × $0.10
- [ ] "View Profile" opens customer details
- [ ] Loading states display properly
- [ ] Mobile responsive layout

---

## Progress Tracking

- [x] Task 1: Create new types/interfaces
- [x] Task 2: Update search logic to use shop customers API
- [x] Task 3: Create CustomerCard component
- [x] Task 4: Update search results display
- [x] Task 5: Update search input (placeholder, remove validation)
- [ ] Task 6: Create CustomerDetailsModal (optional - future enhancement)
- [x] Task 7: Apply styling updates
- [x] Build: Frontend compiles successfully

---

## Notes

- Backend API already supports name search - no backend changes needed
- The `/api/shops/:shopId/customers` endpoint requires shop authentication (already handled)
- RCN to USD conversion: 1 RCN = $0.10
- Consider pagination if shop has many customers (>50 results)

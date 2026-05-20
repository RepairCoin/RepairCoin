# Purchase Orders Integration Fixes - May 2026

## Overview
This document details the fixes applied to resolve Purchase Orders integration issues in the RepairCoin platform. The fixes address frontend-backend API mismatches, database query conflicts, and UI stability issues.

**Date:** May 20, 2026
**Commit:** 41637eff
**Status:** ✅ Completed and Deployed

---

## Issues Fixed

### 1. ShopSidebar Component Crash
**Issue:** Missing import caused TypeError when rendering Purchase Orders menu item
**Location:** `frontend/src/components/ui/sidebar/ShopSidebar.tsx`

**Error:**
```
TypeError: Cannot read properties of undefined (reading 'filter')
THREE.WebGLRenderer Context Lost
```

**Root Cause:** The `Package` icon from lucide-react was used but not imported

**Fix:**
```typescript
// Added to imports at line 31
import {
  // ... other imports
  Package,
} from "lucide-react";

// Menu item (lines 117-122)
{
  title: "Purchase Orders",
  href: "/shop?tab=purchase-orders",
  icon: <Package className="w-5 h-5" />,
  tabId: "purchase-orders",
},
```

---

### 2. 500 Internal Server Error on Purchase Orders API
**Issue:** SQL query returning duplicate column name error
**Location:** `backend/src/repositories/PurchaseOrderRepository.ts:233`

**Error:**
```
GET http://localhost:4000/api/inventory/purchase-orders/zwift-tech? 500 (Internal Server Error)
```

**Root Cause:** Query was selecting both `po.*` (includes vendor_name) and `v.name as vendor_name` from JOIN

**Before:**
```typescript
const query = `
  SELECT po.*, v.name as vendor_name
  FROM purchase_orders po
  LEFT JOIN inventory_vendors v ON po.vendor_id = v.id
  WHERE ${whereClause}
  ORDER BY po.order_date DESC, po.created_at DESC
  LIMIT ${paramIndex} OFFSET ${paramIndex + 1}
`;
```

**After:**
```typescript
const query = `
  SELECT po.*
  FROM purchase_orders po
  WHERE ${whereClause}
  ORDER BY po.order_date DESC, po.created_at DESC
  LIMIT ${paramIndex} OFFSET ${paramIndex + 1}
`;
```

**Rationale:** The `purchase_orders` table already stores `vendor_name` directly, so no JOIN is needed.

---

### 3. Frontend API Response Structure Mismatch
**Issue:** Frontend expected different response properties than backend was returning
**Location:** `frontend/src/services/api/inventory.ts`

**Error:**
```
TypeError: Cannot read properties of undefined (reading 'filter')
at PurchaseOrdersTab.tsx:154
```

**Root Cause:** Backend returns `{success: true, data: {...}}` but frontend accessed custom properties

**Fixes Applied:**

| Method | Before | After |
|--------|--------|-------|
| `getPurchaseOrderStats` | `response.stats` | `response.data` |
| `getPurchaseOrders` | `response.purchaseOrders` | `response.data.orders \|\| []` |
| `getPurchaseOrder` | `response.purchaseOrder` | `response.data` |
| `createPurchaseOrder` | `response.purchaseOrder` | `response.data` |
| `updatePurchaseOrder` | `response.purchaseOrder` | `response.data` |
| `receiveItems` | `response.purchaseOrder` | `response.data` |
| `cancelPurchaseOrder` | `response.purchaseOrder` | `response.data` |

**Example Fix:**
```typescript
// Before
async getPurchaseOrders(shopId: string, status?: string): Promise<PurchaseOrder[]> {
  const response = await apiClient.get(`/inventory/purchase-orders/${shopId}?${params}`);
  return response.purchaseOrders; // ❌ Wrong property
}

// After
async getPurchaseOrders(shopId: string, status?: string): Promise<PurchaseOrder[]> {
  const response = await apiClient.get(`/inventory/purchase-orders/${shopId}?${params}`);
  return response.data.orders || []; // ✅ Correct property with fallback
}
```

---

### 4. Null Safety in Stats Display
**Issue:** Stats properties could be undefined, causing toFixed() errors
**Location:** `frontend/src/components/shop/tabs/PurchaseOrdersTab.tsx`

**Error:**
```
TypeError: Cannot read properties of undefined (reading 'toFixed')
at PurchaseOrdersTab.tsx:189
```

**Root Cause:** Stats properties (totalSpending, averageOrderValue) could be null/undefined when no data exists

**Fix:** Added null safety with fallback values

```typescript
// Before
<p className="text-2xl font-bold">${stats.totalSpending.toFixed(2)}</p>

// After
<p className="text-2xl font-bold">${(stats.totalSpending || 0).toFixed(2)}</p>
```

**All Stats Fixed:**
- Line 179: `stats.totalOrders || 0`
- Line 189: `(stats.totalSpending || 0).toFixed(2)`
- Line 199: `stats.pendingOrders || 0`
- Line 209: `stats.receivedOrders || 0`
- Line 219: `(stats.averageOrderValue || 0).toFixed(2)`

---

## Migration File Numbering Resolution

### Issue
Multiple migration files had duplicate numbers causing conflicts:
- Two files numbered 114
- Two files numbered 116
- Two files numbered 115

### Resolution
Renumbered migrations to sequential order:

| Old Filename | New Filename |
|--------------|--------------|
| `114_create_inventory_v2_enhancements.sql` | `117_create_inventory_v2_enhancements.sql` |
| `116_create_po_suggestions_system.sql` | `118_create_po_suggestions_system.sql` |
| `115_add_inventory_digest_preferences.sql` | `119_add_inventory_digest_preferences.sql` |

**Migration Tracking:** Updated INSERT statements to match new filenames

---

## Testing Results

### Backend
- ✅ Purchase Orders API endpoints return 200 OK
- ✅ Stats endpoint returns correct data structure
- ✅ SQL queries execute without errors
- ✅ No duplicate column conflicts

### Frontend
- ✅ ShopSidebar renders without errors
- ✅ Purchase Orders tab loads correctly
- ✅ Stats cards display with proper formatting
- ✅ No undefined property errors
- ✅ Null values handled gracefully

### Database
- ✅ All three tables exist: `service_inventory_items`, `purchase_orders`, `purchase_order_items`
- ✅ Migrations run in correct order
- ✅ No duplicate entries in migrations table

---

## API Response Format Documentation

### Standard Format
All inventory API endpoints return responses in this format:

```typescript
{
  success: boolean;
  data: T;  // Generic type based on endpoint
  error?: string;
}
```

### Purchase Orders Endpoints

#### GET `/api/inventory/purchase-orders/stats/:shopId`
```typescript
{
  success: true,
  data: {
    totalOrders: number;
    totalSpending: number;
    pendingOrders: number;
    receivedOrders: number;
    averageOrderValue: number;
  }
}
```

#### GET `/api/inventory/purchase-orders/:shopId`
```typescript
{
  success: true,
  data: {
    orders: PurchaseOrder[];
  }
}
```

#### GET `/api/inventory/purchase-orders/:shopId/:poId`
```typescript
{
  success: true,
  data: PurchaseOrder  // Single purchase order object
}
```

#### POST `/api/inventory/purchase-orders/:shopId`
```typescript
{
  success: true,
  data: PurchaseOrder  // Newly created purchase order
}
```

---

## Common Errors & Solutions

### "Request aborted" warnings in console
**Not an actual error!** This is React Strict Mode in development intentionally mounting components twice. The first set of API requests gets aborted. This behavior:
- Only happens in development
- Will not occur in production
- Is expected React 18+ behavior
- Can be safely ignored

### "Too many clients" database error
**Solution:** The app uses a shared connection pool. Check for:
1. Multiple server instances running
2. Unclosed connections in custom queries
3. Pool size in `database-pool.ts` (default: 20)

### Missing Purchase Orders data
**Solution:**
1. Verify database migrations have run: `npm run db:migrate`
2. Check if `purchase_orders` table exists
3. Ensure shop has active subscription
4. Check API response structure matches expected format

---

## Files Modified

### Backend
- `src/repositories/PurchaseOrderRepository.ts` - Fixed SQL query
- `migrations/117_create_inventory_v2_enhancements.sql` - Renumbered from 114
- `migrations/118_create_po_suggestions_system.sql` - Renumbered from 116
- `migrations/119_add_inventory_digest_preferences.sql` - Renumbered from 115

### Frontend
- `src/components/ui/sidebar/ShopSidebar.tsx` - Added Package icon import and menu item
- `src/services/api/inventory.ts` - Fixed all PO API methods to use response.data
- `src/components/shop/tabs/PurchaseOrdersTab.tsx` - Added null safety to stats
- `src/components/shop/inventory/POSuggestionsCard.tsx` - Fixed response handling
- `src/components/shop/tabs/InventoryTab.tsx` - Fixed response handling

---

## Best Practices Established

### 1. API Response Consistency
Always access backend responses via `response.data` structure:
```typescript
const response = await apiClient.get('/endpoint');
return response.data; // ✅ Correct
// NOT: response.customProperty ❌
```

### 2. Null Safety in UI
Always provide fallback values for potentially null/undefined data:
```typescript
{(stats.totalSpending || 0).toFixed(2)} // ✅ Safe
{stats.totalSpending.toFixed(2)} // ❌ Can crash
```

### 3. SQL Query Simplification
Only JOIN tables when truly needed:
- ✅ Use direct column if data is already in table
- ❌ Don't JOIN just to get data you already have

### 4. Migration Numbering
- Keep migrations sequential
- Update tracking INSERTs when renaming
- Test migrations on clean database

---

## Future Improvements

1. **TypeScript Strictness:** Add stricter typing for API responses
2. **Error Boundaries:** Add React error boundaries for PO components
3. **Loading States:** Improve skeleton loaders during data fetch
4. **Retry Logic:** Add automatic retry for failed API calls
5. **Caching:** Consider caching PO stats to reduce API calls

---

## Related Documentation

- [Inventory V2.1 Email Campaign](./INVENTORY_V2.1_EMAIL_CAMPAIGN.md)
- [Database Schema](../backend/migrations/)
- [API Documentation](http://localhost:4000/api-docs)

---

**Reviewed by:** Claude Code
**Last Updated:** May 20, 2026

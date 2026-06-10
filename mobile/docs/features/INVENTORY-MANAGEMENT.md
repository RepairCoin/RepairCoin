# Inventory Management

## Overview

The Inventory Management feature allows shop owners to track physical parts and supplies used in repairs. It is a full stock management system integrated into the shop dashboard.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | Fully implemented |
| Backend API | Fully implemented |
| Mobile (React Native) | Not implemented |

## Feature Modules

### 1. Inventory Items
Track every physical item a shop owns.

**Fields per item:**
- Name, SKU, barcode
- Price (selling price) and Cost (purchase price)
- Stock quantity and Reserved quantity
- Low stock threshold (triggers alerts)
- Status: `available`, `low_stock`, `out_of_stock`, `discontinued`
- Category and Vendor
- Images

**Actions:**
- Create, edit, delete items
- Bulk delete / bulk update
- Upload images (DigitalOcean Spaces)
- Barcode scanning support (via barcode field lookup)

### 2. Stock Adjustments
Every stock change is logged with a reason and type.

**Adjustment types:** `manual`, `purchase`, `sale`, `return`, `damage`, `loss`, `recount`, `transfer`

**Fields logged:** quantity before/after, reason, reference (e.g. linked purchase order or service order), who made the adjustment.

### 3. Categories
Group inventory items by type (e.g. "Screens", "Batteries", "Tools").

- Create, edit, delete categories
- Display order configurable
- Optional icon

### 4. Vendors
Manage suppliers the shop orders from.

- Name, contact name, email, phone, address, notes
- Linked to inventory items and purchase orders

### 5. Purchase Orders
Formal orders placed to vendors to restock inventory. See [PURCHASE-ORDERS.md](PURCHASE-ORDERS.md).

### 6. Low Stock Alerts
Automated email alerts when items drop below their threshold.

- Configure alert email and frequency (`daily` or `weekly`)
- Digest modes: `immediate`, `daily`, `weekly`, `monthly`
- Manual trigger available
- Admin can run scheduler manually

### 7. Inventory Analytics
Performance insights on stock.

- Overview: total value, cost, potential profit, margin, top items, category breakdown
- Turnover analysis: fast/moderate/slow moving items with days-to-sell
- Profit margin breakdown per item
- Stock level trends over time (adds vs removes)
- Low stock forecast: estimated stockout dates with urgency levels

### 8. Service Integration
Link inventory items to services so stock is automatically deducted on order completion.

- Link items to a service with required quantity and optional flag
- Check stock availability before booking
- View which services use a specific item

### 9. PO Suggestions (AI-powered)
Automatically recommends when and how much to reorder based on usage patterns.

See [PO-SUGGESTIONS.md](PO-SUGGESTIONS.md).

## API Endpoints

Base path: `/api/inventory`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Inventory statistics |
| GET | `/items` | List items with filters/pagination |
| POST | `/items` | Create item |
| PUT | `/items/:id` | Update item |
| DELETE | `/items/:id` | Delete item |
| POST | `/items/:id/adjust` | Adjust stock |
| GET | `/categories` | List categories |
| GET | `/vendors` | List vendors |
| GET | `/purchase-orders/:shopId` | List purchase orders |
| POST | `/purchase-orders/:shopId` | Create purchase order |
| POST | `/purchase-orders/:shopId/:poId/receive` | Receive items |
| GET | `/analytics/:shopId/overview` | Overview analytics |
| GET | `/analytics/:shopId/turnover` | Turnover analytics |
| GET | `/analytics/:shopId/forecast` | Low stock forecast |
| GET | `/alerts/settings/:shopId` | Get alert settings |
| PUT | `/alerts/settings/:shopId` | Update alert settings |

## Frontend Location

- Tab: `frontend/src/components/shop/tabs/InventoryTab.tsx`
- Analytics: `frontend/src/components/shop/tabs/InventoryAnalyticsTab.tsx`
- Low Stock Alerts: `frontend/src/components/shop/tabs/LowStockAlertsTab.tsx`
- Purchase Orders: `frontend/src/components/shop/tabs/PurchaseOrdersTab.tsx`
- API Service: `frontend/src/services/api/inventory.ts`
- Types: `frontend/src/types/inventory.ts`

## Backend Location

- Domain: `backend/src/domains/InventoryDomain/`
- Repository: `backend/src/repositories/InventoryRepository.ts`
- Purchase Order Repo: `backend/src/repositories/PurchaseOrderRepository.ts`
- PO Suggestion Service: `backend/src/services/POSuggestionService.ts`
- Low Stock Alert Service: `backend/src/services/LowStockAlertService.ts`
- Migrations: `backend/migrations/109_create_inventory_tables.sql`, `117_create_inventory_v2_enhancements.sql`

## Known Bugs (as of June 2026)

1. **receiveItems crashes for linked items** — `PurchaseOrderRepository` uses wrong column names (`previous_quantity`/`new_quantity` instead of `quantity_before`/`quantity_after`)
2. **Stats field mismatch** — backend returns `totalSpent`, frontend expects `totalSpending`; `averageOrderValue` is missing from backend response
3. **Cancel partially_received PO fails** — backend cancel query only allows `draft`, `sent`, `confirmed` statuses but UI shows cancel button for `partially_received`

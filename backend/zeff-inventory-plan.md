# RepairCoin Inventory Management System - Implementation Plan

**Version:** 1.0
**Date:** 2026-05-04
**Author:** Zeff
**Project:** RepairCoin Inventory (Square-inspired)

---

## 📋 Table of Contents
1. [Overview](#overview)
2. [Feature Requirements](#feature-requirements)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Frontend Components](#frontend-components)
6. [Import/Export System](#importexport-system)
7. [Implementation Phases](#implementation-phases)
8. [Technical Considerations](#technical-considerations)
9. [Testing Strategy](#testing-strategy)

---

## 1. Overview

### Objective
Build a comprehensive inventory management system for RepairCoin shops, inspired by Square's inventory interface, allowing shops to track stock levels, manage items, and import/export inventory data.

### Key Goals
- ✅ Manage inventory items with detailed attributes
- ✅ Track stock levels and availability
- ✅ Support bulk import/export (Excel/CSV)
- ✅ Enable filtering, searching, and sorting
- ✅ Integrate with existing service marketplace
- ✅ Support multiple item categories and vendors

### Success Criteria
- Shops can create, read, update, delete inventory items
- Bulk import of 500+ items in under 10 seconds
- Real-time stock level updates
- Seamless integration with booking system
- Mobile-responsive UI

---

## 2. Feature Requirements

### 2.1 Core Features

#### A. Item Management
- **Create Item**
  - Name (required)
  - Description
  - SKU (auto-generated or manual)
  - Category/Reporting Category
  - Price (with currency)
  - Cost (for profit tracking)
  - Default vendor
  - Images (multiple)
  - Tags/Labels

- **Edit Item**
  - Update any field
  - Track modification history
  - Audit trail

- **Delete Item**
  - Soft delete (archive)
  - Prevent deletion if in active orders
  - Bulk delete support

- **Status Management**
  - Available
  - Sold Out
  - Low Stock (threshold-based)
  - Discontinued
  - Draft

#### B. Stock Management
- **Track Quantity**
  - Current stock level
  - Reserved stock (from pending orders)
  - Available stock (current - reserved)

- **Low Stock Alerts**
  - Configurable threshold per item
  - Email/in-app notifications
  - Dashboard widget

- **Stock Adjustments**
  - Manual adjustment with reason
  - Automatic adjustment from sales
  - Adjustment history log

#### C. Search & Filtering
- **Search**
  - Full-text search across name, SKU, description
  - Search by vendor
  - Search by category

- **Filters**
  - Category dropdown
  - Status (Active, Sold Out, Low Stock, All)
  - Vendor filter
  - Price range filter
  - Date added filter

- **Sorting**
  - Name (A-Z, Z-A)
  - Price (Low to High, High to Low)
  - Stock level
  - Last modified

#### D. Bulk Actions
- **Select Items**
  - Checkbox selection
  - Select all / Deselect all
  - Select filtered items

- **Bulk Operations**
  - Change status (e.g., mark as discontinued)
  - Update category
  - Update vendor
  - Delete selected
  - Export selected

---

## 3. Database Schema

### 3.1 Tables

#### `inventory_items`
```sql
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,

  -- Basic Info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(100) UNIQUE,

  -- Categorization
  category VARCHAR(100),
  reporting_category VARCHAR(100),
  tags TEXT[], -- Array of tags

  -- Pricing
  price DECIMAL(10, 2) NOT NULL,
  cost DECIMAL(10, 2), -- For profit margin calculation
  currency VARCHAR(3) DEFAULT 'USD',
  sold_by VARCHAR(50) DEFAULT 'ea', -- ea, lb, oz, kg, etc.

  -- Stock
  stock_quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0, -- From pending orders
  low_stock_threshold INTEGER DEFAULT 5,
  track_stock BOOLEAN DEFAULT true,

  -- Vendor
  default_vendor VARCHAR(255),
  vendor_sku VARCHAR(100),

  -- Status
  status VARCHAR(50) DEFAULT 'available', -- available, sold_out, low_stock, discontinued, draft
  is_active BOOLEAN DEFAULT true,

  -- Images
  images JSONB DEFAULT '[]', -- Array of image URLs
  primary_image_url TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255), -- Wallet address
  updated_by VARCHAR(255),

  -- Soft delete
  deleted_at TIMESTAMP,

  -- Indexes
  CONSTRAINT positive_price CHECK (price >= 0),
  CONSTRAINT positive_cost CHECK (cost IS NULL OR cost >= 0),
  CONSTRAINT positive_stock CHECK (stock_quantity >= 0),
  CONSTRAINT positive_reserved CHECK (reserved_quantity >= 0)
);

CREATE INDEX idx_inventory_shop ON inventory_items(shop_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_status ON inventory_items(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_category ON inventory_items(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_sku ON inventory_items(sku);
CREATE INDEX idx_inventory_name ON inventory_items USING gin(to_tsvector('english', name));
```

#### `inventory_adjustments`
```sql
CREATE TABLE inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  shop_id VARCHAR(255) NOT NULL,

  -- Adjustment Details
  quantity_change INTEGER NOT NULL, -- Can be negative
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,

  -- Reason
  adjustment_type VARCHAR(50) NOT NULL, -- manual, sale, return, damage, restock, import
  reason TEXT,

  -- Reference
  reference_type VARCHAR(50), -- order, booking, manual
  reference_id VARCHAR(255), -- Order ID, Booking ID, etc.

  -- Metadata
  adjusted_by VARCHAR(255) NOT NULL, -- Wallet address
  adjusted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Audit
  notes TEXT
);

CREATE INDEX idx_adjustments_item ON inventory_adjustments(item_id);
CREATE INDEX idx_adjustments_shop ON inventory_adjustments(shop_id);
CREATE INDEX idx_adjustments_date ON inventory_adjustments(adjusted_at DESC);
```

#### `inventory_categories`
```sql
CREATE TABLE inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  description TEXT,
  parent_category_id UUID REFERENCES inventory_categories(id),

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(shop_id, name)
);

CREATE INDEX idx_categories_shop ON inventory_categories(shop_id);
```

#### `inventory_vendors`
```sql
CREATE TABLE inventory_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  website VARCHAR(500),

  -- Payment terms
  payment_terms VARCHAR(100),
  notes TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(shop_id, name)
);

CREATE INDEX idx_vendors_shop ON inventory_vendors(shop_id);
```

---

## 4. API Endpoints

### 4.1 Inventory Items

#### GET `/api/inventory`
Get all inventory items for a shop with filtering, search, and pagination.

**Query Parameters:**
```typescript
{
  page?: number;           // Default: 1
  limit?: number;          // Default: 20, Max: 100
  search?: string;         // Search name, SKU, description
  category?: string;       // Filter by category
  status?: string;         // available, sold_out, low_stock, all
  vendor?: string;         // Filter by vendor
  sortBy?: string;         // name, price, stock, updated_at
  sortOrder?: 'asc' | 'desc';
  minPrice?: number;
  maxPrice?: number;
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    items: InventoryItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    summary: {
      totalItems: number;
      activeItems: number;
      soldOutItems: number;
      lowStockItems: number;
      totalValue: number; // sum(price * stock_quantity)
    };
  }
}
```

#### POST `/api/inventory`
Create a new inventory item.

**Request Body:**
```typescript
{
  name: string;
  description?: string;
  sku?: string; // Auto-generate if not provided
  category?: string;
  reportingCategory?: string;
  price: number;
  cost?: number;
  soldBy?: string;
  stockQuantity?: number;
  lowStockThreshold?: number;
  defaultVendor?: string;
  images?: string[];
  tags?: string[];
}
```

**Response:**
```typescript
{
  success: true,
  data: InventoryItem;
  message: "Inventory item created successfully";
}
```

#### GET `/api/inventory/:id`
Get a single inventory item by ID.

**Response:**
```typescript
{
  success: true,
  data: {
    item: InventoryItem;
    adjustmentHistory: InventoryAdjustment[];
    relatedOrders: Order[]; // Recent orders using this item
  }
}
```

#### PUT `/api/inventory/:id`
Update an inventory item.

**Request Body:**
```typescript
{
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  cost?: number;
  stockQuantity?: number;
  status?: 'available' | 'sold_out' | 'discontinued' | 'draft';
  // ... any field from creation
}
```

#### DELETE `/api/inventory/:id`
Soft delete an inventory item.

**Query Parameters:**
```typescript
{
  force?: boolean; // Hard delete if true (admin only)
}
```

#### POST `/api/inventory/:id/adjust-stock`
Manually adjust stock level.

**Request Body:**
```typescript
{
  quantityChange: number; // Can be negative
  reason: string;
  notes?: string;
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    item: InventoryItem;
    adjustment: InventoryAdjustment;
  };
  message: "Stock adjusted successfully";
}
```

#### POST `/api/inventory/bulk-update`
Bulk update multiple items.

**Request Body:**
```typescript
{
  itemIds: string[];
  updates: {
    status?: string;
    category?: string;
    vendor?: string;
    // ... selective fields
  };
}
```

#### DELETE `/api/inventory/bulk-delete`
Bulk delete items.

**Request Body:**
```typescript
{
  itemIds: string[];
}
```

### 4.2 Import/Export

#### GET `/api/inventory/export`
Export inventory to Excel/CSV.

**Query Parameters:**
```typescript
{
  format: 'xlsx' | 'csv';
  includeInactive?: boolean;
  includeAdjustmentHistory?: boolean;
  category?: string; // Filter by category
  ids?: string[]; // Export specific items
}
```

**Response:**
File download (Excel or CSV)

#### GET `/api/inventory/template`
Download import template.

**Query Parameters:**
```typescript
{
  format: 'xlsx' | 'csv';
  includeSamples?: boolean; // Include sample rows
}
```

**Response:**
Template file download

#### POST `/api/inventory/import`
Import inventory from Excel/CSV.

**Request Body (FormData):**
```typescript
{
  file: File; // Excel or CSV file
  mode: 'add' | 'merge' | 'replace';
  dryRun?: boolean;
  onDuplicateSKU?: 'skip' | 'update' | 'rename' | 'error';
}
```

**Response:**
```typescript
{
  success: boolean;
  jobId: string;
  summary: {
    total: number;
    imported: number;
    updated: number;
    skipped: number;
    errors: number;
    invalidRows: Array<{
      row: number;
      sku?: string;
      name?: string;
      errors: string[];
    }>;
  };
  validationErrors?: ValidationError[];
}
```

#### GET `/api/inventory/import/:jobId`
Get import job status.

**Response:**
```typescript
{
  success: true;
  data: {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number; // 0-100
    summary: ImportSummary;
    errors?: ValidationError[];
  }
}
```

### 4.3 Categories & Vendors

#### GET `/api/inventory/categories`
Get all categories for a shop.

#### POST `/api/inventory/categories`
Create a new category.

#### GET `/api/inventory/vendors`
Get all vendors for a shop.

#### POST `/api/inventory/vendors`
Create a new vendor.

---

## 5. Frontend Components

### 5.1 Component Structure

```
frontend/src/components/shop/inventory/
├── InventoryTab.tsx               # Main tab (already created)
├── InventoryTable.tsx             # Table view with filters
├── InventoryGrid.tsx              # Optional grid view
├── InventoryFilters.tsx           # Search, category, status filters
├── InventoryStats.tsx             # Summary cards (total, active, low stock)
├── CreateItemModal.tsx            # Create new item modal
├── EditItemModal.tsx              # Edit item modal
├── StockAdjustmentModal.tsx       # Adjust stock modal
├── BulkActionsBar.tsx             # Bulk action controls
├── ImportInventoryModal.tsx       # Import modal (similar to ServiceImportModal)
├── ExportInventoryModal.tsx       # Export modal
└── components/
    ├── ItemRow.tsx                # Single table row
    ├── StatusBadge.tsx            # Status indicator (Available, Sold Out, etc.)
    ├── StockIndicator.tsx         # Stock level indicator
    └── CategoryPill.tsx           # Category badge
```

### 5.2 Key Component Features

#### `InventoryTable.tsx`
- Sortable columns
- Checkbox selection for bulk actions
- Inline quick actions (edit, adjust stock, delete)
- Lazy loading / virtualization for 1000+ items
- Responsive design (collapses to cards on mobile)

#### `InventoryFilters.tsx`
- Search bar with debounced input
- Category dropdown (multi-select)
- Status filter (Available, Sold Out, Low Stock, All)
- Vendor filter
- Price range slider
- Clear all filters button

#### `InventoryStats.tsx`
```tsx
<div className="grid grid-cols-4 gap-4">
  <StatCard title="Total Items" value={totalItems} />
  <StatCard title="Active Items" value={activeItems} color="green" />
  <StatCard title="Sold Out" value={soldOutItems} color="red" />
  <StatCard title="Low Stock" value={lowStockItems} color="yellow" />
</div>
```

#### `CreateItemModal.tsx`
Form fields:
- Name (required)
- Description (textarea)
- SKU (auto-generate option)
- Category (dropdown + "Add new")
- Price (number input with currency)
- Cost (optional)
- Sold by (dropdown: ea, lb, kg, etc.)
- Stock quantity (number)
- Low stock threshold (number)
- Default vendor (dropdown + "Add new")
- Images (multi-upload with drag & drop)
- Tags (tag input)

#### `ImportInventoryModal.tsx`
- Similar to ServiceImportModal we just built
- Download template button
- File upload (drag & drop)
- Import mode selection (add, merge, replace)
- Duplicate handling (skip, update, rename, error)
- Dry run option
- Progress indicator
- Validation results display
- Error summary with downloadable error report

---

## 6. Import/Export System

### 6.1 Excel Template Structure

#### Sheet: "Inventory"

| Column | Type | Required | Description | Example |
|--------|------|----------|-------------|---------|
| Name | Text | Yes | Item name | "Camera Lens Protector" |
| Description | Text | No | Item description | "Protects camera lens from scratches" |
| SKU | Text | No | Stock keeping unit | "CLP-001" |
| Category | Text | No | Item category | "Accessories" |
| Reporting Category | Text | No | For reports | "Accessories" |
| Price | Number | Yes | Selling price | 24.99 |
| Cost | Number | No | Cost to shop | 10.00 |
| Sold By | Text | No | Unit of measure | "ea" |
| Stock Quantity | Integer | No | Current stock | 50 |
| Low Stock Threshold | Integer | No | Alert threshold | 10 |
| Default Vendor | Text | No | Vendor name | "Tech Supplies Inc" |
| Vendor SKU | Text | No | Vendor's SKU | "TSI-CLP001" |
| Status | Text | No | Item status | "available" |
| Tags | Text | No | Comma-separated | "phone, protection, popular" |

#### Sheet: "Sample Data" (optional)
3-5 sample rows showing proper data format

### 6.2 Import Validation Rules

1. **Name Validation**
   - Required field
   - Max 255 characters
   - Must be unique per shop

2. **SKU Validation**
   - Optional (auto-generate if empty)
   - Must be unique globally
   - Max 100 characters
   - Alphanumeric + hyphens only

3. **Price Validation**
   - Required
   - Must be >= 0
   - Max 2 decimal places

4. **Stock Validation**
   - Must be >= 0
   - Integer only

5. **Status Validation**
   - Must be one of: available, sold_out, discontinued, draft
   - Default: available

6. **Category/Vendor**
   - Auto-create if doesn't exist
   - Trim whitespace
   - Case-insensitive matching

### 6.3 Import Modes

#### Add Mode
- Only import new items (skip if SKU exists)
- Best for: Adding new inventory

#### Merge Mode
- Update existing items by SKU
- Add new items if SKU doesn't exist
- Best for: Updating prices/stock levels

#### Replace Mode
- Delete all existing inventory
- Import all items from file
- ⚠️ Requires confirmation
- Best for: Full inventory reset

### 6.4 Duplicate Handling

**Options when duplicate SKU found:**

1. **Skip** - Skip the duplicate row
2. **Update** - Update existing item with new data
3. **Rename** - Append suffix to SKU (e.g., CLP-001-2)
4. **Error** - Fail the import with error

### 6.5 Export Features

- Export all or selected items
- Include/exclude inactive items
- Include adjustment history (optional)
- Filter by category, status, vendor
- Format: Excel (.xlsx) or CSV
- File naming: `inventory_export_YYYY-MM-DD.xlsx`

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Basic CRUD operations

- [ ] Create database tables and migrations
- [ ] Implement InventoryRepository
- [ ] Create InventoryController with basic endpoints
- [ ] Add routes to InventoryDomain
- [ ] Create basic InventoryTable component
- [ ] Implement CreateItemModal
- [ ] Implement EditItemModal

**Deliverables:**
- Shops can create, view, update, delete inventory items
- Basic list view with pagination

### Phase 2: Search & Filtering (Week 2)
**Goal:** Advanced querying

- [ ] Implement full-text search
- [ ] Add filtering logic (category, status, vendor, price)
- [ ] Add sorting functionality
- [ ] Create InventoryFilters component
- [ ] Add InventoryStats dashboard
- [ ] Implement status badges and indicators

**Deliverables:**
- Full search and filter functionality
- Summary statistics dashboard

### Phase 3: Stock Management (Week 3)
**Goal:** Track stock levels

- [ ] Implement stock adjustment endpoint
- [ ] Create InventoryAdjustment table and tracking
- [ ] Add StockAdjustmentModal component
- [ ] Implement low stock alerts
- [ ] Add reserved stock logic
- [ ] Create adjustment history view

**Deliverables:**
- Manual stock adjustments with history
- Low stock alerts and indicators

### Phase 4: Bulk Actions (Week 4)
**Goal:** Mass operations

- [ ] Implement bulk update endpoint
- [ ] Implement bulk delete endpoint
- [ ] Add checkbox selection to table
- [ ] Create BulkActionsBar component
- [ ] Add confirmation modals for bulk operations

**Deliverables:**
- Bulk edit, delete, and status changes
- Selection controls

### Phase 5: Import/Export (Week 5)
**Goal:** Bulk data management

- [ ] Create Excel template generator
- [ ] Implement import parser and validator
- [ ] Create ImportInventoryModal component
- [ ] Implement export functionality
- [ ] Add import job tracking
- [ ] Create validation error display

**Deliverables:**
- Full import/export functionality
- Template downloads
- Import validation and error handling

### Phase 6: Categories & Vendors (Week 6)
**Goal:** Enhanced organization

- [ ] Create category management endpoints
- [ ] Create vendor management endpoints
- [ ] Add category creation modal
- [ ] Add vendor creation modal
- [ ] Integrate with item creation/editing

**Deliverables:**
- Category and vendor management
- Auto-creation during import

### Phase 7: Integration & Polish (Week 7)
**Goal:** Production ready

- [ ] Integrate with booking system (reserve stock)
- [ ] Add permission checks (subscription guard)
- [ ] Implement mobile responsive design
- [ ] Add loading states and error handling
- [ ] Performance optimization (caching, indexing)
- [ ] Add analytics tracking

**Deliverables:**
- Fully integrated inventory system
- Mobile-friendly UI
- Production-ready performance

### Phase 8: Testing & Deployment (Week 8)
**Goal:** Quality assurance

- [ ] Unit tests for repository and service layer
- [ ] Integration tests for API endpoints
- [ ] Frontend component tests
- [ ] Import/export stress testing (1000+ items)
- [ ] User acceptance testing
- [ ] Deploy to staging
- [ ] Deploy to production

**Deliverables:**
- Comprehensive test coverage
- Production deployment

---

## 8. Technical Considerations

### 8.1 Performance Optimization

1. **Database Indexing**
   - Index on shop_id, status, category, sku
   - Full-text search index on name and description
   - Composite indexes for common filter combinations

2. **Query Optimization**
   - Use pagination (default limit: 20)
   - Lazy load images (thumbnail URLs)
   - Cache category and vendor lists
   - Use SELECT specific columns, not SELECT *

3. **Frontend Performance**
   - Virtualized table for 500+ items
   - Debounced search (300ms)
   - Optimistic UI updates
   - Image lazy loading
   - Infinite scroll alternative to pagination

4. **Import Performance**
   - Process in batches of 100 items
   - Use bulk INSERT queries
   - Background job processing for large imports
   - Progress callbacks every 10%

### 8.2 Data Integrity

1. **Stock Consistency**
   - Use database transactions for stock adjustments
   - Prevent negative stock (constraint)
   - Lock rows during adjustment to prevent race conditions
   - Audit trail for all stock changes

2. **SKU Uniqueness**
   - Database unique constraint
   - Generate SKUs: `{CATEGORY_PREFIX}-{TIMESTAMP}-{RANDOM}`
   - Validate before insert

3. **Soft Deletes**
   - Never hard delete items with order history
   - Use deleted_at column
   - Filter out deleted items in queries

### 8.3 Security

1. **Authorization**
   - Shops can only access their own inventory
   - Require active subscription (SubscriptionGuard)
   - Admin can view all inventories

2. **Input Validation**
   - Sanitize all inputs
   - Validate file uploads (max 10MB)
   - Check file extensions and MIME types
   - Rate limit import requests (5 per hour)

3. **Data Privacy**
   - Don't expose cost in public APIs
   - Log sensitive operations (bulk delete, replace mode)

### 8.4 Integration Points

1. **Booking System**
   - Reserve stock when booking created
   - Release stock when booking cancelled
   - Deduct stock when booking completed
   - Update reserved_quantity in real-time

2. **Service Marketplace**
   - Link services to inventory items
   - Display "Out of Stock" on service cards
   - Auto-disable services when inventory depleted

3. **Analytics**
   - Track inventory turnover rate
   - Monitor low stock items
   - Report on profit margins (price - cost)

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Backend:**
- InventoryRepository CRUD operations
- Stock adjustment logic
- Import parser and validator
- SKU generation
- Category/vendor creation

**Frontend:**
- Component rendering
- Filter logic
- Search debouncing
- Form validation

### 9.2 Integration Tests

- API endpoint responses
- Database transactions
- File upload and parsing
- Export file generation
- Bulk operations

### 9.3 End-to-End Tests

**User Flows:**
1. Create item → View in list → Edit item → Delete item
2. Import 100 items → Validate success → Export items
3. Search items → Filter by category → Select all → Bulk update status
4. Adjust stock → View adjustment history
5. Create booking → Verify stock reserved → Complete booking → Verify stock deducted

### 9.4 Performance Tests

- Import 1000 items: < 10 seconds
- Load 500 items in table: < 2 seconds
- Search with filters: < 500ms
- Export 1000 items: < 5 seconds

### 9.5 Error Handling Tests

- Duplicate SKU import
- Invalid file format
- Missing required fields
- Concurrent stock adjustments
- Network failures
- File size exceeded

---

## 10. Sample Data

### 10.1 Import Template Sample Rows

```csv
Name,Description,SKU,Category,Reporting Category,Price,Cost,Sold By,Stock Quantity,Low Stock Threshold,Default Vendor,Vendor SKU,Status,Tags
Camera Lens Protector,Protects camera lens from scratches,CLP-001,Accessories,Accessories,24.99,10.00,ea,50,10,Tech Supplies Inc,TSI-CLP001,available,"phone,protection,popular"
Game Console Cleaning,Professional game console cleaning service,GCC-001,Game Console Repairs,Game Console Repairs,180.00,50.00,ea,0,0,,,,service
Heavy Duty iPhone Case,Military-grade drop protection,HDIC-001,Accessories,Accessories,34.99,15.00,ea,100,20,CasePro Ltd,CP-HDIC-001,available,"phone,protection"
iPad 10 Battery Repair,Battery replacement for iPad 10,IPB10-001,iPad Repairs,iPad Repairs,180.00,80.00,ea,0,0,RepairParts Co,RPC-IPB10,sold_out,"ipad,repair"
```

---

## 11. UI/UX Mockup Reference

Based on the Square interface provided:

### Layout Components

1. **Top Bar**
   - Search input (left)
   - Category filter button
   - Status filter dropdown (Active, All)
   - "All filters" advanced filter modal trigger
   - Actions dropdown (right)
   - "Create item" button (primary CTA)

2. **Table Columns**
   - Checkbox (bulk selection)
   - Item (with thumbnail + name)
   - Reporting category
   - Sold by (unit)
   - Status (badge: Available/Sold out)
   - Price
   - Default vendor
   - Actions menu (three dots)

3. **Status Badges**
   - Available: Green pill badge
   - Sold out: Red/pink pill badge
   - Low stock: Yellow/orange pill badge

4. **Color Scheme**
   - Match RepairCoin theme:
     - Primary: #FFCC00 (yellow)
     - Background: #1A1A1A (dark)
     - Text: White/gray
     - Success: Green
     - Warning: Yellow/orange
     - Danger: Red

---

## 12. Timeline & Milestones

### Total Estimated Time: 8 weeks

**Milestone 1 (Week 2):** Basic CRUD + Filtering ✅
**Milestone 2 (Week 4):** Stock Management + Bulk Actions ✅
**Milestone 3 (Week 6):** Import/Export + Categories/Vendors ✅
**Milestone 4 (Week 8):** Production Ready ✅

---

## 13. Future Enhancements (Post-MVP)

1. **Barcode Scanning**
   - Generate barcodes for items
   - Mobile barcode scanner for stock adjustments

2. **Purchase Orders**
   - Create PO for vendors
   - Track incoming shipments
   - Auto-update stock on receipt

3. **Inventory Valuation Reports**
   - Total inventory value
   - Profit margin analysis
   - Slow-moving item reports

4. **Multi-location Support**
   - Track stock across multiple shop locations
   - Transfer stock between locations

5. **Inventory Forecasting**
   - Predict stock needs based on sales trends
   - Auto-reorder suggestions

6. **Bundle Products**
   - Create product bundles
   - Auto-deduct component items

7. **Serial Number Tracking**
   - Track individual units by serial number
   - Warranty management

---

## 14. Acceptance Criteria

### Must Have (MVP)
- ✅ Create, read, update, delete inventory items
- ✅ Search and filter items (category, status, price)
- ✅ Track stock levels and display availability
- ✅ Import items from Excel/CSV (500+ items)
- ✅ Export items to Excel/CSV
- ✅ Download import template
- ✅ Bulk actions (delete, update status)
- ✅ Mobile responsive design
- ✅ Subscription guard protection

### Nice to Have
- ⭐ Grid view alternative
- ⭐ Item images (multi-upload)
- ⭐ Adjustment history timeline
- ⭐ Low stock email alerts
- ⭐ Category management UI
- ⭐ Vendor management UI

### Future
- 🔮 Barcode generation/scanning
- 🔮 Purchase orders
- 🔮 Multi-location inventory
- 🔮 Forecasting

---

## 15. Success Metrics

### KPIs to Track

1. **Adoption Rate**
   - % of shops using inventory feature
   - Average items per shop

2. **Usage Metrics**
   - Items created per week
   - Imports per week
   - Searches per session

3. **Performance**
   - Average load time for 500 items
   - Import time for 1000 items
   - Search response time

4. **Error Rates**
   - Import failure rate
   - Validation error rate
   - API error rate

---

## Appendix A: File Locations

### Backend
- **Domain:** `backend/src/domains/InventoryDomain/`
- **Repository:** `backend/src/repositories/InventoryRepository.ts`
- **Controller:** `backend/src/domains/InventoryDomain/controllers/InventoryController.ts`
- **Routes:** `backend/src/domains/InventoryDomain/routes.ts`
- **Services:** `backend/src/domains/InventoryDomain/services/`
- **Migrations:** `backend/src/migrations/XXXX_create_inventory_tables.sql`

### Frontend
- **Tab:** `frontend/src/components/shop/tabs/InventoryTab.tsx` ✅ (Created)
- **Components:** `frontend/src/components/shop/inventory/`
- **Types:** `frontend/src/types/inventory.ts`
- **API:** `frontend/src/services/api/inventory.ts`

---

**End of Plan**

---

**Notes:**
- This plan is a living document and will be updated as requirements evolve
- Priority should be given to Phases 1-5 for MVP
- Consult with the team before implementing destructive operations (replace mode, bulk delete)

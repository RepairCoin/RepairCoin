# RepairCoin Inventory Management System

## Overview

The RepairCoin Inventory Management System is a comprehensive solution for shops to manage their inventory, track stock levels, manage categories and vendors, and export data for analysis.

**Last Updated:** May 11, 2026
**Status:** ✅ Fully Implemented and Production Ready

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Frontend Components](#frontend-components)
6. [Usage Guide](#usage-guide)
7. [Configuration](#configuration)

---

## Features

### ✅ Core Inventory Management
- Add, edit, and delete inventory items
- Upload product images (stored in DigitalOcean Spaces)
- Track SKU, barcode, pricing, and stock levels
- Real-time stock status indicators

### ✅ Stock Management
- Adjust stock quantities with 8 different adjustment types:
  - Manual Adjustment
  - Purchase/Restock
  - Sale
  - Customer Return
  - Damage/Loss
  - Theft/Loss
  - Inventory Recount
  - Transfer
- Complete adjustment history per item
- Prevent negative stock levels

### ✅ Search & Filtering
- Search by name, SKU, or barcode
- Filter by category, vendor, status
- Quick filters for low stock and out of stock items
- Sort by: name, price, stock level, date added

### ✅ Bulk Operations
- Select multiple items
- Bulk delete items
- Bulk update (category, vendor, status)
- Visual selection count

### ✅ Category & Vendor Management
- Full CRUD operations for categories
- Full CRUD operations for vendors
- View item counts per category/vendor
- Cannot delete categories/vendors in use

### ✅ Export Features
- Export inventory to CSV
- Includes all item details
- Filename with current date
- Respects current filters

### ✅ Visual Alerts
- Dashboard statistics cards
- Pulsing borders for low stock items (yellow)
- Pulsing borders for out of stock items (red)
- Animated ping indicators
- Color-coded status badges

---

## Architecture

### Backend Structure

```
backend/src/domains/InventoryDomain/
├── index.ts                    # Domain entry point
├── routes.ts                   # Route definitions
├── controllers/
│   ├── inventoryController.ts  # Item CRUD operations
│   ├── categoryController.ts   # Category management
│   ├── vendorController.ts     # Vendor management
│   ├── adjustmentController.ts # Stock adjustments
│   └── uploadController.ts     # Image uploads
└── services/                   # Business logic (if needed)
```

### Frontend Structure

```
frontend/src/components/shop/
├── tabs/
│   └── InventoryTab.tsx        # Main inventory interface
├── modals/
│   ├── AddInventoryItemModal.tsx
│   ├── EditInventoryItemModal.tsx
│   ├── StockAdjustmentModal.tsx
│   ├── AdjustmentHistoryModal.tsx
│   ├── CategoryManagementModal.tsx
│   ├── VendorManagementModal.tsx
│   ├── BulkUpdateModal.tsx
│   └── BulkActionsBar.tsx
└── services/api/
    └── inventory.ts            # API client methods
```

---

## Database Schema

### Tables

#### `inventory_items`
```sql
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
  category_id UUID REFERENCES inventory_categories(id),
  vendor_id UUID REFERENCES inventory_vendors(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(100),
  barcode VARCHAR(100),
  price DECIMAL(10, 2) NOT NULL,
  cost DECIMAL(10, 2),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  status VARCHAR(50) NOT NULL DEFAULT 'available',
  images JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Status Values:**
- `available` - In stock and available
- `low_stock` - Below threshold
- `out_of_stock` - Stock quantity is 0
- `discontinued` - No longer sold

#### `inventory_categories`
```sql
CREATE TABLE inventory_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(shop_id, name)
);
```

#### `inventory_vendors`
```sql
CREATE TABLE inventory_vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(shop_id, name)
);
```

#### `inventory_adjustments`
```sql
CREATE TABLE inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
  adjustment_type VARCHAR(50) NOT NULL,
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Adjustment Types:**
- `manual` - Manual adjustment
- `purchase` - Purchase/Restock
- `sale` - Sale
- `return` - Customer return
- `damage` - Damage/Loss
- `loss` - Theft/Loss
- `recount` - Inventory recount
- `transfer` - Transfer

---

## API Endpoints

### Base URL: `/api/inventory`

All endpoints require authentication and shop role.

### Inventory Items

#### `GET /items`
Get inventory items with filters and pagination.

**Query Parameters:**
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 20)
- `search` (string) - Search by name, SKU, or barcode
- `categoryId` (UUID) - Filter by category
- `vendorId` (UUID) - Filter by vendor
- `status` (string) - Filter by status
- `lowStock` (boolean) - Show only low stock items
- `outOfStock` (boolean) - Show only out of stock items
- `sortBy` (string) - Sort option

**Response:**
```json
{
  "items": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100,
    "itemsPerPage": 20
  }
}
```

#### `GET /items/:itemId`
Get single inventory item by ID.

#### `POST /items`
Create new inventory item.

**Request Body:**
```json
{
  "name": "iPhone 13 LCD Screen",
  "description": "High-quality replacement LCD screen",
  "sku": "IP13-LCD-001",
  "barcode": "1234567890123",
  "categoryId": "uuid",
  "vendorId": "uuid",
  "price": 89.99,
  "cost": 45.00,
  "stockQuantity": 25,
  "lowStockThreshold": 10,
  "images": ["https://..."],
  "metadata": {}
}
```

#### `PUT /items/:itemId`
Update inventory item.

#### `DELETE /items/:itemId`
Delete inventory item.

#### `POST /items/bulk/delete`
Bulk delete items.

**Request Body:**
```json
{
  "itemIds": ["uuid1", "uuid2", ...]
}
```

#### `POST /items/bulk/update`
Bulk update items.

**Request Body:**
```json
{
  "itemIds": ["uuid1", "uuid2", ...],
  "updates": {
    "categoryId": "uuid",
    "vendorId": "uuid",
    "status": "available"
  }
}
```

### Stock Adjustments

#### `POST /items/:itemId/adjust`
Adjust stock quantity.

**Request Body:**
```json
{
  "type": "purchase",
  "quantityChange": 50,
  "reason": "Restock from supplier",
  "notes": "Order #12345"
}
```

#### `GET /items/:itemId/adjustments`
Get adjustment history for item.

**Query Parameters:**
- `page` (number)
- `limit` (number)

### Categories

#### `GET /categories`
Get all categories for shop.

#### `POST /categories`
Create new category.

**Request Body:**
```json
{
  "name": "Electronics",
  "description": "Electronic devices and components"
}
```

#### `PUT /categories/:categoryId`
Update category.

#### `DELETE /categories/:categoryId`
Delete category (fails if items exist).

### Vendors

#### `GET /vendors`
Get all vendors for shop.

#### `POST /vendors`
Create new vendor.

**Request Body:**
```json
{
  "name": "Tech Supplies Inc",
  "contactName": "John Smith",
  "email": "john@techsupplies.com",
  "phone": "555-0101",
  "address": "123 Tech Street, CA 94025",
  "notes": "Primary supplier"
}
```

#### `PUT /vendors/:vendorId`
Update vendor.

#### `DELETE /vendors/:vendorId`
Delete vendor (fails if items exist).

### Image Upload

#### `POST /upload-image`
Upload inventory item image.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Field: `image` (file)

**Response:**
```json
{
  "url": "https://repaircoinstorage.sfo3.cdn.digitaloceanspaces.com/...",
  "key": "shops/shop-id/inventory/filename.jpg"
}
```

**Constraints:**
- Max file size: 10MB
- Allowed types: JPEG, PNG, GIF, WebP

### Statistics

#### `GET /stats`
Get inventory statistics.

**Response:**
```json
{
  "totalItems": 150,
  "totalValue": 12500.50,
  "lowStockItems": 5,
  "outOfStockItems": 2,
  "totalCategories": 8,
  "totalVendors": 4
}
```

---

## Frontend Components

### InventoryTab

Main inventory management interface.

**Location:** `frontend/src/components/shop/tabs/InventoryTab.tsx`

**Features:**
- Dashboard with statistics
- Search and filtering
- Item list with actions
- Pagination
- Bulk selection
- CSV export

**Props:**
```typescript
interface InventoryTabProps {
  shopId: string;
}
```

### AddInventoryItemModal

Modal for adding new inventory items.

**Features:**
- Image upload with preview
- Quick add category/vendor
- Form validation
- Real-time stock status preview

### EditInventoryItemModal

Modal for editing inventory items.

**Features:**
- Pre-filled form with existing data
- Image upload/change
- Cannot edit stock quantity (use adjustment modal)

### StockAdjustmentModal

Modal for adjusting stock quantities.

**Features:**
- 8 adjustment types with icons
- Real-time stock level preview
- Reason and notes fields
- Validation

### AdjustmentHistoryModal

Modal showing adjustment history for an item.

**Features:**
- Paginated list
- Type badges
- Reason and notes display
- Date/time stamps

### CategoryManagementModal

Modal for managing categories.

**Features:**
- List all categories
- Add new category
- Edit category
- Delete category (with validation)

### VendorManagementModal

Modal for managing vendors.

**Features:**
- List all vendors
- Add new vendor (full form)
- Edit vendor
- Delete vendor (with validation)

### BulkActionsBar

Fixed bar shown when items are selected.

**Features:**
- Selection count
- Bulk delete button
- Bulk update button
- Clear selection

### BulkUpdateModal

Modal for bulk updating items.

**Features:**
- Update category
- Update vendor
- Update status
- Shows count of affected items

---

## Usage Guide

### Adding a New Item

1. Click "Add Item" button
2. Upload an image (optional)
3. Fill in item details:
   - Name (required)
   - Description
   - SKU, Barcode
   - Select category (or quick-add new)
   - Select vendor (or quick-add new)
   - Price (required)
   - Cost
   - Initial stock quantity
   - Low stock threshold
4. Click "Create Item"

### Adjusting Stock

1. Click the stock adjustment icon (TrendingUp) on an item
2. Select adjustment type
3. Enter quantity change (+/-)
4. Provide reason
5. Add notes (optional)
6. Click "Adjust Stock"

### Viewing Adjustment History

1. Click the history icon (History) on an item
2. View paginated list of adjustments
3. Filter by type if needed

### Bulk Operations

1. Select items using checkboxes
2. Bulk Actions Bar appears at bottom
3. Click "Delete Selected" or "Update Selected"
4. Confirm action in modal

### Exporting to CSV

1. Apply desired filters (optional)
2. Click "Export CSV" button
3. CSV file downloads with format: `inventory_YYYY-MM-DD.csv`

### Managing Categories

1. Click "Categories" button
2. View existing categories with item counts
3. Add, edit, or delete categories
4. Cannot delete categories with items

### Managing Vendors

1. Click "Vendors" button
2. View existing vendors with item counts
3. Add, edit, or delete vendors
4. Cannot delete vendors with items

---

## Configuration

### Backend Configuration

**Environment Variables:**
```env
# DigitalOcean Spaces (for image storage)
DO_SPACES_KEY=your_key
DO_SPACES_SECRET=your_secret
DO_SPACES_BUCKET=repaircoinstorage
DO_SPACES_REGION=sfo3
DO_SPACES_CDN_ENDPOINT=https://repaircoinstorage.sfo3.cdn.digitaloceanspaces.com
```

**Image Upload Limits:**
```typescript
// backend/src/domains/InventoryDomain/controllers/uploadController.ts
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    // ...
  },
});
```

### Frontend Configuration

**Pagination:**
```typescript
const ITEMS_PER_PAGE = 20;
```

**Sort Options:**
```typescript
const sortOptions = [
  'newest', 'oldest',
  'name_asc', 'name_desc',
  'price_asc', 'price_desc',
  'stock_asc', 'stock_desc'
];
```

---

## Seeding Sample Data

Use the seed script to populate test data:

```bash
cd backend
npm run seed:inventory <shop-wallet-address>
```

**Seed Data Includes:**
- 5 categories
- 3 vendors
- 12 inventory items with images
- Total value: $8,674.06

---

## Error Handling

### Common Errors

**"Cannot delete category with existing items"**
- Solution: Reassign items to another category first

**"Cannot delete vendor with existing items"**
- Solution: Reassign items to another vendor first

**"Stock level cannot be negative"**
- Solution: Check the quantity change value

**"Image upload failed"**
- Possible causes:
  - File too large (>10MB)
  - Invalid file type
  - Network issue
- Solution: Check file size and type, retry

**"Failed to export inventory"**
- Possible cause: No items to export
- Solution: Add items or adjust filters

---

## Performance Considerations

### Database Indexing

Ensure these indexes exist:
```sql
CREATE INDEX idx_inventory_items_shop_id ON inventory_items(shop_id);
CREATE INDEX idx_inventory_items_category_id ON inventory_items(category_id);
CREATE INDEX idx_inventory_items_vendor_id ON inventory_items(vendor_id);
CREATE INDEX idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX idx_inventory_items_barcode ON inventory_items(barcode);
CREATE INDEX idx_inventory_adjustments_item_id ON inventory_adjustments(item_id);
```

### Pagination

Always use pagination for large datasets:
- Default: 20 items per page
- Max recommended: 50 items per page

### Image Optimization

Images are served via DigitalOcean Spaces CDN:
- Images are cached at edge locations
- Use query parameters for resizing: `?w=400&h=400&fit=crop`

---

## Future Enhancements

### Potential Features
- [ ] Barcode scanning integration
- [ ] Multiple images per item
- [ ] Purchase order management
- [ ] Inventory transfer between locations
- [ ] Low stock email alerts
- [ ] Integration with service marketplace
- [ ] Inventory analytics dashboard
- [ ] Reorder suggestions based on sales velocity

---

## Troubleshooting

### Images Not Loading

1. Check DigitalOcean Spaces configuration
2. Verify CORS settings on bucket
3. Check browser console for errors
4. Images fallback to Package icon on error

### Filters Not Working

1. Clear filters and try again
2. Check network tab for API errors
3. Verify shop authentication

### Export Not Downloading

1. Check browser download settings
2. Verify items exist in current view
3. Check browser console for errors

---

## Support

For issues or questions:
- Check backend logs: `backend/logs/`
- Check browser console for frontend errors
- Review API responses in Network tab
- Contact development team

---

**Document Version:** 1.0
**Last Updated:** May 11, 2026
**Maintained By:** RepairCoin Development Team

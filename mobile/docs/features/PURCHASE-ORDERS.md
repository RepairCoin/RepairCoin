# Purchase Orders

## Overview

Purchase Orders (POs) are formal restocking requests that shop owners send to vendors. When received, inventory stock is automatically updated.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | Fully implemented |
| Backend API | Fully implemented |
| Mobile (React Native) | Not implemented |

## Lifecycle

```
Draft -> Sent -> Confirmed -> Partially Received -> Received
                           \-> Cancelled (any stage except Received)
```

| Status | Description |
|--------|-------------|
| `draft` | Created, not yet sent to vendor |
| `sent` | Sent to vendor, awaiting confirmation |
| `confirmed` | Vendor confirmed the order |
| `partially_received` | Some items have arrived |
| `received` | All items received, PO closed |
| `cancelled` | Order was cancelled |

## Actions

| Action | Allowed When |
|--------|-------------|
| Create | Always |
| Cancel | `draft`, `sent`, `confirmed` |
| Delete | `draft` only |
| Receive items | `confirmed` or `partially_received` |
| View details | Always |

## Create PO Flow

1. Select a vendor (from saved vendors list or type manually)
2. Add items from existing inventory
3. Set quantities and unit costs per item
4. Optionally set expected delivery date and notes
5. Submit — PO is created with status `draft` and auto-generated PO number (format: `PO-YYYY-NNNN`)

## Receive Items Flow

When a shipment arrives:
1. Open the PO and click "Receive Items"
2. Enter the actual quantity received per item
3. On submit:
   - Each linked inventory item's stock quantity increases automatically
   - An adjustment record is created (type: `restock`, reference: purchase order)
   - PO status changes to `partially_received` or `received` depending on fulfillment

## Stats Dashboard

Displayed at the top of the Purchase Orders tab:
- **Total Orders** — count of all POs ever created
- **Total Spending** — sum of all PO totals
- **Pending Orders** — POs in `sent`, `confirmed`, or `partially_received` state
- **Received Orders** — fully received POs
- **Average Order Value** — mean total across all POs

## PO Number Format

Auto-generated per shop per year:
```
PO-{YEAR}-{NNNN}
```
Example: `PO-2026-0001`, `PO-2026-0002`

## API Endpoints

Base path: `/api/inventory/purchase-orders`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats/:shopId` | Get PO statistics |
| GET | `/:shopId` | List all POs (filter by status) |
| GET | `/:shopId/:poId` | Get single PO |
| POST | `/:shopId` | Create PO |
| PUT | `/:shopId/:poId` | Update PO |
| POST | `/:shopId/:poId/receive` | Receive items |
| POST | `/:shopId/:poId/cancel` | Cancel PO |
| DELETE | `/:shopId/:poId` | Delete PO (draft only) |

## Frontend Location

- Tab: `frontend/src/components/shop/tabs/PurchaseOrdersTab.tsx`
- Create Modal: `frontend/src/components/shop/tabs/modals/CreatePurchaseOrderModal.tsx`
- Detail Modal: `frontend/src/components/shop/tabs/modals/PurchaseOrderDetailModal.tsx`
- Receive Modal: `frontend/src/components/shop/tabs/modals/ReceiveItemsModal.tsx`

## Backend Location

- Controller: `backend/src/domains/InventoryDomain/controllers/purchaseOrderController.ts`
- Repository: `backend/src/repositories/PurchaseOrderRepository.ts`

## Known Bugs (as of June 2026)

1. **receiveItems crashes for linked inventory items** — wrong column names in adjustment INSERT (`previous_quantity`/`new_quantity` instead of `quantity_before`/`quantity_after`)
2. **Stats mismatch** — backend returns `totalSpent`, frontend expects `totalSpending`; `averageOrderValue` missing from backend
3. **Cancel partially_received fails** — backend only allows cancelling `draft`, `sent`, `confirmed` but UI shows cancel for `partially_received`

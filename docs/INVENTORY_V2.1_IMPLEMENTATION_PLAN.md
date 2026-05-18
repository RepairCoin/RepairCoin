# Inventory v2.1 - Quick Win Enhancements

**Status:** In Progress (20% Complete)
**Target Completion:** 11-14 hours
**Features:** 3 high-impact enhancements to existing v2.0
**Date Started:** May 18, 2026
**Last Updated:** May 18, 2026

## 🎯 Current Progress

- ✅ **Feature 1 (Email Digest):** Backend 100%, Frontend 0% = **60% Complete**
- ⏳ **Feature 2 (Barcode Scanning):** 0% Complete
- ⏳ **Feature 3 (Auto PO Suggestions):** 0% Complete
- **Overall:** **20% Complete**

See `INVENTORY_V2.1_PROGRESS.md` for detailed implementation status.

---

## 📋 Overview

Three quick-win features that enhance the existing Inventory v2.0 system:

1. **Email Digest Mode** (3-4 hours) - Weekly/monthly summaries instead of daily alerts
2. **Barcode Scanning** (3-4 hours) - Camera-based scanning for quick lookup/add
3. **Automatic PO Suggestions** (5-6 hours) - AI-driven reorder recommendations

**Total Estimated Time:** 11-14 hours across 3 features

---

## 🎯 Feature 1: Email Digest Mode

**Time Estimate:** 3-4 hours
**Priority:** HIGH (reduces email fatigue, requested by shops)

### **What It Does**
Instead of sending individual low stock alerts, aggregate all low stock items into a single weekly or monthly digest email.

### **User Stories**
- As a shop owner, I want to receive a **weekly summary** of all low stock items instead of daily emails
- As a shop owner, I want to choose between **daily/weekly/monthly** digest frequency
- As a shop owner, I want the digest to include **recommended order quantities** based on usage

### **Implementation Plan**

#### **Backend Changes** (2-3 hours)

##### **1. Database Migration 115** (30 min)
```sql
-- File: backend/migrations/115_add_inventory_digest_preferences.sql

-- Add digest preferences to shops table
ALTER TABLE shops
  ADD COLUMN low_stock_digest_mode VARCHAR(20) DEFAULT 'daily' CHECK (low_stock_digest_mode IN ('immediate', 'daily', 'weekly', 'monthly')),
  ADD COLUMN low_stock_digest_day_of_week INTEGER DEFAULT 1 CHECK (low_stock_digest_day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
  ADD COLUMN low_stock_digest_day_of_month INTEGER DEFAULT 1 CHECK (low_stock_digest_day_of_month BETWEEN 1 AND 28),
  ADD COLUMN low_stock_digest_time VARCHAR(5) DEFAULT '09:00', -- HH:MM format
  ADD COLUMN last_digest_sent_at TIMESTAMP;

COMMENT ON COLUMN shops.low_stock_digest_mode IS 'Frequency of low stock digest: immediate (current behavior), daily, weekly, monthly';
COMMENT ON COLUMN shops.low_stock_digest_day_of_week IS 'Day of week for weekly digests (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN shops.low_stock_digest_day_of_month IS 'Day of month for monthly digests (1-28)';
COMMENT ON COLUMN shops.low_stock_digest_time IS 'Time to send digest (HH:MM format, shop timezone)';
```

##### **2. Update LowStockAlertService** (1 hour)
```typescript
// File: backend/src/domains/InventoryDomain/services/LowStockAlertService.ts

export class LowStockAlertService {
  // NEW: Check if digest should be sent based on shop preferences
  private shouldSendDigest(shop: ShopDigestPreferences): boolean {
    const now = new Date();
    const lastSent = shop.lastDigestSentAt;

    switch (shop.digestMode) {
      case 'immediate':
        return true; // Current behavior (24h cooldown handled elsewhere)

      case 'daily':
        // Send if digest_time matches and not sent today
        return this.isScheduledTime(now, shop.digestTime) &&
               !this.wasSentToday(lastSent);

      case 'weekly':
        // Send if it's the right day of week and time
        return now.getDay() === shop.digestDayOfWeek &&
               this.isScheduledTime(now, shop.digestTime) &&
               !this.wasSentThisWeek(lastSent);

      case 'monthly':
        // Send if it's the right day of month and time
        return now.getDate() === shop.digestDayOfMonth &&
               this.isScheduledTime(now, shop.digestTime) &&
               !this.wasSentThisMonth(lastSent);
    }
  }

  // NEW: Generate digest email with all low stock items
  async sendLowStockDigest(shopId: string): Promise<void> {
    const lowStockItems = await this.getLowStockItems(shopId);

    if (lowStockItems.length === 0) {
      return; // No items to report
    }

    const shop = await this.getShopDetails(shopId);

    // Group items by urgency
    const critical = lowStockItems.filter(i => i.stockQuantity === 0);
    const warning = lowStockItems.filter(i => i.stockQuantity > 0 && i.stockQuantity <= i.lowStockThreshold * 0.5);
    const low = lowStockItems.filter(i => i.stockQuantity > i.lowStockThreshold * 0.5);

    // Calculate suggested order quantities based on usage
    const itemsWithSuggestions = await Promise.all(
      lowStockItems.map(async (item) => {
        const avgUsage = await this.getAverageUsageRate(item.id, 30); // Last 30 days
        const suggestedQty = Math.ceil(avgUsage * 30); // 30 days supply

        return {
          ...item,
          averageUsagePerDay: avgUsage,
          suggestedOrderQuantity: suggestedQty,
          estimatedDaysUntilStockout: item.stockQuantity / (avgUsage || 1)
        };
      })
    );

    await this.emailService.sendLowStockDigest({
      to: shop.email,
      shopName: shop.name,
      digestMode: shop.digestMode,
      totalItems: lowStockItems.length,
      criticalCount: critical.length,
      warningCount: warning.length,
      lowCount: low.length,
      items: itemsWithSuggestions
    });

    // Update last sent timestamp
    await this.updateLastDigestSent(shopId);
  }

  // NEW: Calculate average usage rate for an item
  private async getAverageUsageRate(itemId: string, days: number): Promise<number> {
    const result = await this.pool.query(`
      SELECT
        COALESCE(
          ABS(SUM(quantity_change)) / NULLIF($2, 0),
          0
        ) as avg_daily_usage
      FROM inventory_adjustments
      WHERE item_id = $1
        AND adjustment_type IN ('sale', 'service_completion', 'damage', 'loss')
        AND created_at >= NOW() - INTERVAL '${days} days'
        AND quantity_change < 0 -- Only count reductions
    `, [itemId, days]);

    return parseFloat(result.rows[0]?.avg_daily_usage || '0');
  }
}
```

##### **3. Create Email Template** (30 min)
```typescript
// File: backend/src/services/EmailService.ts

async sendLowStockDigest(params: DigestEmailParams): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .header { background: #1e40af; color: white; padding: 20px; }
        .summary { padding: 20px; background: #f3f4f6; margin: 20px 0; }
        .item-table { width: 100%; border-collapse: collapse; }
        .item-table th { background: #e5e7eb; padding: 10px; text-align: left; }
        .item-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
        .critical { color: #dc2626; font-weight: bold; }
        .warning { color: #ea580c; }
        .low { color: #ca8a04; }
        .suggestion { background: #dbeafe; padding: 5px; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📦 ${params.digestMode.toUpperCase()} Low Stock Digest</h1>
        <p>${params.shopName}</p>
      </div>

      <div class="summary">
        <h2>Summary</h2>
        <p><strong>Total Items Requiring Attention:</strong> ${params.totalItems}</p>
        <ul>
          <li class="critical">🔴 Out of Stock: ${params.criticalCount}</li>
          <li class="warning">🟠 Critical Low: ${params.warningCount}</li>
          <li class="low">🟡 Low Stock: ${params.lowCount}</li>
        </ul>
      </div>

      <table class="item-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Current Stock</th>
            <th>Threshold</th>
            <th>Avg Usage/Day</th>
            <th>Days Until Out</th>
            <th>Suggested Order Qty</th>
          </tr>
        </thead>
        <tbody>
          ${params.items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td class="${item.stockQuantity === 0 ? 'critical' : item.stockQuantity <= item.lowStockThreshold * 0.5 ? 'warning' : 'low'}">
                ${item.stockQuantity}
              </td>
              <td>${item.lowStockThreshold}</td>
              <td>${item.averageUsagePerDay.toFixed(1)}</td>
              <td>${item.estimatedDaysUntilStockout.toFixed(0)} days</td>
              <td class="suggestion">
                📦 ${item.suggestedOrderQuantity} units
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="padding: 20px; text-align: center;">
        <a href="${process.env.FRONTEND_URL}/shop/inventory"
           style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Manage Inventory →
        </a>
      </div>
    </body>
    </html>
  `;

  await this.sendEmail({
    to: params.to,
    subject: `${params.digestMode.toUpperCase()} Low Stock Digest - ${params.totalItems} Items Need Attention`,
    html
  });
}
```

##### **4. Update Scheduler** (30 min)
```typescript
// File: backend/src/domains/InventoryDomain/services/LowStockAlertService.ts

// Modify existing cron job to respect digest mode
startScheduler(): void {
  // Run every hour instead of daily
  this.schedulerInterval = setInterval(async () => {
    try {
      const shops = await this.getShopsWithAlertsEnabled();

      for (const shop of shops) {
        if (this.shouldSendDigest(shop)) {
          await this.sendLowStockDigest(shop.shopId);
        }
      }
    } catch (error) {
      logger.error('Low stock digest scheduler error:', error);
    }
  }, 60 * 60 * 1000); // Every hour
}
```

#### **Frontend Changes** (1 hour)

##### **Update LowStockAlertsTab.tsx**
```typescript
// File: frontend/src/components/shop/tabs/LowStockAlertsTab.tsx

// Add digest mode settings
<div className="space-y-4">
  <div>
    <label className="block text-sm font-medium mb-2">Digest Frequency</label>
    <select
      value={settings.digestMode}
      onChange={(e) => setSettings({...settings, digestMode: e.target.value})}
      className="w-full border rounded px-3 py-2"
    >
      <option value="immediate">Immediate (24h cooldown)</option>
      <option value="daily">Daily Summary</option>
      <option value="weekly">Weekly Summary</option>
      <option value="monthly">Monthly Summary</option>
    </select>
  </div>

  {settings.digestMode === 'weekly' && (
    <div>
      <label className="block text-sm font-medium mb-2">Day of Week</label>
      <select
        value={settings.digestDayOfWeek}
        onChange={(e) => setSettings({...settings, digestDayOfWeek: parseInt(e.target.value)})}
        className="w-full border rounded px-3 py-2"
      >
        <option value="1">Monday</option>
        <option value="2">Tuesday</option>
        <option value="3">Wednesday</option>
        <option value="4">Thursday</option>
        <option value="5">Friday</option>
        <option value="6">Saturday</option>
        <option value="0">Sunday</option>
      </select>
    </div>
  )}

  {settings.digestMode === 'monthly' && (
    <div>
      <label className="block text-sm font-medium mb-2">Day of Month</label>
      <input
        type="number"
        min="1"
        max="28"
        value={settings.digestDayOfMonth}
        onChange={(e) => setSettings({...settings, digestDayOfMonth: parseInt(e.target.value)})}
        className="w-full border rounded px-3 py-2"
      />
    </div>
  )}

  <div>
    <label className="block text-sm font-medium mb-2">Send Time (Your Timezone)</label>
    <input
      type="time"
      value={settings.digestTime}
      onChange={(e) => setSettings({...settings, digestTime: e.target.value})}
      className="w-full border rounded px-3 py-2"
    />
  </div>

  <div className="bg-blue-50 border border-blue-200 rounded p-4">
    <p className="text-sm text-blue-800">
      {settings.digestMode === 'immediate' && 'You will receive alerts as soon as items go low (max once per day)'}
      {settings.digestMode === 'daily' && `You will receive a daily summary at ${settings.digestTime}`}
      {settings.digestMode === 'weekly' && `You will receive a weekly summary every ${getDayName(settings.digestDayOfWeek)} at ${settings.digestTime}`}
      {settings.digestMode === 'monthly' && `You will receive a monthly summary on day ${settings.digestDayOfMonth} at ${settings.digestTime}`}
    </p>
  </div>
</div>
```

### **Testing Checklist**
- [ ] Migration 115 runs successfully
- [ ] Daily digest sends at scheduled time
- [ ] Weekly digest sends on correct day
- [ ] Monthly digest sends on correct day of month
- [ ] Immediate mode still works (backward compatibility)
- [ ] Email template renders correctly
- [ ] Usage calculations are accurate
- [ ] Suggested quantities are reasonable
- [ ] Frontend saves preferences correctly
- [ ] Time zone handling is correct

---

## 🎯 Feature 2: Barcode Scanning

**Time Estimate:** 3-4 hours
**Priority:** HIGH (high user delight, practical value)

### **What It Does**
Use device camera to scan barcodes for quick item lookup, stock adjustment, or adding new items.

### **User Stories**
- As a shop owner, I want to **scan a barcode** to quickly find an inventory item
- As a shop owner, I want to **scan during stock count** to adjust quantities faster
- As a shop owner, I want to **scan unknown barcodes** and add new items
- As a shop owner, I want to **batch scan** multiple items during inventory counts

### **Implementation Plan**

#### **Frontend Changes** (3-4 hours)

##### **1. Install Barcode Scanner Library** (15 min)
```bash
cd frontend
npm install react-barcode-reader @zxing/library
npm install --save-dev @types/react-barcode-reader
```

##### **2. Create BarcodeScannerModal Component** (2 hours)
```typescript
// File: frontend/src/components/shop/modals/BarcodeScannerModal.tsx

import React, { useState, useRef, useEffect } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { Camera, X, Loader, CheckCircle, AlertCircle } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'lookup' | 'add' | 'adjust';
  onBarcodeScanned: (barcode: string, item?: InventoryItem) => void;
}

export function BarcodeScannerModal({ isOpen, onClose, mode, onBarcodeScanned }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [foundItem, setFoundItem] = useState<InventoryItem | null>(null);
  const codeReader = useRef<BrowserMultiFormatReader>();

  useEffect(() => {
    if (!isOpen) return;

    // Initialize barcode reader
    codeReader.current = new BrowserMultiFormatReader();

    // Request camera permission and start scanning
    startScanning();

    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const startScanning = async () => {
    try {
      setScanning(true);
      setError(null);

      // Check camera permission
      const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setCameraPermission(permissionStatus.state as any);

      if (permissionStatus.state === 'denied') {
        setError('Camera access denied. Please enable camera in browser settings.');
        setScanning(false);
        return;
      }

      // Get video devices
      const videoDevices = await codeReader.current!.listVideoInputDevices();

      if (videoDevices.length === 0) {
        setError('No camera found on this device');
        setScanning(false);
        return;
      }

      // Prefer back camera on mobile
      const backCamera = videoDevices.find(device =>
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('rear')
      ) || videoDevices[0];

      // Start decoding
      codeReader.current!.decodeFromVideoDevice(
        backCamera.deviceId,
        videoRef.current!,
        async (result, error) => {
          if (result) {
            const barcode = result.getText();
            setResult(barcode);

            // Lookup item by barcode
            const item = await lookupItemByBarcode(barcode);

            if (item) {
              setFoundItem(item);
              playSuccessSound();
              onBarcodeScanned(barcode, item);

              // Auto-close after 2 seconds in lookup mode
              if (mode === 'lookup') {
                setTimeout(() => {
                  onClose();
                }, 2000);
              }
            } else {
              // Barcode not found - offer to add new item
              if (mode === 'add') {
                onBarcodeScanned(barcode, undefined);
                onClose();
              } else {
                setError(`No item found with barcode: ${barcode}`);
                playErrorSound();
              }
            }
          }

          if (error && !(error instanceof NotFoundException)) {
            console.error('Barcode scan error:', error);
          }
        }
      );
    } catch (err: any) {
      console.error('Failed to start camera:', err);
      setError(err.message || 'Failed to access camera');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (codeReader.current) {
      codeReader.current.reset();
    }
    setScanning(false);
  };

  const lookupItemByBarcode = async (barcode: string): Promise<InventoryItem | null> => {
    try {
      const response = await inventoryApi.getItemByBarcode(barcode);
      return response.data.item;
    } catch (error) {
      return null;
    }
  };

  const playSuccessSound = () => {
    const audio = new Audio('/sounds/beep-success.mp3');
    audio.play().catch(() => {/* Ignore if sound fails */});
  };

  const playErrorSound = () => {
    const audio = new Audio('/sounds/beep-error.mp3');
    audio.play().catch(() => {/* Ignore if sound fails */});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            <h2 className="text-lg font-semibold">
              {mode === 'lookup' && 'Scan Barcode to Find Item'}
              {mode === 'add' && 'Scan Barcode to Add New Item'}
              {mode === 'adjust' && 'Scan Barcode to Adjust Stock'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera View */}
        <div className="p-4">
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ paddingBottom: '75%' }}>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              playsInline
            />

            {/* Scanning Overlay */}
            {scanning && !result && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-4 border-green-500 w-64 h-48 animate-pulse"></div>
              </div>
            )}

            {/* Loading State */}
            {scanning && !result && (
              <div className="absolute top-4 left-0 right-0 flex justify-center">
                <div className="bg-white bg-opacity-90 rounded-full px-4 py-2 flex items-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">Scanning...</span>
                </div>
              </div>
            )}

            {/* Success State */}
            {result && foundItem && (
              <div className="absolute inset-0 bg-green-500 bg-opacity-90 flex flex-col items-center justify-center text-white">
                <CheckCircle className="w-16 h-16 mb-4" />
                <p className="text-2xl font-bold mb-2">Item Found!</p>
                <p className="text-lg">{foundItem.name}</p>
                <p className="text-sm mt-2">Stock: {foundItem.stockQuantity} units</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="absolute inset-0 bg-red-500 bg-opacity-90 flex flex-col items-center justify-center text-white p-4">
                <AlertCircle className="w-16 h-16 mb-4" />
                <p className="text-lg font-bold mb-2">Scan Failed</p>
                <p className="text-sm text-center">{error}</p>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-4 text-center text-sm text-gray-600">
            <p>Point your camera at a barcode</p>
            <p>Supported formats: UPC, EAN, Code 128, Code 39, QR Code</p>
          </div>

          {/* Permission Prompt */}
          {cameraPermission === 'denied' && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
              <p className="font-medium text-yellow-800">Camera access required</p>
              <p className="text-yellow-700 mt-1">
                Please enable camera access in your browser settings and refresh the page.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

##### **3. Add Barcode Lookup API** (30 min)
```typescript
// File: frontend/src/services/api/inventory.ts

// Add to inventory API
async getItemByBarcode(barcode: string): Promise<ApiResponse<{ item: InventoryItem | null }>> {
  return axios.get(`/api/inventory/items/barcode/${encodeURIComponent(barcode)}`);
}
```

##### **4. Update InventoryTab with Scan Button** (30 min)
```typescript
// File: frontend/src/components/shop/tabs/InventoryTab.tsx

// Add scan button to header
<div className="flex items-center gap-2">
  <button
    onClick={() => setScannerOpen(true)}
    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
  >
    <Camera className="w-4 h-4" />
    Scan Barcode
  </button>
  <button onClick={() => setAddModalOpen(true)} className="...">
    Add Item
  </button>
</div>

{/* Barcode Scanner Modal */}
<BarcodeScannerModal
  isOpen={scannerOpen}
  onClose={() => setScannerOpen(false)}
  mode="lookup"
  onBarcodeScanned={(barcode, item) => {
    if (item) {
      // Highlight found item in list
      setHighlightedItemId(item.id);

      // Scroll to item
      document.getElementById(`inventory-item-${item.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }}
/>
```

##### **5. Add Batch Scanning Mode** (1 hour)
```typescript
// File: frontend/src/components/shop/modals/BatchStockCountModal.tsx

// New modal for physical inventory counts
export function BatchStockCountModal({ isOpen, onClose }: Props) {
  const [scannedItems, setScannedItems] = useState<Map<string, number>>(new Map());
  const [scanning, setScanning] = useState(true);

  const handleBarcodeScanned = (barcode: string, item?: InventoryItem) => {
    if (item) {
      // Increment count for this item
      setScannedItems(prev => {
        const newMap = new Map(prev);
        const currentCount = newMap.get(item.id) || 0;
        newMap.set(item.id, currentCount + 1);
        return newMap;
      });
    }
  };

  const handleFinishCount = async () => {
    // Create stock adjustments for all scanned items
    for (const [itemId, count] of scannedItems.entries()) {
      const item = await inventoryApi.getItem(itemId);
      const difference = count - item.stockQuantity;

      if (difference !== 0) {
        await inventoryApi.adjustStock(itemId, {
          type: 'recount',
          quantityChange: difference,
          reason: 'Physical inventory count via barcode scanning',
          notes: `Scanned: ${count} units, Previous: ${item.stockQuantity} units`
        });
      }
    }

    toast.success(`Updated ${scannedItems.size} items from barcode scan`);
    onClose();
  };

  return (
    // Modal with continuous scanning + item count list
    // Show running tally of scanned items
    // Allow manual quantity adjustment before submitting
  );
}
```

#### **Backend Changes** (30 min)

##### **Add Barcode Lookup Endpoint**
```typescript
// File: backend/src/domains/InventoryDomain/controllers/inventoryController.ts

// Add to existing controller
async getItemByBarcode(req: Request, res: Response) {
  const { barcode } = req.params;
  const shopId = req.user!.shopId;

  try {
    const item = await this.inventoryRepository.findByBarcode(shopId, barcode);

    res.json({
      success: true,
      item: item || null
    });
  } catch (error) {
    logger.error('Get item by barcode error:', error);
    res.status(500).json({ success: false, message: 'Failed to lookup barcode' });
  }
}

// File: backend/src/domains/InventoryDomain/routes.ts
router.get('/items/barcode/:barcode', authenticateJWT, requireShopRole, inventoryController.getItemByBarcode);
```

### **Testing Checklist**
- [ ] Camera permission requested correctly
- [ ] Barcode scanning works on desktop (webcam)
- [ ] Barcode scanning works on mobile (back camera)
- [ ] Supports multiple barcode formats (UPC, EAN, QR)
- [ ] Found items highlighted in list
- [ ] Unknown barcodes offer to add new item
- [ ] Batch scanning counts items correctly
- [ ] Stock adjustments created from batch count
- [ ] Success/error sounds play
- [ ] Works in different lighting conditions

---

## 🎯 Feature 3: Automatic PO Suggestions

**Time Estimate:** 5-6 hours
**Priority:** HIGH (saves time, data-driven)

### **What It Does**
Automatically suggest purchase orders based on usage patterns, forecast analytics, and current stock levels.

### **User Stories**
- As a shop owner, I want **automatic PO suggestions** when items are running low
- As a shop owner, I want to see **recommended order quantities** based on usage
- As a shop owner, I want to **approve and create POs** with one click
- As a shop owner, I want suggestions to consider **lead time** from vendors

### **Implementation Plan**

#### **Backend Changes** (3-4 hours)

##### **1. Database Migration 116** (30 min)
```sql
-- File: backend/migrations/116_add_vendor_lead_times.sql

-- Add lead time to vendors
ALTER TABLE inventory_vendors
  ADD COLUMN lead_time_days INTEGER DEFAULT 7,
  ADD COLUMN minimum_order_amount DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN preferred BOOLEAN DEFAULT false;

COMMENT ON COLUMN inventory_vendors.lead_time_days IS 'Typical delivery time in days';
COMMENT ON COLUMN inventory_vendors.minimum_order_amount IS 'Minimum order value required by vendor';
COMMENT ON COLUMN inventory_vendors.preferred IS 'Mark as preferred vendor for auto-suggestions';

-- Create PO suggestions table (for audit trail)
CREATE TABLE purchase_order_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
  vendor_id UUID REFERENCES inventory_vendors(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  suggested_items JSONB NOT NULL, -- Array of {itemId, suggestedQty, reason}
  total_estimated_cost DECIMAL(10, 2),
  rationale TEXT, -- Why this suggestion was made
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days',
  approved_at TIMESTAMP,
  approved_by VARCHAR(255),
  po_id UUID REFERENCES purchase_orders(id), -- If converted to actual PO
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_po_suggestions_shop ON purchase_order_suggestions(shop_id);
CREATE INDEX idx_po_suggestions_vendor ON purchase_order_suggestions(vendor_id);
CREATE INDEX idx_po_suggestions_status ON purchase_order_suggestions(status);
CREATE INDEX idx_po_suggestions_expires ON purchase_order_suggestions(expires_at) WHERE status = 'pending';
```

##### **2. Create POSuggestionService** (2 hours)
```typescript
// File: backend/src/domains/InventoryDomain/services/POSuggestionService.ts

interface SuggestionItem {
  itemId: string;
  itemName: string;
  currentStock: number;
  lowStockThreshold: number;
  averageUsagePerDay: number;
  daysUntilStockout: number;
  suggestedQuantity: number;
  estimatedCost: number;
  urgency: 'critical' | 'high' | 'medium';
}

interface POSuggestion {
  vendorId: string;
  vendorName: string;
  items: SuggestionItem[];
  totalEstimatedCost: number;
  rationale: string;
  urgencyLevel: 'critical' | 'high' | 'medium';
}

export class POSuggestionService {
  constructor(private pool: Pool) {}

  // Main method: Generate PO suggestions for a shop
  async generateSuggestions(shopId: string): Promise<POSuggestion[]> {
    // 1. Get all low stock items with usage analytics
    const lowStockItems = await this.getLowStockItemsWithAnalytics(shopId);

    if (lowStockItems.length === 0) {
      return [];
    }

    // 2. Group items by vendor (prefer preferred vendors)
    const itemsByVendor = this.groupItemsByVendor(lowStockItems);

    // 3. Generate suggestion for each vendor
    const suggestions: POSuggestion[] = [];

    for (const [vendorId, items] of itemsByVendor.entries()) {
      const vendor = await this.getVendorDetails(vendorId);

      const suggestion = await this.createVendorSuggestion(
        vendor,
        items,
        shopId
      );

      // Only suggest if meets vendor minimum order amount
      if (suggestion.totalEstimatedCost >= (vendor.minimumOrderAmount || 0)) {
        suggestions.push(suggestion);
      }
    }

    // 4. Sort by urgency (critical first)
    suggestions.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2 };
      return urgencyOrder[a.urgencyLevel] - urgencyOrder[b.urgencyLevel];
    });

    // 5. Save suggestions to database for audit trail
    for (const suggestion of suggestions) {
      await this.saveSuggestion(shopId, suggestion);
    }

    return suggestions;
  }

  private async getLowStockItemsWithAnalytics(shopId: string): Promise<any[]> {
    const result = await this.pool.query(`
      WITH item_usage AS (
        SELECT
          ia.item_id,
          ABS(SUM(ia.quantity_change)) / 30.0 as avg_usage_per_day
        FROM inventory_adjustments ia
        WHERE ia.shop_id = $1
          AND ia.adjustment_type IN ('sale', 'service_completion', 'damage', 'loss')
          AND ia.quantity_change < 0
          AND ia.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY ia.item_id
      )
      SELECT
        i.id,
        i.name,
        i.stock_quantity,
        i.low_stock_threshold,
        i.vendor_id,
        i.cost,
        COALESCE(u.avg_usage_per_day, 0) as avg_usage_per_day,
        CASE
          WHEN u.avg_usage_per_day > 0
          THEN i.stock_quantity / u.avg_usage_per_day
          ELSE 999
        END as days_until_stockout
      FROM inventory_items i
      LEFT JOIN item_usage u ON u.item_id = i.id
      WHERE i.shop_id = $1
        AND i.status = 'available'
        AND i.stock_quantity <= i.low_stock_threshold
        AND i.vendor_id IS NOT NULL
      ORDER BY days_until_stockout ASC
    `, [shopId]);

    return result.rows;
  }

  private groupItemsByVendor(items: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();

    for (const item of items) {
      if (!item.vendor_id) continue;

      const vendorItems = grouped.get(item.vendor_id) || [];
      vendorItems.push(item);
      grouped.set(item.vendor_id, vendorItems);
    }

    return grouped;
  }

  private async createVendorSuggestion(
    vendor: any,
    items: any[],
    shopId: string
  ): Promise<POSuggestion> {
    const suggestionItems: SuggestionItem[] = items.map(item => {
      // Calculate suggested quantity
      // Formula: (avg usage per day * lead time days) + (avg usage per day * buffer days)
      const leadTimeDays = vendor.lead_time_days || 7;
      const bufferDays = 30; // 30 days supply as buffer
      const usagePerDay = parseFloat(item.avg_usage_per_day);

      const suggestedQty = Math.max(
        Math.ceil((usagePerDay * leadTimeDays) + (usagePerDay * bufferDays)),
        item.low_stock_threshold * 2 // At minimum, double the threshold
      );

      // Determine urgency
      const daysUntil = parseFloat(item.days_until_stockout);
      let urgency: 'critical' | 'high' | 'medium' = 'medium';
      if (daysUntil < leadTimeDays) urgency = 'critical';
      else if (daysUntil < leadTimeDays * 2) urgency = 'high';

      return {
        itemId: item.id,
        itemName: item.name,
        currentStock: item.stock_quantity,
        lowStockThreshold: item.low_stock_threshold,
        averageUsagePerDay: usagePerDay,
        daysUntilStockout: daysUntil,
        suggestedQuantity: suggestedQty,
        estimatedCost: parseFloat(item.cost || 0) * suggestedQty,
        urgency
      };
    });

    const totalCost = suggestionItems.reduce((sum, item) => sum + item.estimatedCost, 0);

    // Determine overall urgency (highest urgency item)
    const hasCritical = suggestionItems.some(i => i.urgency === 'critical');
    const hasHigh = suggestionItems.some(i => i.urgency === 'high');
    const overallUrgency = hasC ritical ? 'critical' : hasHigh ? 'high' : 'medium';

    // Generate rationale
    const criticalCount = suggestionItems.filter(i => i.urgency === 'critical').length;
    const rationale = this.generateRationale(suggestionItems, vendor, criticalCount);

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      items: suggestionItems,
      totalEstimatedCost: totalCost,
      rationale,
      urgencyLevel: overallUrgency
    };
  }

  private generateRationale(items: SuggestionItem[], vendor: any, criticalCount: number): string {
    const parts: string[] = [];

    if (criticalCount > 0) {
      parts.push(`🔴 ${criticalCount} item(s) will stock out before vendor delivery (${vendor.lead_time_days} days)`);
    }

    const totalItems = items.length;
    parts.push(`📦 ${totalItems} item(s) below reorder threshold`);

    const avgDaysUntilOut = items.reduce((sum, i) => sum + i.daysUntilStockout, 0) / totalItems;
    parts.push(`⏱️ Average ${Math.round(avgDaysUntilOut)} days until stockout`);

    parts.push(`📊 Order quantities based on 30-day usage forecast + ${vendor.lead_time_days}-day lead time`);

    return parts.join('\n');
  }

  private async saveSuggestion(shopId: string, suggestion: POSuggestion): Promise<string> {
    const result = await this.pool.query(`
      INSERT INTO purchase_order_suggestions (
        shop_id,
        vendor_id,
        status,
        suggested_items,
        total_estimated_cost,
        rationale
      ) VALUES ($1, $2, 'pending', $3, $4, $5)
      RETURNING id
    `, [
      shopId,
      suggestion.vendorId,
      JSON.stringify(suggestion.items),
      suggestion.totalEstimatedCost,
      suggestion.rationale
    ]);

    return result.rows[0].id;
  }

  // Approve suggestion and convert to actual PO
  async approveSuggestion(suggestionId: string, shopId: string): Promise<string> {
    const suggestion = await this.getSuggestion(suggestionId);

    if (suggestion.status !== 'pending') {
      throw new Error('Suggestion has already been processed');
    }

    // Create actual purchase order
    const poId = await this.createPOFromSuggestion(suggestion, shopId);

    // Mark suggestion as approved
    await this.pool.query(`
      UPDATE purchase_order_suggestions
      SET status = 'approved',
          approved_at = NOW(),
          po_id = $2
      WHERE id = $1
    `, [suggestionId, poId]);

    return poId;
  }
}
```

##### **3. Create API Endpoints** (1 hour)
```typescript
// File: backend/src/domains/InventoryDomain/controllers/poSuggestionController.ts

export class POSuggestionController {
  // GET /api/inventory/suggestions/:shopId
  async getSuggestions(req: Request, res: Response) {
    const { shopId } = req.params;

    try {
      const suggestions = await poSuggestionService.generateSuggestions(shopId);
      res.json({ success: true, suggestions });
    } catch (error) {
      logger.error('Get PO suggestions error:', error);
      res.status(500).json({ success: false, message: 'Failed to generate suggestions' });
    }
  }

  // POST /api/inventory/suggestions/:suggestionId/approve
  async approveSuggestion(req: Request, res: Response) {
    const { suggestionId } = req.params;
    const shopId = req.user!.shopId;

    try {
      const poId = await poSuggestionService.approveSuggestion(suggestionId, shopId);
      res.json({ success: true, poId });
    } catch (error) {
      logger.error('Approve suggestion error:', error);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // POST /api/inventory/suggestions/:suggestionId/reject
  async rejectSuggestion(req: Request, res: Response) {
    const { suggestionId } = req.params;

    try {
      await poSuggestionService.rejectSuggestion(suggestionId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Reject suggestion error:', error);
      res.status(500).json({ success: false, message: 'Failed to reject suggestion' });
    }
  }
}
```

#### **Frontend Changes** (2 hours)

##### **1. Create POSuggestionsCard Component** (1.5 hours)
```typescript
// File: frontend/src/components/shop/POSuggestionsCard.tsx

export function POSuggestionsCard({ shopId }: { shopId: string }) {
  const [suggestions, setSuggestions] = useState<POSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuggestions();
  }, [shopId]);

  const loadSuggestions = async () => {
    try {
      const response = await inventoryApi.getSuggestions(shopId);
      setSuggestions(response.data.suggestions);
    } catch (error) {
      toast.error('Failed to load PO suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (suggestionId: string) => {
    try {
      const response = await inventoryApi.approveSuggestion(suggestionId);
      toast.success(`Purchase order created: ${response.data.poId}`);
      loadSuggestions();
    } catch (error) {
      toast.error('Failed to create PO');
    }
  };

  if (loading) return <div>Loading suggestions...</div>;
  if (suggestions.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-6 h-6 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          AI-Powered Purchase Order Suggestions
        </h3>
      </div>

      <div className="space-y-4">
        {suggestions.map((suggestion, idx) => (
          <div key={idx} className="bg-white rounded-lg p-4 border border-gray-200">
            {/* Urgency Badge */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{suggestion.vendorName}</span>
                <Badge variant={
                  suggestion.urgencyLevel === 'critical' ? 'destructive' :
                  suggestion.urgencyLevel === 'high' ? 'warning' : 'default'
                }>
                  {suggestion.urgencyLevel.toUpperCase()}
                </Badge>
              </div>
              <span className="text-xl font-bold text-gray-900">
                ${suggestion.totalEstimatedCost.toFixed(2)}
              </span>
            </div>

            {/* Rationale */}
            <div className="bg-blue-50 rounded p-3 mb-3 whitespace-pre-line text-sm">
              {suggestion.rationale}
            </div>

            {/* Items List */}
            <div className="space-y-2 mb-4">
              <p className="text-sm font-medium text-gray-700">
                Suggested Items ({suggestion.items.length}):
              </p>
              {suggestion.items.slice(0, 3).map(item => (
                <div key={item.itemId} className="flex items-center justify-between text-sm bg-gray-50 rounded p-2">
                  <div>
                    <span className="font-medium">{item.itemName}</span>
                    <span className="text-gray-500 ml-2">
                      (Current: {item.currentStock}, Usage: {item.averageUsagePerDay.toFixed(1)}/day)
                    </span>
                  </div>
                  <span className="font-semibold">
                    Order: {item.suggestedQuantity} units
                  </span>
                </div>
              ))}
              {suggestion.items.length > 3 && (
                <p className="text-sm text-gray-500">
                  + {suggestion.items.length - 3} more items
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(suggestion.id)}
                className="flex-1 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Create PO with These Items
              </button>
              <button
                onClick={() => handleReject(suggestion.id)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

##### **2. Add to Inventory Dashboard** (30 min)
```typescript
// File: frontend/src/components/shop/tabs/InventoryTab.tsx

// Add at top of inventory tab (above item list)
<POSuggestionsCard shopId={shopId} />
```

### **Testing Checklist**
- [ ] Suggestions generated based on usage patterns
- [ ] Urgency levels calculated correctly
- [ ] Vendor lead times considered
- [ ] Minimum order amounts respected
- [ ] Approval creates actual PO
- [ ] Rejected suggestions hidden
- [ ] Suggestions expire after 7 days
- [ ] Empty state when no suggestions
- [ ] Cost estimates accurate
- [ ] Multiple vendors handled correctly

---

## 📊 Implementation Summary

### **Total Time Estimate**
- Feature 1 (Email Digest): 3-4 hours
- Feature 2 (Barcode Scanning): 3-4 hours
- Feature 3 (Auto PO Suggestions): 5-6 hours
- **Total: 11-14 hours**

### **Database Changes**
- Migration 115: Digest preferences (5 columns)
- Migration 116: Vendor lead times + PO suggestions table

### **API Endpoints Added**
1. `PUT /api/inventory/alerts/digest-settings/:shopId`
2. `GET /api/inventory/items/barcode/:barcode`
3. `GET /api/inventory/suggestions/:shopId`
4. `POST /api/inventory/suggestions/:id/approve`
5. `POST /api/inventory/suggestions/:id/reject`

### **Components Created**
1. `BarcodeScannerModal.tsx`
2. `BatchStockCountModal.tsx`
3. `POSuggestionsCard.tsx`

### **Components Modified**
1. `LowStockAlertsTab.tsx` - Add digest settings
2. `InventoryTab.tsx` - Add scan button + suggestions card
3. `VendorManagementModal.tsx` - Add lead time field

---

## 🚀 Deployment Plan

### **Phase 1: Email Digest (Week 1)**
1. Deploy migration 115
2. Update LowStockAlertService
3. Update frontend settings
4. Test with 2-3 shops
5. Monitor email delivery

### **Phase 2: Barcode Scanning (Week 2)**
1. Add camera permissions to app
2. Deploy barcode scanner component
3. Test on mobile devices
4. Gather user feedback
5. Optimize scan performance

### **Phase 3: Auto PO Suggestions (Week 3)**
1. Deploy migration 116
2. Deploy POSuggestionService
3. Deploy frontend suggestions card
4. Test with historical data
5. Monitor suggestion accuracy

---

## ✅ Success Metrics

### **Email Digest**
- [ ] 50%+ shops switch to weekly/monthly digest
- [ ] Email complaint rate < 1%
- [ ] Shop owners report less email fatigue

### **Barcode Scanning**
- [ ] 30%+ shops use barcode feature monthly
- [ ] Scan success rate > 90%
- [ ] Average scan time < 3 seconds

### **Auto PO Suggestions**
- [ ] 40%+ of suggested POs approved
- [ ] Stockouts reduced by 30%
- [ ] Shops save 2+ hours/month on ordering

---

**Next Step:** Choose which feature to implement first, or implement all three in sequence!

**Recommendation:** Start with **Email Digest** (quickest win, 3 hours), then **Barcode Scanning** (high delight), then **Auto PO Suggestions** (most complex).

// frontend/src/components/shop/modals/BatchStockCountModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Loader2, CheckCircle, Package, Save, Trash2, AlertCircle, BarChart3 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { inventoryApi } from '@/services/api/inventory';
import { useLocationStore } from '@/stores/locationStore';
import type { InventoryItem } from '@/types/inventory';

interface ScannedItem {
  item: InventoryItem;
  scannedCount: number;
  difference: number; // scannedCount - currentStock
  lastScannedAt: Date;
}

interface BatchStockCountModalProps {
  onClose: () => void;
  onComplete: () => void;
}

export const BatchStockCountModal: React.FC<BatchStockCountModalProps> = ({ onClose, onComplete }) => {
  const [scanning, setScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<Map<string, ScannedItem>>(new Map());
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const activeLocationId = useLocationStore((s) => s.activeLocationId);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerInitialized = useRef(false);

  // Statistics
  const totalItemsScanned = scannedItems.size;
  const totalScans = Array.from(scannedItems.values()).reduce((sum, item) => sum + item.scannedCount, 0);
  const itemsWithDiscrepancy = Array.from(scannedItems.values()).filter(item => item.difference !== 0).length;

  useEffect(() => {
    if (scannerInitialized.current) return;

    const initScanner = async () => {
      try {
        scannerInitialized.current = true;

        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setCameraPermission(permission.state as any);

        if (permission.state === 'denied') {
          setError('Camera access denied. Please enable camera in browser settings.');
          return;
        }

        html5QrCodeRef.current = new Html5Qrcode('batch-scanner-reader');
        await startScanning();
      } catch (err: any) {
        console.error('Scanner init error:', err);
        setError('Failed to initialize camera. Please check permissions.');
      }
    };

    initScanner();

    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    if (!html5QrCodeRef.current) return;

    try {
      setScanning(true);
      setError(null);

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        config,
        async (decodedText) => {
          setLastScannedBarcode(decodedText);
          await handleBarcodeScanned(decodedText);
        },
        (errorMessage) => {
          // Ignore scanning errors (expected when no barcode in view)
        }
      );
    } catch (err: any) {
      console.error('Start scanning error:', err);
      setError('Failed to start camera: ' + (err.message || 'Unknown error'));
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (!html5QrCodeRef.current) return;

    try {
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
      setScanning(false);
    } catch (err) {
      console.error('Stop scanning error:', err);
    }
  };

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      const response = await inventoryApi.getItemByBarcode(barcode);

      if (response.success && response.item) {
        const item = response.item;

        setScannedItems(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(item.id);

          if (existing) {
            // Increment count
            const newCount = existing.scannedCount + 1;
            newMap.set(item.id, {
              ...existing,
              scannedCount: newCount,
              difference: newCount - item.stockQuantity,
              lastScannedAt: new Date(),
            });
          } else {
            // First scan of this item
            newMap.set(item.id, {
              item,
              scannedCount: 1,
              difference: 1 - item.stockQuantity,
              lastScannedAt: new Date(),
            });
          }

          return newMap;
        });

        playSuccessSound();
      } else {
        // Item not found - brief error flash
        setError(`Unknown barcode: ${barcode}`);
        playErrorSound();
        setTimeout(() => setError(null), 1500);
      }
    } catch (err: any) {
      console.error('Lookup error:', err);
      setError('Failed to lookup barcode');
      setTimeout(() => setError(null), 2000);
    }
  };

  const adjustItemCount = (itemId: string, newCount: number) => {
    if (newCount < 0) return;

    setScannedItems(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(itemId);

      if (existing) {
        newMap.set(itemId, {
          ...existing,
          scannedCount: newCount,
          difference: newCount - existing.item.stockQuantity,
        });
      }

      return newMap;
    });
  };

  const removeItem = (itemId: string) => {
    setScannedItems(prev => {
      const newMap = new Map(prev);
      newMap.delete(itemId);
      return newMap;
    });
  };

  const handleSave = async () => {
    if (scannedItems.size === 0) {
      toast.error('No items scanned yet');
      return;
    }

    setSaving(true);

    try {
      // Create stock adjustments for all items with discrepancies
      const adjustments = Array.from(scannedItems.values()).filter(item => item.difference !== 0);

      if (adjustments.length === 0) {
        toast.info('All counts match current stock. No adjustments needed.');
        onComplete();
        onClose();
        return;
      }

      // Process adjustments
      for (const { item, scannedCount, difference } of adjustments) {
        await inventoryApi.adjustStock(item.id, {
          adjustmentType: 'recount',
          quantityChange: difference,
          reason: 'Physical inventory count via barcode scanning',
          notes: `Scanned: ${scannedCount} units, Previous: ${item.stockQuantity} units, Difference: ${difference > 0 ? '+' : ''}${difference}`,
          locationId: activeLocationId || undefined,
        });
      }

      toast.success(`Updated ${adjustments.length} item(s) from barcode scan`);
      onComplete();
      onClose();
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error('Failed to save stock counts. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const playSuccessSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUQ0PVKni77BgGwc+ltj1zoUsBC+BzvLYiTcIGWi77eefTRAMUKfj8LZjHAY4ktfyy3ksBSR3x/DdkEAKFF606+uoVRQKRp/g8r5sIQUxh9Hz04IzBh5uwO/jmVEND1Sp4u+wYBsHPpbY9c6FLCV/AAAAAwAD//8AAP//+wAA/wIAAwAC//0A//8AAAUA+gD+AAEA');
      audio.play().catch(() => {});
    } catch (err) {}
  };

  const playErrorSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRhIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YU4AAAAAAAD//wAA/v8AAP7/AAD+/wAA/v8AAP7/AAD+/wAA');
      audio.play().catch(() => {});
    } catch (err) {}
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Batch Stock Count</h2>
              <p className="text-sm text-gray-600">Scan items continuously for inventory count</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Side - Camera */}
          <div className="w-1/2 p-4 border-r">
            <div className="h-full flex flex-col">
              {/* Camera View */}
              <div className="relative bg-black rounded-lg overflow-hidden flex-1 mb-4">
                <div id="batch-scanner-reader" className="w-full h-full"></div>

                {/* Scanning Overlay */}
                {scanning && !error && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-4 border-green-500 w-64 h-48 animate-pulse rounded-lg"></div>
                  </div>
                )}

                {/* Error Overlay */}
                {error && (
                  <div className="absolute top-4 left-0 right-0 flex justify-center">
                    <div className="bg-red-500 bg-opacity-90 text-white rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  </div>
                )}

                {/* Last Scanned */}
                {lastScannedBarcode && !error && (
                  <div className="absolute top-4 left-0 right-0 flex justify-center">
                    <div className="bg-green-500 bg-opacity-90 text-white rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Scanned: {lastScannedBarcode}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{totalItemsScanned}</p>
                  <p className="text-xs text-blue-800">Unique Items</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{totalScans}</p>
                  <p className="text-xs text-green-800">Total Scans</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-600">{itemsWithDiscrepancy}</p>
                  <p className="text-xs text-orange-800">Discrepancies</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Scanned Items List */}
          <div className="w-1/2 p-4 flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Scanned Items</h3>

            {scannedItems.size === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Package className="w-16 h-16 mx-auto mb-2 opacity-50" />
                  <p>Start scanning to add items</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2">
                {Array.from(scannedItems.values()).map(({ item, scannedCount, difference }) => (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-3 ${
                      difference === 0
                        ? 'border-gray-200 bg-white'
                        : difference > 0
                        ? 'border-green-300 bg-green-50'
                        : 'border-red-300 bg-red-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        {item.sku && (
                          <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => adjustItemCount(item.id, scannedCount - 1)}
                          className="w-8 h-8 border border-gray-300 rounded hover:bg-gray-100 flex items-center justify-center"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={scannedCount}
                          onChange={(e) => adjustItemCount(item.id, parseInt(e.target.value) || 0)}
                          className="w-16 text-center border border-gray-300 rounded px-2 py-1"
                        />
                        <button
                          onClick={() => adjustItemCount(item.id, scannedCount + 1)}
                          className="w-8 h-8 border border-gray-300 rounded hover:bg-gray-100 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>

                      <div className="flex-1 text-sm">
                        <p className="text-gray-600">
                          System: <span className="font-medium">{item.stockQuantity}</span>
                        </p>
                        <p className={`font-medium ${difference === 0 ? 'text-green-600' : difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {difference > 0 ? '+' : ''}{difference} difference
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center gap-2 p-4 border-t bg-gray-50">
          <p className="text-sm text-gray-600">
            {itemsWithDiscrepancy > 0
              ? `${itemsWithDiscrepancy} item(s) will be adjusted`
              : 'All counts match system records'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || scannedItems.size === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Count ({scannedItems.size})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

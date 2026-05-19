// frontend/src/components/shop/modals/BarcodeScannerModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Loader2, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { inventoryApi } from '@/services/api/inventory';
import type { InventoryItem } from '@/types/inventory';

interface BarcodeScannerModalProps {
  onClose: () => void;
  onItemFound: (item: InventoryItem) => void;
  mode?: 'lookup' | 'add' | 'adjust';
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  onClose,
  onItemFound,
  mode = 'lookup',
}) => {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [foundItem, setFoundItem] = useState<InventoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [loadingItem, setLoadingItem] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerInitialized = useRef(false);

  // Initialize scanner on mount
  useEffect(() => {
    if (scannerInitialized.current) return;

    const initScanner = async () => {
      try {
        scannerInitialized.current = true;

        // Check camera permission
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setCameraPermission(permission.state as any);

        if (permission.state === 'denied') {
          setError('Camera access denied. Please enable camera in browser settings.');
          return;
        }

        // Initialize Html5Qrcode
        html5QrCodeRef.current = new Html5Qrcode('barcode-reader');

        // Start scanning
        await startScanning();
      } catch (err: any) {
        console.error('Scanner init error:', err);
        setError('Failed to initialize camera. Please check permissions.');
      }
    };

    initScanner();

    // Cleanup on unmount
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
        { facingMode: 'environment' }, // Prefer back camera on mobile
        config,
        async (decodedText) => {
          // Barcode detected
          console.log('Barcode detected:', decodedText);
          setResult(decodedText);

          // Stop scanning temporarily
          await stopScanning();

          // Lookup item
          await lookupItemByBarcode(decodedText);
        },
        (errorMessage) => {
          // Scanning errors (usually just "no barcode found")
          // Don't show these to user as they're expected
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

  const lookupItemByBarcode = async (barcode: string) => {
    setLoadingItem(true);
    try {
      const response = await inventoryApi.getItemByBarcode(barcode);

      if (response.success && response.item) {
        setFoundItem(response.item);
        playSuccessSound();
        toast.success(`Found: ${response.item.name}`);

        // Notify parent
        onItemFound(response.item);

        // Auto-close after 2 seconds in lookup mode
        if (mode === 'lookup') {
          setTimeout(() => {
            onClose();
          }, 2000);
        }
      } else {
        // Barcode not found
        setError(`No item found with barcode: ${barcode}`);
        playErrorSound();

        if (mode === 'add') {
          toast.error('Barcode not found. You can add it as a new item.');
          setTimeout(() => onClose(), 2000);
        } else {
          // Allow retry
          setTimeout(async () => {
            setError(null);
            setResult(null);
            await startScanning();
          }, 3000);
        }
      }
    } catch (err: any) {
      console.error('Lookup error:', err);
      setError('Failed to lookup barcode. Please try again.');
      playErrorSound();

      // Allow retry
      setTimeout(async () => {
        setError(null);
        setResult(null);
        await startScanning();
      }, 3000);
    } finally {
      setLoadingItem(false);
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

  const getModeTitle = () => {
    switch (mode) {
      case 'lookup':
        return 'Scan Barcode to Find Item';
      case 'add':
        return 'Scan Barcode to Add New Item';
      case 'adjust':
        return 'Scan Barcode to Adjust Stock';
      default:
        return 'Scan Barcode';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">{getModeTitle()}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera View */}
        <div className="p-4">
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ paddingBottom: '75%' }}>
            {/* Scanner Container */}
            <div id="barcode-reader" className="absolute inset-0 w-full h-full"></div>

            {/* Scanning Overlay */}
            {scanning && !result && !error && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-4 border-green-500 w-64 h-48 animate-pulse rounded-lg"></div>
              </div>
            )}

            {/* Loading State */}
            {(scanning || loadingItem) && !result && !error && (
              <div className="absolute top-4 left-0 right-0 flex justify-center">
                <div className="bg-white bg-opacity-90 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">
                    {loadingItem ? 'Looking up item...' : 'Scanning...'}
                  </span>
                </div>
              </div>
            )}

            {/* Success State */}
            {result && foundItem && (
              <div className="absolute inset-0 bg-green-500 bg-opacity-95 flex flex-col items-center justify-center text-white p-6">
                <CheckCircle className="w-20 h-20 mb-4" />
                <p className="text-2xl font-bold mb-2">Item Found!</p>
                <p className="text-xl mb-1">{foundItem.name}</p>
                {foundItem.sku && (
                  <p className="text-sm opacity-90 mb-2">SKU: {foundItem.sku}</p>
                )}
                <p className="text-lg font-semibold">Stock: {foundItem.stockQuantity} units</p>
                {mode === 'lookup' && (
                  <p className="text-sm mt-4 opacity-90">Closing...</p>
                )}
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="absolute inset-0 bg-red-500 bg-opacity-95 flex flex-col items-center justify-center text-white p-6 text-center">
                <AlertCircle className="w-16 h-16 mb-4" />
                <p className="text-lg font-bold mb-2">Scan Failed</p>
                <p className="text-sm">{error}</p>
                {error.includes('not found') && (
                  <p className="text-xs mt-3 opacity-90">Retrying in 3 seconds...</p>
                )}
              </div>
            )}

            {/* Permission Denied */}
            {cameraPermission === 'denied' && (
              <div className="absolute inset-0 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-center text-white p-6 text-center">
                <Camera className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-bold mb-2">Camera Access Required</p>
                <p className="text-sm opacity-90">
                  Please enable camera access in your browser settings and reload the page.
                </p>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">How to scan:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Point your camera at the barcode</li>
                  <li>Hold steady until the barcode is detected</li>
                  <li>Supported formats: UPC, EAN, Code 128, Code 39, QR Code</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Permission Help */}
          {cameraPermission === 'denied' && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm font-medium text-yellow-900 mb-1">Enable Camera Access:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-800">
                <li>Click the camera icon in your browser's address bar</li>
                <li>Select "Allow" for camera access</li>
                <li>Reload this page</li>
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

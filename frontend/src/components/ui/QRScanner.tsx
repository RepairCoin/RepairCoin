'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, X } from 'lucide-react';
import QrScanner from 'qr-scanner';

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose, isOpen }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);

  const startScanner = async () => {
    try {
      setError(null);
      setCameraLoading(true);

      // Wait for video element to be ready in the DOM
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!videoRef.current) {
        throw new Error("Video element not ready");
      }

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const scannedText = result.data;
          console.log("QR scan result:", scannedText);
          onScan(scannedText);
          stopScanner();
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment' // Use back camera on mobile
        }
      );

      setQrScanner(scanner);

      // Start the scanner with better error handling
      try {
        await scanner.start();
        setIsScanning(true);
        setCameraLoading(false);
      } catch (startError: any) {
        console.error("Scanner start error:", startError);

        // Provide more specific error messages
        if (startError.name === 'NotAllowedError') {
          setError("Camera permission denied. Please allow camera access in your browser settings.");
        } else if (startError.name === 'NotFoundError') {
          setError("No camera found on this device.");
        } else if (startError.name === 'NotReadableError') {
          setError("Camera is already in use by another application.");
        } else {
          setError("Failed to start camera. Please try again.");
        }

        setQrScanner(null);
        setCameraLoading(false);
      }
    } catch (err) {
      console.error("Error initializing QR scanner:", err);
      setError("Failed to initialize camera. Please try again.");
      setCameraLoading(false);
    }
  };

  const stopScanner = () => {
    if (qrScanner) {
      qrScanner.stop();
      qrScanner.destroy();
      setQrScanner(null);
    }

    // Explicitly stop all video tracks to ensure camera is released
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Camera track stopped:', track.kind);
      });
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
    setCameraLoading(false);
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  // Start scanner when modal opens
  useEffect(() => {
    if (isOpen) {
      startScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
      }
    };
  }, [qrScanner]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#212121] rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Camera className="w-6 h-6 text-[#FFCC00]" />
            Scan Wallet QR Code
          </h3>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-600 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="relative rounded-xl overflow-hidden bg-black">
          {error ? (
            <div className="flex flex-col items-center justify-center h-64 p-6 text-center">
              <CameraOff className="w-16 h-16 text-red-400 mb-4" />
              <p className="text-white mb-4">{error}</p>
              <button
                onClick={startScanner}
                className="px-6 py-3 bg-[#FFCC00] text-black font-medium rounded-lg hover:bg-yellow-500 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-64 object-cover rounded-xl"
                playsInline
                muted
              />
              {cameraLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
                  <div className="text-center">
                    <svg
                      className="animate-spin h-12 w-12 text-[#FFCC00] mx-auto mb-3"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <p className="text-white text-sm">Starting camera...</p>
                  </div>
                </div>
              )}
              {!cameraLoading && isScanning && (
                <div className="absolute inset-0 border-2 border-[#FFCC00] rounded-xl pointer-events-none">
                  <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#FFCC00]"></div>
                  <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#FFCC00]"></div>
                  <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#FFCC00]"></div>
                  <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#FFCC00]"></div>
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-gray-400 text-sm mt-4 text-center">
          Position the wallet QR code within the frame to scan the address
        </p>

        <button
          onClick={handleClose}
          className="w-full mt-4 px-4 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default QRScanner;
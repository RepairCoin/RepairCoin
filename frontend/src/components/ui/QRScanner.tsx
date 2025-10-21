'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, RotateCcw, X } from 'lucide-react';

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose, isOpen }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Import QR code detection library dynamically
  const [QrScanner, setQrScanner] = useState<any>(null);

  useEffect(() => {
    // Dynamically import QR scanner library
    const loadQrScanner = async () => {
      try {
        // Using qr-scanner library - install with: npm install qr-scanner
        const QrScannerModule = await import('qr-scanner');
        setQrScanner(QrScannerModule.default);
      } catch (err) {
        console.warn('QR Scanner library not available, using fallback canvas-based detection');
        // Fallback to a simpler implementation
        setQrScanner('fallback');
      }
    };

    if (isOpen) {
      loadQrScanner();
    }
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setHasPermission(true);
        setIsScanning(true);
        
        // Start scanning after video loads
        videoRef.current.onloadedmetadata = () => {
          startScanning();
        };
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setHasPermission(false);
      
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else if (err.name === 'NotSupportedError') {
        setError('Camera not supported on this device.');
      } else {
        setError('Failed to access camera. Please try again.');
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    setIsScanning(false);
  };

  const startScanning = () => {
    if (!videoRef.current || !canvasRef.current) return;

    if (QrScanner && QrScanner !== 'fallback') {
      // Use qr-scanner library if available
      try {
        const qrScanner = new QrScanner(
          videoRef.current,
          (result: any) => {
            if (result?.data) {
              onScan(result.data);
              stopCamera();
              onClose();
            }
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
          }
        );
        
        qrScanner.start();
        
        // Store reference for cleanup
        videoRef.current.qrScanner = qrScanner;
      } catch (err) {
        console.error('QR Scanner error:', err);
        setError('QR scanning failed. Please try again.');
      }
    } else {
      // Fallback: Basic canvas-based scanning
      scanIntervalRef.current = setInterval(() => {
        scanFrame();
      }, 500); // Scan every 500ms
    }
  };

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data for QR detection
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // This is a simplified approach - in a real implementation,
    // you'd use a QR detection library like jsQR
    try {
      // Placeholder for QR detection logic
      // In production, you'd use: jsQR(imageData.data, imageData.width, imageData.height)
      const qrResult = detectQRFromImageData(imageData);
      if (qrResult) {
        onScan(qrResult);
        stopCamera();
        onClose();
      }
    } catch (err) {
      // Silent fail for QR detection
    }
  };

  // Simplified QR detection placeholder
  const detectQRFromImageData = (imageData: ImageData): string | null => {
    // This is a placeholder - real implementation would use jsQR or similar
    // For demo purposes, return null (no QR detected)
    return null;
  };

  const switchCamera = async () => {
    stopCamera();
    setFacingMode(facingMode === 'user' ? 'environment' : 'user');
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  useEffect(() => {
    if (isOpen && QrScanner !== null) {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, QrScanner, facingMode]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="relative w-full h-full max-w-md max-h-screen bg-black">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-50 p-4">
          <div className="flex justify-between items-center">
            <h3 className="text-white text-lg font-semibold">Scan QR Code</h3>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Camera View */}
        <div className="relative w-full h-full">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <CameraOff className="w-16 h-16 text-red-400 mb-4" />
              <p className="text-white mb-4">{error}</p>
              <button
                onClick={startCamera}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : hasPermission === false ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <Camera className="w-16 h-16 text-yellow-400 mb-4" />
              <p className="text-white mb-4">Camera permission required</p>
              <p className="text-gray-300 text-sm mb-6">
                Please allow camera access to scan QR codes
              </p>
              <button
                onClick={startCamera}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Enable Camera
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              
              {/* Scanning overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Scanning frame */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="w-64 h-64 border-2 border-transparent">
                      {/* Corner indicators */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white"></div>
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white"></div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white"></div>
                      
                      {/* Scanning line animation */}
                      {isScanning && (
                        <div className="absolute inset-0 overflow-hidden">
                          <div className="absolute w-full h-0.5 bg-red-500 animate-pulse"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Dark overlay with hole */}
                <div className="absolute inset-0 bg-black bg-opacity-50">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-64 bg-transparent border border-white border-opacity-30 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4">
          <div className="flex justify-center items-center space-x-4">
            <button
              onClick={switchCamera}
              disabled={!isScanning}
              className="p-3 bg-white bg-opacity-20 text-white rounded-full hover:bg-opacity-30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Switch Camera"
            >
              <RotateCcw className="w-6 h-6" />
            </button>
            
            <div className="text-center">
              <p className="text-white text-sm">
                {isScanning ? 'Position QR code within the frame' : 'Starting camera...'}
              </p>
            </div>
          </div>
        </div>

        {/* Hidden canvas for frame processing */}
        <canvas
          ref={canvasRef}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default QRScanner;
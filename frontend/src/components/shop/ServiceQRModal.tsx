'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Share2, Copy, Check } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'react-hot-toast';

interface ServiceQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  serviceName: string;
  shopName: string;
}

export const ServiceQRModal: React.FC<ServiceQRModalProps> = ({
  isOpen,
  onClose,
  serviceId,
  serviceName,
  shopName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const serviceUrl = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/service/${serviceId}`;

  // Generate QR code
  useEffect(() => {
    if (isOpen && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        serviceUrl,
        {
          width: 300,
          margin: 2,
          color: {
            dark: '#101010',
            light: '#FFFFFF',
          },
        },
        (error) => {
          if (error) {
            console.error('Error generating QR code:', error);
            toast.error('Failed to generate QR code');
          }
        }
      );
    }
  }, [isOpen, serviceUrl]);

  const handleDownload = () => {
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${serviceName.replace(/\s+/g, '-')}-QR.png`;
      link.href = url;
      link.click();
      toast.success('QR code downloaded!');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(serviceUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: serviceName,
          text: `Check out this service: ${serviceName} at ${shopName}`,
          url: serviceUrl,
        });
      } catch (err) {
        // User cancelled share or error occurred
        if ((err as Error).name !== 'AbortError') {
          toast.error('Failed to share');
        }
      }
    } else {
      // Fallback to copy link
      handleCopyLink();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#101010] rounded-xl border border-gray-800 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Service QR Code</h2>
            <p className="text-sm text-gray-400 mt-1">Share this code with customers</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* QR Code */}
        <div className="px-6 py-8 flex flex-col items-center">
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <canvas ref={canvasRef} />
          </div>

          {/* Service Info */}
          <div className="mt-6 text-center">
            <h3 className="text-lg font-semibold text-white">{serviceName}</h3>
            <p className="text-sm text-gray-400 mt-1">{shopName}</p>
          </div>

          {/* URL Display */}
          <div className="mt-4 w-full">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg px-4 py-3 flex items-center gap-2">
              <input
                type="text"
                value={serviceUrl}
                readOnly
                className="flex-1 bg-transparent text-sm text-gray-300 outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="p-2 hover:bg-gray-700 rounded transition-colors"
                title="Copy link"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-800 flex gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 py-3 bg-[#FFCC00] hover:bg-[#e6b800] text-[#101010] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download QR
          </button>
          <button
            onClick={handleShare}
            className="flex-1 py-3 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 border border-gray-700"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>

        {/* Instructions */}
        <div className="px-6 py-4 bg-[#1a1a1a] border-t border-gray-800">
          <p className="text-xs text-gray-400 text-center">
            Customers can scan this QR code to view and book this service directly
          </p>
        </div>
      </div>
    </div>
  );
};

"use client";

import React, { useEffect, useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { toast } from "react-hot-toast";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrData: string;
  title?: string;
  description?: string;
  shareableLink?: string; // Optional shareable link instead of raw QR data
}

// QR Code generation using QR Server API
export function QRCodeModal({
  isOpen,
  onClose,
  qrData,
  title = "QR Code",
  description = "Scan this QR code",
  shareableLink,
}: QRCodeModalProps) {
  const [qrImageUrl, setQrImageUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && qrData) {
      setLoading(true);
      // Generate QR code URL using QR Server API (free service)
      const encodedData = encodeURIComponent(qrData);
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodedData}&bgcolor=FFFFFF&color=000000&format=png&qzone=1&margin=0`;

      setQrImageUrl(qrApiUrl);
      setLoading(false);
    }
  }, [isOpen, qrData]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all">
          {/* Header */}
          <div
            className="w-full flex items-center justify-between px-4 md:px-6 lg:px-8 py-3 md:py-4 text-white rounded-t-xl md:rounded-t-2xl"
            style={{
              backgroundImage: `url('/img/cust-ref-widget3.png')`,
              backgroundSize: "cover",
              backgroundPosition: "right",
              backgroundRepeat: "no-repeat",
            }}
          >
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-yellow-500 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="bg-[#212121] rounded-b-2xl p-6 flex flex-col items-center">
            {/* QR Code */}
            <div className="bg-white p-4 rounded-xl shadow-inner">
              {loading ? (
                <div className="w-64 h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                </div>
              ) : qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt="QR Code"
                  className="w-64 h-64"
                  onError={() => {
                    console.error("Failed to load QR code image");
                  }}
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center text-red-500">
                  No QR code data available
                </div>
              )}
            </div>

            {/* Description if provided */}
            {description && (
              <p className="mt-4 text-sm text-gray-300 text-center">
                {description}
              </p>
            )}

            {/* Copy Link Section - Only show if there's a shareable link */}
            {shareableLink && (
              <div className="mt-4 w-full max-w-xs">
                <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-2">
                  <input
                    type="text"
                    value={shareableLink}
                    readOnly
                    className="flex-1 bg-transparent text-xs text-gray-400 truncate outline-none"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(shareableLink);
                        setCopied(true);
                        toast.success("Link copied to clipboard!");
                        setTimeout(() => setCopied(false), 2000);
                      } catch (err) {
                        toast.error("Failed to copy link");
                      }
                    }}
                    className="p-2 bg-[#FFCC00] hover:bg-[#FFD700] text-black rounded-lg transition-colors"
                    title="Copy link"
                  >
                    {copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500 text-center">
                  Click to copy the shareable link
                </p>
              </div>
            )}

            {/* Expiry Notice */}
            <p className="mt-4 text-xs text-gray-400 text-center">
              This QR code expires in 60 seconds
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

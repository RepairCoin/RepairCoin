"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { ShopProfileClient } from "../customer/ShopProfileClient";

interface ShopProfilePreviewModalProps {
  shopId: string;
  onClose: () => void;
}

export const ShopProfilePreviewModal: React.FC<ShopProfilePreviewModalProps> = ({
  shopId,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";

    // Simulate loading time
    setTimeout(() => setIsLoading(false), 500);

    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-7xl max-h-[90vh] bg-[#0A0A0A] rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#101010] border-b border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white">Customer View Preview</h2>
            <p className="text-sm text-gray-400 mt-1">
              This is how customers see your shop profile
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors group"
            aria-label="Close preview"
          >
            <X className="w-6 h-6 text-gray-400 group-hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#FFCC00] animate-spin" />
            </div>
          ) : (
            <div className="p-6">
              <ShopProfileClient shopId={shopId} isPreviewMode={true} />
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="sticky bottom-0 px-6 py-3 bg-gray-900/50 border-t border-gray-800 backdrop-blur-sm">
          <p className="text-xs text-gray-400 text-center">
            💡 Tip: Make changes to your profile, save them, and refresh this preview to see updates
          </p>
        </div>
      </div>
    </div>
  );
};

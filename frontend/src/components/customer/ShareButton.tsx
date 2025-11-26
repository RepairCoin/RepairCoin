"use client";

import React, { useState } from "react";
import { Share2, Link as LinkIcon, Check } from "lucide-react";
import { toast } from "react-hot-toast";

interface ShareButtonProps {
  /**
   * Service name to share
   */
  serviceName: string;
  /**
   * Service ID for building URL
   */
  serviceId: string;
  /**
   * Shop name
   */
  shopName: string;
  /**
   * Size variant
   */
  size?: "sm" | "md" | "lg";
  /**
   * Custom className
   */
  className?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  serviceName,
  serviceId,
  shopName,
  size = "md",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Build the service URL
  const serviceUrl = `${window.location.origin}/customer/marketplace?service=${serviceId}`;
  const shareText = `Check out "${serviceName}" by ${shopName} on RepairCoin!`;

  // Size classes
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(serviceUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying link:", error);
      toast.error("Failed to copy link");
    }
  };

  const handleShareWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${serviceUrl}`)}`;
    window.open(whatsappUrl, "_blank");
    setIsOpen(false);
  };

  const handleShareTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(serviceUrl)}`;
    window.open(twitterUrl, "_blank");
    setIsOpen(false);
  };

  const handleShareFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(serviceUrl)}`;
    window.open(facebookUrl, "_blank");
    setIsOpen(false);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    if (isOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative">
      {/* Share Button */}
      <button
        onClick={handleToggle}
        className={`
          ${sizeClasses[size]}
          flex items-center justify-center
          rounded-full
          bg-gray-800 text-gray-400
          hover:bg-gray-700 hover:text-[#FFCC00]
          transition-all duration-200
          ${className}
        `}
        title="Share service"
      >
        <Share2 className={iconSizes[size]} />
      </button>

      {/* Share Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50 overflow-hidden">
          {/* Copy Link */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyLink();
            }}
            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-700 transition-colors"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-500" />
            ) : (
              <LinkIcon className="w-5 h-5 text-gray-400" />
            )}
            <span className="text-sm text-gray-300">
              {copied ? "Copied!" : "Copy Link"}
            </span>
          </button>

          {/* WhatsApp */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleShareWhatsApp();
            }}
            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            <span className="text-sm text-gray-300">WhatsApp</span>
          </button>

          {/* Twitter */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleShareTwitter();
            }}
            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="text-sm text-gray-300">Twitter</span>
          </button>

          {/* Facebook */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleShareFacebook();
            }}
            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span className="text-sm text-gray-300">Facebook</span>
          </button>
        </div>
      )}
    </div>
  );
};

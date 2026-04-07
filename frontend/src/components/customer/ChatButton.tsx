"use client";

import React, { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { FaFacebookMessenger, FaWhatsapp } from "react-icons/fa";

interface ChatButtonProps {
  whatsapp?: string;
  messenger?: string;
  shopName: string;
  serviceName: string;
  className?: string;
}

export const ChatButton: React.FC<ChatButtonProps> = ({
  whatsapp,
  messenger,
  shopName,
  serviceName,
  className = "",
}) => {
  const [showOptions, setShowOptions] = useState(false);

  // Don't render if no chat options available
  if (!whatsapp && !messenger) {
    return null;
  }

  // Generate pre-filled messages
  const whatsappMessage = encodeURIComponent(
    `Hi ${shopName}! I'm interested in your "${serviceName}" service. Is this available?`
  );

  const messengerMessage = encodeURIComponent(
    `Hi! I'm interested in your "${serviceName}" service.`
  );

  // Format WhatsApp URL
  const whatsappUrl = whatsapp
    ? `${whatsapp.includes('?') ? whatsapp : whatsapp}${whatsapp.includes('?') ? '&' : '?'}text=${whatsappMessage}`
    : null;

  // If only one option, show direct button
  if ((whatsapp && !messenger) || (!whatsapp && messenger)) {
    const url = whatsapp ? whatsappUrl : messenger;
    const Icon = whatsapp ? FaWhatsapp : FaFacebookMessenger;
    const label = whatsapp ? "WhatsApp" : "Messenger";
    const color = whatsapp ? "from-green-600 to-green-700 hover:from-green-700 hover:to-green-800" : "from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800";

    return (
      <a
        href={url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r ${color} text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg ${className}`}
      >
        <Icon className="w-4 h-4" />
        <span>Chat on {label}</span>
      </a>
    );
  }

  // Multiple options - show dropdown
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowOptions(!showOptions)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
      >
        <MessageCircle className="w-4 h-4" />
        <span>Chat Now</span>
        {showOptions ? (
          <X className="w-4 h-4" />
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Dropdown Menu */}
      {showOptions && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowOptions(false)}
          />

          {/* Options */}
          <div className="absolute top-full right-0 mt-2 w-56 bg-[#1A1A1A] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
            {whatsapp && (
              <a
                href={whatsappUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 hover:bg-green-600/10 transition-colors border-b border-gray-800"
                onClick={() => setShowOptions(false)}
              >
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <FaWhatsapp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">WhatsApp</p>
                  <p className="text-xs text-gray-400">Chat instantly</p>
                </div>
              </a>
            )}

            {messenger && (
              <a
                href={messenger}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 hover:bg-blue-600/10 transition-colors"
                onClick={() => setShowOptions(false)}
              >
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <FaFacebookMessenger className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Messenger</p>
                  <p className="text-xs text-gray-400">Chat on Facebook</p>
                </div>
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
};

"use client";

import React from "react";
import { MessagesContainer } from "@/components/messaging/MessagesContainer";
import { MessageCircle, HelpCircle } from "lucide-react";

interface MessagesTabProps {
  customerId: string;
}

export const MessagesTab: React.FC<MessagesTabProps> = ({ customerId }) => {
  return (
    <div className="h-full flex flex-col">
      {/* Header Info Banner (Optional) */}
      <div className="bg-gradient-to-r from-[#FFCC00]/10 to-[#FFD700]/10 border border-[#FFCC00]/20 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#FFCC00]/20 rounded-lg">
            <HelpCircle className="w-5 h-5 text-[#FFCC00]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">
              Message Shops Directly
            </h3>
            <p className="text-xs text-gray-400">
              Ask questions about services, confirm appointments, or get support from shops you've booked with.
            </p>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 bg-[#1A1A1A] border border-gray-800 rounded-lg overflow-hidden">
        <MessagesContainer userType="customer" currentUserId={customerId} />
      </div>
    </div>
  );
};

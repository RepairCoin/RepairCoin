"use client";

import React, { useState } from "react";
import { X, Package } from "lucide-react";
import { MockBooking, getStatusLabel, getStatusColor } from "./mockData";
import { BookingOverviewTab } from "./tabs/BookingOverviewTab";
import { BookingMessageTab } from "./tabs/BookingMessageTab";
import { BookingTimelineTab } from "./tabs/BookingTimelineTab";

interface BookingDetailsPanelProps {
  booking: MockBooking | null;
  onClose: () => void;
  onSendMessage: (bookingId: string, message: string) => void;
  isBlocked?: boolean;
  blockReason?: string;
}

type TabType = 'overview' | 'message' | 'timeline';

export const BookingDetailsPanel: React.FC<BookingDetailsPanelProps> = ({
  booking,
  onClose,
  onSendMessage,
  isBlocked = false,
  blockReason = "Action blocked"
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  if (!booking) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1A1A1A] rounded-2xl border border-gray-800">
        <div className="text-center p-8">
          <Package className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">Select a Booking</h3>
          <p className="text-gray-500 text-sm">
            Click on a booking from the list to view details
          </p>
        </div>
      </div>
    );
  }

  const tabs: { key: TabType; label: string; badge?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'message', label: 'Message', badge: booking.unreadCount > 0 ? booking.unreadCount : undefined },
    { key: 'timeline', label: 'Timeline' }
  ];

  const handleSendMessage = (message: string) => {
    onSendMessage(booking.bookingId, message);
  };

  return (
    <div className="h-full flex flex-col bg-[#1A1A1A] rounded-2xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-white">{booking.bookingId}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors lg:hidden"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(booking.status)}`}>
          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
          {getStatusLabel(booking.status)}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-white border-b-2 border-[#FFCC00]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.badge && (
              <span className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && <BookingOverviewTab booking={booking} />}
        {activeTab === 'message' && (
          <BookingMessageTab
            booking={booking}
            onSendMessage={handleSendMessage}
            isBlocked={isBlocked}
            blockReason={blockReason}
          />
        )}
        {activeTab === 'timeline' && <BookingTimelineTab booking={booking} />}
      </div>
    </div>
  );
};

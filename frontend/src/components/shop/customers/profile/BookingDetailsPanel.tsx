"use client";

import React from "react";
import { Calendar, DollarSign, CreditCard, Coins, Clock } from "lucide-react";

interface BookingOrder {
  orderId: string;
  serviceName: string;
  status: string;
  totalPrice: number;
  rcnDiscount: number;
  finalPrice: number;
  rcnEarned: number;
  paymentMethod?: string;
  bookingTimeSlot?: string;
  bookingEndTime?: string;
  createdAt: string;
  completedAt?: string;
  shopName?: string;
}

interface BookingDetailsPanelProps {
  booking: BookingOrder;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    paid: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    completed: "bg-green-500/20 text-green-400 border-green-500/30",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
    refunded: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${styles[status] || styles.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const formatDateTime = (dateStr?: string): string => {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const BookingDetailsPanel: React.FC<BookingDetailsPanelProps> = ({ booking }) => {
  const timelineEvents = [
    { label: "Order Created", time: booking.createdAt },
    ...(booking.bookingTimeSlot
      ? [{ label: "Scheduled", time: booking.bookingTimeSlot }]
      : []),
    ...(booking.completedAt
      ? [{ label: "Completed", time: booking.completedAt }]
      : []),
  ];

  return (
    <div className="bg-[#101010] rounded-[20px] p-5 border border-[#303236]">
      <h3 className="text-sm font-semibold text-[#FFCC00] mb-4">Booking Details</h3>

      {/* Service & Status */}
      <div className="mb-4">
        <p className="text-white font-semibold text-base mb-1">{booking.serviceName}</p>
        <p className="text-gray-500 text-xs font-mono mb-2">{booking.orderId}</p>
        <StatusBadge status={booking.status} />
      </div>

      {/* Info Grid */}
      <div className="space-y-3 mb-5">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-gray-400">Schedule:</span>
          <span className="text-white">{formatDateTime(booking.bookingTimeSlot)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="w-4 h-4 text-gray-500" />
          <span className="text-gray-400">Cost:</span>
          <span className="text-white">${booking.totalPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <CreditCard className="w-4 h-4 text-gray-500" />
          <span className="text-gray-400">Payment:</span>
          <span className="text-white">{booking.paymentMethod || "Card"}</span>
        </div>
      </div>

      {/* RepairCoin Impact */}
      <div className="bg-[#0A0A0A] rounded-xl p-4 border border-[#303236] mb-5">
        <h4 className="text-xs font-semibold text-[#FFCC00] mb-3 flex items-center gap-1.5">
          <Coins className="w-3.5 h-3.5" />
          RepairCoin Impact
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Earned</span>
            <span className="text-green-400 font-semibold">+{booking.rcnEarned.toFixed(1)} RCN</span>
          </div>
          {booking.rcnDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Redeemed</span>
              <span className="text-blue-400 font-semibold">-{booking.rcnDiscount.toFixed(1)} RCN</span>
            </div>
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Activity Timeline
        </h4>
        <div className="space-y-0">
          {timelineEvents.map((event, i) => (
            <div key={i} className="flex gap-3 relative">
              {/* Vertical line */}
              {i < timelineEvents.length - 1 && (
                <div className="absolute left-[7px] top-4 w-px h-full bg-[#303236]" />
              )}
              {/* Dot */}
              <div className="w-[15px] h-[15px] rounded-full bg-[#303236] border-2 border-[#FFCC00] flex-shrink-0 mt-0.5 z-10" />
              <div className="pb-4">
                <p className="text-sm text-white font-medium">{event.label}</p>
                <p className="text-xs text-gray-500">{formatDateTime(event.time)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

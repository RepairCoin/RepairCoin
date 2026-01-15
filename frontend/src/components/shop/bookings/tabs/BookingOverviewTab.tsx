"use client";

import React from "react";
import { User, MapPin, Phone, Wallet, Calendar, Clock, CreditCard, Coins, Package, Copy, Check } from "lucide-react";
import { MockBooking, getTierColor, formatDate, formatTime12Hour, truncateAddress } from "../mockData";
import { toast } from "react-hot-toast";

interface BookingOverviewTabProps {
  booking: MockBooking;
}

export const BookingOverviewTab: React.FC<BookingOverviewTabProps> = ({ booking }) => {
  const [copied, setCopied] = React.useState(false);

  const copyWalletAddress = () => {
    navigator.clipboard.writeText(booking.customerAddress);
    setCopied(true);
    toast.success('Wallet address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Service Info */}
      <div className="flex gap-3 p-4 bg-[#0D0D0D] rounded-xl border border-gray-800">
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
          {booking.serviceImageUrl ? (
            <img
              src={booking.serviceImageUrl}
              alt={booking.serviceName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-6 h-6 text-gray-600" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold">{booking.serviceName}</h3>
          <p className="text-gray-400 text-sm">{booking.serviceCategory} • {booking.serviceSubcategory}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#FFCC00]/20 text-[#FFCC00]">
              Earns +{booking.rcnEarned} RCN
            </span>
            {booking.rcnPromo > 0 && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                Running Promo +{booking.rcnPromo} RCN
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Customer Details */}
      <div className="p-4 bg-[#0D0D0D] rounded-xl border border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-gray-400" />
          <h4 className="text-white font-medium">Customer Details</h4>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              <span className="text-white">{booking.customerName}</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase text-black ${getTierColor(booking.customerTier)}`}>
              {booking.customerTier}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            <span className="text-gray-300">{booking.customerLocation}</span>
          </div>

          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-gray-500" />
            <span className="text-gray-300">{booking.customerPhone}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">Wallet Address:</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-[#1A1A1A] rounded-lg">
            <code className="text-gray-300 text-sm flex-1 truncate">{booking.customerAddress}</code>
            <button
              onClick={copyWalletAddress}
              className="p-1.5 hover:bg-gray-800 rounded transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Booking Details */}
      <div className="p-4 bg-[#0D0D0D] rounded-xl border border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-gray-400" />
          <h4 className="text-white font-medium">Booking Details</h4>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-sm">Date Booked</p>
            <p className="text-white font-medium">{formatDate(booking.bookedAt)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Service Date</p>
            <p className="text-white font-medium">{formatDate(booking.serviceDate)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Time</p>
            <p className="text-white font-medium">{formatTime12Hour(booking.serviceTime)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Amount</p>
            <p className="text-[#FFCC00] font-bold">${booking.amount.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Payment and Rewards */}
      <div className="p-4 bg-[#0D0D0D] rounded-xl border border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="w-4 h-4 text-gray-400" />
          <h4 className="text-white font-medium">Payment and Rewards</h4>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Method</span>
            <span className="text-white font-medium">
              {booking.paymentMethod || 'Awaiting Payment'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">RCN Earned</span>
            <span className="text-[#FFCC00] font-medium">+{booking.rcnEarned} RCN</span>
          </div>
          {booking.rcnPromo > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">RCN Gained thru Promo or Coupon</span>
              <span className="text-green-400 font-medium">+{booking.rcnPromo} RCN</span>
            </div>
          )}
          {booking.rcnRedeemed > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">RCN Redeemed</span>
              <span className="text-blue-400 font-medium">+{booking.rcnRedeemed} RCN</span>
            </div>
          )}
        </div>
      </div>

      {/* Internal Notes */}
      {booking.customerNotes && (
        <div className="p-4 bg-[#0D0D0D] rounded-xl border border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📝</span>
            <h4 className="text-white font-medium">Internal Notes (from the customer)</h4>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed italic">
            "{booking.customerNotes}"
          </p>
        </div>
      )}
    </div>
  );
};

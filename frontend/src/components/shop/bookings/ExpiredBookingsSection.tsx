"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, Trash2, XCircle, Loader2, Calendar, Clock, Package, CheckSquare, Square } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  getExpiredUnpaidBookings,
  bulkCancelOrders,
  cancelAllExpiredUnpaid,
  ServiceOrderWithDetails,
} from "@/services/api/services";
import { formatDate, formatTime12Hour, truncateAddress } from "./mockData";

interface ExpiredBookingsSectionProps {
  onRefreshNeeded: () => void;
}

export const ExpiredBookingsSection: React.FC<ExpiredBookingsSectionProps> = ({
  onRefreshNeeded,
}) => {
  const [loading, setLoading] = useState(true);
  const [expiredBookings, setExpiredBookings] = useState<ServiceOrderWithDetails[]>([]);
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [cancelling, setCancelling] = useState(false);

  const loadExpiredBookings = async () => {
    setLoading(true);
    try {
      const bookings = await getExpiredUnpaidBookings();
      setExpiredBookings(bookings);
    } catch (error) {
      console.error('Error loading expired bookings:', error);
      toast.error('Failed to load expired bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpiredBookings();
  }, []);

  const toggleBookingSelection = (orderId: string) => {
    setSelectedBookings((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedBookings.size === expiredBookings.length) {
      setSelectedBookings(new Set());
    } else {
      setSelectedBookings(new Set(expiredBookings.map((b) => b.orderId)));
    }
  };

  const handleBulkCancel = async () => {
    if (selectedBookings.size === 0) {
      toast.error('Please select at least one booking to cancel');
      return;
    }

    if (!confirm(`Are you sure you want to cancel ${selectedBookings.size} expired booking(s)?`)) {
      return;
    }

    setCancelling(true);
    try {
      const result = await bulkCancelOrders(
        Array.from(selectedBookings),
        'Expired unpaid booking - automatically cancelled'
      );

      if (result.failed && result.failed.length > 0) {
        toast.error(`Failed to cancel ${result.failed.length} booking(s)`);
      } else {
        toast.success(`Successfully cancelled ${result.cancelledCount} booking(s)`);
      }

      setSelectedBookings(new Set());
      await loadExpiredBookings();
      onRefreshNeeded();
    } catch (error) {
      console.error('Error bulk cancelling bookings:', error);
      toast.error('Failed to cancel selected bookings');
    } finally {
      setCancelling(false);
    }
  };

  const handleCancelAll = async () => {
    if (expiredBookings.length === 0) {
      toast.error('No expired bookings to cancel');
      return;
    }

    if (!confirm(`Are you sure you want to cancel ALL ${expiredBookings.length} expired booking(s)? This action cannot be undone.`)) {
      return;
    }

    setCancelling(true);
    try {
      const result = await cancelAllExpiredUnpaid();
      toast.success(`Successfully cancelled ${result.cancelledCount} expired booking(s)`);
      setSelectedBookings(new Set());
      await loadExpiredBookings();
      onRefreshNeeded();
    } catch (error) {
      console.error('Error cancelling all expired bookings:', error);
      toast.error('Failed to cancel all expired bookings');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#FFCC00] animate-spin" />
          <span className="ml-3 text-gray-400">Loading expired bookings...</span>
        </div>
      </div>
    );
  }

  if (expiredBookings.length === 0) {
    return (
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckSquare className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-white font-medium mb-2">All Clear!</h3>
          <p className="text-gray-400 text-sm">
            You have no expired unpaid bookings at this time.
          </p>
        </div>
      </div>
    );
  }

  const allSelected = selectedBookings.size === expiredBookings.length;

  return (
    <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Expired Unpaid Bookings</h3>
            <p className="text-sm text-gray-400">
              {expiredBookings.length} booking{expiredBookings.length !== 1 ? 's' : ''} past their scheduled date
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {selectedBookings.size > 0 && (
            <button
              onClick={handleBulkCancel}
              disabled={cancelling}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-lg text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Cancel Selected ({selectedBookings.size})
            </button>
          )}
          <button
            onClick={handleCancelAll}
            disabled={cancelling}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-lg text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Cancel All
          </button>
        </div>
      </div>

      {/* Select All Checkbox */}
      <div className="mb-4 pb-4 border-b border-gray-800">
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          {allSelected ? (
            <CheckSquare className="w-5 h-5 text-[#FFCC00]" />
          ) : (
            <Square className="w-5 h-5" />
          )}
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Bookings List */}
      <div className="space-y-3">
        {expiredBookings.map((booking) => {
          const isSelected = selectedBookings.has(booking.orderId);

          return (
            <div
              key={booking.orderId}
              onClick={() => toggleBookingSelection(booking.orderId)}
              className={`bg-[#0D0D0D] border rounded-lg p-4 cursor-pointer transition-all ${
                isSelected ? 'border-[#FFCC00] ring-1 ring-[#FFCC00]/30' : 'border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <div className="pt-1">
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-[#FFCC00]" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-600" />
                  )}
                </div>

                {/* Service Image */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                  {booking.serviceImageUrl ? (
                    <img
                      src={booking.serviceImageUrl}
                      alt={booking.serviceName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                      <Package className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                </div>

                {/* Booking Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium truncate">{booking.serviceName}</h4>
                  <p className="text-gray-400 text-sm truncate">
                    {booking.customerName} • {truncateAddress(booking.customerAddress)}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(booking.bookingDate || '')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime12Hour(booking.bookingTime || '')}
                    </div>
                    <div className="text-[#FFCC00] font-medium">
                      ${booking.totalAmount.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    <AlertTriangle className="w-3 h-3" />
                    Expired
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Message */}
      <div className="mt-4 p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg">
        <p className="text-sm text-orange-400">
          These bookings are past their scheduled date and have not been paid. Cancel them to keep your booking list clean.
        </p>
      </div>
    </div>
  );
};

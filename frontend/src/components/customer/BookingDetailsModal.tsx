"use client";

import React from "react";
import {
  X,
  Download,
  Printer,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  Store,
  DollarSign,
  ShoppingBag,
  CheckCircle,
  Package,
} from "lucide-react";
import { ServiceOrderWithDetails } from "@/services/api/services";

interface BookingDetailsModalProps {
  order: ServiceOrderWithDetails;
  isOpen: boolean;
  onClose: () => void;
}

export const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "pending":
        return {
          color: "text-yellow-400",
          bgColor: "bg-yellow-500/10",
          borderColor: "border-yellow-500/30",
          label: "⏳ Pending Approval",
        };
      case "paid":
        return {
          color: "text-blue-400",
          bgColor: "bg-blue-500/10",
          borderColor: "border-blue-500/30",
          label: "💳 Payment Confirmed",
        };
      case "approved":
        return {
          color: "text-green-400",
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/30",
          label: "✅ Approved",
        };
      case "scheduled":
        return {
          color: "text-purple-400",
          bgColor: "bg-purple-500/10",
          borderColor: "border-purple-500/30",
          label: "📅 Scheduled",
        };
      case "completed":
        return {
          color: "text-green-400",
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/30",
          label: "✅ Completed",
        };
      case "cancelled":
        return {
          color: "text-gray-400",
          bgColor: "bg-gray-500/10",
          borderColor: "border-gray-500/30",
          label: "❌ Cancelled",
        };
      default:
        return {
          color: "text-gray-400",
          bgColor: "bg-gray-500/10",
          borderColor: "border-gray-500/30",
          label: status,
        };
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Create a downloadable receipt
    const receiptContent = `
BOOKING RECEIPT
================

Order ID: ${order.orderId}
Date: ${formatDate(order.createdAt)}

SERVICE DETAILS
---------------
Service: ${order.serviceName}
${order.serviceDescription ? `Description: ${order.serviceDescription}\n` : ""}
Shop: ${order.shopName}
${order.shopAddress ? `Address: ${order.shopAddress}\n` : ""}
${order.shopCity ? `City: ${order.shopCity}\n` : ""}

${order.bookingTimeSlot ? `APPOINTMENT DETAILS\n-------------------\nDate: ${formatDate(order.bookingTimeSlot)}\nTime: ${formatTime(order.bookingTimeSlot)}\n\n` : ""}
PAYMENT BREAKDOWN
-----------------
Subtotal: $${order.totalAmount.toFixed(2)}
${order.rcnRedeemed ? `RCN Redeemed: ${order.rcnRedeemed.toFixed(2)} RCN\n` : ""}
${order.rcnDiscountUsd ? `RCN Discount: -$${order.rcnDiscountUsd.toFixed(2)}\n` : ""}
Final Amount: $${order.finalAmountUsd?.toFixed(2) || order.totalAmount.toFixed(2)}

${order.rcnEarned ? `RCN Earned: +${order.rcnEarned.toFixed(2)} RCN\n` : ""}
Status: ${order.status.toUpperCase()}

Thank you for using RepairCoin!
    `.trim();

    const blob = new Blob([receiptContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${order.orderId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const statusInfo = getStatusInfo(order.status);

  // Order timeline based on status
  const getTimeline = () => {
    const timeline = [
      {
        label: "Booking Created",
        date: order.createdAt,
        completed: true,
        icon: <ShoppingBag className="w-5 h-5" />,
      },
      {
        label: "Payment Confirmed",
        date: order.status !== "pending" ? order.createdAt : null,
        completed: order.status !== "pending" && order.status !== "cancelled",
        icon: <DollarSign className="w-5 h-5" />,
      },
      {
        label: "Approved by Shop",
        date: order.status === "approved" || order.status === "scheduled" || order.status === "completed" ? order.updatedAt : null,
        completed: order.status === "approved" || order.status === "scheduled" || order.status === "completed",
        icon: <CheckCircle className="w-5 h-5" />,
      },
      {
        label: "Service Scheduled",
        date: order.bookingTimeSlot || null,
        completed: order.status === "scheduled" || order.status === "completed",
        icon: <Calendar className="w-5 h-5" />,
      },
      {
        label: "Service Completed",
        date: order.completedAt || null,
        completed: order.status === "completed",
        icon: <Package className="w-5 h-5" />,
      },
    ];

    return timeline.filter((item) => order.status !== "cancelled" || item.completed);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1A1A1A] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-800 shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-[#1A1A1A] border-b border-gray-800 px-6 py-5 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-bold text-white">Booking Details</h2>
              <p className="text-sm text-gray-400 mt-1">
                Order ID: <span className="font-mono text-gray-300">{order.orderId}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                title="Download Receipt"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={handlePrint}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                title="Print Receipt"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status Badge */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold border ${statusInfo.bgColor} ${statusInfo.borderColor} ${statusInfo.color}`}>
              {statusInfo.label}
            </div>

            {/* Service Details */}
            <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#FFCC00]" />
                Service Details
              </h3>
              <div className="flex gap-4">
                {/* Service Image */}
                {order.serviceImageUrl ? (
                  <div className="w-32 h-32 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0">
                    <img
                      src={order.serviceImageUrl}
                      alt={order.serviceName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-12 h-12 text-gray-600" />
                  </div>
                )}
                {/* Service Info */}
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-white mb-2">{order.serviceName}</h4>
                  {order.serviceDescription && (
                    <p className="text-sm text-gray-400 mb-3">{order.serviceDescription}</p>
                  )}
                  <div className="text-2xl font-bold text-green-400">
                    ${order.totalAmount.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Shop Information */}
            <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Store className="w-5 h-5 text-[#FFCC00]" />
                Shop Information
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Shop Name</div>
                  <div className="text-white font-semibold">{order.shopName}</div>
                </div>
                {order.shopAddress && (
                  <div>
                    <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Address
                    </div>
                    <div className="text-white">
                      {order.shopAddress}
                      {order.shopCity && `, ${order.shopCity}`}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {order.shopPhone && (
                    <div>
                      <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        Phone
                      </div>
                      <div className="text-white">{order.shopPhone}</div>
                    </div>
                  )}
                  {order.shopEmail && (
                    <div>
                      <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        Email
                      </div>
                      <div className="text-white">{order.shopEmail}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Appointment Details */}
            {order.bookingTimeSlot && (
              <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#FFCC00]" />
                  Appointment Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Date
                    </div>
                    <div className="text-white font-semibold">
                      {formatDate(order.bookingTimeSlot)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Time
                    </div>
                    <div className="text-white font-semibold">
                      {formatTime(order.bookingTimeSlot)}
                    </div>
                  </div>
                </div>
                {order.notes && (
                  <div className="mt-4">
                    <div className="text-sm text-gray-400 mb-1">Notes</div>
                    <div className="text-white bg-gray-800/50 rounded-lg p-3">
                      {order.notes}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payment Breakdown */}
            <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#FFCC00]" />
                Payment Breakdown
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white font-semibold">
                    ${order.totalAmount.toFixed(2)}
                  </span>
                </div>
                {order.rcnRedeemed && order.rcnRedeemed > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-2">
                        <span className="text-xl">🪙</span>
                        RCN Redeemed
                      </span>
                      <span className="text-[#FFCC00] font-semibold">
                        {order.rcnRedeemed.toFixed(2)} RCN
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">RCN Discount</span>
                      <span className="text-green-400 font-semibold">
                        -${order.rcnDiscountUsd?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                  </>
                )}
                <div className="border-t border-gray-700 pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-lg">Final Amount</span>
                    <span className="text-green-400 font-bold text-xl">
                      ${order.finalAmountUsd?.toFixed(2) || order.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
                {order.rcnEarned && order.rcnEarned > 0 && order.status === "completed" && (
                  <div className="bg-gradient-to-r from-[#FFCC00]/20 to-[#FFD700]/10 border border-[#FFCC00]/30 rounded-lg p-4 mt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[#FFCC00] font-semibold flex items-center gap-2">
                        <span className="text-2xl">🪙</span>
                        RCN Earned
                      </span>
                      <span className="text-[#FFCC00] font-bold text-xl">
                        +{order.rcnEarned.toFixed(2)} RCN
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      RepairCoin rewards added to your balance
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Order Timeline */}
            <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#FFCC00]" />
                Order Timeline
              </h3>
              <div className="space-y-4">
                {getTimeline().map((item, index) => (
                  <div key={index} className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        item.completed
                          ? "bg-green-500/20 text-green-400"
                          : "bg-gray-700 text-gray-500"
                      }`}
                    >
                      {item.icon}
                    </div>
                    {/* Content */}
                    <div className="flex-1">
                      <div
                        className={`font-semibold ${
                          item.completed ? "text-white" : "text-gray-500"
                        }`}
                      >
                        {item.label}
                      </div>
                      {item.date && (
                        <div className="text-sm text-gray-400 mt-1">
                          {formatDate(item.date)}
                          {item.date && formatTime(item.date) && ` at ${formatTime(item.date)}`}
                        </div>
                      )}
                      {!item.completed && !item.date && (
                        <div className="text-sm text-gray-500 mt-1">Pending</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Booking Info */}
            <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-400 mb-1">Booking ID</div>
                  <div className="text-white font-mono">{order.orderId}</div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">Booking Date</div>
                  <div className="text-white">{formatDate(order.createdAt)}</div>
                </div>
                {order.stripePaymentIntentId && (
                  <div className="col-span-2">
                    <div className="text-gray-400 mb-1">Payment ID</div>
                    <div className="text-white font-mono text-xs break-all">
                      {order.stripePaymentIntentId}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[#1A1A1A] border-t border-gray-800 px-6 py-4">
            <button
              onClick={onClose}
              className="w-full bg-[#FFCC00] text-black font-bold py-3 rounded-lg hover:bg-[#FFD700] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

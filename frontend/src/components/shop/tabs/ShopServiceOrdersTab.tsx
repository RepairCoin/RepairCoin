"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  Loader2,
  Package,
  Search,
  MessageSquare,
  Copy,
  Phone,
  MapPin,
  CreditCard,
  Coins,
  FileText,
  ChevronRight,
  User,
  Star,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  getShopOrders,
  updateOrderStatus,
  ServiceOrderWithDetails,
  approveBooking,
  rescheduleBooking,
} from "@/services/api/services";
import { CompleteOrderModal } from "../modals/CompleteOrderModal";
import { MarkNoShowModal } from "../MarkNoShowModal";
import { RescheduleModal } from "../modals/RescheduleModal";

interface ShopServiceOrdersTabProps {
  shopId: string;
}

type FilterType = "all" | "pending" | "paid" | "completed" | "cancelled" | "no_show";

// Booking progress stages
type BookingStage = "requested" | "paid" | "approved" | "scheduled" | "completed";

const BOOKING_STAGES: BookingStage[] = ["requested", "paid", "approved", "scheduled", "completed"];

const getBookingStage = (order: ServiceOrderWithDetails): BookingStage => {
  if (order.status === "completed") return "completed";
  if (order.shopApproved && order.bookingDate) return "scheduled";
  if (order.shopApproved) return "approved";
  if (order.status === "paid") return "paid";
  return "requested";
};

const getStageIndex = (stage: BookingStage): number => BOOKING_STAGES.indexOf(stage);

// Progress bar component
const BookingProgressBar: React.FC<{ currentStage: BookingStage }> = ({ currentStage }) => {
  const currentIndex = getStageIndex(currentStage);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        {BOOKING_STAGES.map((stage, index) => {
          const isActive = index <= currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <div key={stage} className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full ${
                  isActive
                    ? isCurrent
                      ? "bg-[#FFCC00]"
                      : "bg-green-500"
                    : "bg-gray-600"
                }`}
              />
              <span
                className={`text-[10px] mt-1 capitalize ${
                  isActive ? "text-white" : "text-gray-500"
                }`}
              >
                {stage}
              </span>
            </div>
          );
        })}
      </div>
      <div className="relative h-1 bg-gray-700 rounded-full">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-500 to-[#FFCC00] rounded-full transition-all duration-300"
          style={{ width: `${(currentIndex / (BOOKING_STAGES.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
};

// Booking card component
const BookingCard: React.FC<{
  order: ServiceOrderWithDetails;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReschedule: () => void;
  onMarkComplete: () => void;
  onMarkNoShow: () => void;
  isProcessing: boolean;
}> = ({
  order,
  isSelected,
  onSelect,
  onApprove,
  onReschedule,
  onMarkComplete,
  onMarkNoShow,
  isProcessing,
}) => {
  const currentStage = getBookingStage(order);
  const needsApproval = order.status === "paid" && !order.shopApproved;

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return "-";
    // Convert 24h to 12h format
    const [hours, minutes] = timeString.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const generateBookingId = (orderId: string) => {
    return `BK-${orderId.slice(0, 6).toUpperCase()}`;
  };

  return (
    <div
      onClick={onSelect}
      className={`bg-[#1A1A1A] border rounded-xl p-4 cursor-pointer transition-all duration-200 ${
        isSelected
          ? "border-[#FFCC00] ring-1 ring-[#FFCC00]/30"
          : "border-gray-800 hover:border-gray-700"
      }`}
    >
      {/* Header: Service info */}
      <div className="flex gap-3 mb-3">
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
          {order.serviceImageUrl ? (
            <img
              src={order.serviceImageUrl}
              alt={order.serviceName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              <Package className="w-6 h-6 text-gray-600" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{order.serviceName}</h3>
          <p className="text-xs text-gray-400">
            {order.customerName || "Customer"} • {truncateAddress(order.customerAddress)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {needsApproval && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FFCC00]/20 text-[#FFCC00] border border-[#FFCC00]/30">
                <Clock className="w-3 h-3" />
                Waiting for Shop Approval
              </span>
            )}
            {order.status === "paid" && order.shopApproved && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                <CheckCircle className="w-3 h-3" />
                Approved
              </span>
            )}
            {order.status === "completed" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <CheckCircle className="w-3 h-3" />
                Completed
              </span>
            )}
            {order.status === "pending" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Clock className="w-3 h-3" />
                Pending Payment
              </span>
            )}
            {order.status === "no_show" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                <AlertTriangle className="w-3 h-3" />
                No-Show
              </span>
            )}
            {order.status === "cancelled" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                <X className="w-3 h-3" />
                Cancelled
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Date/Time/Cost boxes */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="bg-[#101010] rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Booked</p>
          <p className="text-xs text-white font-medium">{formatDate(order.createdAt)}</p>
        </div>
        <div className="bg-[#101010] rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Service Date</p>
          <p className="text-xs text-white font-medium">{formatDate(order.bookingDate)}</p>
        </div>
        <div className="bg-[#101010] rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Time</p>
          <p className="text-xs text-white font-medium">
            {formatTime(order.bookingTime || order.bookingTimeSlot)}
          </p>
        </div>
        <div className="bg-[#101010] rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Cost</p>
          <p className="text-xs text-white font-medium">${order.totalAmount.toFixed(2)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <BookingProgressBar currentStage={currentStage} />
      </div>

      {/* Message for pending approval */}
      {needsApproval && (
        <div className="flex items-start gap-2 mb-3 p-2 bg-[#FFCC00]/10 rounded-lg">
          <MessageSquare className="w-4 h-4 text-[#FFCC00] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#FFCC00]">
            The customer has requested this service and is waiting for your response
          </p>
        </div>
      )}

      {/* Booking ID and actions */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          Booking ID: <span className="text-white font-mono">{generateBookingId(order.orderId)}</span>
        </span>
        {needsApproval && (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReschedule();
              }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-transparent border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Reschedule
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onApprove();
              }}
              disabled={isProcessing}
              className="px-3 py-1.5 text-xs font-medium text-black bg-[#FFCC00] rounded-lg hover:bg-[#FFD700] transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <CheckCircle className="w-3 h-3" />
              Approve
            </button>
          </div>
        )}
        {order.status === "paid" && order.shopApproved && (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkNoShow();
              }}
              className="px-3 py-1.5 text-xs font-medium text-orange-400 bg-transparent border border-orange-400/50 rounded-lg hover:bg-orange-400/10 transition-colors"
            >
              No-Show
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkComplete();
              }}
              disabled={isProcessing}
              className="px-3 py-1.5 text-xs font-medium text-black bg-green-500 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <CheckCircle className="w-3 h-3" />
              Mark Complete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Booking detail panel component
const BookingDetailPanel: React.FC<{
  order: ServiceOrderWithDetails | null;
}> = ({ order }) => {
  const [activeTab, setActiveTab] = useState<"overview" | "message" | "timeline">("overview");

  if (!order) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Select a booking to view details</p>
        </div>
      </div>
    );
  }

  const currentStage = getBookingStage(order);
  const needsApproval = order.status === "paid" && !order.shopApproved;

  const generateBookingId = (orderId: string) => {
    return `BK-${orderId.slice(0, 6).toUpperCase()}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return "-";
    const [hours, minutes] = timeString.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const getTierBadgeColor = (tier?: string) => {
    switch (tier?.toLowerCase()) {
      case "gold":
        return "bg-[#FFCC00]/20 text-[#FFCC00] border-[#FFCC00]/30";
      case "silver":
        return "bg-gray-400/20 text-gray-300 border-gray-400/30";
      case "bronze":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-gray-600/20 text-gray-400 border-gray-600/30";
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  return (
    <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl overflow-hidden h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-white font-mono">
            {generateBookingId(order.orderId)}
          </h3>
          {needsApproval && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-[#FFCC00]/20 text-[#FFCC00] border border-[#FFCC00]/30">
              <Clock className="w-3 h-3" />
              Waiting for Shop Approval
            </span>
          )}
          {order.status === "paid" && order.shopApproved && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
              <CheckCircle className="w-3 h-3" />
              Paid - Ready to Service
            </span>
          )}
          {order.status === "completed" && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <CheckCircle className="w-3 h-3" />
              Completed
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-800 -mx-4 px-4">
          {(["overview", "message", "timeline"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 text-sm font-medium capitalize transition-colors relative ${
                activeTab === tab
                  ? "text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto max-h-[calc(100vh-300px)]">
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Service info */}
            <div className="flex items-center gap-3 p-3 bg-[#101010] rounded-lg">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                {order.serviceImageUrl ? (
                  <img
                    src={order.serviceImageUrl}
                    alt={order.serviceName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <Package className="w-6 h-6 text-gray-600" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">{order.serviceName}</h4>
                <p className="text-xs text-gray-400">{order.serviceCategory || "Service"}</p>
                <div className="flex items-center gap-2 mt-1">
                  {order.rcnEarned && order.rcnEarned > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#FFCC00]/20 text-[#FFCC00]">
                      Earns +{order.rcnEarned} RCN
                    </span>
                  )}
                  {order.promoRcn && order.promoRcn > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                      Running Promo +{order.promoRcn} RCN
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="bg-[#101010] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-gray-400" />
                <h4 className="text-sm font-semibold text-white">Customer Details</h4>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-white">{order.customerName || "Customer"}</span>
                    {order.customerTier && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-medium ${getTierBadgeColor(
                          order.customerTier
                        )}`}
                      >
                        {order.customerTier}
                      </span>
                    )}
                  </div>
                  {order.customerPhone && (
                    <div className="flex items-center gap-1 text-gray-400">
                      <Phone className="w-3 h-3" />
                      <span className="text-xs">{order.customerPhone}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Wallet Address</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">
                      {order.customerAddress.slice(0, 10)}...{order.customerAddress.slice(-8)}
                    </span>
                    <button
                      onClick={() => copyToClipboard(order.customerAddress, "Address")}
                      className="p-1 hover:bg-gray-800 rounded"
                    >
                      <Copy className="w-3 h-3 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking Details */}
            <div className="bg-[#101010] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <h4 className="text-sm font-semibold text-white">Booking Details</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Date Booked</p>
                  <p className="text-sm text-white">{formatDate(order.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Service Date</p>
                  <p className="text-sm text-white">{formatDate(order.bookingDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Time</p>
                  <p className="text-sm text-white">
                    {formatTime(order.bookingTime || order.bookingTimeSlot)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Amount</p>
                  <p className="text-sm text-white font-semibold">${order.totalAmount.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Payment and Rewards */}
            <div className="bg-[#101010] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <h4 className="text-sm font-semibold text-white">Payment and Rewards</h4>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Method</span>
                  <span className="text-xs text-white">Card •••• 4242</span>
                </div>
                {order.rcnEarned && order.rcnEarned > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">RCN Earned</span>
                    <span className="text-xs text-[#FFCC00]">+{order.rcnEarned} RCN</span>
                  </div>
                )}
                {order.promoRcn && order.promoRcn > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">RCN Gained thru Promo</span>
                    <span className="text-xs text-purple-400">+{order.promoRcn} RCN</span>
                  </div>
                )}
                {order.rcnRedeemed && order.rcnRedeemed > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">RCN Redeemed</span>
                    <span className="text-xs text-green-400">-{order.rcnRedeemed} RCN</span>
                  </div>
                )}
              </div>
            </div>

            {/* Internal Notes */}
            {order.notes && (
              <div className="bg-[#101010] rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <h4 className="text-sm font-semibold text-white">Internal Notes (from customer)</h4>
                </div>
                <p className="text-xs text-gray-400">{order.notes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "message" && (
          <div className="flex items-center justify-center h-48 text-gray-500">
            <div className="text-center">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages yet</p>
            </div>
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
              <div>
                <p className="text-xs text-white">Booking Created</p>
                <p className="text-[10px] text-gray-500">{formatDate(order.createdAt)}</p>
              </div>
            </div>
            {order.status !== "pending" && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                <div>
                  <p className="text-xs text-white">Payment Received</p>
                  <p className="text-[10px] text-gray-500">{formatDate(order.createdAt)}</p>
                </div>
              </div>
            )}
            {order.shopApproved && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                <div>
                  <p className="text-xs text-white">Booking Approved</p>
                  <p className="text-[10px] text-gray-500">{formatDate(order.approvedAt)}</p>
                </div>
              </div>
            )}
            {order.rescheduledAt && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-[#FFCC00] mt-1.5" />
                <div>
                  <p className="text-xs text-white">Booking Rescheduled</p>
                  <p className="text-[10px] text-gray-500">{formatDate(order.rescheduledAt)}</p>
                  {order.rescheduleReason && (
                    <p className="text-[10px] text-gray-400">Reason: {order.rescheduleReason}</p>
                  )}
                </div>
              </div>
            )}
            {order.status === "completed" && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                <div>
                  <p className="text-xs text-white">Service Completed</p>
                  <p className="text-[10px] text-gray-500">{formatDate(order.completedAt)}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const ShopServiceOrdersTab: React.FC<ShopServiceOrdersTabProps> = ({ shopId }) => {
  const [orders, setOrders] = useState<ServiceOrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrderWithDetails | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [completeOrder, setCompleteOrder] = useState<ServiceOrderWithDetails | null>(null);
  const [noShowOrder, setNoShowOrder] = useState<ServiceOrderWithDetails | null>(null);
  const [rescheduleOrder, setRescheduleOrder] = useState<ServiceOrderWithDetails | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<"bookings" | "messages">("bookings");

  useEffect(() => {
    loadOrders();
  }, [shopId]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      // Always load ALL orders - filtering is done client-side
      const response = await getShopOrders({
        limit: 500, // Load more to get all orders
      });

      if (response) {
        setOrders(response.data);
        // Auto-select first order if none selected
        if (!selectedOrder && response.data.length > 0) {
          setSelectedOrder(response.data[0]);
        }
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (order: ServiceOrderWithDetails) => {
    setUpdatingOrder(order.orderId);
    try {
      await approveBooking(order.orderId);
      toast.success("Booking approved successfully!");
      loadOrders();
    } catch (error) {
      console.error("Error approving booking:", error);
      toast.error("Failed to approve booking");
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handleReschedule = async (newDate: string, newTime: string, reason?: string) => {
    if (!rescheduleOrder) return;
    setUpdatingOrder(rescheduleOrder.orderId);
    try {
      await rescheduleBooking(rescheduleOrder.orderId, newDate, newTime, reason);
      toast.success("Booking rescheduled successfully!");
      setRescheduleOrder(null);
      loadOrders();
    } catch (error) {
      console.error("Error rescheduling booking:", error);
      toast.error("Failed to reschedule booking");
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handleMarkComplete = async () => {
    if (!completeOrder) return;
    setUpdatingOrder(completeOrder.orderId);
    try {
      await updateOrderStatus(completeOrder.orderId, "completed");
      toast.success("Order marked as completed! Customer will receive their RCN rewards.");
      setCompleteOrder(null);
      loadOrders();
    } catch (error) {
      console.error("Error completing order:", error);
      toast.error("Failed to complete order");
    } finally {
      setUpdatingOrder(null);
    }
  };

  // Filter orders by status filter and search query
  const filteredOrders = orders.filter((order) => {
    // First, apply status filter
    if (filter !== "all" && order.status !== filter) {
      return false;
    }

    // Then, apply search query
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.serviceName?.toLowerCase().includes(query) ||
      order.orderId.toLowerCase().includes(query) ||
      order.customerAddress.toLowerCase().includes(query) ||
      (order.customerName && order.customerName.toLowerCase().includes(query))
    );
  });

  // Calculate stats
  const stats = {
    pending: orders.filter((o) => o.status === "paid" && !o.shopApproved).length,
    paid: orders.filter((o) => o.status === "paid" && o.shopApproved).length,
    completed: orders.filter((o) => o.status === "completed").length,
    revenue: orders
      .filter((o) => o.status === "paid" || o.status === "completed")
      .reduce((sum, o) => sum + o.totalAmount, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin mx-auto mb-4" />
          <p className="text-white">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FFCC00]/20 rounded-lg">
              <Clock className="w-5 h-5 text-[#FFCC00]" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Pending Booking</p>
              <p className="text-2xl font-bold text-white">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Paid</p>
              <p className="text-2xl font-bold text-white">{stats.paid}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Completed</p>
              <p className="text-2xl font-bold text-white">{stats.completed}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FFCC00]/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-[#FFCC00]" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Revenue</p>
              <p className="text-2xl font-bold text-white">${stats.revenue.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-4 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveMainTab("bookings")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors relative ${
            activeMainTab === "bookings"
              ? "text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Bookings
          {activeMainTab === "bookings" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
          )}
        </button>
        <button
          onClick={() => setActiveMainTab("messages")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors relative ${
            activeMainTab === "messages"
              ? "text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Messages
          {stats.pending > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 absolute -top-0.5 right-0" />
          )}
          {activeMainTab === "messages" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
          )}
        </button>
      </div>

      {activeMainTab === "bookings" && (
        <>
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search booking ID, Customer Name"
                className="w-full pl-10 pr-4 py-2 bg-[#1A1A1A] border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {(["all", "pending", "paid", "completed", "cancelled", "no_show"] as FilterType[]).map(
                (status) => {
                  const displayName = status === "no_show" ? "No-Show" : status.charAt(0).toUpperCase() + status.slice(1);
                  return (
                    <button
                      key={status}
                      onClick={() => setFilter(status)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        filter === status
                          ? status === "no_show" ? "bg-orange-500 text-white" : "bg-[#FFCC00] text-black"
                          : "bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-[#FFCC00]/50"
                      }`}
                    >
                      {displayName}
                      {status !== "all" &&
                        ` (${orders.filter((o) => o.status === status).length})`}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Two-panel layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Booking cards */}
            <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
              {filteredOrders.length === 0 ? (
                <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-12 text-center">
                  <div className="text-4xl mb-4">📦</div>
                  <h3 className="text-lg font-semibold text-white mb-2">No Bookings Found</h3>
                  <p className="text-gray-400 text-sm">
                    {filter === "all"
                      ? "You haven't received any bookings yet"
                      : `No ${filter} bookings`}
                  </p>
                </div>
              ) : (
                filteredOrders.map((order) => (
                  <BookingCard
                    key={order.orderId}
                    order={order}
                    isSelected={selectedOrder?.orderId === order.orderId}
                    onSelect={() => setSelectedOrder(order)}
                    onApprove={() => handleApprove(order)}
                    onReschedule={() => setRescheduleOrder(order)}
                    onMarkComplete={() => setCompleteOrder(order)}
                    onMarkNoShow={() => setNoShowOrder(order)}
                    isProcessing={updatingOrder === order.orderId}
                  />
                ))
              )}
            </div>

            {/* Right: Detail panel */}
            <div className="hidden lg:block">
              <BookingDetailPanel order={selectedOrder} />
            </div>
          </div>
        </>
      )}

      {activeMainTab === "messages" && (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">Messages coming soon</p>
            <p className="text-sm text-gray-600">Customer messaging feature is in development</p>
          </div>
        </div>
      )}

      {/* Modals */}
      {completeOrder && (
        <CompleteOrderModal
          orderAmount={completeOrder.totalAmount}
          serviceName={completeOrder.serviceName}
          customerAddress={completeOrder.customerAddress}
          onConfirm={handleMarkComplete}
          onClose={() => setCompleteOrder(null)}
          isProcessing={updatingOrder === completeOrder.orderId}
        />
      )}

      <MarkNoShowModal
        order={noShowOrder}
        isOpen={!!noShowOrder}
        onClose={() => setNoShowOrder(null)}
        onSuccess={() => {
          setNoShowOrder(null);
          loadOrders();
        }}
      />

      {rescheduleOrder && (
        <RescheduleModal
          order={rescheduleOrder}
          shopId={shopId}
          onReschedule={handleReschedule}
          onClose={() => setRescheduleOrder(null)}
          isProcessing={updatingOrder === rescheduleOrder.orderId}
        />
      )}
    </div>
  );
};

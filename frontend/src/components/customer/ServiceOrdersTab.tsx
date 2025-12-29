"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  MapPin,
  Loader2,
  Star,
  Eye,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Store,
  RotateCcw
} from "lucide-react";
import { getCustomerOrders, ServiceOrderWithDetails, servicesApi } from "@/services/api/services";
import { WriteReviewModal } from "./WriteReviewModal";
import { BookingDetailsModal } from "./BookingDetailsModal";
import { BookingCard } from "./BookingCard";
import { CancelBookingModal } from "./CancelBookingModal";

export const ServiceOrdersTab: React.FC = () => {
  const router = useRouter();
  const [orders, setOrders] = useState<ServiceOrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [reviewingOrder, setReviewingOrder] = useState<ServiceOrderWithDetails | null>(null);
  const [reviewEligibility, setReviewEligibility] = useState<Map<string, boolean>>(new Map());
  const [showHelp, setShowHelp] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "status">("date");
  const [viewingOrder, setViewingOrder] = useState<ServiceOrderWithDetails | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<ServiceOrderWithDetails | null>(null);

  useEffect(() => {
    loadOrders();
  }, [filter]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const statusFilter = filter === "all" ? undefined : filter;
      const response = await getCustomerOrders({
        status: statusFilter,
        limit: 50,
      });

      if (response) {
        setOrders(response.data);
        // Check review eligibility for completed orders
        checkReviewEligibility(response.data);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const checkReviewEligibility = async (ordersList: ServiceOrderWithDetails[]) => {
    const completedOrders = ordersList.filter((order) => order.status === "completed");
    const eligibilityMap = new Map<string, boolean>();

    await Promise.all(
      completedOrders.map(async (order) => {
        try {
          const response = await servicesApi.canReviewOrder(order.orderId);
          eligibilityMap.set(order.orderId, response.canReview);
        } catch (error) {
          console.error(`Error checking review eligibility for order ${order.orderId}:`, error);
          eligibilityMap.set(order.orderId, false);
        }
      })
    );

    setReviewEligibility(eligibilityMap);
  };

  const handleWriteReview = (order: ServiceOrderWithDetails) => {
    setReviewingOrder(order);
  };

  const handleBookAgain = (order: ServiceOrderWithDetails) => {
    // Navigate to the service page so user can book it again
    router.push(`/customer/services/${order.serviceId}`);
    toast.success("Redirecting to service page...");
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "pending":
        return {
          icon: <Clock className="w-5 h-5" />,
          text: "Pending",
          badge: "⏳ Waiting for Shop Approval",
          badgeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
          description: "Waiting for approval or payment. You'll see the next action in the Ongoing status section.",
          color: "text-yellow-300"
        };
      case "paid":
        return {
          icon: <DollarSign className="w-5 h-5" />,
          text: "Paid",
          badge: "💳 Payment Confirmed",
          badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
          description: "Payment is confirmed. The shop may still finalize schedule details.",
          color: "text-blue-300"
        };
      case "approved":
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          text: "Approved",
          badge: "✅ Approved",
          badgeColor: "bg-green-500/20 text-green-300 border-green-500/30",
          description: "The shop accepted your booking. Scheduling is next.",
          color: "text-green-300"
        };
      case "scheduled":
        return {
          icon: <Calendar className="w-5 h-5" />,
          text: "Scheduled",
          badge: "📅 Scheduled",
          badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
          description: "Your service date and time are locked in.",
          color: "text-purple-300"
        };
      case "completed":
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          text: "Completed",
          badge: "✅ Completed",
          badgeColor: "bg-green-500/20 text-green-300 border-green-500/30",
          description: "The service has been finished. You can now view your receipt, leave a review, and keep this record for future reference.",
          color: "text-green-300"
        };
      case "cancelled":
        return {
          icon: <XCircle className="w-5 h-5" />,
          text: "Cancelled",
          badge: "❌ Cancelled",
          badgeColor: "bg-gray-500/20 text-gray-300 border-gray-500/30",
          description: "This booking was cancelled.",
          color: "text-gray-300"
        };
      default:
        return {
          icon: <Clock className="w-5 h-5" />,
          text: status,
          badge: status,
          badgeColor: "bg-gray-500/20 text-gray-300 border-gray-500/30",
          description: "",
          color: "text-gray-300"
        };
    }
  };

  const getProgressPercentage = (status: string) => {
    switch (status) {
      case "pending": return 20;
      case "paid": return 40;
      case "approved": return 60;
      case "scheduled": return 80;
      case "completed": return 100;
      case "cancelled": return 0;
      default: return 0;
    }
  };

  const getCurrentStep = (status: string) => {
    switch (status) {
      case "pending": return 1;
      case "paid": return 2;
      case "approved": return 3;
      case "scheduled": return 4;
      case "completed": return 5;
      case "cancelled": return 0;
      default: return 0;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
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

  // Calculate summary counts
  const getSummary = () => {
    return {
      pending: orders.filter(o => o.status === "pending").length,
      paid: orders.filter(o => o.status === "paid" || o.status === "approved" || o.status === "scheduled").length,
      completed: orders.filter(o => o.status === "completed").length,
      cancelled: orders.filter(o => o.status === "cancelled").length,
    };
  };

  const summary = getSummary();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin mx-auto mb-4" />
          <p className="text-white">Loading your bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="w-8 h-8 text-[#FFCC00]" />
            <h1 className="text-3xl font-bold text-white">My Bookings</h1>
          </div>
          <p className="text-gray-400">View and manage your service bookings</p>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Sort by</span>
          <button className="px-4 py-2 bg-[#1A1A1A] border border-gray-800 rounded-lg text-white text-sm hover:border-[#FFCC00]/50 transition-colors">
            Date
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`relative px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
            filter === "all"
              ? "bg-[#FFCC00] text-black"
              : "bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-[#FFCC00]/50"
          }`}
        >
          All
          {filter === "all" && summary.pending > 0 && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {summary.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter("pending")}
          className={`relative px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
            filter === "pending"
              ? "bg-[#FFCC00] text-black"
              : "bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-[#FFCC00]/50"
          }`}
        >
          Pending
          {summary.pending > 0 && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {summary.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter("paid")}
          className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
            filter === "paid"
              ? "bg-[#FFCC00] text-black"
              : "bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-[#FFCC00]/50"
          }`}
        >
          Paid
        </button>
        <button
          onClick={() => setFilter("completed")}
          className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
            filter === "completed"
              ? "bg-[#FFCC00] text-black"
              : "bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-[#FFCC00]/50"
          }`}
        >
          Completed
        </button>
        <button
          onClick={() => setFilter("cancelled")}
          className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
            filter === "cancelled"
              ? "bg-[#FFCC00] text-black"
              : "bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-[#FFCC00]/50"
          }`}
        >
          Cancelled
        </button>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Bookings Found</h3>
          <p className="text-gray-400 mb-6">
            {filter === "all"
              ? "You haven't booked any services yet"
              : `No ${filter} bookings`}
          </p>
          <button
            onClick={() => setFilter("all")}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold px-6 py-3 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200"
          >
            View All Bookings
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bookings Cards */}
          <div className="lg:col-span-2 space-y-4">
            {orders.map((order) => {
              const statusInfo = getStatusInfo(order.status);
              const progress = getProgressPercentage(order.status);

              return (
                <BookingCard
                  key={order.orderId}
                  serviceImageUrl={order.serviceImageUrl}
                  serviceName={order.serviceName}
                  shopName={order.shopName}
                  shopCity={order.shopCity}
                  statusBadge={
                    <span
                      className={`inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold border whitespace-nowrap ${statusInfo.badgeColor}`}
                    >
                      {statusInfo.badge}
                    </span>
                  }
                  dateBooked={order.createdAt}
                  serviceDate={order.bookingTimeSlot}
                  serviceTime={order.bookingTimeSlot ? formatTime(order.bookingTimeSlot) : undefined}
                  cost={order.totalAmount}
                  progressSection={
                    order.status !== "cancelled" ? (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-300">
                            Ongoing Status
                          </span>
                          <span className="text-xs text-gray-500">
                            Step {getCurrentStep(order.status)} out of 5
                          </span>
                        </div>
                        <div className="flex gap-1.5 mb-3">
                          {[20, 40, 60, 80, 100].map((step, index) => {
                            const isCompleted = progress >= step;
                            return (
                              <div
                                key={index}
                                className={`flex-1 h-2.5 rounded-full transition-all duration-500 ${
                                  isCompleted ? "bg-green-500" : "bg-gray-700"
                                }`}
                              />
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-xs">
                          <div className={`${progress >= 20 ? "text-white" : "text-gray-500"}`}>Requested</div>
                          <div className={`${progress >= 40 ? "text-white" : "text-gray-500"}`}>Paid</div>
                          <div className={`${progress >= 60 ? "text-white" : "text-gray-500"}`}>Approved</div>
                          <div className={`${progress >= 80 ? "text-white" : "text-gray-500"}`}>Scheduled</div>
                          <div className={`${progress >= 100 ? "text-white" : "text-gray-500"}`}>Completed</div>
                        </div>
                      </div>
                    ) : undefined
                  }
                  additionalSections={
                    order.noShow ? (
                      <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                            <XCircle className="w-5 h-5 text-orange-400" />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-orange-400 mb-1 text-base">Marked as No-Show</div>
                            <div className="text-sm text-orange-200/80">
                              This booking was marked as no-show by the shop.
                              {order.noShowNotes && ` Note: ${order.noShowNotes}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : undefined
                  }
                  nextActionSection={
                    order.status === "pending" ? (
                      <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-4 mb-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                            <Clock className="w-5 h-5 text-yellow-400" />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-yellow-400 mb-1 text-base">Next Action</div>
                            <div className="text-sm text-yellow-200/80">
                              Waiting for shop approval. You'll be notified once they respond.
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : undefined
                  }
                  actionButtons={
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setViewingOrder(order)}
                        className="flex items-center justify-center gap-1.5 bg-[#FFCC00] text-black font-semibold px-4 py-2 rounded-lg hover:bg-[#FFD700] transition-colors text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                      {order.status === "pending" && (
                        <button
                          onClick={() => setCancellingOrder(order)}
                          className="flex items-center gap-1.5 bg-red-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel
                        </button>
                      )}
                      {order.status === "completed" && reviewEligibility.get(order.orderId) === true && (
                        <button
                          onClick={() => handleWriteReview(order)}
                          className="flex items-center gap-1.5 bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold px-4 py-2 rounded-lg hover:from-green-500 hover:to-green-400 transition-all text-sm"
                        >
                          <Star className="w-4 h-4" />
                          Review
                        </button>
                      )}
                      {(order.status === "completed" || order.status === "cancelled") && (
                        <button
                          onClick={() => handleBookAgain(order)}
                          className="flex items-center gap-1.5 bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Book Again
                        </button>
                      )}
                    </div>
                  }
                  rcnBadge={
                    order.status === "completed" && order.rcnEarned && order.rcnEarned > 0 ? (
                      <div className="mt-3 bg-gradient-to-r from-[#FFCC00]/20 to-[#FFD700]/10 border border-[#FFCC00]/30 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">🪙</span>
                          <div>
                            <div className="text-sm font-semibold text-[#FFCC00]">
                              You earned +{order.rcnEarned.toFixed(2)} RCN
                            </div>
                            <div className="text-xs text-gray-400">
                              RepairCoin rewards for this service
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : undefined
                  }
                  bookingId={order.orderId}
                />
              );
            })}
          </div>

          {/* Quick Summary Sidebar */}
          <div className="space-y-4">
            {/* Summary Card */}
            <div className="bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] border border-gray-800 rounded-xl p-5 sticky top-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-[#FFCC00] rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-black" />
                </div>
                <h3 className="font-bold text-white">Quick Summary</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#0D0D0D] rounded-lg border border-yellow-500/20">
                  <div>
                    <div className="text-2xl font-bold text-white">{summary.pending}</div>
                    <div className="text-xs text-gray-400">Pending</div>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-400" />
                </div>

                <div className="flex items-center justify-between p-3 bg-[#0D0D0D] rounded-lg border border-blue-500/20">
                  <div>
                    <div className="text-2xl font-bold text-white">{summary.paid}</div>
                    <div className="text-xs text-gray-400">Paid</div>
                  </div>
                  <DollarSign className="w-8 h-8 text-blue-400" />
                </div>

                <div className="flex items-center justify-between p-3 bg-[#0D0D0D] rounded-lg border border-green-500/20">
                  <div>
                    <div className="text-2xl font-bold text-white">{summary.completed}</div>
                    <div className="text-xs text-gray-400">Completed</div>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>

                <div className="flex items-center justify-between p-3 bg-[#0D0D0D] rounded-lg border border-gray-500/20">
                  <div>
                    <div className="text-2xl font-bold text-white">{summary.cancelled}</div>
                    <div className="text-xs text-gray-400">Cancelled</div>
                  </div>
                  <XCircle className="w-8 h-8 text-gray-400" />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-800">
                <div className="text-xs text-gray-500 mb-1">Tip:</div>
                <div className="text-sm text-gray-300">
                  Tap "View" on any booking to see the full timeline, receipts, and actions.
                </div>
              </div>
            </div>

            {/* Status Guide */}
            <div className="bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] border border-gray-800 rounded-xl p-5">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="w-full flex items-center justify-between mb-4"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-[#FFCC00]" />
                  <h3 className="font-bold text-white">What each status means</h3>
                </div>
                {showHelp ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {showHelp && (
                <div className="space-y-3">
                  {["pending", "paid", "approved", "scheduled", "completed"].map((status) => {
                    const info = getStatusInfo(status);
                    return (
                      <div key={status} className="flex items-start gap-3 p-3 bg-[#0D0D0D] rounded-lg">
                        <div className={`mt-0.5 ${info.color}`}>{info.icon}</div>
                        <div>
                          <div className={`font-semibold mb-1 ${info.color}`}>
                            {info.text}
                          </div>
                          <div className="text-xs text-gray-400 leading-relaxed">
                            {info.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Write Review Modal */}
      {reviewingOrder && (
        <WriteReviewModal
          order={reviewingOrder}
          isOpen={!!reviewingOrder}
          onClose={() => setReviewingOrder(null)}
          onSuccess={() => {
            setReviewingOrder(null);
            loadOrders();
          }}
        />
      )}

      {/* Booking Details Modal */}
      {viewingOrder && (
        <BookingDetailsModal
          order={viewingOrder}
          isOpen={!!viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}

      {/* Cancel Booking Modal */}
      <CancelBookingModal
        order={cancellingOrder}
        isOpen={!!cancellingOrder}
        onClose={() => setCancellingOrder(null)}
        onSuccess={() => {
          setCancellingOrder(null);
          loadOrders();
        }}
      />
    </div>
  );
};

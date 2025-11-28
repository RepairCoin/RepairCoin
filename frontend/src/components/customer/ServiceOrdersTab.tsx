"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
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
  Edit
} from "lucide-react";
import { getCustomerOrders, ServiceOrderWithDetails, servicesApi } from "@/services/api/services";
import { WriteReviewModal } from "./WriteReviewModal";

export const ServiceOrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<ServiceOrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [reviewingOrder, setReviewingOrder] = useState<ServiceOrderWithDetails | null>(null);
  const [reviewEligibility, setReviewEligibility] = useState<Map<string, boolean>>(new Map());

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          text: "Paid",
          className: "bg-green-500/20 text-green-400 border-green-500/30",
        };
      case "completed":
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          text: "Completed",
          className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        };
      case "pending":
        return {
          icon: <Clock className="w-4 h-4" />,
          text: "Pending Payment",
          className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        };
      case "cancelled":
        return {
          icon: <XCircle className="w-4 h-4" />,
          text: "Cancelled",
          className: "bg-gray-500/20 text-gray-400 border-gray-500/30",
        };
      case "refunded":
        return {
          icon: <XCircle className="w-4 h-4" />,
          text: "Refunded",
          className: "bg-red-500/20 text-red-400 border-red-500/30",
        };
      default:
        return {
          icon: <Clock className="w-4 h-4" />,
          text: status,
          className: "bg-gray-500/20 text-gray-400 border-gray-500/30",
        };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Bookings</h1>
          <p className="text-gray-400">View and manage your service bookings</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["all", "pending", "paid", "completed", "cancelled"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === status
                ? "bg-[#FFCC00] text-black"
                : "bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-[#FFCC00]/50"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
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
        <div className="space-y-3">
          {orders.map((order) => {
            const statusBadge = getStatusBadge(order.status);
            return (
              <div
                key={order.orderId}
                className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4 hover:border-[#FFCC00]/30 transition-all duration-200"
              >
                <div className="flex gap-4">
                  {/* Service Image - Smaller */}
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                    {order.serviceImageUrl ? (
                      <img
                        src={order.serviceImageUrl}
                        alt={order.serviceName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-gray-600" />
                      </div>
                    )}
                  </div>

                  {/* Order Details */}
                  <div className="flex-1 min-w-0">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-white truncate">
                          {order.serviceName}
                        </h3>
                        <p className="text-xs text-gray-400 truncate">{order.shopName}</p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${statusBadge.className}`}
                      >
                        {statusBadge.icon}
                        {statusBadge.text}
                      </span>
                    </div>

                    {/* Info Row */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mb-2">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        <span className="font-semibold text-green-500">
                          ${order.totalAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(order.createdAt)}
                      </div>
                      {order.bookingDate && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(order.bookingDate)}
                        </div>
                      )}
                    </div>

                    {/* RCN Earned - Compact */}
                    {order.status === "completed" && order.rcnEarned && order.rcnEarned > 0 && (
                      <div className="bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-lg px-3 py-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🪙</span>
                          <span className="text-xs font-semibold text-[#FFCC00]">
                            +{order.rcnEarned.toFixed(2)} RCN Earned
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Review Button - Compact */}
                    {order.status === "completed" && (
                      <>
                        {reviewEligibility.get(order.orderId) === true ? (
                          <button
                            onClick={() => handleWriteReview(order)}
                            className="w-full bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-medium px-3 py-2 rounded-lg hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200 inline-flex items-center justify-center gap-1.5 text-sm"
                          >
                            <Star className="w-3.5 h-3.5" />
                            Write Review
                          </button>
                        ) : reviewEligibility.get(order.orderId) === false ? (
                          <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-xs text-green-400 font-medium">
                              Review submitted
                            </span>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Results Count */}
      {orders.length > 0 && (
        <p className="text-center text-gray-500 text-sm">
          Showing {orders.length} booking{orders.length !== 1 ? "s" : ""}
        </p>
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
    </div>
  );
};

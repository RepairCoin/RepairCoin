"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  User,
  Loader2,
  Package,
} from "lucide-react";
import { getShopOrders, updateOrderStatus, ServiceOrderWithDetails } from "@/services/api/services";

interface ShopServiceOrdersTabProps {
  shopId: string;
}

export const ShopServiceOrdersTab: React.FC<ShopServiceOrdersTabProps> = ({ shopId }) => {
  const [orders, setOrders] = useState<ServiceOrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, [filter, shopId]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const statusFilter = filter === "all" ? undefined : filter;
      const response = await getShopOrders({
        status: statusFilter,
        limit: 100,
      });

      if (response) {
        setOrders(response.data);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkCompleted = async (orderId: string) => {
    if (!confirm("Mark this order as completed? This action cannot be undone.")) {
      return;
    }

    setUpdatingOrder(orderId);
    try {
      await updateOrderStatus(orderId, "completed");
      toast.success("Order marked as completed!");
      loadOrders();
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Failed to update order status");
    } finally {
      setUpdatingOrder(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          text: "Paid - Ready to Service",
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
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin mx-auto mb-4" />
          <p className="text-white">Loading service bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Service Bookings</h1>
          <p className="text-gray-400">Manage your service orders and bookings</p>
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

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Pending</p>
              <p className="text-xl font-bold text-white">
                {orders.filter((o) => o.status === "pending").length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Receipt className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Paid</p>
              <p className="text-xl font-bold text-white">
                {orders.filter((o) => o.status === "paid").length}
              </p>
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
              <p className="text-xl font-bold text-white">
                {orders.filter((o) => o.status === "completed").length}
              </p>
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
              <p className="text-xl font-bold text-white">
                ${orders
                  .filter((o) => o.status === "paid" || o.status === "completed")
                  .reduce((sum, o) => sum + o.totalAmount, 0)
                  .toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Bookings Found</h3>
          <p className="text-gray-400 mb-6">
            {filter === "all"
              ? "You haven't received any service bookings yet"
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
        <div className="space-y-4">
          {orders.map((order) => {
            const statusBadge = getStatusBadge(order.status);
            return (
              <div
                key={order.orderId}
                className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6 hover:border-[#FFCC00]/30 transition-all duration-200"
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Service Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">
                          {order.serviceName}
                        </h3>
                        {order.serviceDescription && (
                          <p className="text-sm text-gray-400 mb-2">
                            {order.serviceDescription}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap ${statusBadge.className}`}
                      >
                        {statusBadge.icon}
                        {statusBadge.text}
                      </span>
                    </div>

                    {/* Customer Info */}
                    <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Customer Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Wallet Address:</span>
                          <code className="text-[#FFCC00] bg-[#FFCC00]/10 px-2 py-1 rounded">
                            {truncateAddress(order.customerAddress)}
                          </code>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Full Address:</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(order.customerAddress);
                              toast.success("Address copied!");
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 underline"
                          >
                            Copy Full Address
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Order Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-semibold text-green-500">
                          ${order.totalAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Calendar className="w-4 h-4" />
                        Booked {formatDate(order.createdAt)}
                      </div>
                    </div>

                    {order.bookingDate && (
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                        <Clock className="w-4 h-4" />
                        Scheduled for {formatDate(order.bookingDate)}
                      </div>
                    )}

                    {order.notes && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-300">
                          <span className="font-semibold text-blue-400">Customer Notes:</span>{" "}
                          {order.notes}
                        </p>
                      </div>
                    )}

                    <div className="text-xs text-gray-500">Order ID: {order.orderId}</div>
                  </div>

                  {/* Actions */}
                  {order.status === "paid" && (
                    <div className="lg:w-48 flex flex-col gap-3">
                      <button
                        onClick={() => handleMarkCompleted(order.orderId)}
                        disabled={updatingOrder === order.orderId}
                        className="w-full bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold px-4 py-3 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {updatingOrder === order.orderId ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Package className="w-4 h-4" />
                            Mark Completed
                          </>
                        )}
                      </button>
                      <p className="text-xs text-gray-500 text-center">
                        Mark as completed after service is done
                      </p>
                    </div>
                  )}

                  {order.status === "completed" && order.completedAt && (
                    <div className="lg:w-48">
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                        <CheckCircle className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-blue-400">Completed</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(order.completedAt)}
                        </p>
                      </div>
                    </div>
                  )}
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
    </div>
  );
};

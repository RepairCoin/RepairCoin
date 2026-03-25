import { useState, useMemo, useCallback } from "react";
import { useServiceOrdersQuery } from "../queries/useServiceOrdersQuery";
import { bookingApi } from "@/shared/services/booking.services";
import { appointmentApi } from "@/shared/services/appointment.services";
import { OrderFilterType, ServiceOrderWithDetails, OrderStats } from "../../types";

const FILTERS: { key: OrderFilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "no_show", label: "No-Show" },
];

export function useServiceOrdersUI() {
  const { data: orders = [], isLoading, refetch } = useServiceOrdersQuery();
  const [filter, setFilter] = useState<OrderFilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrderWithDetails | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    return (orders as ServiceOrderWithDetails[]).filter((order) => {
      // Status filter
      if (filter === "pending" && !(order.status === "paid" && !order.shopApproved)) return false;
      if (filter === "paid" && !(order.status === "paid" && order.shopApproved)) return false;
      if (filter === "completed" && order.status !== "completed") return false;
      if (filter === "cancelled" && order.status !== "cancelled") return false;
      if (filter === "no_show" && order.status !== "no_show") return false;

      // Search
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        order.serviceName?.toLowerCase().includes(q) ||
        order.orderId.toLowerCase().includes(q) ||
        order.customerAddress?.toLowerCase().includes(q) ||
        order.customerName?.toLowerCase().includes(q)
      );
    });
  }, [orders, filter, searchQuery]);

  const stats: OrderStats = useMemo(() => {
    const all = orders as ServiceOrderWithDetails[];
    return {
      pending: all.filter((o) => o.status === "paid" && !o.shopApproved).length,
      paid: all.filter((o) => o.status === "paid" && o.shopApproved).length,
      completed: all.filter((o) => o.status === "completed").length,
      revenue: all
        .filter((o) => o.status === "paid" || o.status === "completed")
        .reduce((sum, o) => sum + o.totalAmount, 0),
    };
  }, [orders]);

  const handleApprove = useCallback(
    async (orderId: string) => {
      setProcessingId(orderId);
      try {
        await bookingApi.approveOrder(orderId);
        await refetch();
      } finally {
        setProcessingId(null);
      }
    },
    [refetch]
  );

  const handleMarkComplete = useCallback(
    async (orderId: string) => {
      setProcessingId(orderId);
      try {
        await bookingApi.updateOrderStatus(orderId, "completed");
        await refetch();
      } finally {
        setProcessingId(null);
      }
    },
    [refetch]
  );

  const handleMarkNoShow = useCallback(
    async (orderId: string, notes?: string) => {
      setProcessingId(orderId);
      try {
        await appointmentApi.markOrderAsNoShow(orderId, notes);
        await refetch();
      } finally {
        setProcessingId(null);
      }
    },
    [refetch]
  );

  return {
    orders: filteredOrders,
    allOrders: orders as ServiceOrderWithDetails[],
    isLoading,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    selectedOrder,
    setSelectedOrder,
    stats,
    processingId,
    handleApprove,
    handleMarkComplete,
    handleMarkNoShow,
    refetch,
    filters: FILTERS,
  };
}

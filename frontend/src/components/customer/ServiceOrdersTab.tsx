"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  Loader2,
  Star,
  Eye,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { getCustomerOrders, ServiceOrderWithDetails, servicesApi, OrderStatus } from "@/services/api/services";
import { ListSkeleton } from "@/components/ui/skeleton";
import { WriteReviewModal } from "./WriteReviewModal";
import { BookingDetailsModal } from "./BookingDetailsModal";
import { BookingCard } from "./BookingCard";
import { CancelBookingModal } from "./CancelBookingModal";
import { formatBookingId } from "@/utils/formatters";
import DisputeModal from "./DisputeModal";
import { getDisputeStatus } from "@/services/api/noShow";
import type { NoShowHistoryEntry } from "@/services/api/noShow";
import { AlertTriangle } from "lucide-react";
import Pagination from "@/components/shop/groups/shared/Pagination";

// No-Show banner with dispute status awareness
const NoShowBanner: React.FC<{
  order: ServiceOrderWithDetails;
  onDispute: () => void;
}> = ({ order, onDispute }) => {
  const [disputeInfo, setDisputeInfo] = useState<{
    status: string | null;
    reason?: string;
    resolutionNotes?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDispute = async () => {
      try {
        const data = await getDisputeStatus(order.orderId);
        if (data) {
          setDisputeInfo({
            status: data.disputeStatus || null,
            reason: data.disputeReason,
            resolutionNotes: data.disputeResolutionNotes,
          });
        }
      } catch {
        // No dispute exists yet — that's fine
        setDisputeInfo(null);
      } finally {
        setLoading(false);
      }
    };
    fetchDispute();
  }, [order.orderId]);

  // Dispute approved — green banner
  if (disputeInfo?.status === "approved") {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-green-400 mb-1 text-base">Dispute Approved</div>
            <div className="text-sm text-green-200/80">
              Your no-show dispute has been approved. The penalty has been reversed.
            </div>
            {disputeInfo.resolutionNotes && (
              <div className="text-sm text-green-200/60 mt-1">
                Shop note: {disputeInfo.resolutionNotes}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Dispute rejected — red banner
  if (disputeInfo?.status === "rejected") {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-red-400 mb-1 text-base">Dispute Rejected</div>
            <div className="text-sm text-red-200/80">
              Your no-show dispute was reviewed and rejected by the shop.
            </div>
            {disputeInfo.resolutionNotes && (
              <div className="text-sm text-red-200/60 mt-1">
                Reason: {disputeInfo.resolutionNotes}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Dispute pending — blue banner
  if (disputeInfo?.status === "pending") {
    return (
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-blue-400 mb-1 text-base">Dispute Under Review</div>
            <div className="text-sm text-blue-200/80">
              Your dispute has been submitted and is waiting for the shop to review.
            </div>
            {disputeInfo.reason && (
              <div className="text-sm text-blue-200/60 mt-1">
                Your reason: {disputeInfo.reason}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No dispute yet — orange banner with dispute button
  return (
    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-orange-400 mb-1 text-base">Marked as No-Show</div>
          <div className="text-sm text-orange-200/80">
            This booking was marked as no-show by the shop.
            {order.noShowNotes && ` Note: ${order.noShowNotes}`}
          </div>
          {!loading && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDispute();
              }}
              className="mt-3 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors"
            >
              Dispute No-Show
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

export const ServiceOrdersTab: React.FC = () => {
  const router = useRouter();
  const [orders, setOrders] = useState<ServiceOrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [reviewingOrder, setReviewingOrder] = useState<ServiceOrderWithDetails | null>(null);
  const [reviewEligibility, setReviewEligibility] = useState<Map<string, boolean>>(new Map());
  const [showHelp, setShowHelp] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewingOrder, setViewingOrder] = useState<ServiceOrderWithDetails | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<ServiceOrderWithDetails | null>(null);
  const [disputeOrder, setDisputeOrder] = useState<ServiceOrderWithDetails | null>(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [reportingOrder, setReportingOrder] = useState<ServiceOrderWithDetails | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    setCurrentPage(1);
    loadOrders(1, filter);
  }, [filter]);

  useEffect(() => {
    loadCounts();
  }, []);

  const loadOrders = async (page: number = currentPage, currentFilter: string = filter) => {
    setLoading(true);
    try {
      // The "cancelled" filter aggregates all terminal statuses (matching its
      // pill count below), so request them as a comma-separated group.
      const cancelledGroup: string = "cancelled,refunded,no_show,expired";
      const statusFilter =
        currentFilter === "all"
          ? undefined
          : currentFilter === "cancelled"
          ? (cancelledGroup as OrderStatus)
          : (currentFilter as OrderStatus);
      const response = await getCustomerOrders({
        status: statusFilter,
        page,
        limit: ITEMS_PER_PAGE,
      });

      if (response) {
        setOrders(response.data);
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages);
          setCurrentPage(response.pagination.page);
        }
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

  const loadCounts = async () => {
    try {
      const statuses: OrderStatus[] = ["pending", "paid", "completed", "cancelled", "refunded", "no_show", "expired"];
      const results = await Promise.all(
        statuses.map((s) =>
          getCustomerOrders({ status: s, page: 1, limit: 1 }).then(
            (r) => [s, r?.pagination?.totalItems ?? 0] as const
          )
        )
      );
      const counts: Record<string, number> = {};
      results.forEach(([s, n]) => { counts[s] = n; });
      setStatusCounts(counts);
    } catch (error) {
      console.error("Error loading order counts:", error);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadOrders(page);
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
    // Navigate to the shop profile page where user can view and book the service again
    router.push(`/customer/shop/${order.shopId}`);
    toast.success("Redirecting to shop...");
  };

  /**
   * Whether a completed booking can still be reported as never having happened.
   *
   * Uses the platform default window; a shop can configure its own
   * (shop_no_show_policy.completion_report_window_days), which the order payload doesn't
   * carry. The backend is the authority and rejects a late report with a clear message —
   * this only decides whether to offer the button.
   */
  const DEFAULT_REPORT_WINDOW_DAYS = 14;
  const isWithinReportWindow = (order: ServiceOrderWithDetails): boolean => {
    if (!order.completedAt) return false;
    const daysSince = (Date.now() - new Date(order.completedAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= DEFAULT_REPORT_WINDOW_DAYS;
  };

  /** "Yes, this happened" — completes the booking and issues the RCN reward. */
  const handleConfirmCompletion = async (order: ServiceOrderWithDetails) => {
    setConfirmingOrderId(order.orderId);
    try {
      await servicesApi.confirmOrderCompletion(order.orderId);
      toast.success("Thanks — booking confirmed and your rewards are on the way.");
      await loadOrders();
    } catch (error: unknown) {
      console.error("Failed to confirm booking:", error);
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "Couldn't confirm this booking. Please try again.";
      toast.error(message);
    } finally {
      setConfirmingOrderId(null);
    }
  };

  /** "This didn't happen" — the only path that refunds a booking. */
  const handleReportNotCompleted = async () => {
    if (!reportingOrder) return;
    setSubmittingReport(true);
    try {
      const { rcnRefunded, stripeRefunded } = await servicesApi.reportOrderNotCompleted(
        reportingOrder.orderId,
        reportReason.trim() || undefined
      );
      const parts: string[] = [];
      if (stripeRefunded > 0) parts.push(`$${stripeRefunded.toFixed(2)}`);
      if (rcnRefunded > 0) parts.push(`${rcnRefunded} RCN`);
      toast.success(
        parts.length > 0
          ? `Reported — ${parts.join(" and ")} is being refunded.`
          : "Reported. We'll follow up on your refund."
      );
      setReportingOrder(null);
      setReportReason("");
      await loadOrders();
    } catch (error: unknown) {
      console.error("Failed to report booking:", error);
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "Couldn't submit your report. Please try again.";
      toast.error(message);
    } finally {
      setSubmittingReport(false);
    }
  };

  // Map order status considering shopApproved flag
  const getEffectiveStatus = (order: ServiceOrderWithDetails): string => {
    // If status is 'paid' and shop has approved, show as 'scheduled' (auto-confirmed)
    if (order.status === 'paid' && order.shopApproved) {
      return 'scheduled';
    }
    return order.status;
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
      case "no_show":
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          text: "No-Show",
          badge: "⚠️ No-Show",
          badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
          description: "This booking was marked as a no-show by the shop.",
          color: "text-orange-300"
        };
      case "expired":
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          text: "Expired",
          badge: "⌛ Expired — Refunded",
          badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
          description:
            "The shop didn't mark this booking as completed within 24 hours of the appointment, so it expired automatically and your payment was refunded.",
          color: "text-amber-300"
        };
      case "awaiting_confirmation":
        return {
          icon: <HelpCircle className="w-5 h-5" />,
          text: "Needs Your Confirmation",
          badge: "❔ Did this happen?",
          badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
          description:
            "The shop hasn't marked this booking as completed. Nothing has been charged back or refunded — just let us know whether the service went ahead.",
          color: "text-amber-300"
        };
      default: {
        const formatted = status
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join("-");
        return {
          icon: <Clock className="w-5 h-5" />,
          text: formatted,
          badge: formatted,
          badgeColor: "bg-gray-500/20 text-gray-300 border-gray-500/30",
          description: "",
          color: "text-gray-300"
        };
      }
    }
  };

  // An expired booking DID make real progress before it stalled — the auto-expiry
  // sweeper only ever picks up orders sitting in 'paid', so it always cleared
  // Requested and Paid, plus Approved when the shop had accepted it. Reporting it
  // as step 0 (the old `default` branch) told the customer nothing had happened on
  // a booking they had already paid for.
  const expiredProgress = (order?: ServiceOrderWithDetails) => (order?.shopApproved ? 60 : 40);

  const getProgressPercentage = (status: string, order?: ServiceOrderWithDetails) => {
    switch (status) {
      case "pending": return 20;
      case "paid": return 40;
      case "approved": return 60;
      case "scheduled": return 80;
      case "completed": return 100;
      case "expired": return expiredProgress(order);
      // Same shape as expired: Requested and Paid definitely cleared, Approved too
      // when the shop accepted it. The booking is stalled, not undone.
      case "awaiting_confirmation": return expiredProgress(order);
      case "cancelled": return 0;
      default: return 0;
    }
  };

  const getCurrentStep = (status: string, order?: ServiceOrderWithDetails) => {
    switch (status) {
      case "pending": return 1;
      case "paid": return 2;
      case "approved": return 3;
      case "scheduled": return 4;
      case "completed": return 5;
      case "expired": return expiredProgress(order) / 20;
      case "awaiting_confirmation": return expiredProgress(order) / 20;
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

  // Calculate summary counts from backend status totals (not the current page)
  const getSummary = () => {
    return {
      pending: statusCounts["pending"] || 0,
      paid: statusCounts["paid"] || 0,
      completed: statusCounts["completed"] || 0,
      cancelled: (statusCounts["cancelled"] || 0) + (statusCounts["refunded"] || 0) + (statusCounts["no_show"] || 0) + (statusCounts["expired"] || 0),
    };
  };

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [orders, sortOrder]);

  const summary = getSummary();

  if (loading) {
    return <ListSkeleton rows={5} />;
  }

  const filterPills = [
    { key: "all", label: "All", count: summary.pending + summary.paid + summary.completed + summary.cancelled },
    { key: "pending", label: "Pending", count: summary.pending },
    { key: "paid", label: "Paid", count: summary.paid },
    { key: "completed", label: "Completed", count: summary.completed },
    { key: "cancelled", label: "Cancelled", count: summary.cancelled },
  ];

  return (
    <div className="space-y-4">
      {/* Filter Pills + Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filterPills.map((pill) => (
            <button
              key={pill.key}
              onClick={() => setFilter(pill.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                filter === pill.key
                  ? "bg-white text-black"
                  : "bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-gray-600"
              }`}
            >
              {pill.label} ({pill.count})
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm text-gray-500">Sort by:</span>
          <Select
            value={sortOrder}
            onValueChange={(value) => setSortOrder(value as "asc" | "desc")}
          >
            <SelectTrigger className="w-[110px] bg-[#1A1A1A] border border-gray-800 text-white h-9 rounded-lg hover:border-gray-600 transition-colors">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A1A] border-gray-800">
              <SelectItem value="desc" className="text-white hover:bg-gray-800 focus:bg-gray-800 focus:text-white">
                Date ↓
              </SelectItem>
              <SelectItem value="asc" className="text-white hover:bg-gray-800 focus:bg-gray-800 focus:text-white">
                Date ↑
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Bookings Cards */}
          <div className="lg:col-span-2 space-y-4">
            {sortedOrders.map((order) => {
              const effectiveStatus = getEffectiveStatus(order);
              const statusInfo = getStatusInfo(effectiveStatus);
              const progress = getProgressPercentage(effectiveStatus, order);
              const isExpired = effectiveStatus === "expired";
              const isAwaitingConfirmation = effectiveStatus === "awaiting_confirmation";
              // Amber, not green: these steps genuinely happened, but the booking
              // stalled — green would read as "on track".
              const isStalled = isExpired || isAwaitingConfirmation;
              const reachedBarColor = isStalled ? "bg-amber-500" : "bg-green-500";

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
                  serviceDate={order.bookingTimeSlot || order.bookingDate}
                  serviceTime={order.bookingTimeSlot ? formatTime(order.bookingTimeSlot) : order.bookingTime}
                  cost={order.totalAmount}
                  progressSection={
                    order.status !== "cancelled" ? (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-300">
                            Ongoing Status
                          </span>
                          <span className="text-xs text-gray-500">
                            {isStalled
                              ? `Stopped at step ${getCurrentStep(effectiveStatus, order)} of 5`
                              : `Step ${getCurrentStep(effectiveStatus, order)} out of 5`}
                          </span>
                        </div>
                        <div className="flex gap-1.5 mb-3">
                          {[20, 40, 60, 80, 100].map((step, index) => {
                            const isCompleted = progress >= step;
                            return (
                              <div
                                key={index}
                                className={`flex-1 h-2.5 rounded-full transition-all duration-500 ${
                                  isCompleted ? reachedBarColor : "bg-gray-700"
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
                      <NoShowBanner
                        order={order}
                        onDispute={() => setDisputeOrder(order)}
                      />
                    ) : undefined
                  }
                  nextActionSection={
                    isAwaitingConfirmation ? (
                      <div className="bg-[#0D0D0D] border border-amber-500/30 rounded-lg p-4 mb-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                            <HelpCircle className="w-5 h-5 text-amber-400" />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-amber-400 mb-1 text-base">Did this service happen?</div>
                            <div className="text-sm text-amber-200/80 mb-3">
                              {statusInfo.description}
                            </div>
                            <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
                              <button
                                onClick={() => handleConfirmCompletion(order)}
                                disabled={confirmingOrderId === order.orderId}
                                className="flex items-center justify-center gap-1.5 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-green-500 transition-colors text-sm disabled:opacity-60"
                              >
                                {confirmingOrderId === order.orderId ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                                Yes, this happened
                              </button>
                              <button
                                onClick={() => setReportingOrder(order)}
                                disabled={confirmingOrderId === order.orderId}
                                className="flex items-center justify-center gap-1.5 bg-[#1A1A1A] border border-gray-700 text-gray-200 font-semibold px-4 py-2.5 rounded-lg hover:border-red-500/50 hover:text-red-400 transition-colors text-sm disabled:opacity-60"
                              >
                                <XCircle className="w-4 h-4" />
                                This didn&apos;t happen
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : isExpired ? (
                      <div className="bg-[#0D0D0D] border border-amber-500/30 rounded-lg p-4 mb-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-amber-400 mb-1 text-base">Booking expired</div>
                            <div className="text-sm text-amber-200/80">
                              {statusInfo.description} Any RCN you redeemed has been returned to your balance.
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : order.status === "pending" ? (
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
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:justify-end">
                      <button
                        onClick={() => setViewingOrder(order)}
                        className="flex items-center justify-center gap-1.5 bg-[#FFCC00] text-black font-semibold px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg hover:bg-[#FFD700] transition-colors text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline">View Details</span>
                        <span className="sm:hidden">View</span>
                      </button>
                      {order.status === "pending" && (
                        <button
                          onClick={() => setCancellingOrder(order)}
                          className="flex items-center justify-center gap-1.5 bg-red-600 text-white font-semibold px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel
                        </button>
                      )}
                      {order.status === "completed" && reviewEligibility.get(order.orderId) === true && (
                        <button
                          onClick={() => handleWriteReview(order)}
                          className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg hover:from-green-500 hover:to-green-400 transition-all text-sm"
                        >
                          <Star className="w-4 h-4" />
                          Review
                        </button>
                      )}
                      {order.status === "completed" && isWithinReportWindow(order) && (
                        <button
                          onClick={() => setReportingOrder(order)}
                          title="Tell us if this service never actually took place"
                          className="flex items-center justify-center gap-1.5 bg-[#1A1A1A] border border-gray-700 text-gray-300 font-semibold px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg hover:border-red-500/50 hover:text-red-400 transition-colors text-sm"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          <span className="hidden sm:inline">Report a problem</span>
                          <span className="sm:hidden">Report</span>
                        </button>
                      )}
                      {(order.status === "completed" || order.status === "cancelled") && (
                        <button
                          onClick={() => handleBookAgain(order)}
                          className="flex items-center justify-center gap-1.5 bg-blue-600 text-white font-semibold px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span className="hidden sm:inline">Book Again</span>
                          <span className="sm:hidden">Rebook</span>
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
                  bookingId={formatBookingId(order.orderId)}
                />
              );
            })}

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              disabled={loading}
            />
          </div>

          {/* Quick Summary Sidebar - Hidden on mobile */}
          <div className="hidden lg:block">
           <div className="sticky top-0 space-y-4">
            {/* Summary Card */}
            <div className="bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] border border-gray-800 rounded-xl p-5">
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
                  {["pending", "paid", "approved", "scheduled", "completed", "awaiting_confirmation", "expired"].map((status) => {
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
            loadCounts();
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
          loadCounts();
        }}
      />

      {/* Report "this didn't happen" — the only customer-facing path to a refund.
          Custom dialog rather than confirm(), and the reason is optional so a
          customer isn't blocked from reporting by a required field. */}
      {reportingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#161616] p-6">
            <h3 className="mb-2 text-lg font-bold text-white">
              This booking didn&apos;t happen?
            </h3>
            <p className="mb-4 text-sm text-gray-400">
              We&apos;ll refund <span className="font-semibold text-white">{reportingOrder.serviceName}</span>{" "}
              at {reportingOrder.shopName}. Any RCN you redeemed goes back to your balance.
            </p>

            <label htmlFor="report-reason" className="mb-1.5 block text-sm font-medium text-gray-300">
              What happened? <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              id="report-reason"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. the shop was closed when I arrived"
              className="mb-4 w-full rounded-lg border border-gray-700 bg-[#0D0D0D] p-3 text-sm text-white placeholder-gray-600 focus:border-[#FFCC00] focus:outline-none"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setReportingOrder(null);
                  setReportReason("");
                }}
                disabled={submittingReport}
                className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-800 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleReportNotCompleted}
                disabled={submittingReport}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
              >
                {submittingReport && <Loader2 className="h-4 w-4 animate-spin" />}
                {submittingReport ? "Submitting..." : "Report & refund"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute No-Show Modal */}
      {disputeOrder && (
        <DisputeModal
          isOpen={!!disputeOrder}
          onClose={() => setDisputeOrder(null)}
          noShowEntry={{
            id: disputeOrder.orderId,
            orderId: disputeOrder.orderId,
            customerAddress: disputeOrder.customerAddress,
            serviceId: disputeOrder.serviceId,
            shopId: disputeOrder.shopId,
            scheduledTime: disputeOrder.bookingDate || new Date().toISOString(),
            markedNoShowAt: disputeOrder.markedNoShowAt || new Date().toISOString(),
            markedBy: '',
            notes: disputeOrder.noShowNotes || '',
            gracePeriodMinutes: 15,
            customerTierAtTime: '',
            disputed: false,
            createdAt: disputeOrder.createdAt,
          } as unknown as NoShowHistoryEntry}
          onDisputeSubmitted={() => {
            setDisputeOrder(null);
            loadOrders();
            loadCounts();
            toast.success("Dispute submitted successfully");
          }}
        />
      )}
    </div>
  );
};

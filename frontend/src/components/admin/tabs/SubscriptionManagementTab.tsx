"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { FilterTabs } from "@/components/ui/FilterTabs";
import {
  CreditCard,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  PauseCircle,
  RefreshCw,
  X,
  TrendingUp,
  Store,
  Search,
  RotateCcw,
} from "lucide-react";
import apiClient from "@/services/api/client";
import { toast } from "react-hot-toast";

interface Subscription {
  id: number;
  shopId: string;
  shopName?: string;
  status: "pending" | "active" | "cancelled" | "paused" | "defaulted";
  monthlyAmount: number;
  subscriptionType: string;
  billingMethod?: "credit_card" | "ach" | "wire" | "crypto";
  billingReference?: string;
  paymentsMade: number;
  totalPaid: number;
  nextPaymentDate?: string;
  lastPaymentDate?: string;
  stripePeriodEnd?: string;
  enrolledAt: string;
  activatedAt?: string;
  cancelledAt?: string;
  pausedAt?: string;
  resumedAt?: string;
  cancellationReason?: string;
  pauseReason?: string;
  notes?: string;
  createdBy?: string;
  isActive: boolean;
  daysOverdue?: number;
}

interface SubscriptionStats {
  totalActive: number;
  totalPending: number;
  totalPaused: number;
  totalCancelled: number;
  totalRevenue: number;
  monthlyRecurring: number;
  overdueCount: number;
}

// Stat card data for cleaner rendering
interface StatCardData {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  colorClass: string;
  bgGradient: string;
}

export default function SubscriptionManagementTab() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Force scrollbar to prevent layout shift when content changes
  useEffect(() => {
    document.documentElement.style.overflowY = 'scroll';
    return () => {
      document.documentElement.style.overflowY = '';
    };
  }, []);

  // Modal states
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  const calculateStats = useCallback((subs: Subscription[]) => {
    const stats: SubscriptionStats = {
      totalActive: subs.filter((s) => s.status === "active").length,
      totalPending: subs.filter((s) => s.status === "pending").length,
      totalPaused: subs.filter((s) => s.status === "paused").length,
      totalCancelled: subs.filter((s) => s.status === "cancelled").length,
      totalRevenue: subs.reduce((sum, s) => sum + s.totalPaid, 0),
      monthlyRecurring: subs
        .filter((s) => s.status === "active")
        .reduce((sum, s) => sum + s.monthlyAmount, 0),
      overdueCount: subs.filter((s) => s.daysOverdue && s.daysOverdue > 0).length,
    };
    setStats(stats);
  }, []);

  const loadSubscriptions = useCallback(
    async (syncFromStripe = false) => {
      try {
        if (syncFromStripe) {
          setSyncing(true);
        } else {
          setLoading(true);
        }

        const response = await apiClient.get("/admin/subscription/subscriptions", {
          params: syncFromStripe ? { sync: "true" } : {},
        });

        if (response.success) {
          const subs = response.data || [];
          setSubscriptions(subs);
          calculateStats(subs);
          if (syncFromStripe) {
            toast.success("Data synced successfully from Stripe");
          }
        }
      } catch (error) {
        console.error("Error loading subscriptions:", error);
      } finally {
        setLoading(false);
        setSyncing(false);
      }
    },
    [calculateStats]
  );

  const handleSync = async () => {
    await loadSubscriptions(true);
  };

  const filterSubscriptions = useCallback(
    (filter: string, search: string) => {
      let filtered: Subscription[] = [];

      switch (filter) {
        case "active":
          filtered = subscriptions.filter((s) => s.status === "active");
          break;
        case "pending":
          filtered = subscriptions.filter((s) => s.status === "pending");
          break;
        case "paused":
          filtered = subscriptions.filter((s) => s.status === "paused");
          break;
        case "overdue":
          filtered = subscriptions.filter((s) => s.daysOverdue && s.daysOverdue > 0);
          break;
        case "cancelled":
          filtered = subscriptions.filter(
            (s) => s.status === "cancelled" || s.status === "defaulted"
          );
          break;
        default:
          filtered = subscriptions;
      }

      // Apply search filter
      if (search.trim()) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(
          (s) =>
            (s.shopName && s.shopName.toLowerCase().includes(searchLower)) ||
            s.shopId.toLowerCase().includes(searchLower)
        );
      }

      setFilteredSubscriptions(filtered);
    },
    [subscriptions]
  );

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  // Listen for real-time subscription status changes via WebSocket
  useEffect(() => {
    const handleSubscriptionStatusChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { shopAddress, action } = customEvent.detail || {};
      console.log(`📋 Admin: Subscription status changed - ${action} for ${shopAddress}`);
      // Refresh subscriptions list to reflect the change
      loadSubscriptions();
    };

    window.addEventListener('subscription-status-changed', handleSubscriptionStatusChange);

    return () => {
      window.removeEventListener('subscription-status-changed', handleSubscriptionStatusChange);
    };
  }, [loadSubscriptions]);

  useEffect(() => {
    filterSubscriptions(filterStatus, searchQuery);
  }, [subscriptions, filterStatus, searchQuery, filterSubscriptions]);

  const handleApprove = async () => {
    if (!selectedSubscription) return;

    try {
      setActionLoading(true);
      await apiClient.post(
        `/admin/subscription/subscriptions/${selectedSubscription.id}/approve`,
        {
          nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }
      );
      setShowApproveModal(false);
      toast.success("Subscription approved successfully");
      await loadSubscriptions();
    } catch (error) {
      console.error("Error approving subscription:", error);
      toast.error("Failed to approve subscription");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedSubscription) return;

    try {
      setActionLoading(true);
      await apiClient.post(
        `/admin/subscription/subscriptions/${selectedSubscription.id}/cancel`,
        {
          reason: cancellationReason || "Cancelled by administrator",
        }
      );
      setShowCancelModal(false);
      setCancellationReason("");
      toast.success("Subscription cancelled successfully");
      await loadSubscriptions(true);
    } catch (error: any) {
      console.error("Error cancelling subscription:", error);
      const responseData = error?.response?.data;
      const errorMessage = responseData?.error || error?.message || "Failed to cancel subscription";

      // Check if the subscription was cleaned up from the database
      if (responseData?.cleaned) {
        toast(errorMessage, { icon: '⚠️' });
      } else {
        toast.error(errorMessage);
      }
      await loadSubscriptions(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!selectedSubscription) return;

    try {
      setActionLoading(true);
      const response = await apiClient.post(
        `/admin/subscription/subscriptions/${selectedSubscription.id}/pause`
      );
      setShowPauseModal(false);
      setSelectedSubscription(null);
      toast.success(response.message || "Subscription paused successfully");
      await loadSubscriptions(true);
    } catch (error: any) {
      console.error("Error pausing subscription:", error);
      const responseData = error?.response?.data;
      const errorMessage = responseData?.error || error?.message || "Failed to pause subscription";

      // Check if the subscription was cleaned up from the database
      if (responseData?.cleaned) {
        toast(errorMessage, { icon: '⚠️' });
      } else {
        toast.error(errorMessage);
      }
      await loadSubscriptions(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!selectedSubscription) return;

    try {
      setActionLoading(true);
      console.log("Syncing subscription from Stripe before resume...");
      try {
        const syncData = await apiClient.post(
          `/admin/subscription/subscriptions/${selectedSubscription.id}/sync`
        );
        console.log("Sync result:", syncData);

        // Check if subscription was cleaned up (deleted from DB because it no longer exists in Stripe)
        // Note: apiClient interceptor returns response.data directly, so syncData is the unwrapped response
        if ((syncData as any).cleaned || (syncData as any).data?.newStatus === "deleted") {
          await loadSubscriptions();
          setShowResumeModal(false);
          setSelectedSubscription(null);
          toast((syncData as any).message || "Subscription no longer exists in Stripe and has been removed from the system.", { icon: '⚠️' });
          return;
        }

        if (syncData.data?.newStatus === "active") {
          await loadSubscriptions();
          setShowResumeModal(false);
          setSelectedSubscription(null);
          toast.success("Subscription was already active in Stripe. Status updated successfully.");
          return;
        }
      } catch (syncError) {
        console.warn("Sync failed, continuing with resume:", syncError);
      }

      const response = await apiClient.post(
        `/admin/subscription/subscriptions/${selectedSubscription.id}/resume`
      );
      setShowResumeModal(false);
      setSelectedSubscription(null);
      toast.success(response.message || "Subscription resumed successfully");
      await loadSubscriptions(true);
    } catch (error: any) {
      console.error("Error resuming subscription:", error);
      const responseData = error?.response?.data;
      const errorMessage = responseData?.error || error?.message || "Failed to resume subscription";

      // Check if the subscription was cleaned up from the database
      if (responseData?.cleaned) {
        toast(errorMessage, { icon: '⚠️' });
      } else {
        toast.error(errorMessage);
      }
      await loadSubscriptions(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!selectedSubscription) return;

    try {
      setActionLoading(true);
      const response = await apiClient.post(
        `/admin/subscription/subscriptions/${selectedSubscription.id}/reactivate`
      );
      setShowReactivateModal(false);
      setSelectedSubscription(null);
      toast.success(response.message || "Subscription reactivated successfully");
      await loadSubscriptions(true);
    } catch (error: any) {
      console.error("Error reactivating subscription:", error);
      const responseData = error?.response?.data;
      const errorMessage = responseData?.error || error?.message || "Failed to reactivate subscription";

      // Check if the subscription was cleaned up from the database
      if (responseData?.cleaned) {
        toast(errorMessage, { icon: '⚠️' });
      } else {
        toast.error(errorMessage);
      }
      await loadSubscriptions(true);
    } finally {
      setActionLoading(false);
    }
  };

  const canReactivate = (sub: Subscription): boolean => {
    // Allow reactivation for:
    // - "cancelling" = pending cancellation (cancel at period end) - primary use case
    // - "cancelled" = already cancelled but still within paid period
    if (sub.status !== "cancelled" && sub.status !== "cancelling") return false;

    // For "cancelling" status, always allow reactivation (undo pending cancellation)
    if (sub.status === "cancelling") return true;

    // For "cancelled" status, only allow if still within paid period
    let subscribedTillDate: Date | null = null;

    if (sub.stripePeriodEnd) {
      subscribedTillDate = new Date(sub.stripePeriodEnd);
    } else if (sub.lastPaymentDate) {
      const lastPayment = new Date(sub.lastPaymentDate);
      subscribedTillDate = new Date(lastPayment.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    if (!subscribedTillDate || isNaN(subscribedTillDate.getTime())) {
      return false;
    }
    return subscribedTillDate.getTime() > Date.now();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return isNaN(date.getTime())
      ? "-"
      : date.toLocaleDateString("en-US", { timeZone: "America/Chicago" });
  };

  // Status badge component
  const getStatusBadge = (sub: Subscription) => {
    const statusConfig = {
      active: {
        color: "bg-green-500/10 text-green-400 border-green-500/20",
        icon: CheckCircle,
      },
      pending: {
        color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        icon: Clock,
      },
      paused: {
        color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        icon: PauseCircle,
      },
      cancelled: {
        color: "bg-red-500/10 text-red-400 border-red-500/20",
        icon: XCircle,
      },
      cancelling: {
        color: "bg-orange-500/10 text-orange-400 border-orange-500/20",
        icon: Clock,
      },
      defaulted: {
        color: "bg-red-500/10 text-red-400 border-red-500/20",
        icon: AlertCircle,
      },
    };

    const config = statusConfig[sub.status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}
      >
        <Icon className="w-3 h-3" />
        <span className="capitalize">{sub.status}</span>
      </span>
    );
  };

  // Table columns
  const columns: Column<Subscription>[] = [
    {
      key: "shop",
      header: "Shop",
      sortable: true,
      sortValue: (sub) => sub.shopName || sub.shopId,
      accessor: (sub) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-[#FFCC00] to-yellow-600 flex items-center justify-center flex-shrink-0">
            <Store className="h-4 w-4 sm:h-5 sm:w-5 text-gray-900" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {sub.shopName || sub.shopId}
            </p>
            <p className="text-xs text-gray-400 font-mono truncate hidden sm:block">
              {sub.shopId}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (sub) => sub.status,
      className: "hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
      accessor: (sub) => getStatusBadge(sub),
    },
    {
      key: "monthly",
      header: "Monthly",
      sortable: true,
      sortValue: (sub) => sub.monthlyAmount,
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
      accessor: (sub) => (
        <div className="text-sm">
          <p className="text-emerald-400 font-semibold">${sub.monthlyAmount}</p>
          <p className="text-xs text-gray-400">per month</p>
        </div>
      ),
    },
    {
      key: "payments",
      header: "Payments",
      sortable: true,
      sortValue: (sub) => sub.paymentsMade,
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
      accessor: (sub) => (
        <div className="text-sm">
          <p className="text-white font-medium">{sub.paymentsMade} payments</p>
          <p className="text-purple-400 text-xs">${sub.totalPaid.toLocaleString()} total</p>
        </div>
      ),
    },
    {
      key: "subscribedTill",
      header: "Subscribed Till",
      sortable: true,
      sortValue: (sub) => {
        let subscribedTillDate: Date | null = null;
        if (sub.stripePeriodEnd) {
          subscribedTillDate = new Date(sub.stripePeriodEnd);
        } else if (sub.status === "active" && sub.nextPaymentDate) {
          subscribedTillDate = new Date(sub.nextPaymentDate);
        } else if (sub.lastPaymentDate) {
          const lastPayment = new Date(sub.lastPaymentDate);
          subscribedTillDate = new Date(lastPayment.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else if (sub.activatedAt) {
          const activated = new Date(sub.activatedAt);
          subscribedTillDate = new Date(activated.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
        return subscribedTillDate && !isNaN(subscribedTillDate.getTime())
          ? subscribedTillDate.getTime()
          : 0;
      },
      className: "hidden xl:table-cell",
      headerClassName: "hidden xl:table-cell",
      accessor: (sub) => {
        let subscribedTillDate: Date | null = null;
        if (sub.stripePeriodEnd) {
          subscribedTillDate = new Date(sub.stripePeriodEnd);
        } else if (sub.status === "active" && sub.nextPaymentDate) {
          subscribedTillDate = new Date(sub.nextPaymentDate);
        } else if (sub.lastPaymentDate) {
          const lastPayment = new Date(sub.lastPaymentDate);
          subscribedTillDate = new Date(lastPayment.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else if (sub.activatedAt) {
          const activated = new Date(sub.activatedAt);
          subscribedTillDate = new Date(activated.getTime() + 30 * 24 * 60 * 60 * 1000);
        }

        if (!subscribedTillDate || isNaN(subscribedTillDate.getTime())) {
          return <span className="text-gray-500">-</span>;
        }

        const now = new Date();
        const daysRemaining = Math.ceil(
          (subscribedTillDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        const hasExpired = daysRemaining < 0;

        return (
          <div className="text-sm">
            <p className={`font-medium ${hasExpired ? "text-red-400" : "text-white"}`}>
              {subscribedTillDate.toLocaleDateString()}
            </p>
            {hasExpired && (
              <span className="text-xs text-red-400">
                Expired {Math.abs(daysRemaining)} days ago
              </span>
            )}
            {!hasExpired && daysRemaining <= 7 && (
              <span className="text-xs text-yellow-400">{daysRemaining} days left</span>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      accessor: (sub) => (
        <div className="flex items-center gap-1.5 md:gap-2">
          {sub.status === "pending" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSubscription(sub);
                setShowApproveModal(true);
              }}
              className="p-1 md:p-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors"
              title="Approve"
            >
              <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          )}

          {sub.status === "active" && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSubscription(sub);
                  setShowPauseModal(true);
                }}
                className="p-1 md:p-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
                title="Pause"
              >
                <PauseCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSubscription(sub);
                  setShowCancelModal(true);
                }}
                className="p-1 md:p-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
                title="Cancel"
              >
                <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            </>
          )}

          {sub.status === "paused" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSubscription(sub);
                setShowResumeModal(true);
              }}
              className="p-1 md:p-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors"
              title="Resume"
            >
              <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          )}

          {canReactivate(sub) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSubscription(sub);
                setShowReactivateModal(true);
              }}
              className="p-1 md:p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors"
              title="Reactivate"
            >
              <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSubscription(sub);
              setShowDetailsModal(true);
            }}
            className="p-1 md:p-1.5 bg-gray-500/10 text-gray-300 border border-gray-500/20 rounded-lg hover:bg-gray-500/20 transition-colors"
            title="View Details"
          >
            <CreditCard className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>
        </div>
      ),
    },
  ];

  // Render expanded content for mobile
  const renderExpandedContent = (sub: Subscription) => (
    <div className="p-4 space-y-4">
      {/* Status - Show on mobile when hidden in table */}
      <div className="sm:hidden">
        <p className="text-xs text-gray-500 mb-2">Status</p>
        {getStatusBadge(sub)}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Monthly - Hidden on md+ in table */}
        <div className="md:hidden">
          <p className="text-xs text-gray-500 mb-1">Monthly</p>
          <p className="text-emerald-400 font-semibold">${sub.monthlyAmount}</p>
        </div>

        {/* Payments - Hidden on lg+ in table */}
        <div className="lg:hidden">
          <p className="text-xs text-gray-500 mb-1">Payments</p>
          <p className="text-white font-medium">{sub.paymentsMade}</p>
          <p className="text-purple-400 text-xs">${sub.totalPaid.toLocaleString()}</p>
        </div>

        {/* Next Payment */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Next Payment</p>
          <p className="text-white text-sm">{formatDate(sub.nextPaymentDate)}</p>
        </div>

        {/* Last Payment */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Last Payment</p>
          <p className="text-white text-sm">{formatDate(sub.lastPaymentDate)}</p>
        </div>
      </div>

      {/* Cancellation Reason */}
      {sub.cancellationReason && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-red-400 mb-1">Cancellation Reason</p>
              <p className="text-xs text-gray-300">{sub.cancellationReason}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Stats card data
  const getStatCards = (): StatCardData[] => {
    if (!stats) return [];

    return [
      {
        title: "Active",
        value: stats.totalActive,
        subtitle: "Currently active",
        icon: CheckCircle,
        colorClass: "text-green-400",
        bgGradient: "from-green-500/20 to-green-600/10",
      },
      {
        title: "Pending",
        value: stats.totalPending,
        subtitle: "Awaiting approval",
        icon: Clock,
        colorClass: "text-yellow-400",
        bgGradient: "from-yellow-500/20 to-yellow-600/10",
      },
      {
        title: "Paused",
        value: stats.totalPaused,
        subtitle: "Temporarily paused",
        icon: PauseCircle,
        colorClass: "text-blue-400",
        bgGradient: "from-blue-500/20 to-blue-600/10",
      },
      {
        title: "Overdue",
        value: stats.overdueCount,
        subtitle: "Payment overdue",
        icon: AlertCircle,
        colorClass: "text-red-400",
        bgGradient: "from-red-500/20 to-red-600/10",
      },
      {
        title: "MRR",
        value: `$${stats.monthlyRecurring.toLocaleString()}`,
        subtitle: "Monthly recurring",
        icon: TrendingUp,
        colorClass: "text-emerald-400",
        bgGradient: "from-emerald-500/20 to-emerald-600/10",
      },
      {
        title: "Revenue",
        value: `$${stats.totalRevenue.toLocaleString()}`,
        subtitle: "All-time revenue",
        icon: DollarSign,
        colorClass: "text-purple-400",
        bgGradient: "from-purple-500/20 to-purple-600/10",
      },
    ];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-400 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-400">Loading subscriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        title="Subscription Management"
        subtitle="Manage shop subscriptions and billing"
      />

      {/* Statistics Cards - Responsive grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {getStatCards().map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className={`bg-gradient-to-br ${card.bgGradient} bg-[#212121] rounded-2xl p-4 border border-gray-700/50 hover:border-gray-600/50 transition-all`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    {card.title}
                  </p>
                  <div className={`p-2 rounded-lg bg-black/30 ${card.colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white mb-1">{card.value}</p>
                <p className="text-xs text-gray-400">{card.subtitle}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Content Card */}
      <div className="bg-[#212121] rounded-3xl">
        <div
          className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-3 md:py-4 text-white rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-900 font-semibold">
            Monitor Subscriptions
          </p>
        </div>

        {/* Controls */}
        <div className="p-4 md:p-6 border-b border-gray-700/50">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by shop name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#2F2F2F] border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400 text-sm"
              />
            </div>

            {/* Filter Tabs and Sync */}
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <button
                onClick={handleSync}
                disabled={syncing || loading}
                className="px-3 sm:px-4 py-2 bg-[#FFCC00] text-black border border-yellow-500 rounded-3xl hover:bg-yellow-500 transition-all text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{syncing ? "Syncing..." : "Sync Stripe"}</span>
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <FilterTabs
            tabs={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "pending", label: "Pending" },
              { value: "paused", label: "Paused" },
              { value: "overdue", label: "Overdue" },
              { value: "cancelled", label: "Cancelled" },
            ]}
            activeTab={filterStatus}
            onTabChange={setFilterStatus}
            className="mt-4"
          />
        </div>

        {/* Table */}
        <div className="p-4 md:p-6">
          <DataTable
            data={filteredSubscriptions}
            columns={columns}
            keyExtractor={(sub) => sub.id.toString()}
            expandable={true}
            renderExpandedContent={renderExpandedContent}
            headerClassName="bg-gray-900/60 border-gray-800"
            emptyMessage={`No ${filterStatus === "all" ? "" : filterStatus} subscriptions found`}
            emptyIcon={<AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />}
            showPagination={true}
            itemsPerPage={10}
          />
        </div>
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] border border-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div
              className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-xl"
              style={{
                backgroundImage: `url('/img/cust-ref-widget3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                Approve Subscription
              </p>
              <button
                onClick={() => setShowApproveModal(false)}
                disabled={actionLoading}
                className="p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-900" />
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-gray-300 mb-4">
                Approve subscription for{" "}
                <span className="text-white font-semibold">
                  {selectedSubscription.shopName || selectedSubscription.shopId}
                </span>
                ?
              </p>

              <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                <h4 className="font-semibold text-green-400 mb-2">This will:</h4>
                <ul className="space-y-1 text-sm text-green-300">
                  <li>• Activate the subscription immediately</li>
                  <li>• Grant operational status to the shop</li>
                  <li>• Set first payment due in 30 days</li>
                  <li>• Send activation email to shop owner</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowApproveModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-700 text-white rounded-3xl hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-3xl hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Approving..." : "Approve Subscription"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] border border-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div
              className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-xl"
              style={{
                backgroundImage: `url('/img/cust-ref-widget3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                Cancel Subscription
              </p>
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={actionLoading}
                className="p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-900" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <p className="text-gray-300">
                Cancel subscription for{" "}
                <span className="text-white font-semibold">
                  {selectedSubscription.shopName || selectedSubscription.shopId}
                </span>
                ?
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cancellation Reason
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full p-3 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  rows={3}
                  placeholder="Enter reason for cancellation..."
                />
              </div>

              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-blue-400 mb-2">Good news:</h4>
                <p className="text-sm text-blue-300">
                  Shop will retain <strong>full platform access</strong> until the end of their current billing period.
                  They can continue to issue rewards, process redemptions, and manage services as normal until then.
                </p>
              </div>

              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-400 mb-2">After billing period ends:</h4>
                <ul className="space-y-1 text-sm text-yellow-300">
                  <li>• Shop will lose operational status</li>
                  <li>• Cannot issue rewards or process redemptions</li>
                  <li>• Cannot manage services in the marketplace</li>
                  <li>• Shop can resubscribe at any time</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-700 text-white rounded-3xl hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Keep Active
              </button>
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-3xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Cancelling..." : "Cancel Subscription"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {showPauseModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] border border-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div
              className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-xl"
              style={{
                backgroundImage: `url('/img/cust-ref-widget3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                Pause Subscription
              </p>
              <button
                onClick={() => setShowPauseModal(false)}
                disabled={actionLoading}
                className="p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-900" />
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-gray-300 mb-4">
                Pause subscription for{" "}
                <span className="text-white font-semibold">
                  {selectedSubscription.shopName || selectedSubscription.shopId}
                </span>
                ?
              </p>

              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                <h4 className="font-semibold text-blue-400 mb-2">Pausing will:</h4>
                <ul className="space-y-1 text-sm text-blue-300">
                  <li>• Temporarily suspend billing</li>
                  <li>• Maintain operational status for 30 days</li>
                  <li>• Allow shop to resume anytime</li>
                  <li>• Send notification to shop owner</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowPauseModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-700 text-white rounded-3xl hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePause}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-3xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Pausing..." : "Pause Subscription"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Modal */}
      {showResumeModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] border border-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div
              className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-xl"
              style={{
                backgroundImage: `url('/img/cust-ref-widget3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                Resume Subscription
              </p>
              <button
                onClick={() => setShowResumeModal(false)}
                disabled={actionLoading}
                className="p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-900" />
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-gray-300 mb-4">
                Resume subscription for{" "}
                <span className="text-white font-semibold">
                  {selectedSubscription.shopName || selectedSubscription.shopId}
                </span>
                ?
              </p>

              <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                <h4 className="font-semibold text-green-400 mb-2">Resuming will:</h4>
                <ul className="space-y-1 text-sm text-green-300">
                  <li>• Reactivate billing immediately</li>
                  <li>• Restore full operational status</li>
                  <li>• Allow shop to issue rewards and redemptions</li>
                  <li>• Send confirmation notification to shop owner</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowResumeModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-700 text-white rounded-3xl hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResume}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-3xl hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Resuming..." : "Resume Subscription"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate Modal */}
      {showReactivateModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] border border-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div
              className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-xl"
              style={{
                backgroundImage: `url('/img/cust-ref-widget3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                Reactivate Subscription
              </p>
              <button
                onClick={() => setShowReactivateModal(false)}
                disabled={actionLoading}
                className="p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-900" />
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-gray-300 mb-4">
                Reactivate subscription for{" "}
                <span className="text-white font-semibold">
                  {selectedSubscription.shopName || selectedSubscription.shopId}
                </span>
                ?
              </p>

              <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-4">
                <h4 className="font-semibold text-emerald-400 mb-2">Reactivating will:</h4>
                <ul className="space-y-1 text-sm text-emerald-300">
                  <li>• Cancel the scheduled cancellation</li>
                  <li>• Restore subscription to active status</li>
                  <li>• Continue billing at end of current period</li>
                  <li>• Allow shop to continue issuing rewards</li>
                  <li>• Send confirmation notification to shop owner</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowReactivateModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-700 text-white rounded-3xl hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReactivate}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-3xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Reactivating..." : "Reactivate Subscription"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] border border-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div
              className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-xl"
              style={{
                backgroundImage: `url('/img/cust-ref-widget3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                Subscription Details
              </p>
              <button onClick={() => setShowDetailsModal(false)} className="p-2 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-900" />
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="border-b border-gray-700 pb-6">
                  <h3 className="text-lg font-semibold text-[#FFCC00] mb-4">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Shop Name</label>
                      <p className="text-white font-medium">
                        {selectedSubscription.shopName || selectedSubscription.shopId}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Shop ID</label>
                      <p className="text-white font-medium">{selectedSubscription.shopId}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                      {getStatusBadge(selectedSubscription)}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Subscription Type</label>
                      <p className="text-white font-medium">{selectedSubscription.subscriptionType}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Information */}
                <div className="border-b border-gray-700 pb-6">
                  <h3 className="text-lg font-semibold text-[#FFCC00] mb-4">Payment Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Monthly Amount</label>
                      <p className="text-white font-medium">${selectedSubscription.monthlyAmount}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Payments Made</label>
                      <p className="text-white font-medium">{selectedSubscription.paymentsMade}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Total Paid</label>
                      <p className="text-white font-medium">${selectedSubscription.totalPaid}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Next Payment</label>
                      <p className="text-white font-medium">{formatDate(selectedSubscription.nextPaymentDate)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Last Payment</label>
                      <p className="text-white font-medium">{formatDate(selectedSubscription.lastPaymentDate)}</p>
                    </div>
                  </div>
                </div>

                {/* Timeline Information */}
                <div className={selectedSubscription.cancellationReason ? "border-b border-gray-700 pb-6" : ""}>
                  <h3 className="text-lg font-semibold text-[#FFCC00] mb-4">Timeline</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Enrolled Date</label>
                      <p className="text-white font-medium">{formatDate(selectedSubscription.enrolledAt)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Activated Date</label>
                      <p className="text-white font-medium">{formatDate(selectedSubscription.activatedAt)}</p>
                    </div>
                    {selectedSubscription.cancelledAt && (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Cancelled Date</label>
                        <p className="text-white font-medium">{formatDate(selectedSubscription.cancelledAt)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cancellation Information */}
                {selectedSubscription.cancellationReason && (
                  <div>
                    <h3 className="text-lg font-semibold text-[#FFCC00] mb-4">Cancellation Information</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Cancellation Reason</label>
                      <p className="text-white">{selectedSubscription.cancellationReason}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-3xl hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

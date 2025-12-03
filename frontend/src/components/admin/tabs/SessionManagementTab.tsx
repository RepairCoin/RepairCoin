"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Users,
  Shield,
  Store,
  User,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  AlertTriangle,
  Monitor,
  Globe,
  Ban,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { adminApi } from "@/services/api/admin";

interface Session {
  id: string;
  tokenId: string;
  userAddress: string;
  userRole: "admin" | "shop" | "customer";
  shopId?: string;
  userName?: string;
  shopName?: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revoked: boolean;
  revokedAt?: string;
  revokedReason?: string;
  userAgent?: string;
  ipAddress?: string;
}

interface SessionsResponse {
  success: boolean;
  sessions: Session[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface StatCardData {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  colorClass: string;
  bgGradient: string;
}

export function SessionManagementTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Filters - default to "all" so stats are calculated correctly
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination from API
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  });

  // Revoke modal state
  const [revokeModal, setRevokeModal] = useState<{
    isOpen: boolean;
    tokenId: string | null;
    userName: string | null;
    isRevokeAll: boolean;
    userAddress: string | null;
  }>({
    isOpen: false,
    tokenId: null,
    userName: null,
    isRevokeAll: false,
    userAddress: null,
  });
  const [revokeReason, setRevokeReason] = useState("");

  const fetchSessions = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params: Record<string, string | number | undefined> = {
        page: 1,
        limit: 100,
        status: statusFilter === "all" ? undefined : statusFilter
      };

      if (roleFilter !== "all") {
        params.role = roleFilter;
      }

      const response: SessionsResponse = await adminApi.getSessions(params);

      if (response.success) {
        setSessions(response.sessions);
        setPagination(response.pagination);
        if (isRefresh) {
          toast.success("Sessions refreshed successfully");
        }
      }
    } catch (error: any) {
      console.error("Error fetching sessions:", error);
      toast.error(error.message || "Failed to load sessions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roleFilter, statusFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Filter sessions by search query
  const filterSessions = useCallback((search: string) => {
    let filtered = [...sessions];

    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (session) =>
          session.userAddress.toLowerCase().includes(query) ||
          session.userName?.toLowerCase().includes(query) ||
          session.shopName?.toLowerCase().includes(query) ||
          session.ipAddress?.toLowerCase().includes(query)
      );
    }

    setFilteredSessions(filtered);
  }, [sessions]);

  useEffect(() => {
    filterSessions(searchQuery);
  }, [sessions, searchQuery, filterSessions]);

  const handleRefresh = () => {
    fetchSessions(true);
  };

  const openRevokeModal = (tokenId: string, userName: string | undefined, isRevokeAll: boolean = false, userAddress?: string) => {
    setRevokeModal({
      isOpen: true,
      tokenId,
      userName: userName || null,
      isRevokeAll,
      userAddress: userAddress || null,
    });
    setRevokeReason("Revoked by admin");
  };

  const closeRevokeModal = () => {
    setRevokeModal({
      isOpen: false,
      tokenId: null,
      userName: null,
      isRevokeAll: false,
      userAddress: null,
    });
    setRevokeReason("");
  };

  const handleConfirmRevoke = async () => {
    if (!revokeModal.tokenId && !revokeModal.userAddress) return;

    try {
      if (revokeModal.isRevokeAll && revokeModal.userAddress) {
        setRevoking(revokeModal.userAddress);
        const finalReason = revokeReason.trim() || `All sessions revoked by admin for user: ${revokeModal.userName || revokeModal.userAddress}`;
        await adminApi.revokeAllUserSessions(revokeModal.userAddress, finalReason);
        toast.success("All user sessions revoked successfully");
      } else if (revokeModal.tokenId) {
        setRevoking(revokeModal.tokenId);
        const finalReason = revokeReason.trim() || `Revoked by admin for user: ${revokeModal.userName || 'Unknown'}`;
        await adminApi.revokeSession(revokeModal.tokenId, finalReason);
        toast.success("Session revoked successfully");
      }

      fetchSessions();
      closeRevokeModal();
    } catch (error: any) {
      console.error("Error revoking session(s):", error);
      toast.error(error.message || "Failed to revoke session(s)");
    } finally {
      setRevoking(null);
    }
  };

  const getSessionStatus = (session: Session): "active" | "expired" | "revoked" => {
    if (session.revoked) return "revoked";
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);
    if (expiresAt < now) return "expired";
    return "active";
  };

  const getStatusBadge = (session: Session) => {
    const status = getSessionStatus(session);

    const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
      active: {
        color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        icon: CheckCircle,
      },
      expired: {
        color: "bg-gray-500/10 text-gray-400 border-gray-500/20",
        icon: Clock,
      },
      revoked: {
        color: "bg-red-500/10 text-red-400 border-red-500/20",
        icon: XCircle,
      },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}
      >
        <Icon className="w-3 h-3" />
        <span className="capitalize">{status}</span>
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { color: string; icon: React.ElementType }> = {
      admin: {
        color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        icon: Shield,
      },
      shop: {
        color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        icon: Store,
      },
      customer: {
        color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        icon: User,
      },
    };

    const config = roleConfig[role] || roleConfig.customer;
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}
      >
        <Icon className="w-3 h-3" />
        <span className="capitalize">{role}</span>
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Calculate stats
  const stats = {
    total: pagination.total,
    active: sessions.filter(s => !s.revoked && new Date(s.expiresAt) > new Date()).length,
    expired: sessions.filter(s => !s.revoked && new Date(s.expiresAt) < new Date()).length,
    revoked: sessions.filter(s => s.revoked).length,
  };

  const getStatCards = (): StatCardData[] => {
    return [
      {
        title: "Total Sessions",
        value: stats.total,
        subtitle: "All time",
        icon: Users,
        colorClass: "text-yellow-400",
        bgGradient: "from-yellow-500/20 to-yellow-600/10",
      },
      {
        title: "Active",
        value: stats.active,
        subtitle: "Currently valid",
        icon: CheckCircle,
        colorClass: "text-emerald-400",
        bgGradient: "from-emerald-500/20 to-emerald-600/10",
      },
      {
        title: "Expired",
        value: stats.expired,
        subtitle: "Past validity",
        icon: Clock,
        colorClass: "text-gray-400",
        bgGradient: "from-gray-500/20 to-gray-600/10",
      },
      {
        title: "Revoked",
        value: stats.revoked,
        subtitle: "Manually revoked",
        icon: Ban,
        colorClass: "text-red-400",
        bgGradient: "from-red-500/20 to-red-600/10",
      },
    ];
  };

  // Table columns
  const columns: Column<Session>[] = [
    {
      key: "user",
      header: "User",
      sortable: true,
      sortValue: (session) => session.userName || session.shopName || session.userAddress,
      accessor: (session) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-[#FFCC00] to-yellow-600 flex items-center justify-center flex-shrink-0">
            {session.userRole === "admin" ? (
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-gray-900" />
            ) : session.userRole === "shop" ? (
              <Store className="h-4 w-4 sm:h-5 sm:w-5 text-gray-900" />
            ) : (
              <User className="h-4 w-4 sm:h-5 sm:w-5 text-gray-900" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {session.userName || session.shopName || "Unknown"}
            </p>
            <p className="text-xs text-gray-400 font-mono truncate">
              {session.userAddress.slice(0, 6)}...{session.userAddress.slice(-4)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      sortValue: (session) => session.userRole,
      className: "hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
      accessor: (session) => getRoleBadge(session.userRole),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (session) => getSessionStatus(session),
      accessor: (session) => getStatusBadge(session),
    },
    {
      key: "lastUsed",
      header: "Last Used",
      sortable: true,
      sortValue: (session) => new Date(session.lastUsedAt).getTime(),
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
      accessor: (session) => (
        <div className="text-sm">
          <p className="text-white font-medium">{getTimeAgo(session.lastUsedAt)}</p>
          <p className="text-xs text-gray-400">{formatDate(session.lastUsedAt)}</p>
        </div>
      ),
    },
    {
      key: "expires",
      header: "Expires",
      sortable: true,
      sortValue: (session) => new Date(session.expiresAt).getTime(),
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
      accessor: (session) => {
        const isExpired = new Date(session.expiresAt) < new Date();
        return (
          <div className="text-sm">
            <p className={`font-medium ${isExpired ? "text-gray-500" : "text-white"}`}>
              {isExpired ? "Expired" : getTimeAgo(session.expiresAt)}
            </p>
            <p className="text-xs text-gray-400">{formatDate(session.expiresAt)}</p>
          </div>
        );
      },
    },
    {
      key: "ip",
      header: "IP Address",
      sortable: false,
      className: "hidden xl:table-cell",
      headerClassName: "hidden xl:table-cell",
      accessor: (session) => (
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-300 font-mono">{session.ipAddress || "N/A"}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      accessor: (session) => (
        <div className="flex items-center gap-1.5 md:gap-2">
          {!session.revoked ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openRevokeModal(session.tokenId, session.userName || session.shopName, false, session.userAddress);
                }}
                disabled={revoking === session.tokenId}
                className="p-1 md:p-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                title="Revoke"
              >
                <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openRevokeModal(session.tokenId, session.userName || session.shopName, true, session.userAddress);
                }}
                className="p-1 md:p-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 transition-colors"
                title="Revoke All"
              >
                <Ban className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            </>
          ) : (
            session.revokedReason && (
              <span className="text-xs text-gray-500 truncate max-w-[100px]" title={session.revokedReason}>
                {session.revokedReason.slice(0, 20)}...
              </span>
            )
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-400 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-400">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        title="Session Management"
        subtitle="Manage active user sessions and revoke access when needed"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
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
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-gray-900" />
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-900 font-semibold">
              Active Sessions
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 md:p-6 border-b border-gray-700/50">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by address, name, or IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#2F2F2F] border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400 text-sm"
              />
            </div>

            {/* Filters and Refresh */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-[#FFCC00] border border-gray-600 rounded-3xl text-black focus:outline-none focus:border-yellow-400 text-sm"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="shop">Shop</option>
                <option value="customer">Customer</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-[#FFCC00] border border-gray-600 rounded-3xl text-black focus:outline-none focus:border-yellow-400 text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
              </select>

              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="px-3 sm:px-4 py-2 bg-[#FFCC00] text-black border border-yellow-500 rounded-3xl hover:bg-yellow-500 transition-all text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{refreshing ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="p-4 md:p-6">
          <DataTable
            data={filteredSessions}
            columns={columns}
            keyExtractor={(session) => session.id}
            headerClassName="bg-gray-900/60 border-gray-800"
            emptyMessage="No sessions found"
            emptyIcon={<Users className="w-12 h-12 text-gray-500 mx-auto mb-4" />}
            showPagination={true}
            itemsPerPage={10}
          />
        </div>
      </div>

      {/* Revoke Confirmation Modal */}
      <Dialog open={revokeModal.isOpen} onOpenChange={closeRevokeModal}>
        <DialogContent className="sm:max-w-[500px] bg-[#212121] border-gray-700">
          <DialogHeader className="flex flex-row items-start gap-3">
            <div className="mt-1 p-2 rounded-lg bg-red-500/20">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold text-white">
                {revokeModal.isRevokeAll ? "Revoke All Sessions" : "Revoke Session"}
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm text-gray-400">
                {revokeModal.isRevokeAll ? (
                  <>
                    Are you sure you want to revoke <strong className="text-white">ALL sessions</strong> for{" "}
                    <strong className="text-white">{revokeModal.userName || revokeModal.userAddress}</strong>?
                    <br />
                    <span className="text-red-400">
                      The user will be logged out from all devices immediately.
                    </span>
                  </>
                ) : (
                  <>
                    Are you sure you want to revoke this session for{" "}
                    <strong className="text-white">{revokeModal.userName || "this user"}</strong>?
                    <br />
                    <span className="text-red-400">
                      The user will be logged out immediately.
                    </span>
                  </>
                )}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="mt-4">
            <label htmlFor="revoke-reason" className="block text-sm font-medium text-gray-300 mb-2">
              Reason for revocation (optional)
            </label>
            <textarea
              id="revoke-reason"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Enter reason for revocation..."
              rows={3}
              className="w-full px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={closeRevokeModal}
              disabled={!!revoking}
              className="sm:mr-2 border-gray-600 text-gray-300 hover:bg-gray-800 rounded-3xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRevoke}
              disabled={!!revoking}
              className="bg-red-600 hover:bg-red-700 text-white rounded-3xl"
            >
              {revoking ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Revoking...
                </div>
              ) : (
                revokeModal.isRevokeAll ? "Revoke All Sessions" : "Revoke Session"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

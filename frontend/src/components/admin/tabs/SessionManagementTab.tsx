"use client";

import { useState, useEffect } from "react";
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

export function SessionManagementTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "shop" | "customer">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "revoked">("active");

  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  });

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: 50,
        status: statusFilter === "all" ? undefined : statusFilter
      };

      if (roleFilter !== "all") {
        params.role = roleFilter;
      }

      const response: SessionsResponse = await adminApi.getSessions(params);

      if (response.success) {
        setSessions(response.sessions);
        setPagination(response.pagination);
      }
    } catch (error: any) {
      console.error("Error fetching sessions:", error);
      toast.error(error.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [page, roleFilter, statusFilter]);

  const handleRevokeSession = async (tokenId: string, reason?: string) => {
    if (!confirm("Are you sure you want to revoke this session? The user will be logged out immediately.")) {
      return;
    }

    try {
      setRevoking(tokenId);
      await adminApi.revokeSession(tokenId, reason);
      toast.success("Session revoked successfully");
      fetchSessions();
    } catch (error: any) {
      console.error("Error revoking session:", error);
      toast.error(error.message || "Failed to revoke session");
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAllUserSessions = async (userAddress: string, userName?: string) => {
    if (!confirm(`Are you sure you want to revoke ALL sessions for ${userName || userAddress}?`)) {
      return;
    }

    try {
      await adminApi.revokeAllUserSessions(userAddress);
      toast.success("All user sessions revoked successfully");
      fetchSessions();
    } catch (error: any) {
      console.error("Error revoking all user sessions:", error);
      toast.error(error.message || "Failed to revoke sessions");
    }
  };

  const getStatusBadge = (session: Session) => {
    if (session.revoked) {
      return <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Revoked</span>;
    }

    const now = new Date();
    const expiresAt = new Date(session.expiresAt);

    if (expiresAt < now) {
      return <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">Expired</span>;
    }

    return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Active</span>;
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: "bg-purple-500/20 text-purple-400",
      shop: "bg-blue-500/20 text-blue-400",
      customer: "bg-yellow-500/20 text-yellow-400"
    };

    return (
      <span className={`px-2 py-1 text-xs rounded-full ${colors[role as keyof typeof colors]}`}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
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

  // Filter sessions by search query
  const filteredSessions = sessions.filter(session => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      session.userAddress.toLowerCase().includes(query) ||
      session.userName?.toLowerCase().includes(query) ||
      session.shopName?.toLowerCase().includes(query) ||
      session.ipAddress?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-yellow-400 mb-2">Session Management</h2>
        <p className="text-gray-400">Manage active user sessions and revoke access when needed</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-gray-800/50 p-4 rounded-lg">
        <div className="flex-1 min-w-[300px]">
          <input
            type="text"
            placeholder="Search by address, name, or IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="shop">Shop</option>
          <option value="customer">Customer</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>

        <button
          onClick={fetchSessions}
          disabled={loading}
          className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black font-semibold rounded-lg transition-colors"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm">Total Sessions</div>
          <div className="text-2xl font-bold text-white mt-1">{pagination.total}</div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm">Active</div>
          <div className="text-2xl font-bold text-green-400 mt-1">
            {sessions.filter(s => !s.revoked && new Date(s.expiresAt) > new Date()).length}
          </div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm">Expired</div>
          <div className="text-2xl font-bold text-gray-400 mt-1">
            {sessions.filter(s => !s.revoked && new Date(s.expiresAt) < new Date()).length}
          </div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm">Revoked</div>
          <div className="text-2xl font-bold text-red-400 mt-1">
            {sessions.filter(s => s.revoked).length}
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-700/50 text-left">
                <th className="px-4 py-3 text-sm font-semibold text-gray-300">User</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-300">Role</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-300">Status</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-300">Last Used</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-300">Expires</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-300">IP Address</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Loading sessions...
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No sessions found
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-white font-medium">
                          {session.userName || session.shopName || "Unknown"}
                        </div>
                        <div className="text-xs text-gray-400 font-mono">
                          {session.userAddress.slice(0, 6)}...{session.userAddress.slice(-4)}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getRoleBadge(session.userRole)}</td>
                    <td className="px-4 py-3">{getStatusBadge(session)}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-white">{getTimeAgo(session.lastUsedAt)}</div>
                      <div className="text-xs text-gray-400">{formatDate(session.lastUsedAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-white">
                        {new Date(session.expiresAt) > new Date()
                          ? getTimeAgo(session.expiresAt)
                          : "Expired"
                        }
                      </div>
                      <div className="text-xs text-gray-400">{formatDate(session.expiresAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-300 font-mono">{session.ipAddress || "N/A"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {!session.revoked && (
                          <>
                            <button
                              onClick={() => handleRevokeSession(session.tokenId)}
                              disabled={revoking === session.tokenId}
                              className="px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded disabled:opacity-50 transition-colors"
                            >
                              {revoking === session.tokenId ? "Revoking..." : "Revoke"}
                            </button>
                            <button
                              onClick={() => handleRevokeAllUserSessions(session.userAddress, session.userName || session.shopName)}
                              className="px-3 py-1 text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded transition-colors"
                            >
                              Revoke All
                            </button>
                          </>
                        )}
                        {session.revoked && session.revokedReason && (
                          <div className="text-xs text-gray-400" title={session.revokedReason}>
                            {session.revokedReason.slice(0, 30)}...
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors"
          >
            Previous
          </button>
          <span className="px-4 py-2 bg-gray-800 text-white rounded-lg">
            Page {page} of {pagination.pages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === pagination.pages}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

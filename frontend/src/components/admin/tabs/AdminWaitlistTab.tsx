"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import apiClient from "@/services/api/client";

interface WaitlistEntry {
  id: string;
  email: string;
  userType: "customer" | "shop";
  status: "pending" | "contacted" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
  notifiedAt?: string;
  notes?: string;
}

interface WaitlistStats {
  total: number;
  byStatus: Record<string, number>;
  byUserType: Record<string, number>;
  recent24h: number;
}

export function AdminWaitlistTab() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [stats, setStats] = useState<WaitlistStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    status?: string;
    userType?: string;
  }>({});
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    status: "",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load entries
      const entriesResponse = await apiClient.get("/waitlist/entries", {
        params: {
          status: filter.status,
          userType: filter.userType,
          limit: 100,
        },
      });

      if (entriesResponse.data?.success) {
        setEntries(entriesResponse.data.entries || []);
      }

      // Load stats
      const statsResponse = await apiClient.get("/waitlist/stats");
      if (statsResponse.data?.success) {
        setStats(statsResponse.data);
      }
    } catch (error) {
      console.error("Error loading waitlist data:", error);
      toast.error("Failed to load waitlist data");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedEntry || !updateForm.status) {
      toast.error("Please select a status");
      return;
    }

    try {
      const response = await apiClient.put(
        `/waitlist/${selectedEntry.id}/status`,
        {
          status: updateForm.status,
          notes: updateForm.notes,
        }
      );

      if (response.data?.success) {
        toast.success("Waitlist entry updated successfully");
        setShowUpdateModal(false);
        setSelectedEntry(null);
        setUpdateForm({ status: "", notes: "" });
        loadData();
      }
    } catch (error: any) {
      console.error("Error updating waitlist entry:", error);
      toast.error(error.response?.data?.error || "Failed to update entry");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) {
      return;
    }

    try {
      await apiClient.delete(`/waitlist/${id}`);
      toast.success("Entry deleted successfully");
      loadData();
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast.error("Failed to delete entry");
    }
  };

  const openUpdateModal = (entry: WaitlistEntry) => {
    setSelectedEntry(entry);
    setUpdateForm({
      status: entry.status,
      notes: entry.notes || "",
    });
    setShowUpdateModal(true);
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      contacted: "bg-blue-100 text-blue-800 border-blue-300",
      approved: "bg-green-100 text-green-800 border-green-300",
      rejected: "bg-red-100 text-red-800 border-red-300",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold border ${
          colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getUserTypeBadge = (userType: string) => {
    return userType === "shop" ? (
      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
        🏪 Shop
      </span>
    ) : (
      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
        👤 Customer
      </span>
    );
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Staking Waitlist</h2>
          <p className="text-gray-400 mt-1">
            Manage users interested in RCG staking
          </p>
        </div>
        <a
          href="/waitlist"
          target="_blank"
          className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all"
        >
          View Public Page
        </a>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-6 text-white">
            <div className="text-3xl font-bold">{stats.total}</div>
            <div className="text-blue-100 text-sm mt-1">Total Entries</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl p-6 text-white">
            <div className="text-3xl font-bold">{stats.byStatus.pending || 0}</div>
            <div className="text-green-100 text-sm mt-1">Pending</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-6 text-white">
            <div className="text-3xl font-bold">{stats.byUserType.shop || 0}</div>
            <div className="text-purple-100 text-sm mt-1">Shops</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl p-6 text-white">
            <div className="text-3xl font-bold">{stats.recent24h}</div>
            <div className="text-orange-100 text-sm mt-1">Last 24 Hours</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl p-4 flex flex-wrap gap-4">
        <select
          value={filter.status || ""}
          onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-500 outline-none"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="contacted">Contacted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={filter.userType || ""}
          onChange={(e) =>
            setFilter({ ...filter, userType: e.target.value || undefined })
          }
          className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-500 outline-none"
        >
          <option value="">All Types</option>
          <option value="customer">Customers</option>
          <option value="shop">Shops</option>
        </select>

        {(filter.status || filter.userType) && (
          <button
            onClick={() => setFilter({})}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Entries Table */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                  Joined
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    No entries found
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{entry.email}</div>
                      {entry.notes && (
                        <div className="text-xs text-gray-400 mt-1">
                          Note: {entry.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">{getUserTypeBadge(entry.userType)}</td>
                    <td className="px-6 py-4">{getStatusBadge(entry.status)}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(entry.createdAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openUpdateModal(entry)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                        >
                          Update
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Modal */}
      {showUpdateModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">
              Update Waitlist Entry
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <div className="text-white font-medium">{selectedEntry.email}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={updateForm.status}
                  onChange={(e) =>
                    setUpdateForm({ ...updateForm, status: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-500 outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="contacted">Contacted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={updateForm.notes}
                  onChange={(e) =>
                    setUpdateForm({ ...updateForm, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-500 outline-none"
                  placeholder="Add notes about this entry..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleUpdateStatus}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-medium rounded-lg transition-all"
                >
                  Update
                </button>
                <button
                  onClick={() => {
                    setShowUpdateModal(false);
                    setSelectedEntry(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

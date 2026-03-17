"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import apiClient from "@/services/api/client";

interface WaitlistEntry {
  id: string;
  email: string;
  userType: "customer" | "shop";
  inquiryType: "waitlist" | "demo";
  status: "pending" | "contacted" | "approved" | "rejected";
  source: string;
  businessCategory?: string;
  city?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  notifiedAt?: string;
  notes?: string;
}

interface CampaignPerformance {
  source: string;
  visits: number;
  signups: number;
  conversionRate: number | null;
}

interface WaitlistStats {
  total: number;
  byStatus: Record<string, number>;
  byUserType: Record<string, number>;
  bySource: Record<string, number>;
  recent24h: number;
  demoRequests24h: number;
  waitlistSignups24h: number;
  campaignPerformance: CampaignPerformance[];
}

export function AdminWaitlistTab() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [stats, setStats] = useState<WaitlistStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    status?: string;
    userType?: string;
    inquiryType?: string;
    source?: string;
    businessCategory?: string;
  }>({});
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    status: "",
    notes: "",
    assignedTo: "",
  });
  const [viewEntry, setViewEntry] = useState<WaitlistEntry | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [emailSearch, setEmailSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ENTRIES_PER_PAGE = 10;
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    setCurrentPage(1);
  }, [filter]);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [emailSearch]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load entries
      const entriesResponse = await apiClient.get("/waitlist/entries", {
        params: {
          status: filter.status,
          userType: filter.userType,
          inquiryType: filter.inquiryType,
          source: filter.source,
          businessCategory: filter.businessCategory,
          limit: 100,
        },
      }) as any;

      // apiClient interceptor returns response.data directly
      if (entriesResponse.success) {
        setEntries(entriesResponse.data?.entries || []);
      }

      // Load stats
      const statsResponse = await apiClient.get("/waitlist/stats") as any;
      if (statsResponse.success) {
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
          assignedTo: updateForm.assignedTo || undefined,
        }
      ) as any;

      if (response.success) {
        toast.success("Waitlist entry updated successfully");
        setShowUpdateModal(false);
        setSelectedEntry(null);
        setUpdateForm({ status: "", notes: "", assignedTo: "" });
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
      assignedTo: entry.assignedTo || "",
    });
    setShowUpdateModal(true);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleQuickStatus = async (entry: WaitlistEntry, newStatus: string) => {
    setOpenDropdownId(null);
    try {
      const response = await apiClient.put(
        `/waitlist/${entry.id}/status`,
        { status: newStatus }
      ) as any;

      if (response.success) {
        const labels: Record<string, string> = {
          contacted: "Marked as Contacted",
          approved: "Marked as Booked",
          rejected: "Archived",
        };
        toast.success(labels[newStatus] || "Status updated");
        loadData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update status");
    }
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
        Shop
      </span>
    ) : (
      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
        Customer
      </span>
    );
  };

  const getInquiryBadge = (inquiryType: string) => {
    return inquiryType === "demo" ? (
      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
        Demo
      </span>
    ) : (
      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
        Waitlist
      </span>
    );
  };

  const getSourceBadge = (source: string) => {
    const sourceStyles: Record<string, string> = {
      direct: "bg-gray-500/20 text-gray-300 border border-gray-500/30",
      organic: "bg-green-500/20 text-green-400 border border-green-500/30",
      fb: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
      twitter: "bg-white/10 text-white border border-white/20",
    };

    const sourceLabels: Record<string, string> = {
      direct: "Direct",
      organic: "Organic",
      fb: "Facebook",
      twitter: "X / Twitter",
    };

    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${
          sourceStyles[source] || "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
        }`}
      >
        {sourceLabels[source] || source}
      </span>
    );
  };

  const exportToCsv = () => {
    if (filteredEntries.length === 0) {
      toast.error("No entries to export");
      return;
    }

    const categoryLabels: Record<string, string> = {
      repair: "Auto Repair", barber: "Barber / Salon", nails: "Nail Salon",
      gym: "Gym / Fitness", restaurant: "Restaurant", retail: "Retail", other: "Other",
    };

    const headers = ["Email", "Type", "Category", "City", "Source", "Inquiry", "Status", "Assigned To", "Joined", "Notes"];
    const rows = filteredEntries.map((e) => [
      e.email,
      e.userType,
      e.businessCategory ? (categoryLabels[e.businessCategory] || e.businessCategory) : "",
      e.city || "",
      e.source || "direct",
      e.inquiryType || "waitlist",
      e.status,
      e.assignedTo || "",
      new Date(e.createdAt).toLocaleString(),
      (e.notes || "").replace(/"/g, '""'),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `repaircoin-waitlist-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredEntries.length} entries`);
  };

  const getCategoryBadge = (category?: string) => {
    if (!category) return <span className="text-gray-500 text-xs">—</span>;

    const categoryLabels: Record<string, string> = {
      repair: "Auto Repair",
      barber: "Barber / Salon",
      nails: "Nail Salon",
      gym: "Gym / Fitness",
      restaurant: "Restaurant",
      retail: "Retail",
      other: "Other",
    };

    return (
      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
        {categoryLabels[category] || category}
      </span>
    );
  };

  // Client-side email search filter
  const filteredEntries = emailSearch.trim()
    ? entries.filter((e) =>
        e.email.toLowerCase().includes(emailSearch.trim().toLowerCase())
      )
    : entries;

  // Pagination
  const totalPages = Math.ceil(filteredEntries.length / ENTRIES_PER_PAGE);
  const startIndex = (currentPage - 1) * ENTRIES_PER_PAGE;
  const paginatedEntries = filteredEntries.slice(startIndex, startIndex + ENTRIES_PER_PAGE);

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
          <h2 className="text-2xl font-bold text-white">Waitlist & Demos</h2>
          <p className="text-gray-400 mt-1">
            Manage leads, demo requests, and waitlist signups
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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

          <div className="bg-gradient-to-br from-red-500 to-orange-600 rounded-xl p-6 text-white">
            <div className="text-3xl font-bold">{stats.demoRequests24h || 0}</div>
            <div className="text-orange-100 text-sm mt-1">Demo Requests (24h)</div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 text-white">
            <div className="text-3xl font-bold">{stats.waitlistSignups24h || 0}</div>
            <div className="text-teal-100 text-sm mt-1">Waitlist Signups (24h)</div>
          </div>
        </div>
      )}

      {/* Campaign Performance */}
      {stats && stats.campaignPerformance && stats.campaignPerformance.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Campaign Performance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.campaignPerformance.map((campaign) => {
              const sourceLabels: Record<string, string> = {
                direct: "Direct",
                organic: "Organic",
                fb: "Facebook",
              };
              return (
                <div
                  key={campaign.source}
                  className="bg-gray-700/50 rounded-lg p-4 border border-gray-600"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-medium">
                      {sourceLabels[campaign.source] || campaign.source}
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        campaign.conversionRate === null
                          ? "text-gray-500"
                          : campaign.conversionRate > 100
                          ? "text-orange-400"
                          : campaign.conversionRate >= 20
                          ? "text-green-400"
                          : campaign.conversionRate >= 10
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                      title={
                        campaign.conversionRate !== null && campaign.conversionRate > 100
                          ? "CVR > 100% means some signups came without a tracked visit (direct links, bookmarks)"
                          : "CVR = unique signups / unique visits"
                      }
                    >
                      {campaign.conversionRate !== null
                        ? `${campaign.conversionRate}% CVR`
                        : "— CVR"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {campaign.visits}
                      </div>
                      <div className="text-xs text-gray-400">Visits</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {campaign.signups}
                      </div>
                      <div className="text-xs text-gray-400">Signups</div>
                    </div>
                  </div>
                  {/* Conversion bar */}
                  <div className="mt-3 h-2 bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all"
                      style={{
                        width: `${campaign.conversionRate !== null ? Math.min(campaign.conversionRate, 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-gray-800 rounded-xl p-4 flex flex-wrap gap-4 items-center">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={emailSearch}
            onChange={(e) => setEmailSearch(e.target.value)}
            placeholder="Search by email..."
            className="pl-9 pr-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-500 outline-none w-56 text-sm"
          />
        </div>

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

        <select
          value={filter.inquiryType || ""}
          onChange={(e) =>
            setFilter({ ...filter, inquiryType: e.target.value || undefined })
          }
          className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-500 outline-none"
        >
          <option value="">All Inquiries</option>
          <option value="waitlist">Waitlist</option>
          <option value="demo">Demo Requests</option>
        </select>

        <select
          value={filter.source || ""}
          onChange={(e) =>
            setFilter({ ...filter, source: e.target.value || undefined })
          }
          className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-500 outline-none"
        >
          <option value="">All Sources</option>
          <option value="direct">Direct</option>
          <option value="organic">Organic</option>
          <option value="fb">Facebook</option>
        </select>

        <select
          value={filter.businessCategory || ""}
          onChange={(e) =>
            setFilter({ ...filter, businessCategory: e.target.value || undefined })
          }
          className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-500 outline-none"
        >
          <option value="">All Categories</option>
          <option value="repair">Auto Repair</option>
          <option value="barber">Barber / Salon</option>
          <option value="nails">Nail Salon</option>
          <option value="gym">Gym / Fitness</option>
          <option value="restaurant">Restaurant</option>
          <option value="retail">Retail</option>
          <option value="other">Other</option>
        </select>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={exportToCsv}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          {(filter.status || filter.userType || filter.inquiryType || filter.source || filter.businessCategory) && (
            <button
              onClick={() => setFilter({})}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
            >
              Clear Filters
            </button>
          )}
        </div>
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
                  Source
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                  City
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                  Inquiry
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                  Assigned
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
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                    No entries found
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => (
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
                    <td className="px-6 py-4">{getSourceBadge(entry.source || "direct")}</td>
                    <td className="px-6 py-4">{getCategoryBadge(entry.businessCategory)}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-300">{entry.city || "—"}</span>
                    </td>
                    <td className="px-6 py-4">{getInquiryBadge(entry.inquiryType || "waitlist")}</td>
                    <td className="px-6 py-4">{getStatusBadge(entry.status)}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-300">{entry.assignedTo || "—"}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(entry.createdAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative" ref={openDropdownId === entry.id ? dropdownRef : undefined}>
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === entry.id ? null : entry.id)}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors flex items-center gap-1"
                        >
                          Actions
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {openDropdownId === entry.id && (
                          <div className="absolute right-0 mt-1 w-44 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-20 py-1">
                            <button
                              onClick={() => { setViewEntry(entry); setOpenDropdownId(null); }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              View
                            </button>
                            {entry.status !== "contacted" && (
                              <button
                                onClick={() => handleQuickStatus(entry, "contacted")}
                                className="w-full text-left px-4 py-2 text-sm text-blue-300 hover:bg-gray-600 flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                Mark Contacted
                              </button>
                            )}
                            {entry.status !== "approved" && (
                              <button
                                onClick={() => handleQuickStatus(entry, "approved")}
                                className="w-full text-left px-4 py-2 text-sm text-green-300 hover:bg-gray-600 flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Mark Booked
                              </button>
                            )}
                            <button
                              onClick={() => { openUpdateModal(entry); setOpenDropdownId(null); }}
                              className="w-full text-left px-4 py-2 text-sm text-yellow-300 hover:bg-gray-600 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              Edit & Notes
                            </button>
                            <div className="border-t border-gray-600 my-1" />
                            {entry.status !== "rejected" && (
                              <button
                                onClick={() => handleQuickStatus(entry, "rejected")}
                                className="w-full text-left px-4 py-2 text-sm text-orange-300 hover:bg-gray-600 flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                                Archive
                              </button>
                            )}
                            <button
                              onClick={() => { setOpenDropdownId(null); handleDelete(entry.id); }}
                              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-600 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              Delete
                            </button>
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-4 px-6 pb-4">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Previous</span>
            </button>

            <div className="flex items-center gap-1">
              {currentPage > 3 && (
                <>
                  <button
                    onClick={() => setCurrentPage(1)}
                    className="w-10 h-10 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                  >
                    1
                  </button>
                  {currentPage > 4 && (
                    <span className="text-gray-500 px-2">...</span>
                  )}
                </>
              )}

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page =>
                  page === currentPage ||
                  page === currentPage - 1 ||
                  page === currentPage + 1 ||
                  page === currentPage - 2 ||
                  page === currentPage + 2
                )
                .map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-lg transition-colors ${
                      page === currentPage
                        ? "bg-[#FFCC00] text-black font-bold"
                        : "bg-gray-700 text-white hover:bg-gray-600"
                    }`}
                  >
                    {page}
                  </button>
                ))}

              {currentPage < totalPages - 2 && (
                <>
                  {currentPage < totalPages - 3 && (
                    <span className="text-gray-500 px-2">...</span>
                  )}
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className="w-10 h-10 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <span className="hidden sm:inline">Next</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Showing count */}
        {filteredEntries.length > 0 && (
          <div className="text-center text-sm text-gray-400 pb-2">
            Showing {startIndex + 1}–{Math.min(startIndex + ENTRIES_PER_PAGE, filteredEntries.length)} of {filteredEntries.length} entries
          </div>
        )}
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

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Assigned To (Optional)
                </label>
                <input
                  type="text"
                  value={updateForm.assignedTo}
                  onChange={(e) =>
                    setUpdateForm({ ...updateForm, assignedTo: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-500 outline-none"
                  placeholder="e.g. John, Sales Team"
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

      {/* View Detail Modal */}
      {viewEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-white">Lead Details</h3>
              <button
                onClick={() => setViewEntry(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Email</div>
                  <div className="text-white font-medium">{viewEntry.email}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Status</div>
                  <div>{getStatusBadge(viewEntry.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Type</div>
                  <div>{getUserTypeBadge(viewEntry.userType)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Inquiry</div>
                  <div>{getInquiryBadge(viewEntry.inquiryType || "waitlist")}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Source</div>
                  <div>{getSourceBadge(viewEntry.source || "direct")}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Category</div>
                  <div>{getCategoryBadge(viewEntry.businessCategory)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">City</div>
                  <div className="text-white text-sm">{viewEntry.city || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Assigned To</div>
                  <div className="text-white text-sm">{viewEntry.assignedTo || "—"}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Joined</div>
                  <div className="text-white text-sm">
                    {new Date(viewEntry.createdAt).toLocaleDateString()}{" "}
                    {new Date(viewEntry.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {viewEntry.updatedAt && viewEntry.updatedAt !== viewEntry.createdAt && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Last Updated</div>
                  <div className="text-white text-sm">
                    {new Date(viewEntry.updatedAt).toLocaleDateString()}{" "}
                    {new Date(viewEntry.updatedAt).toLocaleTimeString()}
                  </div>
                </div>
              )}

              {viewEntry.notes && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Notes</div>
                  <div className="text-white text-sm bg-gray-700/50 rounded-lg p-3">
                    {viewEntry.notes}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    openUpdateModal(viewEntry);
                    setViewEntry(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-medium rounded-lg transition-all"
                >
                  Edit & Notes
                </button>
                <button
                  onClick={() => setViewEntry(null)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

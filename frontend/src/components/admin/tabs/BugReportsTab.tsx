"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bug, Search, RefreshCw, MessageSquare, X, ChevronDown } from "lucide-react";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { DataTable, Column } from "@/components/ui/DataTable";
import { adminApi } from "@/services/api/admin";

interface BugReport {
  id: number;
  wallet_address: string;
  role: string;
  category: string;
  title: string;
  description: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface BugReportStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  categories: { category: string; count: number }[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: "bg-red-500/20", text: "text-red-400", label: "Open" },
  in_progress: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "In Progress" },
  resolved: { bg: "bg-green-500/20", text: "text-green-400", label: "Resolved" },
  closed: { bg: "bg-gray-500/20", text: "text-gray-400", label: "Closed" },
};

const STATUSES = ["all", "open", "in_progress", "resolved", "closed"];
const CATEGORIES = [
  "all",
  "App Crash",
  "Payment Issue",
  "Wallet / Tokens",
  "Booking / Orders",
  "Notifications",
  "Login / Auth",
  "UI / Display",
  "Other",
];

export function BugReportsTab() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [stats, setStats] = useState<BugReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Detail modal
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getBugReports({
        page,
        limit: 20,
        status: statusFilter !== "all" ? statusFilter : undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        search: searchTerm || undefined,
      });
      setReports(res.data.reports);
      setTotalPages(res.data.pagination.totalPages);
      setTotal(res.data.pagination.total);
    } catch (err) {
      console.error("Failed to fetch bug reports:", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter, searchTerm]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminApi.getBugReportStats();
      setStats(res.data);
    } catch (err) {
      console.error("Failed to fetch bug report stats:", err);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, categoryFilter, searchTerm]);

  const handleUpdateReport = async () => {
    if (!selectedReport) return;
    setUpdating(true);
    try {
      await adminApi.updateBugReport(selectedReport.id, {
        status: editStatus,
        admin_notes: editNotes,
      });
      setSelectedReport(null);
      fetchReports();
      fetchStats();
    } catch (err) {
      console.error("Failed to update bug report:", err);
    } finally {
      setUpdating(false);
    }
  };

  const openDetail = (report: BugReport) => {
    setSelectedReport(report);
    setEditStatus(report.status);
    setEditNotes(report.admin_notes || "");
  };

  const columns: Column<BugReport>[] = [
    {
      key: "id",
      header: "#",
      accessor: (r) => (
        <span className="text-gray-400 text-sm font-mono">#{r.id}</span>
      ),
      sortable: true,
      sortValue: (r) => r.id,
    },
    {
      key: "title",
      header: "Title",
      accessor: (r) => (
        <div className="max-w-[250px]">
          <p className="text-white text-sm font-medium truncate">{r.title}</p>
          <p className="text-gray-500 text-xs truncate">{r.description}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      accessor: (r) => (
        <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-300">
          {r.category}
        </span>
      ),
      sortable: true,
      sortValue: (r) => r.category,
    },
    {
      key: "reporter",
      header: "Reporter",
      accessor: (r) => (
        <div>
          <p className="text-white text-sm font-mono">
            {r.wallet_address.slice(0, 6)}...{r.wallet_address.slice(-4)}
          </p>
          <p className="text-gray-500 text-xs capitalize">{r.role}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      accessor: (r) => {
        const s = STATUS_COLORS[r.status] || STATUS_COLORS.open;
        return (
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.bg} ${s.text}`}>
            {s.label}
          </span>
        );
      },
      sortable: true,
      sortValue: (r) => r.status,
    },
    {
      key: "created_at",
      header: "Date",
      accessor: (r) => (
        <span className="text-gray-400 text-sm">
          {new Date(r.created_at).toLocaleDateString()}
        </span>
      ),
      sortable: true,
      sortValue: (r) => new Date(r.created_at).getTime(),
    },
    {
      key: "actions",
      header: "Actions",
      accessor: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            openDetail(r);
          }}
          className="px-3 py-1.5 text-xs rounded-lg bg-[#FFCC00]/10 text-[#FFCC00] hover:bg-[#FFCC00]/20 transition-colors"
        >
          View
        </button>
      ),
    },
  ];

  return (
    <div>
      <DashboardHeader
        title="Bug Reports"
        subtitle={`${total} total reports`}
        icon={Bug}
        gradientFrom="from-red-500"
        gradientTo="to-orange-500"
        actions={
          <button
            onClick={() => { fetchReports(); fetchStats(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Open", value: stats.open, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
            { label: "In Progress", value: stats.in_progress, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
            { label: "Resolved", value: stats.resolved, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
            { label: "Closed", value: stats.closed, color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl border p-4 ${stat.bg}`}
            >
              <p className="text-gray-400 text-sm">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by title, description, or wallet..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#FFCC00]/50"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none px-4 py-2.5 pr-10 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#FFCC00]/50 cursor-pointer"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s} className="bg-gray-900">
                {s === "all" ? "All Statuses" : STATUS_COLORS[s]?.label || s}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="appearance-none px-4 py-2.5 pr-10 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#FFCC00]/50 cursor-pointer"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-gray-900">
                {c === "all" ? "All Categories" : c}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <DataTable
          data={reports}
          columns={columns}
          keyExtractor={(r) => String(r.id)}
          onRowClick={openDetail}
          loading={loading}
          emptyMessage="No bug reports found"
          showPagination={totalPages > 1}
          itemsPerPage={20}
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-sm disabled:opacity-50 hover:bg-white/10 transition-colors"
          >
            Previous
          </button>
          <span className="text-gray-400 text-sm">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-sm disabled:opacity-50 hover:bg-white/10 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail / Edit Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center">
                  <Bug className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Bug Report #{selectedReport.id}</h3>
                  <p className="text-gray-500 text-xs">
                    {new Date(selectedReport.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Reporter Info */}
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-gray-500 text-xs">Reporter</p>
                  <p className="text-white text-sm font-mono">{selectedReport.wallet_address}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-300 capitalize">
                  {selectedReport.role}
                </span>
              </div>

              {/* Category & Title */}
              <div>
                <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-300">
                  {selectedReport.category}
                </span>
                <h4 className="text-white font-medium mt-2">{selectedReport.title}</h4>
              </div>

              {/* Description */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <p className="text-gray-300 text-sm whitespace-pre-wrap">
                  {selectedReport.description}
                </p>
              </div>

              {/* Status */}
              <div>
                <label className="text-gray-400 text-sm block mb-2">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#FFCC00]/50"
                >
                  {STATUSES.filter((s) => s !== "all").map((s) => (
                    <option key={s} value={s} className="bg-gray-900">
                      {STATUS_COLORS[s]?.label || s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Admin Notes */}
              <div>
                <label className="text-gray-400 text-sm flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4" />
                  Admin Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes about this bug report..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSelectedReport(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-sm hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateReport}
                  disabled={updating}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#FFCC00] text-black text-sm font-medium hover:bg-[#FFCC00]/90 transition-colors disabled:opacity-50"
                >
                  {updating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

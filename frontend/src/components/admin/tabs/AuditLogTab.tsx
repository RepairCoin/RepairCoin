"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ScrollText, Search, RefreshCw, ChevronDown, X } from "lucide-react";
import toast from "react-hot-toast";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { DataTable, Column } from "@/components/ui/DataTable";
import { adminApi } from "@/services/api/admin";

interface ActivityLog {
  id: number | string;
  timestamp: string;
  adminAddress: string;
  action: string;
  description: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  status: string;
}

const ENTITY_TYPES = ["all", "admin", "customer", "shop", "contract", "transaction", "system", "alert"];

// Action-type → colour, grouped by risk/category.
const ACTION_COLORS: { match: RegExp; className: string }[] = [
  { match: /(emergency|stop|pause|suspend|deletion)/, className: "bg-red-500/15 text-red-400 border-red-500/30" },
  { match: /(unsuspend|unpause|activ|creation|approve)/, className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { match: /(mint|sale|redemption|treasury)/, className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  { match: /(admin|role|permission)/, className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
];

function actionColor(action: string): string {
  const hit = ACTION_COLORS.find((c) => c.match.test(action.toLowerCase()));
  return hit?.className ?? "bg-white/10 text-gray-300 border-white/10";
}

function prettify(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const PER_PAGE = 25;

export function AuditLogTab() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getActivityLogs({
        page,
        limit: PER_PAGE,
        entityType: entityType !== "all" ? entityType : undefined,
        adminAddress: search.trim() || undefined,
      });
      if (res?.success) {
        setLogs(res.data?.logs || []);
        setTotalPages(res.data?.pagination?.totalPages || 1);
        setTotal(res.data?.pagination?.totalItems ?? res.data?.total ?? 0);
      } else {
        toast.error("Failed to load audit log");
      }
    } catch (err) {
      console.error("Failed to load activity logs:", err);
      toast.error("Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [page, entityType, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [entityType, search]);

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
    return { date: d.toLocaleDateString(), time: d.toLocaleTimeString() };
  };

  const columns: Column<ActivityLog>[] = [
    {
      key: "timestamp",
      header: "When",
      accessor: (log) => {
        const t = formatTimestamp(log.timestamp);
        if (typeof t === "string") return <span className="text-gray-400 text-sm">{t}</span>;
        return (
          <div className="text-sm">
            <div className="text-gray-300">{t.date}</div>
            <div className="text-gray-500 text-xs">{t.time}</div>
          </div>
        );
      },
    },
    {
      key: "admin",
      header: "Admin",
      accessor: (log) => (
        <span className="text-white text-sm font-mono">
          {log.adminAddress
            ? `${log.adminAddress.slice(0, 6)}...${log.adminAddress.slice(-4)}`
            : "—"}
        </span>
      ),
    },
    {
      key: "action",
      header: "Action",
      accessor: (log) => (
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${actionColor(log.action)}`}>
          {prettify(log.action)}
        </span>
      ),
    },
    {
      key: "entity",
      header: "Target",
      accessor: (log) => (
        <div className="text-sm">
          <p className="text-gray-300 capitalize">{log.entityType || "—"}</p>
          {log.entityId && (
            <p className="text-gray-500 text-xs font-mono truncate max-w-[160px]">{log.entityId}</p>
          )}
        </div>
      ),
    },
    {
      key: "description",
      header: "Details",
      accessor: (log) => (
        <p className="text-gray-300 text-sm max-w-[320px] truncate" title={log.description}>
          {log.description || "—"}
        </p>
      ),
    },
  ];

  return (
    <div>
      <DashboardHeader
        title="Audit Log"
        subtitle={`${total.toLocaleString()} admin actions recorded`}
        icon={ScrollText}
        gradientFrom="from-violet-500"
        gradientTo="to-purple-500"
        actions={
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Filter by admin wallet address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500/50"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="appearance-none px-4 py-2.5 pr-10 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500/50 cursor-pointer capitalize"
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t} className="bg-gray-900">
                {t === "all" ? "All Targets" : prettify(t)}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <DataTable
          data={logs}
          columns={columns}
          keyExtractor={(log) => String(log.id)}
          loading={loading}
          emptyMessage="No admin actions found for these filters"
          showPagination={false}
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
            <span className="text-gray-600"> · {total.toLocaleString()} total</span>
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
    </div>
  );
}

export default AuditLogTab;

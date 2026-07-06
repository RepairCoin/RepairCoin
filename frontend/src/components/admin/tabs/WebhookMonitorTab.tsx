"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Webhook,
  RefreshCw,
  ChevronDown,
  RotateCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { DataTable, Column } from "@/components/ui/DataTable";
import { adminApi } from "@/services/api/admin";

interface WebhookLog {
  id: string;
  webhookId?: string;
  eventType: string;
  source: "stripe" | "fixflow" | "thirdweb" | "other" | string;
  status: "pending" | "processing" | "success" | "failed" | "retry" | string;
  httpStatus?: number;
  errorMessage?: string;
  retryCount: number;
  createdAt?: string;
  processedAt?: string;
}

interface WebhookHealth {
  healthy?: boolean;
  status?: string;
  failedLast24h?: number;
  pendingCount?: number;
  [key: string]: unknown;
}

const STATUSES = ["all", "success", "failed", "pending", "processing", "retry"];
const SOURCES = ["all", "stripe", "fixflow", "thirdweb", "other"];
const PER_PAGE = 25;

const STATUS_STYLE: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  processing: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  retry: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

export function WebhookMonitorTab() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [health, setHealth] = useState<WebhookHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, healthRes] = await Promise.all([
        adminApi.getWebhookLogs({
          page,
          limit: PER_PAGE,
          status: statusFilter !== "all" ? statusFilter : undefined,
          source: sourceFilter !== "all" ? sourceFilter : undefined,
        }),
        adminApi.getWebhookHealth(),
      ]);
      if (logsRes?.success) {
        setLogs(logsRes.data?.items || []);
        setTotal(logsRes.data?.total || 0);
      }
      if (healthRes?.success) setHealth(healthRes.data || null);
    } catch (err) {
      console.error("Failed to load webhook logs:", err);
      toast.error("Failed to load webhook logs");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, sourceFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, sourceFilter]);

  const retry = async (log: WebhookLog) => {
    const id = log.webhookId || log.id;
    setRetryingId(log.id);
    try {
      const res = await adminApi.retryWebhookById(id);
      if (res?.success) {
        toast.success("Webhook reprocessed");
        fetchData();
      } else {
        toast.error("Retry did not succeed");
      }
    } catch (err) {
      console.error("Webhook retry failed:", err);
      toast.error("Failed to retry webhook");
    } finally {
      setRetryingId(null);
    }
  };

  const isHealthy = health?.healthy ?? health?.status === "healthy";

  const columns: Column<WebhookLog>[] = [
    {
      key: "when",
      header: "When",
      accessor: (log) => {
        const d = log.createdAt ? new Date(log.createdAt) : null;
        if (!d || isNaN(d.getTime())) return <span className="text-gray-500 text-sm">—</span>;
        return (
          <div className="text-sm">
            <div className="text-gray-300">{d.toLocaleDateString()}</div>
            <div className="text-gray-500 text-xs">{d.toLocaleTimeString()}</div>
          </div>
        );
      },
    },
    {
      key: "event",
      header: "Event",
      accessor: (log) => (
        <div className="text-sm">
          <p className="text-white font-medium">{log.eventType || "—"}</p>
          <p className="text-gray-500 text-xs capitalize">{log.source}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      accessor: (log) => (
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium border capitalize ${STATUS_STYLE[log.status] || "bg-white/10 text-gray-300 border-white/10"}`}>
            {log.status}
          </span>
          {log.httpStatus ? <span className="text-gray-500 text-xs">{log.httpStatus}</span> : null}
        </div>
      ),
    },
    {
      key: "retries",
      header: "Retries",
      accessor: (log) => <span className="text-gray-400 text-sm">{log.retryCount ?? 0}</span>,
    },
    {
      key: "error",
      header: "Error",
      accessor: (log) =>
        log.errorMessage ? (
          <p className="text-red-400 text-xs max-w-[280px] truncate" title={log.errorMessage}>
            {log.errorMessage}
          </p>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      accessor: (log) =>
        log.status === "failed" || log.status === "retry" ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              retry(log);
            }}
            disabled={retryingId === log.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
          >
            {retryingId === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
            Retry
          </button>
        ) : null,
    },
  ];

  return (
    <div>
      <DashboardHeader
        title="Webhook Monitor"
        subtitle="FixFlow & Stripe webhook delivery — logs, failures, and replay"
        icon={Webhook}
        gradientFrom="from-sky-500"
        gradientTo="to-blue-600"
        actions={
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      {/* Health banner */}
      {health && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 mb-6 ${
            isHealthy ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"
          }`}
        >
          {isHealthy ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-semibold ${isHealthy ? "text-emerald-300" : "text-red-300"}`}>
              Webhook pipeline {isHealthy ? "healthy" : "degraded"}
            </p>
            <p className="text-xs text-gray-400">
              {typeof health.failedLast24h === "number" && (
                <span className="mr-3">
                  <AlertTriangle className="inline w-3 h-3 mb-0.5 mr-1 text-red-400" />
                  {health.failedLast24h} failed (24h)
                </span>
              )}
              {typeof health.pendingCount === "number" && (
                <span>
                  <Clock className="inline w-3 h-3 mb-0.5 mr-1 text-yellow-400" />
                  {health.pendingCount} pending
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <FilterSelect label="Status" value={statusFilter} options={STATUSES} onChange={setStatusFilter} />
        <FilterSelect label="Source" value={sourceFilter} options={SOURCES} onChange={setSourceFilter} />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <DataTable
          data={logs}
          columns={columns}
          keyExtractor={(log) => String(log.id)}
          loading={loading}
          emptyMessage="No webhook events for these filters"
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
            <span className="text-gray-600"> · {total.toLocaleString()} events</span>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-sm disabled:opacity-50 hover:bg-white/10 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

const FilterSelect: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none px-4 py-2.5 pr-10 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 cursor-pointer capitalize"
    >
      {options.map((o) => (
        <option key={o} value={o} className="bg-gray-900">
          {o === "all" ? `All ${label}` : o}
        </option>
      ))}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
  </div>
);

export default WebhookMonitorTab;

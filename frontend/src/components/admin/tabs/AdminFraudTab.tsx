"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  ShieldAlert,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Eye,
  Ban,
  Check,
  X,
  Play,
} from "lucide-react";
import {
  listFraudFindings,
  getFraudSummary,
  updateFraudFindingStatus,
  suspendShopForFraud,
  suspendCustomerForFraud,
  runFraudScan,
  FraudFinding,
  FraudStatus,
  FraudSummary,
} from "@/services/api/fraud";

const STATUS_TABS: { key: FraudStatus | "all"; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "investigating", label: "Investigating" },
  { key: "confirmed", label: "Confirmed" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

const RULE_LABELS: Record<string, string> = {
  concentrated_issuance: "Concentrated issuance",
  rapid_earn_redeem: "Rapid earn → redeem",
  issuance_spike: "Issuance spike",
  review_brigading: "Review brigading",
};

function severityColor(s: number): string {
  if (s >= 80) return "bg-red-500/20 text-red-400 border-red-500/40";
  if (s >= 50) return "bg-amber-500/20 text-amber-400 border-amber-500/40";
  return "bg-gray-500/20 text-gray-400 border-gray-500/40";
}

export const AdminFraudTab: React.FC = () => {
  const [findings, setFindings] = useState<FraudFinding[]>([]);
  const [summary, setSummary] = useState<FraudSummary | null>(null);
  const [activeStatus, setActiveStatus] = useState<FraudStatus | "all">("open");
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const runScan = async () => {
    setScanning(true);
    try {
      const result = await runFraudScan();
      toast.success(
        result
          ? `Scan complete — ${result.scanned} finding(s), ${result.upserted} saved`
          : "Scan complete"
      );
      await load();
    } catch {
      toast.error("Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        listFraudFindings(
          activeStatus === "all" ? {} : { status: activeStatus }
        ),
        getFraudSummary(),
      ]);
      setFindings(list);
      setSummary(sum);
    } catch {
      toast.error("Failed to load fraud findings");
    } finally {
      setLoading(false);
    }
  }, [activeStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (
    f: FraudFinding,
    status: FraudStatus,
    note?: string
  ) => {
    setActioningId(f.id);
    try {
      await updateFraudFindingStatus(f.id, status, note);
      toast.success(`Marked ${status}`);
      await load();
    } catch {
      toast.error("Failed to update finding");
    } finally {
      setActioningId(null);
    }
  };

  const confirmAndSuspend = async (f: FraudFinding) => {
    setActioningId(f.id);
    try {
      const reason = `Fraud finding (${RULE_LABELS[f.rule_key] || f.rule_key}, severity ${f.severity})`;
      if (f.subject_type === "shop" && f.shop_id) {
        await suspendShopForFraud(f.shop_id, reason);
      } else if (f.subject_type === "customer" && f.customer_address) {
        await suspendCustomerForFraud(f.customer_address, reason);
      } else {
        toast.error("No suspendable subject on this finding");
        setActioningId(null);
        return;
      }
      await updateFraudFindingStatus(f.id, "confirmed", `Suspended: ${reason}`);
      toast.success("Subject suspended & finding confirmed");
      await load();
    } catch {
      toast.error("Suspend failed");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-[#FFCC00]" />
          <div>
            <h2 className="text-2xl font-bold text-white">Trust &amp; Safety</h2>
            <p className="text-gray-400 text-sm">
              Fraud &amp; abuse findings from the nightly scan — review and act.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runScan}
            disabled={scanning}
            className="px-3 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-60"
            title="Run the detection scan now"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {scanning ? "Scanning…" : "Run scan now"}
          </button>
          <button
            onClick={load}
            className="px-3 py-2 bg-[#101010] border border-gray-700 text-gray-300 rounded-lg hover:border-[#FFCC00] hover:text-[#FFCC00] transition-colors flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <SummaryCard label="Open" value={summary.open} highlight />
          <SummaryCard label="High severity" value={summary.open_high_severity} danger />
          <SummaryCard label="Investigating" value={summary.investigating} />
          <SummaryCard label="Confirmed" value={summary.confirmed} />
          <SummaryCard label="Dismissed" value={summary.dismissed} />
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap border-b border-gray-800 pb-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveStatus(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeStatus === t.key
                ? "bg-[#FFCC00] text-black font-medium"
                : "bg-[#1A1A1A] text-gray-400 hover:text-white border border-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
        </div>
      ) : findings.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p>No {activeStatus === "all" ? "" : activeStatus} findings.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {findings.map((f) => (
            <FindingCard
              key={f.id}
              finding={f}
              busy={actioningId === f.id}
              onInvestigate={() => setStatus(f, "investigating")}
              onDismiss={() => setStatus(f, "dismissed")}
              onConfirmSuspend={() => confirmAndSuspend(f)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{
  label: string;
  value: number;
  highlight?: boolean;
  danger?: boolean;
}> = ({ label, value, highlight, danger }) => (
  <div
    className={`rounded-lg p-3 border ${
      danger
        ? "bg-red-900/20 border-red-500/40"
        : highlight
          ? "bg-[#1A1A1A] border-[#FFCC00]/40"
          : "bg-[#1A1A1A] border-gray-800"
    }`}
  >
    <p className="text-gray-400 text-xs">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${danger ? "text-red-400" : "text-white"}`}>
      {value}
    </p>
  </div>
);

const FindingCard: React.FC<{
  finding: FraudFinding;
  busy: boolean;
  onInvestigate: () => void;
  onDismiss: () => void;
  onConfirmSuspend: () => void;
}> = ({ finding: f, busy, onInvestigate, onDismiss, onConfirmSuspend }) => {
  const [expanded, setExpanded] = useState(false);
  const isReviewed = f.status === "confirmed" || f.status === "dismissed";

  // Always show whatever subject IDs the finding carries — for a `pair`
  // (self-dealing) that's BOTH the shop and the wallet, so an admin knows
  // exactly who "Confirm & Suspend" will act on.
  const subjectRows: { label: string; value: string; href?: string }[] = [];
  if (f.shop_id) {
    subjectRows.push({ label: "Shop", value: f.shop_id, href: "/admin?tab=shops-management" });
  }
  if (f.customer_address) {
    subjectRows.push({ label: "Wallet", value: f.customer_address, href: "/admin?tab=customers" });
  }
  if (subjectRows.length === 0) {
    subjectRows.push({ label: "Subject", value: f.subject_type });
  }

  return (
    <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${severityColor(f.severity)}`}>
              {f.severity}
            </span>
            <span className="text-white font-semibold">
              {RULE_LABELS[f.rule_key] || f.rule_key}
            </span>
            <span className="text-xs text-gray-500 uppercase tracking-wide px-2 py-0.5 rounded bg-gray-800">
              {f.status}
            </span>
            {f.recommended_action && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  f.recommended_action === "freeze"
                    ? "bg-red-500/15 text-red-400 border-red-500/40"
                    : f.recommended_action === "investigate"
                      ? "bg-blue-500/15 text-blue-400 border-blue-500/40"
                      : "bg-gray-500/15 text-gray-400 border-gray-500/40"
                }`}
                title="The detection engine's recommended action"
              >
                ⚑ {f.recommended_action}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-300 break-words">{f.explanation}</p>
          {/* Subject IDs — shop + wallet shown explicitly (pair shows both) */}
          <div className="mt-1.5 space-y-0.5">
            {subjectRows.map((s) => (
              <div key={s.label} className="text-xs break-all">
                <span className="text-gray-500">{s.label}: </span>
                {s.href ? (
                  <a href={s.href} className="text-[#FFCC00] hover:underline">{s.value}</a>
                ) : (
                  <span className="text-gray-300">{s.value}</span>
                )}
              </div>
            ))}
          </div>
          {/* Metrics */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {Object.entries(f.metrics || {}).map(([k, v]) => (
              <span key={k} className="text-xs text-gray-400">
                <span className="text-gray-500">{k}:</span> {String(v)}
              </span>
            ))}
          </div>
          {f.resolution_note && (
            <p className="text-xs text-gray-500 mt-2 italic">
              Note: {f.resolution_note}
            </p>
          )}

          {/* Drill-down: window + timestamps + review trail */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            {expanded ? "▾ Hide details" : "▸ Details"}
          </button>
          {expanded && (
            <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-gray-400">
              <div><span className="text-gray-500">Rule key:</span> {f.rule_key}</div>
              <div><span className="text-gray-500">Detected:</span> {new Date(f.created_at).toLocaleString()}</div>
              {f.window_start && (
                <div><span className="text-gray-500">Window:</span> {new Date(f.window_start).toLocaleDateString()} → {f.window_end ? new Date(f.window_end).toLocaleDateString() : "now"}</div>
              )}
              <div><span className="text-gray-500">Recommended:</span> {f.recommended_action ?? "—"}</div>
              {f.reviewed_by && (
                <div className="break-all"><span className="text-gray-500">Reviewed by:</span> {f.reviewed_by}</div>
              )}
              {f.reviewed_at && (
                <div><span className="text-gray-500">Reviewed at:</span> {new Date(f.reviewed_at).toLocaleString()}</div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isReviewed && (
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={onInvestigate}
              disabled={busy}
              className="px-3 py-1.5 text-xs rounded-lg bg-[#101010] border border-gray-700 text-gray-300 hover:border-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5" /> Investigate
            </button>
            <button
              onClick={onConfirmSuspend}
              disabled={busy}
              className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
              Confirm &amp; Suspend
            </button>
            <button
              onClick={onDismiss}
              disabled={busy}
              className="px-3 py-1.5 text-xs rounded-lg bg-[#101010] border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" /> Dismiss
            </button>
          </div>
        )}
        {isReviewed && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
            {f.status === "confirmed" ? (
              <Check className="w-4 h-4 text-red-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-gray-600" />
            )}
            {f.reviewed_by ? `by ${f.reviewed_by.slice(0, 8)}…` : "reviewed"}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFraudTab;

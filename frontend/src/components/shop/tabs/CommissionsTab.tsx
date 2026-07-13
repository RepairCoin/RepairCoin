"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Percent, Loader2, DollarSign, CheckCircle } from "lucide-react";
import {
  getCommissions,
  markCommissionsPaid,
  type CommissionReport,
  type CommissionStatus,
} from "@/services/api/commissions";
import { getAssignableMembers, type AssignableMember } from "@/services/api/team";

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const todayStr = () => new Date().toISOString().slice(0, 10);

const money = (n: number) => `$${n.toFixed(2)}`;

const statusBadge: Record<CommissionStatus, string> = {
  accrued: "bg-yellow-500/20 text-yellow-300",
  paid: "bg-green-500/20 text-green-300",
  voided: "bg-red-500/20 text-red-300",
};

export function CommissionsTab() {
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(todayStr());
  const [memberId, setMemberId] = useState("");
  const [status, setStatus] = useState<"" | CommissionStatus>("");
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [report, setReport] = useState<CommissionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    getAssignableMembers()
      .then((d) => setMembers(d.members))
      .catch(() => setMembers([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCommissions({
        from,
        to,
        memberId: memberId || undefined,
        status: status || undefined,
      });
      setReport(data);
    } catch {
      toast.error("Failed to load commissions.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, memberId, status]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const s = report?.summary ?? [];
    return {
      accrued: s.reduce((sum, m) => sum + m.accruedAmount, 0),
      paid: s.reduce((sum, m) => sum + m.paidAmount, 0),
    };
  }, [report]);

  const handleMarkPaid = async () => {
    if (totals.accrued <= 0) return;
    const scope = memberId
      ? members.find((m) => m.id === memberId)?.name ?? "the selected member"
      : "all members";
    if (
      !confirm(
        `Mark ${money(totals.accrued)} of accrued commission as paid for ${scope} (${from} → ${to})? This records that you've paid it out.`,
      )
    )
      return;

    setMarking(true);
    try {
      const result = await markCommissionsPaid({ from, to, memberId: memberId || undefined });
      toast.success(`Marked ${result.count} commission${result.count === 1 ? "" : "s"} paid (${money(result.totalPaid)}).`);
      load();
    } catch {
      toast.error("Couldn't mark as paid. Please try again.");
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#303236] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Percent className="w-5 h-5 text-[#FFCC00]" /> Staff Commissions
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            What each team member earned on the orders they completed. Payout is tracked here — you
            pay it out through your own payroll.
          </p>
        </div>
        <button
          onClick={handleMarkPaid}
          disabled={marking || totals.accrued <= 0}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#FFCC00] text-black font-medium hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {marking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Mark accrued as paid
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-[#101010] border border-[#303236] text-white focus:border-[#FFCC00] outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-[#101010] border border-[#303236] text-white focus:border-[#FFCC00] outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Member</label>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-[#101010] border border-[#303236] text-white focus:border-[#FFCC00] outline-none"
          >
            <option value="">All members</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | CommissionStatus)}
            className="w-full px-3 py-2 rounded-md bg-[#101010] border border-[#303236] text-white focus:border-[#FFCC00] outline-none"
          >
            <option value="">All</option>
            <option value="accrued">Accrued</option>
            <option value="paid">Paid</option>
            <option value="voided">Voided</option>
          </select>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Accrued (unpaid)</p>
              <p className="text-2xl font-bold text-white">{money(totals.accrued)}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Paid</p>
              <p className="text-2xl font-bold text-white">{money(totals.paid)}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-10 h-10 text-[#FFCC00] animate-spin mx-auto" />
          <p className="mt-3 text-gray-400">Loading commissions...</p>
        </div>
      ) : !report || report.rows.length === 0 ? (
        <div className="text-center py-12 bg-[#101010] rounded-lg">
          <Percent className="w-14 h-14 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">No commissions in this range</h3>
          <p className="text-gray-400">Completed orders will accrue commission here once enabled.</p>
        </div>
      ) : (
        <>
          {/* Per-member summary */}
          {report.summary.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[#303236]">
              <table className="w-full text-left">
                <thead className="bg-[#1e1f22] text-gray-400 text-sm">
                  <tr>
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium text-right">Orders</th>
                    <th className="px-4 py-3 font-medium text-right">Accrued</th>
                    <th className="px-4 py-3 font-medium text-right">Paid</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#303236] text-white">
                  {report.summary.map((m) => (
                    <tr key={m.memberId}>
                      <td className="px-4 py-3 font-medium">{m.memberName}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{m.count}</td>
                      <td className="px-4 py-3 text-right text-yellow-300">{money(m.accruedAmount)}</td>
                      <td className="px-4 py-3 text-right text-green-300">{money(m.paidAmount)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{money(m.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detail rows */}
          <div className="overflow-x-auto rounded-lg border border-[#303236]">
            <table className="w-full text-left">
              <thead className="bg-[#1e1f22] text-gray-400 text-sm">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium text-right">Base</th>
                  <th className="px-4 py-3 font-medium text-right">Rate</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#303236] text-white">
                {report.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-400">{r.orderId}</td>
                    <td className="px-4 py-3">{r.memberName}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{money(r.baseAmount)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{r.ratePercent}%</td>
                    <td className="px-4 py-3 text-right font-semibold">{money(r.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${statusBadge[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

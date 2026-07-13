"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Percent, Loader2, DollarSign, CheckCircle } from "lucide-react";
import {
  getMyCommissions,
  type MyCommissions,
  type CommissionStatus,
} from "@/services/api/commissions";

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

export function MyCommissionsTab() {
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState<MyCommissions | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getMyCommissions({ from, to }));
    } catch {
      toast.error("Failed to load your commissions.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="border-b border-[#303236] pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Percent className="w-5 h-5 text-[#FFCC00]" /> My Commissions
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          What you&apos;ve earned on the orders you completed. Your shop pays this out through
          payroll — amounts here are a record, not a wallet balance.
        </p>
      </div>

      {data && !data.commissionsEnabled && (
        <div className="rounded-lg bg-[#101010] border border-[#303236] px-4 py-3 text-sm text-gray-400">
          Commissions aren&apos;t currently enabled for this shop.
        </div>
      )}

      {/* Date filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
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
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Accrued (awaiting payout)</p>
              <p className="text-2xl font-bold text-white">{money(data?.summary.accrued ?? 0)}</p>
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
              <p className="text-2xl font-bold text-white">{money(data?.summary.paid ?? 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-10 h-10 text-[#FFCC00] animate-spin mx-auto" />
          <p className="mt-3 text-gray-400">Loading your commissions...</p>
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="text-center py-12 bg-[#101010] rounded-lg">
          <Percent className="w-14 h-14 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">Nothing in this range</h3>
          <p className="text-gray-400">Commission you earn on completed orders will show up here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#303236]">
          <table className="w-full text-left">
            <thead className="bg-[#1e1f22] text-gray-400 text-sm">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium text-right">Order total</th>
                <th className="px-4 py-3 font-medium text-right">Rate</th>
                <th className="px-4 py-3 font-medium text-right">You earned</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#303236] text-white">
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-400">{r.orderId}</td>
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
      )}
    </div>
  );
}

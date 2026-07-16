"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DollarSign, RefreshCw, Loader2, Coins, Wallet, Store, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { adminApi } from "@/services/api/admin";

interface CommissionShop {
  shopId: string;
  shopName: string;
  enabled: boolean;
  defaultPercent: number;
  accrued: number;
  paid: number;
}

interface CommissionTotals {
  accrued: number;
  paid: number;
}

const usd = (n: number | undefined) =>
  (n ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function CommissionsAnalyticsTab() {
  const [totals, setTotals] = useState<CommissionTotals | null>(null);
  const [shops, setShops] = useState<CommissionShop[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getPlatformCommissions();
      if (res?.success) {
        setTotals(res.data?.totals || null);
        setShops(res.data?.shops || []);
      } else {
        toast.error("Failed to load commission data");
      }
    } catch (err) {
      console.error("Failed to load commission data:", err);
      toast.error("Failed to load commission data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const enabledCount = shops.filter((s) => s.enabled).length;

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Staff Commissions"
        subtitle="Platform-wide commission settings and accrued vs. paid totals across shops"
        icon={DollarSign}
        gradientFrom="from-emerald-500"
        gradientTo="to-teal-600"
        actions={
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : totals ? (
        <>
          {/* Headline totals */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Stat label="Total Accrued (Unpaid)" value={usd(totals.accrued)} icon={Wallet} accent="text-yellow-400" />
            <Stat label="Total Paid Out" value={usd(totals.paid)} icon={Coins} accent="text-emerald-400" />
            <Stat label="Shops With Commissions" value={String(enabledCount)} icon={CheckCircle2} accent="text-white" />
          </div>

          {/* Per-shop breakdown */}
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
            <h3 className="flex items-center gap-2 text-white font-semibold mb-4">
              <Store className="w-5 h-5 text-[#FFCC00]" />
              By Shop
            </h3>
            {shops.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
                      <th className="text-left py-2 font-medium">Shop</th>
                      <th className="text-center py-2 font-medium">Enabled</th>
                      <th className="text-right py-2 font-medium">Default Rate</th>
                      <th className="text-right py-2 font-medium">Accrued</th>
                      <th className="text-right py-2 font-medium">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shops.map((s) => (
                      <tr key={s.shopId} className="border-b border-gray-800/60">
                        <td className="py-2.5">
                          <p className="text-white font-medium">{s.shopName || "Unnamed shop"}</p>
                          <p className="text-gray-500 text-xs font-mono">{s.shopId}</p>
                        </td>
                        <td className="py-2.5 text-center">
                          {s.enabled ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> On
                            </span>
                          ) : (
                            <span className="text-gray-500 text-xs">Off</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right text-gray-300">{s.defaultPercent}%</td>
                        <td className="py-2.5 text-right text-yellow-400">{usd(s.accrued)}</td>
                        <td className="py-2.5 text-right text-white font-medium">{usd(s.paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No shops have enabled staff commissions yet.</p>
            )}
          </div>
        </>
      ) : (
        <p className="text-gray-500 text-center py-16">No commission data available.</p>
      )}
    </div>
  );
}

const Stat: React.FC<{ label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent: string }> = ({
  label,
  value,
  icon: Icon,
  accent,
}) => (
  <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-4">
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <Icon className="w-4 h-4 text-gray-600" />
    </div>
    <p className={`text-2xl font-bold ${accent}`}>{value}</p>
  </div>
);

export default CommissionsAnalyticsTab;

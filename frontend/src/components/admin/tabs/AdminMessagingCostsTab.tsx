"use client";

// Admin: off-channel AI-messaging cost + consent dashboard (Phase 3). Surfaces the
// customer_messaging_costs ledger (AI vs carrier cost per shop) + consent counts so admins can see
// the true cost of SMS/WhatsApp auto-replies and inform the "who pays" decision. Admin-only,
// read-only. Reads GET /api/messages/admin/messaging-costs. Dark theme to match the admin dashboard.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, MessageSquare, DollarSign, Truck, ShieldCheck, Zap } from "lucide-react";
import {
  getMessagingCostSummary, getAdminOverageSummary, fmtCents,
  type MessagingCostSummary, type AdminOverageSummary,
} from "@/services/api/messagingCosts";

const PERIODS: { label: string; days?: number }[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time" },
];

const CARD = "rounded-xl border border-white/10 bg-[#1A1A1A]";

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string }> = ({
  icon, label, value, sub,
}) => (
  <div className={`${CARD} p-4`}>
    <div className="flex items-center gap-2 text-gray-400 text-sm">{icon}<span>{label}</span></div>
    <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    {sub && <div className="text-sm text-gray-500">{sub}</div>}
  </div>
);

export const AdminMessagingCostsTab: React.FC = () => {
  const [data, setData] = useState<MessagingCostSummary | null>(null);
  const [overage, setOverage] = useState<AdminOverageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<number | undefined>(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cost, ov] = await Promise.all([getMessagingCostSummary(days), getAdminOverageSummary()]);
      setData(cost);
      setOverage(ov);
    } catch (e: any) {
      setError(e?.message || "Failed to load messaging costs");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const gt = data?.grandTotal;
  const consentGranted = (channel: string) =>
    data?.consent.filter((c) => c.channel === channel && c.status === "granted").reduce((n, c) => n + c.count, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">AI Messaging Costs</h2>
          <p className="text-sm text-gray-400">
            Off-channel AI auto-replies (SMS &amp; WhatsApp) — inference vs carrier cost per shop.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-white/10 overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.label}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 text-sm ${days === p.days ? "bg-[#FFCC00] text-black font-medium" : "bg-[#1A1A1A] text-gray-300 hover:text-white"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-md border border-white/10 bg-[#1A1A1A] text-gray-300 hover:text-white disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="text-red-400 text-sm py-8 text-center">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<MessageSquare className="w-4 h-4" />} label="AI replies sent" value={String(gt?.replyCount ?? 0)} />
            <StatCard icon={<DollarSign className="w-4 h-4" />} label="AI (inference)" value={fmtCents(gt?.aiCostCents ?? 0)} />
            <StatCard icon={<Truck className="w-4 h-4" />} label="Carrier (est.)" value={fmtCents(gt?.carrierCostCents ?? 0)} />
            <StatCard icon={<DollarSign className="w-4 h-4" />} label="Total cost" value={fmtCents(gt?.totalCents ?? 0)}
              sub={data?.periodDays ? `last ${data.periodDays} days` : "all time"} />
          </div>

          <div className={`${CARD} p-5`}>
            <h3 className="text-base font-semibold text-white mb-4">Cost by shop</h3>
            {(data?.shops.length ?? 0) === 0 ? (
              <div className="text-sm text-gray-400 py-6 text-center">
                No off-channel AI replies recorded for this period yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-white/10">
                      <th className="text-left font-medium py-2 pr-4">Shop</th>
                      <th className="text-right font-medium py-2 px-4">Replies</th>
                      <th className="text-right font-medium py-2 px-4">AI cost</th>
                      <th className="text-right font-medium py-2 px-4">Carrier (est.)</th>
                      <th className="text-right font-medium py-2 pl-4">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.shops.map((s) => (
                      <tr key={s.shopId} className="border-b border-white/5">
                        <td className="py-2 pr-4 text-white font-medium">{s.shopName || s.shopId}</td>
                        <td className="py-2 px-4 text-right text-gray-300">{s.replyCount}</td>
                        <td className="py-2 px-4 text-right text-gray-300">{fmtCents(s.aiCostCents)}</td>
                        <td className="py-2 px-4 text-right text-gray-300">{fmtCents(s.carrierCostCents)}</td>
                        <td className="py-2 pl-4 text-right text-white font-semibold">{fmtCents(s.totalCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-gray-500">
              Carrier cost is an estimate (flat per-message rate); AI cost is exact. Carrier is only charged when a
              reply actually left.
            </p>
          </div>

          <div className={`${CARD} p-5`}>
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4" /> Opt-in consent
            </h3>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div>
                <div className="text-sm text-gray-400">SMS opt-ins</div>
                <div className="text-xl font-semibold text-white">{consentGranted("sms")}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">WhatsApp opt-ins</div>
                <div className="text-xl font-semibold text-white">{consentGranted("whatsapp")}</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Recorded automatically when a customer messages first (implied opt-in). Enforcement is off until legal
              sign-off (ENFORCE_MESSAGING_CONSENT).
            </p>
          </div>

          <div className={`${CARD} p-5`}>
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4" /> AI Usage Overage — this month
            </h3>
            {(overage?.shops.length ?? 0) === 0 ? (
              <div className="text-sm text-gray-400 py-6 text-center">
                No shops are accruing overage this month.
              </div>
            ) : (
              <>
                <div className="mb-3 text-sm text-gray-300">
                  <span className="text-gray-400">Platform billable this month: </span>
                  <span className="font-semibold text-amber-300">{fmtCents(overage!.grandTotal.amountCents)}</span>
                  <span className="text-gray-500"> across {overage!.grandTotal.shopCount} shop(s)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-white/10">
                        <th className="text-left font-medium py-2 pr-4">Shop</th>
                        <th className="text-right font-medium py-2 px-4">Overage cost</th>
                        <th className="text-right font-medium py-2 px-4">Billable (×3)</th>
                        <th className="text-right font-medium py-2 pl-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overage!.shops.map((s) => (
                        <tr key={s.shopId} className="border-b border-white/5">
                          <td className="py-2 pr-4 text-white font-medium">{s.shopName || s.shopId}</td>
                          <td className="py-2 px-4 text-right text-gray-300">{fmtCents(s.overageCostCents)}</td>
                          <td className="py-2 px-4 text-right font-semibold text-amber-300">{fmtCents(s.amountCents)}</td>
                          <td className="py-2 pl-4 text-right text-gray-400 capitalize">{s.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="mt-3 text-xs text-gray-500">
              Billable = AI cost beyond each shop&apos;s monthly allowance × 3 (Usage ×3). Pending until invoiced.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminMessagingCostsTab;

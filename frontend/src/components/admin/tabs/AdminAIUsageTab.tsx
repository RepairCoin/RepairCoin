"use client";

// Admin: platform-wide AI spend, fed by the ai_usage_events view (migration 240).
//
// Replaces a summary that aggregated ai_agent_messages alone and therefore reported ~30% of real
// spend — customer chat isn't even the largest line item (the Unified Assistant is).
//
// Three panels, deliberately not summed into one number (different directions of money):
//   1. AI COGS       money OUT — vendor cost by feature / model / shop / day, ads AI included.
//   2. Overage       money IN  — what we bill shops past their allowance (Usage ×3). Moved here
//                                from the Messaging Costs tab, where it sat next to carrier costs.
//   3. Reconciliation  the audit vs the per-shop counters — a drift alarm, not money.
//
// Layout mirrors AdminMessagingCostsTab (period pills, stat cards, per-shop tables) so the two
// cost dashboards read the same way.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Loader2, RefreshCw, DollarSign, Activity, Cpu, Megaphone,
  Zap, Receipt, Scale, AlertTriangle, CheckCircle2,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  getAiCostSummary, getAdminOverageSummary, invoiceOveragePending,
  fmtCents, fmtUsd, featureLabel,
  type AiCostSummary, type AdminOverageSummary,
} from "@/services/api/aiUsage";

const PERIODS = [7, 30, 90] as const;

const CARD = "rounded-xl border border-white/10 bg-[#1A1A1A]";
// Single accent for every magnitude mark. The charts are single-series — length carries the
// magnitude and the axis/label carries identity — so a per-category palette would encode nothing
// and would need CVD validation to say the same thing twice.
const ACCENT = "#FFCC00";

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string }> = ({
  icon, label, value, sub,
}) => (
  <div className={`${CARD} p-4`}>
    <div className="flex items-center gap-2 text-gray-400 text-sm">{icon}<span>{label}</span></div>
    <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    {sub && <div className="text-sm text-gray-500">{sub}</div>}
  </div>
);

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; note?: string }> = ({
  title, icon, children, note,
}) => (
  <div className={`${CARD} p-5`}>
    <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">{icon}{title}</h3>
    {children}
    {note && <p className="mt-3 text-xs text-gray-500">{note}</p>}
  </div>
);

const EmptyRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-sm text-gray-400 py-6 text-center">{children}</div>
);

export const AdminAIUsageTab: React.FC = () => {
  const [data, setData] = useState<AiCostSummary | null>(null);
  const [overage, setOverage] = useState<AdminOverageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<number>(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summary, ov] = await Promise.all([getAiCostSummary(days), getAdminOverageSummary()]);
      setData(summary);
      setOverage(ov);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Failed to load AI usage");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const [busy, setBusy] = useState<string | null>(null);
  const doInvoice = useCallback(async (arg: { shopId: string } | { all: true }, key: string) => {
    setBusy(key);
    try {
      const r = await invoiceOveragePending(arg);
      if ("all" in arg) {
        const ok = r.results?.filter((x) => x.ok).length ?? 0;
        const failed = r.results?.filter((x) => !x.ok) ?? [];
        toast.success(`Invoiced ${ok} shop(s)${failed.length ? `, ${failed.length} failed` : ""}`);
        if (failed.length) toast.error(`Failed: ${failed.map((f) => f.shopId).join(", ")}`);
      } else {
        toast.success(`Invoiced ${arg.shopId} — ${fmtCents(r.totalCents ?? 0)} (${r.status})`);
      }
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || "Failed to invoice overage");
    } finally {
      setBusy(null);
    }
  }, [load]);

  const cogs = data?.cogs;
  const recon = data?.reconciliation;

  // Bar-list scale: longest bar = the largest feature, so the bars compare against each other
  // rather than against an arbitrary axis max.
  const featureMax = useMemo(
    () => Math.max(0, ...(cogs?.byFeature.map((f) => f.costUsd) ?? [0])),
    [cogs]
  );

  // Drift beyond a cent is worth a human look; below that it's rounding on sub-cent calls.
  const DRIFT_EPSILON = 0.01;

  // The SIGN is what matters, and the two directions mean opposite things:
  //   audit > counter — recordSpend missed increments. Benign: the cap reads the audit, so
  //                     enforcement was correct anyway; only the cached counter lagged.
  //   counter > audit — a call was charged but never written to the audit. That spend is invisible
  //                     to the cap, so the shop is UNDER-charged against its allowance. This is the
  //                     leak the ai_misc_usage ledger was added to close, and the signal that a new
  //                     AI surface has shipped without logging its cost.
  const driftDirection = (usd: number): "clean" | "counter-low" | "counter-high" =>
    Math.abs(usd) < DRIFT_EPSILON ? "clean" : usd > 0 ? "counter-low" : "counter-high";

  const totalDirection = driftDirection(recon?.driftUsd ?? 0);
  // Any single shop leaking is worth surfacing at the top, even if the platform total nets out.
  const anyLeak = (recon?.shops ?? []).some((s) => driftDirection(s.driftUsd) === "counter-high");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">AI Usage &amp; Cost</h2>
          <p className="text-sm text-gray-400">
            Every AI surface on the platform — what it costs us, what we bill back, and whether the
            two ledgers agree.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-white/10 overflow-hidden">
            {PERIODS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-sm ${days === d ? "bg-[#FFCC00] text-black font-medium" : "bg-[#1A1A1A] text-gray-300 hover:text-white"}`}
              >
                {d} days
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
          {/* ---------------- Panel 1: AI COGS (money out) ---------------- */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<DollarSign className="w-4 h-4" />}
              label="Total AI cost"
              value={fmtUsd(cogs?.totalCostUsd ?? 0)}
              sub={`last ${data?.periodDays ?? days} days`}
            />
            <StatCard
              icon={<Activity className="w-4 h-4" />}
              label="AI calls"
              value={(cogs?.totalCalls ?? 0).toLocaleString()}
              sub={`${fmtUsd(cogs?.avgCostPerCallUsd ?? 0)} avg · ${((cogs?.errorRate ?? 0) * 100).toFixed(1)}% errors`}
            />
            <StatCard
              icon={<Cpu className="w-4 h-4" />}
              label="Tokens in / out"
              value={`${((cogs?.totalInputTokens ?? 0) / 1000).toFixed(0)}k / ${((cogs?.totalOutputTokens ?? 0) / 1000).toFixed(0)}k`}
            />
            <StatCard
              icon={<Megaphone className="w-4 h-4" />}
              label="Ads AI (not shop-billed)"
              value={fmtUsd(cogs?.adsCostUsd ?? 0)}
              sub={`${fmtUsd(cogs?.billableCostUsd ?? 0)} counts against allowances`}
            />
          </div>

          <SectionCard
            title="Daily AI cost"
            icon={<Activity className="w-4 h-4" />}
            note="Every AI surface combined, including ads AI. One point per day."
          >
            {(cogs?.trend.length ?? 0) === 0 ? (
              <EmptyRow>No AI calls recorded in this period.</EmptyRow>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cogs!.trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="aiCostFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#ffffff14" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "#9CA3AF", fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: "#ffffff1a" }}
                      minTickGap={24}
                      tickFormatter={(d: string) => d.slice(5)} // MM-DD
                    />
                    <YAxis
                      tick={{ fill: "#9CA3AF", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(v: number) => `$${v < 1 ? v.toFixed(2) : v.toFixed(0)}`}
                    />
                    <Tooltip
                      cursor={{ stroke: "#ffffff40", strokeWidth: 1 }}
                      contentStyle={{
                        background: "#111111",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8,
                        fontSize: 14,
                      }}
                      labelStyle={{ color: "#E5E7EB", fontSize: 14 }}
                      formatter={(v: any, _n: any, p: any) => [
                        `${fmtUsd(Number(v))} · ${p?.payload?.calls ?? 0} calls`,
                        "Cost",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="costUsd"
                      stroke={ACCENT}
                      strokeWidth={2}
                      fill="url(#aiCostFill)"
                      dot={false}
                      activeDot={{ r: 4, stroke: "#1A1A1A", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Cost by feature"
            icon={<DollarSign className="w-4 h-4" />}
            note="Ads AI is real vendor cost but bills to the ads budget, not to any shop's AI allowance — so it appears here and is excluded from the spend cap."
          >
            {(cogs?.byFeature.length ?? 0) === 0 ? (
              <EmptyRow>No AI calls recorded in this period.</EmptyRow>
            ) : (
              <div className="space-y-3">
                {cogs!.byFeature.map((f) => (
                  <div key={`${f.feature}-${f.vendor}`}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-white">
                        {featureLabel(f.feature)}
                        {!f.billableToShop && (
                          <span className="ml-2 rounded border border-white/15 px-1.5 py-0.5 text-xs text-gray-400">
                            ads budget
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-gray-300">
                        {fmtUsd(f.costUsd)}
                        <span className="ml-2 text-gray-500">{f.calls.toLocaleString()} calls</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded bg-white/5">
                      <div
                        className="h-2 rounded"
                        style={{
                          width: featureMax > 0 ? `${Math.max(1, (f.costUsd / featureMax) * 100)}%` : "0%",
                          background: ACCENT,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Cost by model"
              icon={<Cpu className="w-4 h-4" />}
              note="The model mix is the main lever on cost per call — the spend cap degrades shops to Haiku at 70% of their allowance."
            >
              {(cogs?.byModel.length ?? 0) === 0 ? (
                <EmptyRow>No model data for this period.</EmptyRow>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-white/10">
                        <th className="text-left font-medium py-2 pr-4">Model</th>
                        <th className="text-right font-medium py-2 px-4">Calls</th>
                        <th className="text-right font-medium py-2 pl-4">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cogs!.byModel.map((m) => (
                        <tr key={m.model ?? "none"} className="border-b border-white/5">
                          <td className="py-2 pr-4 text-white">{m.model ?? "—"}</td>
                          <td className="py-2 px-4 text-right text-gray-300">{m.calls.toLocaleString()}</td>
                          <td className="py-2 pl-4 text-right text-white font-semibold">{fmtUsd(m.costUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Top shops by AI cost"
              icon={<DollarSign className="w-4 h-4" />}
              note="Cost we incur per shop. Shops on a plan allowance are billed only past it (see Overage below)."
            >
              {(cogs?.byShop.length ?? 0) === 0 ? (
                <EmptyRow>No shop AI activity in this period.</EmptyRow>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-white/10">
                        <th className="text-left font-medium py-2 pr-4">Shop</th>
                        <th className="text-right font-medium py-2 px-4">Calls</th>
                        <th className="text-right font-medium py-2 pl-4">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cogs!.byShop.map((s) => (
                        <tr key={s.shopId} className="border-b border-white/5">
                          <td className="py-2 pr-4 text-white font-medium">{s.shopName || s.shopId}</td>
                          <td className="py-2 px-4 text-right text-gray-300">{s.calls.toLocaleString()}</td>
                          <td className="py-2 pl-4 text-right text-white font-semibold">{fmtUsd(s.costUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>

          {/* ---------------- Panel 2: Overage revenue (money in) ---------------- */}
          <SectionCard
            title="AI Usage Overage — this month (revenue)"
            icon={<Zap className="w-4 h-4" />}
            note="Billable = AI cost beyond each shop's monthly allowance × 3 (Usage ×3). Pending until invoiced."
          >
            {(overage?.shops.length ?? 0) === 0 ? (
              <EmptyRow>No shops are accruing overage this month.</EmptyRow>
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
          </SectionCard>

          <SectionCard
            title="Ready to invoice — completed months"
            icon={<Receipt className="w-4 h-4" />}
            note="Bundles each shop's completed-month pending overage into one Stripe invoice to its card on file. Failed charges stay pending and can be retried here."
          >
            {overage?.stripeEnabled && (overage?.pending?.shops.length ?? 0) > 0 && (
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => doInvoice({ all: true }, "__all__")}
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 rounded-md bg-yellow-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === "__all__" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Receipt className="w-3.5 h-3.5" />}
                  Invoice all due ({fmtCents(overage!.pending.grandTotal.amountCents)})
                </button>
              </div>
            )}

            {!overage?.stripeEnabled && (
              <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                Charging is disabled (<code>AI_OVERAGE_STRIPE_ENABLED</code> off). Amounts below are read-only
                until it&apos;s turned on.
              </div>
            )}

            {(overage?.pending?.shops.length ?? 0) === 0 ? (
              <EmptyRow>
                Nothing pending from completed months. (This month&apos;s accrual is billable after the month closes.)
              </EmptyRow>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-white/10">
                      <th className="text-left font-medium py-2 pr-4">Shop</th>
                      <th className="text-right font-medium py-2 px-4">Months</th>
                      <th className="text-right font-medium py-2 px-4">Billable</th>
                      <th className="text-right font-medium py-2 pl-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overage!.pending.shops.map((s) => (
                      <tr key={s.shopId} className="border-b border-white/5">
                        <td className="py-2 pr-4 text-white font-medium">{s.shopName || s.shopId}</td>
                        <td className="py-2 px-4 text-right text-gray-300">{s.monthCount}</td>
                        <td className="py-2 px-4 text-right font-semibold text-amber-300">{fmtCents(s.amountCents)}</td>
                        <td className="py-2 pl-4 text-right">
                          <button
                            type="button"
                            onClick={() => doInvoice({ shopId: s.shopId }, s.shopId)}
                            disabled={!overage?.stripeEnabled || !!busy}
                            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busy === s.shopId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Receipt className="w-3 h-3" />}
                            Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* ---------------- Panel 3: Reconciliation (drift alarm) ---------------- */}
          <SectionCard
            title="Reconciliation — audit vs per-shop counters"
            icon={<Scale className="w-4 h-4" />}
            note="Always the current calendar month, whatever period is selected above — that's the window the spend cap enforces on. The sign is what matters: audit above counter just means the cached counter lagged (the cap reads the audit, so enforcement was still correct), while counter above audit means a call was charged but never logged — that spend is invisible to the cap and the shop is under-charged."
          >
            <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-gray-400">Audit (enforced): </span>
                <span className="font-semibold text-white">{fmtUsd(recon?.derivedTotalUsd ?? 0)}</span>
              </div>
              <div>
                <span className="text-gray-400">Counters: </span>
                <span className="font-semibold text-white">{fmtUsd(recon?.counterTotalUsd ?? 0)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {totalDirection === "clean" && !anyLeak ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className={`w-4 h-4 ${anyLeak ? "text-red-400" : "text-amber-400"}`} />
                )}
                <span className="text-gray-400">Drift: </span>
                <span
                  className={`font-semibold ${
                    anyLeak ? "text-red-400" : totalDirection === "clean" ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {fmtUsd(recon?.driftUsd ?? 0)}
                </span>
                <span className="text-gray-500">
                  {anyLeak
                    ? "a shop was charged for AI that never reached the audit — the cap is under-counting it"
                    : totalDirection === "clean"
                    ? "in sync"
                    : "cached counters lag the audit (enforcement unaffected)"}
                </span>
              </div>
            </div>

            {(recon?.shops.length ?? 0) === 0 ? (
              <EmptyRow>No shop has AI spend this month.</EmptyRow>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-white/10">
                      <th className="text-left font-medium py-2 pr-4">Shop</th>
                      <th className="text-right font-medium py-2 px-4">Audit</th>
                      <th className="text-right font-medium py-2 px-4">Counter</th>
                      <th className="text-right font-medium py-2 pl-4">Drift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recon!.shops.map((s) => {
                      const dir = driftDirection(s.driftUsd);
                      return (
                        <tr key={s.shopId} className="border-b border-white/5">
                          <td className="py-2 pr-4 text-white font-medium">{s.shopName || s.shopId}</td>
                          <td className="py-2 px-4 text-right text-gray-300">{fmtUsd(s.derivedUsd)}</td>
                          <td className="py-2 px-4 text-right text-gray-300">{fmtUsd(s.counterUsd)}</td>
                          <td
                            className={`py-2 pl-4 text-right font-semibold ${
                              dir === "clean" ? "text-gray-500" : dir === "counter-high" ? "text-red-400" : "text-amber-400"
                            }`}
                          >
                            {fmtUsd(s.driftUsd)}
                            {dir === "counter-high" && (
                              <span className="ml-2 text-xs font-normal text-red-400">unlogged spend</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
};

export default AdminAIUsageTab;

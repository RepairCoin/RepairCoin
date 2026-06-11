"use client";

// Ads System (Q4/Q7) — admin-only ad-management billing for a shop. Pick the plan
// (A dashboard fee / B margin on spend / C pay-per-result), see FixFlow's accrued
// revenue, and (gated) push a Stripe invoice. Rides ON TOP of the $500/mo base sub.
// Plan B is the default. Never rendered in the shop dashboard.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Receipt, Save, RefreshCw, Send } from "lucide-react";
import toast from "react-hot-toast";
import {
  getShopBilling, setBillingPlan, triggerAccrual, pushShopInvoice, fmtUsd,
  type ShopBilling, type AdPlanType, type PlanCModel,
} from "@/services/api/ads";

const inputCls =
  "w-28 px-2.5 py-1.5 bg-[#0F0F0F] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00]";

const PLAN_LABEL: Record<AdPlanType, string> = {
  a: "A — Dashboard fee",
  b: "B — Margin on spend",
  c: "C — Pay per result",
};

export const BillingPanel: React.FC<{ shopId: string }> = ({ shopId }) => {
  const [data, setData] = useState<ShopBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  // Editable plan fields (dollars / percent for the UI; converted to cents/bps on save).
  const [planType, setPlanType] = useState<AdPlanType>("b");
  const [markupPct, setMarkupPct] = useState(20);
  const [dashboardFee, setDashboardFee] = useState(299);
  const [perBookingFee, setPerBookingFee] = useState(50);
  const [revSharePct, setRevSharePct] = useState(10);
  const [planCModel, setPlanCModel] = useState<PlanCModel>("per_booking");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getShopBilling(shopId);
      setData(d);
      setPlanType(d.plan.planType);
      setMarkupPct(d.plan.markupBps / 100);
      setDashboardFee(d.plan.dashboardFeeCents / 100);
      setPerBookingFee(d.plan.perBookingFeeCents / 100);
      setRevSharePct(d.plan.revenueShareBps / 100);
      setPlanCModel(d.plan.planCModel);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await setBillingPlan(shopId, {
        planType,
        markupBps: Math.round(markupPct * 100),
        dashboardFeeCents: Math.round(dashboardFee * 100),
        perBookingFeeCents: Math.round(perBookingFee * 100),
        revenueShareBps: Math.round(revSharePct * 100),
        planCModel,
      });
      toast.success("Billing plan saved.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save plan.");
    } finally {
      setSaving(false);
    }
  };

  const runAccrual = async () => {
    setBusy(true);
    try {
      await triggerAccrual();
      toast.success("Accrual run.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Accrual failed.");
    } finally {
      setBusy(false);
    }
  };

  const pushInvoice = async () => {
    // Gated server-side — surfaces the actionable 501 message when Stripe isn't wired.
    setBusy(true);
    try {
      await pushShopInvoice(shopId);
      toast.success("Invoice pushed.");
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || "Invoice push unavailable.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-400 text-sm py-3"><Loader2 className="w-4 h-4 animate-spin" /> Loading billing…</div>;
  }
  if (!data) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Receipt className="w-4 h-4 text-[#FFCC00]" />
        <p className="text-sm font-medium text-gray-300">Ad-Management Billing</p>
        <span className="text-xs px-1.5 py-0.5 rounded bg-[#FFCC00]/15 text-[#FFCC00]">Admin only</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">Rides on top of the $500/mo base subscription. Plan B is the default.</p>

      {/* Plan editor */}
      <div className="rounded-lg border border-white/10 bg-[#1A1A1A] p-3 mb-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {(["a", "b", "c"] as AdPlanType[]).map((t) => (
            <button
              key={t}
              onClick={() => setPlanType(t)}
              className={`text-xs px-2.5 py-1.5 rounded-md border ${planType === t ? "border-[#FFCC00] text-white bg-[#FFCC00]/10" : "border-gray-700 text-gray-400 hover:text-white"}`}
            >
              {PLAN_LABEL[t]}
            </button>
          ))}
        </div>

        {planType === "a" && (
          <label className="flex items-center gap-2 text-sm text-gray-300">
            Dashboard fee <input type="number" min={0} value={dashboardFee} onChange={(e) => setDashboardFee(+e.target.value)} className={inputCls} /> / month
          </label>
        )}
        {planType === "b" && (
          <label className="flex items-center gap-2 text-sm text-gray-300">
            Markup on ad spend <input type="number" min={0} step={0.5} value={markupPct} onChange={(e) => setMarkupPct(+e.target.value)} className={inputCls} /> %
          </label>
        )}
        {planType === "c" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {(["per_booking", "revenue_share"] as PlanCModel[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPlanCModel(m)}
                  className={`text-xs px-2.5 py-1.5 rounded-md border ${planCModel === m ? "border-[#FFCC00] text-white bg-[#FFCC00]/10" : "border-gray-700 text-gray-400 hover:text-white"}`}
                >
                  {m === "per_booking" ? "Per booking" : "Revenue share"}
                </button>
              ))}
            </div>
            {planCModel === "per_booking" ? (
              <label className="flex items-center gap-2 text-sm text-gray-300">
                Fee per confirmed booking <input type="number" min={0} value={perBookingFee} onChange={(e) => setPerBookingFee(+e.target.value)} className={inputCls} />
              </label>
            ) : (
              <label className="flex items-center gap-2 text-sm text-gray-300">
                Share of booking revenue <input type="number" min={0} step={0.5} value={revSharePct} onChange={(e) => setRevSharePct(+e.target.value)} className={inputCls} /> %
              </label>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save plan
          </button>
        </div>
      </div>

      {/* Accrued revenue */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {[
          { label: "Pending", v: data.totals.pendingCents },
          { label: "Invoiced", v: data.totals.invoicedCents },
          { label: "Paid", v: data.totals.paidCents },
          { label: "Total accrued", v: data.totals.totalCents },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-white/10 bg-[#1A1A1A] px-3 py-2.5">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className="text-base font-semibold text-white">{fmtUsd(s.v)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={runAccrual} disabled={busy} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-white disabled:opacity-50">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Run accrual now
        </button>
        <button onClick={pushInvoice} disabled={busy || data.invoicePreview.lineCount === 0} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-white disabled:opacity-50">
          <Send className="w-3.5 h-3.5" /> Push invoice ({data.invoicePreview.lineCount} · {fmtUsd(data.invoicePreview.totalCents)})
        </button>
        {!data.stripeEnabled && <span className="text-xs text-gray-500">Stripe collection not enabled</span>}
      </div>
    </div>
  );
};

export default BillingPanel;

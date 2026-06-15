"use client";

// Ads System — admin-only ad-management billing for a shop. Pick the flat tier
// (Starter $199 / Growth $499 / Business $999); the shop pays its own ad spend
// directly, so the fee is FixFlow's flat management fee. See accrued revenue +
// (gated) push a Stripe invoice. Rides ON TOP of the $500/mo base sub. Never rendered
// in the shop dashboard. (Legacy Plan A/B/C are retired — saving switches to a tier.)

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Receipt, Save, RefreshCw, Send } from "lucide-react";
import toast from "react-hot-toast";
import {
  getShopBilling, setBillingPlan, triggerAccrual, pushShopInvoice, fmtUsd,
  FLAT_TIERS, type ShopBilling, type FlatTierName,
} from "@/services/api/ads";

export const BillingPanel: React.FC<{ shopId: string }> = ({ shopId }) => {
  const [data, setData] = useState<ShopBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const [tier, setTier] = useState<FlatTierName>("growth");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getShopBilling(shopId);
      setData(d);
      const t = d.plan.flatTierName as FlatTierName | null;
      setTier(t && FLAT_TIERS.some((x) => x.name === t) ? t : "growth");
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
      const feeCents = FLAT_TIERS.find((t) => t.name === tier)?.feeCents ?? 49900;
      await setBillingPlan(shopId, { planType: "flat", flatTierName: tier, flatFeeCents: feeCents });
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
      <p className="text-xs text-gray-500 mb-3">Rides on top of the $500/mo base subscription. The shop pays its own ad spend directly.</p>

      {/* Plan editor — flat tiers */}
      <div className="rounded-lg border border-white/10 bg-[#1A1A1A] p-3 mb-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {FLAT_TIERS.map((t) => (
            <button
              key={t.name}
              onClick={() => setTier(t.name)}
              className={`text-xs px-2.5 py-1.5 rounded-md border ${tier === t.name ? "border-[#FFCC00] text-white bg-[#FFCC00]/10" : "border-gray-700 text-gray-400 hover:text-white"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">{FLAT_TIERS.find((t) => t.name === tier)?.blurb}</p>

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

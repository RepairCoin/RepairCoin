"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Gem, RefreshCw, Loader2, Trophy, Coins, HandCoins } from "lucide-react";
import toast from "react-hot-toast";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { adminApi } from "@/services/api/admin";

interface RcgDistribution {
  totalSupply: number;
  treasuryBalance: number;
  circulatingSupply: number;
  distribution: { treasury: number; shops: number; other: number };
  tierDistribution: { none: number; standard: number; premium: number; elite: number };
  topHolders: { shop: string; balance: number; tier: string }[];
}

interface OtcSale {
  shopId: string;
  packageType: string;
  rcgAmount: number;
  usdAmount: number;
  pricePerRcg: number;
  paymentMethod?: string;
  paymentReference?: string;
  status: string;
}

const PACKAGES: Record<string, { label: string; rcg: number; usd: number }> = {
  standard: { label: "Standard", rcg: 10000, usd: 5000 },
  premium: { label: "Premium", rcg: 50000, usd: 22500 },
  elite: { label: "Elite", rcg: 200000, usd: 80000 },
};

const TIER_STYLE: Record<string, string> = {
  none: "text-gray-400",
  standard: "text-amber-400",
  premium: "text-purple-400",
  elite: "text-indigo-400",
};

const num = (n: number | undefined) => (n ?? 0).toLocaleString();

export function RcgManagementTab() {
  const [dist, setDist] = useState<RcgDistribution | null>(null);
  const [loading, setLoading] = useState(true);

  // OTC sale form
  const [shopId, setShopId] = useState("");
  const [pkg, setPkg] = useState<"standard" | "premium" | "elite">("standard");
  const [paymentMethod, setPaymentMethod] = useState("wire");
  const [paymentReference, setPaymentReference] = useState("");
  const [recording, setRecording] = useState(false);
  const [lastSale, setLastSale] = useState<OtcSale | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getRcgDistribution();
      if (res?.success) setDist(res.data);
      else toast.error("Failed to load RCG distribution");
    } catch (err) {
      console.error("Failed to load RCG distribution:", err);
      toast.error("Failed to load RCG distribution");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const recordSale = async () => {
    if (!shopId.trim()) {
      toast.error("Enter a shop ID");
      return;
    }
    setRecording(true);
    setLastSale(null);
    try {
      const res = await adminApi.recordRcgOtcSale({
        shopId: shopId.trim(),
        package: pkg,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
      });
      if (res?.success) {
        setLastSale(res.data?.sale || null);
        toast.success("OTC sale recorded — process the token transfer manually");
        setShopId("");
        setPaymentReference("");
      } else {
        toast.error(res?.error || "Failed to record OTC sale");
      }
    } catch (err) {
      console.error("OTC sale failed:", err);
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(msg || "Failed to record OTC sale");
    } finally {
      setRecording(false);
    }
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="RCG Management"
        subtitle="Governance token distribution, shop tiers, and OTC sales"
        icon={Gem}
        gradientFrom="from-indigo-500"
        gradientTo="to-violet-600"
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
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : dist ? (
        <>
          {/* Supply cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SupplyCard label="Total Supply" value={num(dist.totalSupply)} icon={Coins} accent="text-white" />
            <SupplyCard label="Circulating" value={num(dist.circulatingSupply)} icon={Coins} accent="text-emerald-400" />
            <SupplyCard label="Held by Shops" value={num(dist.distribution?.shops)} icon={Coins} accent="text-indigo-400" />
          </div>

          {/* Tier distribution */}
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4">Shop Tier Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <TierCard label="No Tier" hint="< 10K RCG" count={dist.tierDistribution?.none} tier="none" />
              <TierCard label="Standard" hint="10K–50K RCG" count={dist.tierDistribution?.standard} tier="standard" />
              <TierCard label="Premium" hint="50K–200K RCG" count={dist.tierDistribution?.premium} tier="premium" />
              <TierCard label="Elite" hint="200K+ RCG" count={dist.tierDistribution?.elite} tier="elite" />
            </div>
          </div>

          {/* Top holders */}
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
            <h3 className="flex items-center gap-2 text-white font-semibold mb-4">
              <Trophy className="w-5 h-5 text-[#FFCC00]" />
              Top RCG Holders
            </h3>
            {dist.topHolders?.length ? (
              <div className="space-y-2">
                {dist.topHolders.map((h, i) => (
                  <div key={`${h.shop}-${i}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#101010] border border-gray-800/60">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-500/15 text-indigo-400 text-sm font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm text-white font-mono flex-1 min-w-0 truncate">{h.shop}</p>
                    <span className={`text-xs capitalize ${TIER_STYLE[h.tier] || "text-gray-400"}`}>{h.tier}</span>
                    <p className="text-sm font-semibold text-white w-28 text-right">{num(h.balance)} RCG</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No shops hold RCG yet.</p>
            )}
          </div>

          {/* OTC sale recorder */}
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
            <h3 className="flex items-center gap-2 text-white font-semibold mb-1">
              <HandCoins className="w-5 h-5 text-emerald-400" />
              Record OTC Sale
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Records an over-the-counter RCG package sale. The token transfer &amp; tier update are done manually afterward.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-gray-400 mb-1">Shop ID</label>
                <input
                  type="text"
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                  placeholder="shop id"
                  className="w-full px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Package</label>
                <select
                  value={pkg}
                  onChange={(e) => setPkg(e.target.value as "standard" | "premium" | "elite")}
                  className="px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                >
                  {Object.entries(PACKAGES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label} — {v.rcg.toLocaleString()} RCG (${v.usd.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 capitalize"
                >
                  <option value="wire">Wire</option>
                  <option value="ach">ACH</option>
                  <option value="crypto">Crypto</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs text-gray-400 mb-1">Payment Reference</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="optional"
                  className="w-full px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={recordSale}
                disabled={recording}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {recording ? <Loader2 className="w-4 h-4 animate-spin" /> : <HandCoins className="w-4 h-4" />}
                Record Sale
              </button>
            </div>

            {lastSale && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
                <p className="text-emerald-300 font-medium mb-2">Sale recorded — process the token transfer manually.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-gray-300">
                  <div><span className="text-gray-500 text-xs block">Shop</span>{lastSale.shopId}</div>
                  <div><span className="text-gray-500 text-xs block">Package</span><span className="capitalize">{lastSale.packageType}</span></div>
                  <div><span className="text-gray-500 text-xs block">RCG</span>{num(lastSale.rcgAmount)}</div>
                  <div><span className="text-gray-500 text-xs block">USD</span>${num(lastSale.usdAmount)}</div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-gray-500 text-center py-16">No RCG data available.</p>
      )}
    </div>
  );
}

const SupplyCard: React.FC<{ label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent: string }> = ({
  label,
  value,
  icon: Icon,
  accent,
}) => (
  <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <Icon className="w-4 h-4 text-gray-600" />
    </div>
    <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    <p className="text-xs text-gray-600">RCG</p>
  </div>
);

const TierCard: React.FC<{ label: string; hint: string; count: number | undefined; tier: string }> = ({
  label,
  hint,
  count,
  tier,
}) => (
  <div className="bg-[#101010] rounded-xl p-4 border border-gray-800/60">
    <p className={`text-sm font-medium ${TIER_STYLE[tier]}`}>{label}</p>
    <p className="text-2xl font-bold text-white mt-1">{count ?? 0}</p>
    <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>
  </div>
);

export default RcgManagementTab;

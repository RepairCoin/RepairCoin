"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Network, RefreshCw, Loader2, Users, Coins, Landmark, Layers, Search } from "lucide-react";
import toast from "react-hot-toast";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { adminApi } from "@/services/api/admin";

interface AffiliateGroup {
  groupId: string;
  groupName: string;
  groupType: string;
  active: boolean;
  customTokenName: string | null;
  customTokenSymbol: string | null;
  tokenValueUsd: number;
  createdByShopId: string | null;
  createdAt: string;
  memberCount: number;
  pendingMembers: number;
  outstandingBalance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  holderCount: number;
  rcnAllocated: number;
  rcnAvailable: number;
  liabilityUsd: number;
}

interface Summary {
  totalGroups: number;
  activeGroups: number;
  totalMembers: number;
  totalOutstandingTokens: number;
  totalLiabilityUsd: number;
  totalRcnAllocated: number;
}

const num = (n: number | undefined) => (n ?? 0).toLocaleString();
const usd = (n: number | undefined) =>
  `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AffiliateGroupsTab() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [groups, setGroups] = useState<AffiliateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAffiliateGroups();
      if (res?.success) {
        setSummary(res.data?.summary || null);
        setGroups(res.data?.groups || []);
      } else {
        toast.error("Failed to load affiliate groups");
      }
    } catch (err) {
      console.error("Failed to load affiliate groups:", err);
      toast.error("Failed to load affiliate groups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = groups.filter((g) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      g.groupName?.toLowerCase().includes(q) ||
      g.customTokenSymbol?.toLowerCase().includes(q) ||
      g.groupId?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Affiliate Groups"
        subtitle="Shop coalitions, custom group tokens, and outstanding token liability"
        icon={Network}
        gradientFrom="from-cyan-500"
        gradientTo="to-blue-600"
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
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      ) : (
        <>
          {/* Summary */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Groups" value={`${summary.activeGroups}/${summary.totalGroups}`} icon={Layers} accent="text-white" hint="active / total" />
              <Stat label="Total Members" value={num(summary.totalMembers)} icon={Users} accent="text-cyan-400" />
              <Stat label="Token Liability" value={usd(summary.totalLiabilityUsd)} icon={Landmark} accent="text-orange-400" hint={`${num(summary.totalOutstandingTokens)} tokens outstanding`} />
              <Stat label="RCN Allocated" value={`${num(summary.totalRcnAllocated)} RCN`} icon={Coins} accent="text-yellow-400" />
            </div>
          )}

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search groups by name, token, or id..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* Groups */}
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-center py-16">No affiliate groups found.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((g) => (
                <div key={g.groupId} className="bg-[#1A1A1A] border border-gray-800 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === g.groupId ? null : g.groupId)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-semibold">{g.groupName}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${g.groupType === "public" ? "bg-blue-500/15 text-blue-400" : "bg-gray-500/15 text-gray-400"}`}>
                          {g.groupType}
                        </span>
                        {!g.active && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">inactive</span>
                        )}
                        {g.pendingMembers > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">{g.pendingMembers} pending</span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {g.customTokenName || "—"}
                        {g.customTokenSymbol ? ` (${g.customTokenSymbol})` : ""} · {g.memberCount} members · {g.holderCount} holders
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-orange-400 font-semibold text-sm">{usd(g.liabilityUsd)}</p>
                      <p className="text-gray-500 text-xs">{num(g.outstandingBalance)} {g.customTokenSymbol || "tokens"}</p>
                    </div>
                  </button>

                  {expanded === g.groupId && (
                    <div className="border-t border-gray-800 p-4 bg-[#101010] grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <Detail label="Outstanding" value={`${num(g.outstandingBalance)} ${g.customTokenSymbol || ""}`} />
                      <Detail label="Lifetime Earned" value={num(g.lifetimeEarned)} />
                      <Detail label="Lifetime Redeemed" value={num(g.lifetimeRedeemed)} />
                      <Detail label="Token Value" value={usd(g.tokenValueUsd)} />
                      <Detail label="RCN Allocated" value={`${num(g.rcnAllocated)} RCN`} />
                      <Detail label="RCN Available" value={`${num(g.rcnAvailable)} RCN`} />
                      <Detail label="Created By" value={g.createdByShopId || "—"} mono />
                      <Detail label="Created" value={g.createdAt ? new Date(g.createdAt).toLocaleDateString() : "—"} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const Stat: React.FC<{ label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent: string; hint?: string }> = ({
  label,
  value,
  icon: Icon,
  accent,
  hint,
}) => (
  <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-4">
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <Icon className="w-4 h-4 text-gray-600" />
    </div>
    <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    {hint && <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>}
  </div>
);

const Detail: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div>
    <p className="text-gray-500 text-xs mb-0.5">{label}</p>
    <p className={`text-gray-200 ${mono ? "font-mono text-xs truncate" : ""}`}>{value}</p>
  </div>
);

export default AffiliateGroupsTab;

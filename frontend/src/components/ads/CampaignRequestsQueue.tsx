"use client";

// Admin "campaign requests to build" queue (lifecycle Phase 3). Lists open requests
// (pending/approved/building) with the brief; admin builds them into a live campaign or
// declines. Concierge: this is where the admin acts on shop requests.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Inbox, Hammer, X, Link2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  listCampaignRequests, buildCampaignFromRequest, declineCampaignRequest, setShopAdsAccount,
  CAMPAIGN_GOALS, type AdCampaignRequest,
} from "@/services/api/ads";

const GOAL_LABEL = Object.fromEntries(CAMPAIGN_GOALS.map((g) => [g.value, g.label]));

function brief(r: AdCampaignRequest): string {
  const parts: string[] = [];
  if (r.promoteServiceIds?.length) parts.push(`${r.promoteServiceIds.length} service${r.promoteServiceIds.length > 1 ? "s" : ""}`);
  if (r.monthlyBudgetCents != null) parts.push(`$${(r.monthlyBudgetCents / 100).toFixed(0)}/mo`);
  if (r.targetRadiusMiles != null) parts.push(`${r.targetRadiusMiles} mi`);
  if (r.goal) parts.push(GOAL_LABEL[r.goal] ?? r.goal);
  return parts.join(" · ");
}

export const CampaignRequestsQueue: React.FC<{ onBuilt?: () => void }> = ({ onBuilt }) => {
  const [reqs, setReqs] = useState<AdCampaignRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setReqs(await listCampaignRequests().catch(() => [])); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const build = async (r: AdCampaignRequest) => {
    const name = window.prompt("Campaign name?", `Campaign — ${r.goal ?? "ads"}`)?.trim();
    if (name === undefined) return; // cancelled
    setBusy(r.id);
    try {
      await buildCampaignFromRequest(r.id, name ? { name } : undefined);
      toast.success("Campaign built and live.");
      await load();
      onBuilt?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error || e?.message || "Couldn't build.");
    } finally { setBusy(null); }
  };

  const connect = async (r: AdCampaignRequest) => {
    setBusy(r.id);
    try {
      await setShopAdsAccount(r.shopId, true);
      toast.success(`${r.shopId}'s ad account connected — you can build now.`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't connect.");
    } finally { setBusy(null); }
  };

  const decline = async (r: AdCampaignRequest) => {
    const reason = window.prompt("Decline reason (optional)?") ?? undefined;
    setBusy(r.id);
    try {
      await declineCampaignRequest(r.id, reason);
      toast.success("Request declined.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't decline.");
    } finally { setBusy(null); }
  };

  if (loading) return null;
  if (reqs.length === 0) return null; // nothing to build — keep the admin tab clean

  return (
    <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-3">
      <div className="flex items-center gap-2 mb-3">
        <Inbox className="w-5 h-5 text-[#FFCC00]" />
        <h3 className="text-base font-semibold text-white">Campaign requests to build</h3>
        <span className="text-xs px-1.5 py-0.5 rounded bg-[#FFCC00]/20 text-[#FFCC00]">{reqs.length}</span>
      </div>
      <div className="space-y-2">
        {reqs.map((r) => (
          <div key={r.id} className="rounded-lg border border-white/10 bg-[#141414] p-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-white">Shop <span className="font-medium">{r.shopId}</span> <span className="text-xs text-gray-500 capitalize">· {r.status}</span></p>
              {brief(r) && <p className="text-xs text-[#FFCC00] mt-0.5">{brief(r)}</p>}
              {r.offer && <p className="text-xs text-gray-400 mt-0.5">Offer: {r.offer}</p>}
              {r.message && <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">“{r.message}”</p>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => connect(r)} disabled={busy === r.id} title="Mark this shop's ad account connected (build precondition)" className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-white disabled:opacity-50">
                <Link2 className="w-3.5 h-3.5" /> Connect
              </button>
              <button onClick={() => build(r)} disabled={busy === r.id} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-green-500/15 text-green-400 hover:bg-green-500/25 disabled:opacity-50">
                {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Hammer className="w-3.5 h-3.5" />} Build
              </button>
              <button onClick={() => decline(r)} disabled={busy === r.id} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50">
                <X className="w-3.5 h-3.5" /> Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CampaignRequestsQueue;

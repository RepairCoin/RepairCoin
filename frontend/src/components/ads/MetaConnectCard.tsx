"use client";

// Shop-side "Connect Meta" card (Stage-4 connect slice). The shop authorizes FixFlow to run
// ads on its OWN Meta ad account (OAuth), then picks an ad account + Page — which flips the
// §9.6 gate so campaigns can go live. When the flow is disabled (no Meta App / flag off) this
// falls back to the passive status note (the admin sets connection up manually). Dark raw-
// tailwind to match the sibling ads panels.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plug, CheckCircle2, Link2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  getMetaConnection, getMetaConnectUrl, getMetaAccounts, selectMetaAccount, disconnectMeta,
  type MetaConnection, type MetaAdAccount, type MetaPageLite,
} from "@/services/api/ads";

export const MetaConnectCard: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const [conn, setConn] = useState<MetaConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Picker state
  const [picking, setPicking] = useState(false);
  const [adAccounts, setAdAccounts] = useState<MetaAdAccount[]>([]);
  const [pages, setPages] = useState<MetaPageLite[]>([]);
  const [adAccountId, setAdAccountId] = useState("");
  const [pageId, setPageId] = useState("");
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setConn(await getMetaConnection().catch(() => null)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openPicker = useCallback(async () => {
    setPicking(true);
    setLoadingAccounts(true);
    try {
      const { adAccounts, pages } = await getMetaAccounts();
      setAdAccounts(adAccounts);
      setPages(pages);
      setAdAccountId(adAccounts[0]?.id ?? "");
      setPageId(pages[0]?.id ?? "");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error || "Couldn't load your Meta accounts.");
      setPicking(false);
    } finally { setLoadingAccounts(false); }
  }, []);

  // Handle the OAuth callback redirect (?meta=select|error) once, then strip the param.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const meta = params.get("meta");
    if (!meta) return;
    if (meta === "select") void openPicker();
    else if (meta === "error") toast.error(`Meta connection failed${params.get("reason") ? `: ${params.get("reason")}` : "."}`);
    params.delete("meta"); params.delete("reason");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [openPicker]);

  const connect = async () => {
    setBusy(true);
    try { window.location.href = await getMetaConnectUrl(); }
    catch (e: any) { toast.error(e?.response?.data?.message || "Couldn't start Meta connection."); setBusy(false); }
  };

  const save = async () => {
    if (!adAccountId || !pageId) { toast.error("Pick an ad account and a Page."); return; }
    setBusy(true);
    try {
      await selectMetaAccount(adAccountId, pageId);
      toast.success("Meta connected — campaigns can now go live.");
      setPicking(false);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || "Couldn't save selection.");
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!window.confirm("Disconnect your Meta ad account? Campaigns can't go live until you reconnect.")) return;
    setBusy(true);
    try { await disconnectMeta(); toast.success("Meta disconnected."); await load(); onChanged?.(); }
    catch (e: any) { toast.error(e?.message || "Couldn't disconnect."); }
    finally { setBusy(false); }
  };

  if (loading || !conn) return null;

  // --- Connected ---
  if (conn.connected) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-medium text-green-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Meta ad account connected
          </p>
          {conn.enabled && (
            <button onClick={disconnect} disabled={busy} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : "Disconnect"}
            </button>
          )}
        </div>
        {conn.enabled && (conn.adAccountId || conn.pageId) && (
          <p className="text-xs text-gray-500 mt-1">
            {conn.adAccountId && <>Ad account <span className="text-gray-300">{conn.adAccountId}</span></>}
            {conn.pageId && <> · Page <span className="text-gray-300">{conn.pageId}</span></>}
          </p>
        )}
        {/* Lead ads require the Page to accept Meta's Lead Generation Terms (one-time, per Page). */}
        {conn.enabled && conn.pageId && conn.leadgenTosAccepted === false && (
          <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-900/10 p-2.5 text-xs text-amber-300/90">
            ⚠ To run lead-form ads, your Facebook Page must accept Meta&apos;s Lead Generation Terms (one-time).{" "}
            <a
              href={`https://www.facebook.com/ads/leadgen/tos/?page_id=${conn.pageId}`}
              target="_blank" rel="noreferrer"
              className="text-[#FFCC00] underline font-medium"
            >Accept Lead Ads Terms →</a>{" "}
            <button onClick={() => void load()} className="text-gray-300 hover:text-white underline">I&apos;ve accepted — recheck</button>
          </div>
        )}
      </div>
    );
  }

  // --- Disabled (no Meta App / flag off) + not connected → nothing actionable for the shop
  // (the admin-flip path handles connection); avoid noising every ads-tab visitor.
  if (!conn.enabled) return null;

  // --- Enabled: token but no selection → picker ---
  if (conn.hasToken || picking) {
    return (
      <div className="rounded-xl border border-[#FFCC00]/30 bg-[#141414] p-4">
        <p className="text-sm font-medium text-gray-200 flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-[#FFCC00]" /> Choose your ad account &amp; Page
        </p>
        {!picking ? (
          <button onClick={openPicker} className="text-sm font-medium px-3 py-2 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800]">
            Continue
          </button>
        ) : loadingAccounts ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading your Meta accounts…</div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ad account</label>
              <select value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} className={selectCls}>
                {adAccounts.length === 0 && <option value="">No ad accounts found</option>}
                {adAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Facebook Page</label>
              <select value={pageId} onChange={(e) => setPageId(e.target.value)} className={selectCls}>
                {pages.length === 0 && <option value="">No Pages found</option>}
                {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button onClick={save} disabled={busy || !adAccountId || !pageId} className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Connect
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- Enabled, no token → Connect button ---
  return (
    <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
      <p className="text-sm font-medium text-gray-200 mb-1">Connect your Meta ad account</p>
      <p className="text-xs text-gray-500 mb-3">
        Ads run on your own Meta account (you keep paying Meta directly). Campaigns can&apos;t go live until it&apos;s connected.
      </p>
      <button onClick={connect} disabled={busy} className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md bg-[#1877F2] text-white hover:bg-[#166FE0] disabled:opacity-50">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} Connect Meta
      </button>
    </div>
  );
};

const selectCls = "w-full px-2.5 py-1.5 bg-[#0F0F0F] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00]";

export default MetaConnectCard;

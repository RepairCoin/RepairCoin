"use client";

// Shop-side "Connect Google" card (Google plan, Slice 1). The shop authorizes FixFlow to run ads on
// its OWN Google Ads account (OAuth), then picks a customer account — which flips google_ads_connected.
// Mirrors MetaConnectCard (customer-only; no Page/Pixel). Hidden when the flow is disabled (flag off /
// no Google app configured). Gated at mount by NEXT_PUBLIC_ADS_GOOGLE_ENABLED in the parent.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Plug, CheckCircle2, Link2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  getGoogleConnection, getGoogleConnectUrl, getGoogleAccounts, selectGoogleAccount, disconnectGoogle,
  type GoogleConnection, type GoogleCustomerLite,
} from "@/services/api/ads";

export const GoogleConnectCard: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const [conn, setConn] = useState<GoogleConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [picking, setPicking] = useState(false);
  const [accounts, setAccounts] = useState<GoogleCustomerLite[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setConn(await getGoogleConnection().catch(() => null)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openPicker = useCallback(async () => {
    setPicking(true);
    setLoadingAccounts(true);
    try {
      const { accounts } = await getGoogleAccounts();
      setAccounts(accounts);
      setCustomerId(accounts[0]?.customerId ?? "");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error || "Couldn't load your Google accounts.");
      setPicking(false);
    } finally { setLoadingAccounts(false); }
  }, []);

  // Handle the OAuth callback redirect (?google=select|error) once, then strip the param.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (!g) return;
    if (g === "select") void openPicker();
    else if (g === "error") toast.error(`Google connection failed${params.get("reason") ? `: ${params.get("reason")}` : "."}`);
    params.delete("google"); params.delete("reason");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [openPicker]);

  // Auto-open the picker when authorized but not yet selected (connection-state fallback for the deep link).
  const pickerAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (pickerAutoOpenedRef.current) return;
    if (conn?.enabled && conn.hasToken && !conn.connected && !picking) {
      pickerAutoOpenedRef.current = true;
      void openPicker();
    }
  }, [conn, picking, openPicker]);

  const connect = async () => {
    setBusy(true);
    try { window.location.href = await getGoogleConnectUrl(); }
    catch (e: any) { toast.error(e?.response?.data?.message || "Couldn't start Google connection."); setBusy(false); }
  };

  const save = async () => {
    if (!customerId) { toast.error("Pick a Google Ads account."); return; }
    setBusy(true);
    try {
      await selectGoogleAccount(customerId);
      toast.success("Google Ads account connected.");
      setPicking(false);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || "Couldn't save selection.");
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!window.confirm("Disconnect your Google Ads account?")) return;
    setBusy(true);
    try { await disconnectGoogle(); toast.success("Google disconnected."); await load(); onChanged?.(); }
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
            <CheckCircle2 className="w-4 h-4" /> Google Ads account connected
          </p>
          {conn.enabled && (
            <button onClick={disconnect} disabled={busy} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : "Disconnect"}
            </button>
          )}
        </div>
        {conn.enabled && conn.customerId && (
          <p className="text-xs text-gray-500 mt-1">
            Customer <span className="text-gray-300">{conn.customerId}</span>
          </p>
        )}
      </div>
    );
  }

  // Disabled + not connected → nothing actionable for the shop.
  if (!conn.enabled) return null;

  // --- Enabled: token but no selection → picker ---
  if (conn.hasToken || picking) {
    return (
      <div className="rounded-xl border border-[#FFCC00]/30 bg-[#141414] p-4">
        <p className="text-sm font-medium text-gray-200 flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-[#FFCC00]" /> Choose your Google Ads account
        </p>
        {!picking ? (
          <button onClick={openPicker} className="text-sm font-medium px-3 py-2 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800]">
            Continue
          </button>
        ) : loadingAccounts ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading your Google accounts…</div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Google Ads account</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={selectCls}>
                {accounts.length === 0 && <option value="">No accounts found</option>}
                {/* Show the customer id alongside the name — accounts can share a name (e.g. two
                    "Test Client"s under a manager), so the id is what disambiguates them. */}
                {accounts.map((a) => (
                  <option key={a.customerId} value={a.customerId}>{a.name} · {fmtCustomerId(a.customerId)}</option>
                ))}
              </select>
            </div>
            <button onClick={save} disabled={busy || !customerId} className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50">
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
      <p className="text-sm font-medium text-gray-200 mb-1">Connect your Google Ads account</p>
      <p className="text-xs text-gray-500 mb-3">
        Ads run on your own Google Ads account (you keep paying Google directly). Business plan only.
      </p>
      <button onClick={connect} disabled={busy} className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md bg-[#4285F4] text-white hover:bg-[#3B78E7] disabled:opacity-50">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} Connect Google
      </button>
    </div>
  );
};

const selectCls = "w-full px-2.5 py-1.5 bg-[#0F0F0F] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00]";

// Format a 10-digit Google customer id as XXX-XXX-XXXX (matches Google Ads' own display);
// leaves anything unexpected untouched.
const fmtCustomerId = (id: string): string => {
  const d = (id || "").replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : id;
};

export default GoogleConnectCard;

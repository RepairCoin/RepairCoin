"use client";

import React, { useCallback, useEffect, useState } from "react";
import { clearAllAuthCaches } from "@/hooks/useAuthInitializer";
import {
  Building2,
  Users,
  Mail,
  Phone,
  UserPlus,
  LogIn,
  Trash2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
  Copy,
  Check,
  Link2,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  agencyApi,
  AgencyProfile,
  AgencyClient,
  AgencyInvite,
} from "@/services/api/agency";

export function AgencyTab() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [profile, setProfile] = useState<AgencyProfile | null>(null);
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [invites, setInvites] = useState<AgencyInvite[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [entering, setEntering] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, clientsRes, invitesRes] = await Promise.all([
        agencyApi.getMe(),
        agencyApi.getClients(),
        agencyApi.listInvites(),
      ]);
      setProfile((meRes as any)?.data ?? null);
      setClients(((clientsRes as any)?.data as AgencyClient[]) ?? []);
      setInvites(((invitesRes as any)?.data as AgencyInvite[]) ?? []);
      setAuthorized(true);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403 || status === 404) {
        setAuthorized(false);
      } else {
        toast.error("Failed to load agency dashboard");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const enterClient = async (shopId: string) => {
    setEntering(shopId);
    try {
      await agencyApi.enterClient(shopId);
      // Session cookie now points at the client shop. Clear cached (owner) session/shop data and
      // do a full navigation so auth re-hydrates from the new cookie as the client shop. Force the
      // overview tab so it lands on the client's dashboard, not the (restored) agency tab.
      clearAllAuthCaches();
      window.location.href = "/shop?tab=overview";
    } catch (err) {
      toast.error("Failed to enter client shop");
      setEntering(null);
    }
  };

  const removeClient = async (shopId: string, name: string) => {
    if (!window.confirm(`Unlink "${name}" from your agency? They'll need their own subscription to keep operating.`)) {
      return;
    }
    try {
      await agencyApi.removeClient(shopId);
      toast.success("Client unlinked");
      await load();
    } catch (err) {
      toast.error("Failed to unlink client");
    }
  };

  const revokeInvite = async (token: string) => {
    try {
      await agencyApi.revokeInvite(token);
      setInvites((prev) => prev.filter((i) => i.token !== token));
    } catch (err) {
      toast.error("Failed to revoke invite");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="max-w-md mx-auto bg-[#1A1A1A] border border-gray-800 rounded-2xl p-8 text-center">
        <ShieldCheck className="w-10 h-10 text-[#FFCC00] mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Agency Program not active</h2>
        <p className="text-gray-400 text-sm">
          Activate the Agency Program add-on in your shop's Plans &amp; Billing to manage client shops.
        </p>
      </div>
    );
  }

  const agency = profile?.agency;
  const used = profile?.activeClientCount ?? clients.length;
  const limit = profile?.clientLimit ?? 10;
  const am = profile?.accountManager;

  return (
    <div className="space-y-6 text-white">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#FFCC00]/15 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-[#FFCC00]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{agency?.name || "Agency"}</h1>
            <p className="text-sm text-gray-400">
              {used} / {limit} client shops
              {used > limit && <span className="text-amber-400"> · billed for {used - limit} extra</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FFCC00] hover:bg-[#FFD700] text-black font-medium transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Invite Client
          </button>
        </div>
      </div>

      {/* Account manager */}
      {am && (am.name || am.email || am.phone) && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold">Your Account Manager</span>
          </div>
          <div className="text-sm text-gray-300 flex flex-wrap gap-x-6 gap-y-1">
            {am.name && <span className="text-white font-medium">{am.name}</span>}
            {am.email && (
              <a href={`mailto:${am.email}`} className="flex items-center gap-1.5 hover:text-white">
                <Mail className="w-3.5 h-3.5 text-emerald-400" /> {am.email}
              </a>
            )}
            {am.phone && (
              <a href={`tel:${am.phone}`} className="flex items-center gap-1.5 hover:text-white">
                <Phone className="w-3.5 h-3.5 text-emerald-400" /> {am.phone}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-white font-semibold mb-4">
            <Link2 className="w-5 h-5 text-[#FFCC00]" /> Pending Invites
            <span className="text-gray-500 text-sm font-normal">({invites.length})</span>
          </h2>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.token} className="flex items-center justify-between gap-3 bg-[#101010] border border-gray-800 rounded-lg px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-white text-sm truncate">{inv.label || "Client invite"}</p>
                  <p className="text-gray-500 text-xs truncate">{inv.url}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <CopyButton text={inv.url} />
                  <button
                    onClick={() => revokeInvite(inv.token)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Revoke invite"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roster */}
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-white font-semibold mb-4">
          <Users className="w-5 h-5 text-[#FFCC00]" /> Client Shops
          <span className="text-gray-500 text-sm font-normal">({clients.length})</span>
        </h2>
        {clients.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
                  <th className="text-left py-2 font-medium">Shop</th>
                  <th className="text-left py-2 font-medium">Location</th>
                  <th className="text-center py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.shopId} className="border-b border-gray-800/60">
                    <td className="py-3">
                      <p className="text-white font-medium">{c.name || "Unnamed shop"}</p>
                      <p className="text-gray-500 text-xs">{c.email || c.shopId}</p>
                    </td>
                    <td className="py-3 text-gray-300">
                      {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`text-xs font-medium ${c.active ? "text-emerald-400" : "text-gray-500"}`}>
                        {c.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => enterClient(c.shopId)}
                          disabled={entering === c.shopId}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFCC00]/10 text-[#FFCC00] border border-[#FFCC00]/20 hover:bg-[#FFCC00]/20 transition-colors disabled:opacity-50"
                        >
                          {entering === c.shopId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                          Enter
                        </button>
                        <button
                          onClick={() => removeClient(c.shopId, c.name)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Unlink client"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-6 text-center">
            No client shops yet. Invite your first client to get started.
          </p>
        )}
      </div>

      {showInvite && (
        <InviteClientModal
          onClose={() => setShowInvite(false)}
          onCreated={(invite) => {
            setInvites((prev) => [invite, ...prev]);
          }}
        />
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually");
    }
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 transition-colors text-xs"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

function InviteClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (invite: AgencyInvite) => void;
}) {
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [invite, setInvite] = useState<AgencyInvite | null>(null);

  const create = async () => {
    setCreating(true);
    try {
      const res: any = await agencyApi.createInvite(label.trim() || undefined);
      const created = res?.data as AgencyInvite;
      setInvite(created);
      onCreated(created);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to create invite");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Invite Client Shop</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!invite ? (
          <>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-400">
                Generate an invite link and send it to your client. They complete the standard shop signup with
                their own wallet, and their shop is automatically added to your agency — no separate subscription.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Label <span className="text-gray-600">(optional, for your reference)</span>
                </label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Acme Repairs"
                  disabled={creating}
                  className="w-full px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
              <button onClick={onClose} disabled={creating} className="px-4 py-2 rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={create}
                disabled={creating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FFCC00] hover:bg-[#FFD700] text-black font-medium disabled:opacity-50"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />} Create invite link
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-300">Share this link with your client:</p>
              <div className="bg-[#101010] border border-gray-800 rounded-lg px-4 py-3 text-sm text-gray-300 break-all">
                {invite.url}
              </div>
              <CopyButton text={invite.url} />
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-gray-800">
              <button onClick={onClose} className="px-4 py-2 rounded-lg bg-[#FFCC00] hover:bg-[#FFD700] text-black font-medium">
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AgencyTab;

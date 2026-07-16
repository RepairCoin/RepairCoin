"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Building2, RefreshCw, Loader2, Users, UserCog, X } from "lucide-react";
import toast from "react-hot-toast";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { adminApi } from "@/services/api/admin";

interface AdminAgency {
  id: string;
  name: string;
  ownerShopId: string;
  ownerShopName: string | null;
  status: "pending" | "active" | "past_due" | "cancelled";
  contactEmail: string | null;
  activeClientCount: number;
  clientLimit: number;
  accountManagerName: string | null;
  accountManagerAddress: string | null;
  createdAt: string;
}

interface AgencyClient {
  shopId: string;
  name: string;
  email: string | null;
  active: boolean;
  city: string | null;
  country: string | null;
}

interface AssignableManager {
  address: string;
  name: string | null;
  email: string | null;
}

const STATUS_STYLE: Record<AdminAgency["status"], string> = {
  active: "text-emerald-400",
  past_due: "text-amber-400",
  pending: "text-gray-400",
  cancelled: "text-red-400",
};

export function AgenciesTab() {
  const [agencies, setAgencies] = useState<AdminAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientsFor, setClientsFor] = useState<AdminAgency | null>(null);
  const [assignFor, setAssignFor] = useState<AdminAgency | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAllAgencies();
      if (res?.success) {
        setAgencies((res.data as AdminAgency[]) || []);
      } else {
        toast.error("Failed to load agencies");
      }
    } catch (err) {
      console.error("Failed to load agencies:", err);
      toast.error("Failed to load agencies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Agencies"
        subtitle="All agency accounts on the platform"
        icon={Building2}
        gradientFrom="from-amber-500"
        gradientTo="to-yellow-600"
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
          <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
        </div>
      ) : (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-white font-semibold mb-4">
            <Users className="w-5 h-5 text-[#FFCC00]" />
            All Agencies
            <span className="text-gray-500 text-sm font-normal">({agencies.length})</span>
          </h3>
          {agencies.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
                    <th className="text-left py-2 font-medium">Agency</th>
                    <th className="text-left py-2 font-medium">Owner Shop</th>
                    <th className="text-center py-2 font-medium">Clients</th>
                    <th className="text-left py-2 font-medium">Account Manager</th>
                    <th className="text-center py-2 font-medium">Status</th>
                    <th className="text-right py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agencies.map((a) => (
                    <tr key={a.id} className="border-b border-gray-800/60">
                      <td className="py-3">
                        <p className="text-white font-medium">{a.name || "Unnamed agency"}</p>
                        <p className="text-gray-500 text-xs">{a.contactEmail || a.id}</p>
                      </td>
                      <td className="py-3 text-gray-300">{a.ownerShopName || a.ownerShopId}</td>
                      <td className="py-3 text-center text-gray-300">
                        {a.activeClientCount} / {a.clientLimit}
                      </td>
                      <td className="py-3 text-gray-300">
                        {a.accountManagerName || (a.accountManagerAddress ? `${a.accountManagerAddress.slice(0, 6)}…` : "—")}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`text-xs font-medium capitalize ${STATUS_STYLE[a.status]}`}>
                          {a.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setClientsFor(a)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 transition-colors text-xs"
                          >
                            <Users className="w-3.5 h-3.5" /> Clients
                          </button>
                          <button
                            onClick={() => setAssignFor(a)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFCC00]/10 text-[#FFCC00] border border-[#FFCC00]/20 hover:bg-[#FFCC00]/20 transition-colors text-xs"
                          >
                            <UserCog className="w-3.5 h-3.5" /> Assign AM
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No agencies yet.</p>
          )}
        </div>
      )}

      {clientsFor && <ClientsModal agency={clientsFor} onClose={() => setClientsFor(null)} />}
      {assignFor && (
        <AssignManagerModal
          agency={assignFor}
          onClose={() => setAssignFor(null)}
          onSaved={async () => {
            setAssignFor(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ClientsModal({ agency, onClose }: { agency: AdminAgency; onClose: () => void }) {
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await adminApi.getAgencyClients(agency.id);
        if (active) setClients(((res as any)?.data as AgencyClient[]) || []);
      } catch {
        toast.error("Failed to load clients");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [agency.id]);

  return (
    <ModalShell title={`${agency.name} — Client Shops`} onClose={onClose}>
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
          </div>
        ) : clients.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
                  <th className="text-left py-2 font-medium">Shop</th>
                  <th className="text-left py-2 font-medium">Location</th>
                  <th className="text-center py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.shopId} className="border-b border-gray-800/60">
                    <td className="py-2.5">
                      <p className="text-white font-medium">{c.name || "Unnamed shop"}</p>
                      <p className="text-gray-500 text-xs">{c.email || c.shopId}</p>
                    </td>
                    <td className="py-2.5 text-gray-300">
                      {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="py-2.5 text-center">
                      <span className={`text-xs font-medium ${c.active ? "text-emerald-400" : "text-gray-500"}`}>
                        {c.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-4 text-center">This agency has no client shops yet.</p>
        )}
      </div>
    </ModalShell>
  );
}

function AssignManagerModal({
  agency,
  onClose,
  onSaved,
}: {
  agency: AdminAgency;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [managers, setManagers] = useState<AssignableManager[]>([]);
  const [selected, setSelected] = useState<string>(agency.accountManagerAddress ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await adminApi.getAssignableManagers();
        if (active) setManagers(((res as any)?.data as AssignableManager[]) || []);
      } catch {
        toast.error("Failed to load admins");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.assignAgencyManager(agency.id, selected);
      toast.success(selected ? "Account manager assigned" : "Account manager cleared");
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to assign account manager");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`${agency.name} — Account Manager`} onClose={onClose}>
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-400">
          The assigned admin sees this agency under their <span className="text-gray-200">My Shops → Agencies You Manage</span>,
          and is shown to the agency as their account manager.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">Account manager</label>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading admins…
            </div>
          ) : (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={saving}
              className="w-full px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
            >
              <option value="">— Unassigned —</option>
              {managers.map((m) => (
                <option key={m.address} value={m.address}>
                  {m.name || m.email || m.address}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
        <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-50">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FFCC00] hover:bg-[#FFD700] text-black font-medium disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
        </button>
      </div>
    </ModalShell>
  );
}

export default AgenciesTab;

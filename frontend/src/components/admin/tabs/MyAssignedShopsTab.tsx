"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Store, RefreshCw, Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { adminApi } from "@/services/api/admin";

interface AssignedShop {
  shopId: string;
  name: string;
  email: string;
  active: boolean;
  verified: boolean;
  city?: string;
  country?: string;
}

export function MyAssignedShopsTab() {
  const [shops, setShops] = useState<AssignedShop[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getMyAssignedShops();
      if (res?.success) {
        setShops((res.data as AssignedShop[]) || []);
      } else {
        toast.error("Failed to load assigned shops");
      }
    } catch (err) {
      console.error("Failed to load assigned shops:", err);
      toast.error("Failed to load assigned shops");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const location = (s: AssignedShop) =>
    [s.city, s.country].filter(Boolean).join(", ") || "—";

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="My Shops"
        subtitle="Shops where you are the assigned account manager"
        icon={Store}
        gradientFrom="from-emerald-500"
        gradientTo="to-teal-600"
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
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-white font-semibold mb-4">
            <ShieldCheck className="w-5 h-5 text-[#FFCC00]" />
            Assigned to You
            <span className="text-gray-500 text-sm font-normal">({shops.length})</span>
          </h3>
          {shops.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
                    <th className="text-left py-2 font-medium">Shop</th>
                    <th className="text-left py-2 font-medium">Location</th>
                    <th className="text-center py-2 font-medium">Verified</th>
                    <th className="text-center py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.map((s) => (
                    <tr key={s.shopId} className="border-b border-gray-800/60">
                      <td className="py-2.5">
                        <p className="text-white font-medium">{s.name || "Unnamed shop"}</p>
                        <p className="text-gray-500 text-xs">{s.email}</p>
                      </td>
                      <td className="py-2.5 text-gray-300">{location(s)}</td>
                      <td className="py-2.5 text-center">
                        {s.verified ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        {s.active ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                            <XCircle className="w-3.5 h-3.5" /> Suspended
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No shops are assigned to you yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default MyAssignedShopsTab;

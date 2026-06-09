"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bot, Loader2, AlertCircle, Search } from "lucide-react";
import toast from "react-hot-toast";
import { Switch } from "@/components/ui/switch";
import {
  AdminShopAiSettings,
  AdminShopAiSettingsUpdate,
  ADMIN_BUDGET_BOUNDS,
  listAdminShopAiSettings,
  adminUpdateShopAiSettings,
} from "@/services/api/aiSettings";

/**
 * Admin gate for the AI Sales Agent. A per-shop table where an admin
 * controls the three capability gates: whether AI selling is on, whether
 * follow-up nudges are on, and the monthly AI budget. Everything else
 * (handoff threshold, follow-up delay) is the shop's own to tune in their
 * dashboard — this tab deliberately doesn't touch those.
 */
export const AdminAISettingsTab: React.FC = () => {
  const [shops, setShops] = useState<AdminShopAiSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setShops(await listAdminShopAiSettings());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load shop AI settings"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyUpdate = useCallback(
    async (shopId: string, patch: AdminShopAiSettingsUpdate) => {
      setSavingId(shopId);
      try {
        const fresh = await adminUpdateShopAiSettings(shopId, patch);
        setShops((prev) => prev.map((s) => (s.shopId === shopId ? fresh : s)));
        toast.success("Shop AI settings updated");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update shop"
        );
      } finally {
        setSavingId(null);
      }
    },
    []
  );

  const q = filter.trim().toLowerCase();
  const filtered = q
    ? shops.filter(
        (s) =>
          s.shopName.toLowerCase().includes(q) ||
          s.shopId.toLowerCase().includes(q)
      )
    : shops;

  const enabledCount = shops.filter((s) => s.aiGlobalEnabled).length;
  const followupCount = shops.filter((s) => s.aiFollowupEnabled).length;
  const imagesCount = shops.filter((s) => s.aiImagesEnabled).length;

  return (
    <div className="bg-[#101010] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#303236]">
        <p className="text-lg text-[#FFCC00] font-semibold flex items-center gap-2">
          <Bot className="w-5 h-5" />
          AI Agent — Shop Controls
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Enable the AI Sales Agent, follow-up nudges, and AI image generation
          per shop, and set each shop&apos;s monthly AI budget. Shops tune their
          own behavior settings (handoff threshold, follow-up delay) from their
          dashboard.
        </p>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#FFCC00] animate-spin" />
            <span className="ml-2 text-gray-400">Loading shops…</span>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-400">
                Couldn&apos;t load shop AI settings
              </p>
              <p className="text-sm text-red-300 mt-1">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Summary + search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <p className="text-sm text-gray-400">
                {shops.length} shops · {enabledCount} with AI on ·{" "}
                {followupCount} with follow-ups on · {imagesCount} with images on
              </p>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search shops…"
                  className="pl-9 pr-3 py-2 bg-[#1a1a1a] text-white text-sm rounded-lg border border-[#303236] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] w-full sm:w-64"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-[#303236] rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1a1a1a] text-gray-400 text-left">
                    <th className="px-4 py-3 font-medium">Shop</th>
                    <th className="px-4 py-3 font-medium">AI Sales Agent</th>
                    <th className="px-4 py-3 font-medium">Follow-up Nudges</th>
                    <th className="px-4 py-3 font-medium">AI Images</th>
                    <th className="px-4 py-3 font-medium">Monthly Budget</th>
                    <th className="px-4 py-3 font-medium">Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No shops match &quot;{filter}&quot;.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((shop) => (
                      <ShopAIRow
                        key={shop.shopId}
                        shop={shop}
                        saving={savingId === shop.shopId}
                        onUpdate={applyUpdate}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface ShopAIRowProps {
  shop: AdminShopAiSettings;
  saving: boolean;
  onUpdate: (shopId: string, patch: AdminShopAiSettingsUpdate) => void;
}

const ShopAIRow: React.FC<ShopAIRowProps> = ({ shop, saving, onUpdate }) => {
  const [budget, setBudget] = useState(String(shop.monthlyBudgetUsd));

  // Keep the local input in sync when a save returns fresh data.
  useEffect(() => {
    setBudget(String(shop.monthlyBudgetUsd));
  }, [shop.monthlyBudgetUsd]);

  const commitBudget = () => {
    const n = parseFloat(budget);
    if (!Number.isFinite(n)) {
      setBudget(String(shop.monthlyBudgetUsd));
      return;
    }
    if (n < ADMIN_BUDGET_BOUNDS.min || n > ADMIN_BUDGET_BOUNDS.max) {
      toast.error(
        `Budget must be between $${ADMIN_BUDGET_BOUNDS.min} and $${ADMIN_BUDGET_BOUNDS.max}`
      );
      setBudget(String(shop.monthlyBudgetUsd));
      return;
    }
    if (n === shop.monthlyBudgetUsd) return; // no change
    onUpdate(shop.shopId, { monthlyBudgetUsd: n });
  };

  return (
    <tr className="border-t border-[#303236]">
      <td className="px-4 py-3">
        <p className="text-white font-medium">{shop.shopName}</p>
        <p className="text-xs text-gray-500 font-mono">{shop.shopId}</p>
      </td>
      <td className="px-4 py-3">
        <Switch
          checked={shop.aiGlobalEnabled}
          disabled={saving}
          onCheckedChange={(v) => onUpdate(shop.shopId, { aiGlobalEnabled: v })}
          className="data-[state=unchecked]:bg-gray-600 data-[state=checked]:bg-[#FFCC00]"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <Switch
            checked={shop.aiFollowupEnabled}
            disabled={saving || !shop.aiGlobalEnabled}
            onCheckedChange={(v) =>
              onUpdate(shop.shopId, { aiFollowupEnabled: v })
            }
            className="data-[state=unchecked]:bg-gray-600 data-[state=checked]:bg-[#FFCC00]"
          />
          {!shop.aiGlobalEnabled && (
            <span className="text-[11px] text-gray-600">Enable AI first</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <Switch
          checked={shop.aiImagesEnabled}
          disabled={saving}
          onCheckedChange={(v) => onUpdate(shop.shopId, { aiImagesEnabled: v })}
          className="data-[state=unchecked]:bg-gray-600 data-[state=checked]:bg-[#FFCC00]"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">$</span>
          <input
            type="number"
            min={ADMIN_BUDGET_BOUNDS.min}
            max={ADMIN_BUDGET_BOUNDS.max}
            value={budget}
            disabled={saving}
            onChange={(e) => setBudget(e.target.value)}
            onBlur={commitBudget}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-20 px-2 py-1 bg-[#1a1a1a] text-white rounded border border-[#303236] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] disabled:opacity-50"
          />
        </div>
      </td>
      <td className="px-4 py-3 text-gray-400">
        ${shop.currentMonthSpendUsd.toFixed(2)}
      </td>
    </tr>
  );
};

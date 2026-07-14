"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bot, Loader2, AlertCircle, Search } from "lucide-react";
import toast from "react-hot-toast";
import { Switch } from "@/components/ui/switch";
import { tierAllowsFeature, getRequiredTier } from "@/config/featureTiers";
import {
  AdminShopAiSettings,
  AdminShopAiSettingsUpdate,
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
  const rewardsCount = shops.filter((s) => s.campaignRewardsEnabled).length;

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
          per shop. The monthly AI budget is set automatically by each shop&apos;s
          plan tier ($10 / $30 / $75) and shown here for monitoring. Shops tune
          their own behavior settings (handoff threshold, follow-up delay) from
          their dashboard.
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
                {" "}· {rewardsCount} with rewards on
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
                    <th className="px-4 py-3 font-medium">Campaign Rewards</th>
                    <th className="px-4 py-3 font-medium">Monthly Budget</th>
                    <th className="px-4 py-3 font-medium">Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
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

// A per-shop feature toggle that's LOCKED when the shop's plan tier doesn't include the feature (WS2).
// Availability comes from the tier, not the admin — a below-tier toggle is disabled + shows "Growth+".
const FeatureSwitch: React.FC<{
  shop: AdminShopAiSettings;
  feature: string;
  checked: boolean;
  saving: boolean;
  requireAiOn?: boolean;
  onChange: (v: boolean) => void;
}> = ({ shop, feature, checked, saving, requireAiOn, onChange }) => {
  const allowed = tierAllowsFeature(shop.tier, feature);
  const req = getRequiredTier(feature);
  const needAiFirst = !!requireAiOn && !shop.aiGlobalEnabled;
  return (
    <div className="flex flex-col gap-0.5">
      <Switch
        checked={allowed && checked}
        disabled={saving || !allowed || needAiFirst}
        onCheckedChange={onChange}
        className="data-[state=unchecked]:bg-gray-600 data-[state=checked]:bg-[#FFCC00] disabled:opacity-50"
      />
      {!allowed && req && (
        <span className="text-[11px] text-[#FFCC00]/70">
          {req.charAt(0).toUpperCase() + req.slice(1)}+
        </span>
      )}
      {allowed && needAiFirst && (
        <span className="text-[11px] text-gray-600">Enable AI first</span>
      )}
    </div>
  );
};

const ShopAIRow: React.FC<ShopAIRowProps> = ({ shop, saving, onUpdate }) => {
  // The monthly AI budget is READ-ONLY — it's a pure function of the shop's plan tier
  // ($10/$30/$75), not admin-set. Shown here for monitoring only.
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
        <FeatureSwitch
          shop={shop}
          feature="aiLeadFollowUp"
          checked={shop.aiFollowupEnabled}
          saving={saving}
          requireAiOn
          onChange={(v) => onUpdate(shop.shopId, { aiFollowupEnabled: v })}
        />
      </td>
      <td className="px-4 py-3">
        <FeatureSwitch
          shop={shop}
          feature="aiImageGen"
          checked={shop.aiImagesEnabled}
          saving={saving}
          onChange={(v) => onUpdate(shop.shopId, { aiImagesEnabled: v })}
        />
      </td>
      <td className="px-4 py-3">
        <FeatureSwitch
          shop={shop}
          feature="campaignRewards"
          checked={shop.campaignRewardsEnabled}
          saving={saving}
          onChange={(v) => onUpdate(shop.shopId, { campaignRewardsEnabled: v })}
        />
      </td>
      <td className="px-4 py-3">
        {/* Read-only — budget follows the plan tier ($10/$30/$75), not admin-set. */}
        <span className="text-white font-medium">${shop.monthlyBudgetUsd}</span>
        <span className="ml-1 text-[11px] text-gray-500">/mo · by plan</span>
      </td>
      <td className="px-4 py-3 text-gray-400">
        ${shop.currentMonthSpendUsd.toFixed(2)}
      </td>
    </tr>
  );
};

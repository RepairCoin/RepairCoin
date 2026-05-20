"use client";

import React, { useState, useEffect } from "react";
import { Bot, Loader2, AlertCircle, Save, Info } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShopAiSettings,
  ShopAiSettingsUpdate,
  AI_SETTINGS_BOUNDS,
  getShopAiSettings,
  updateShopAiSettings,
} from "@/services/api/aiSettings";
import { AISalesImpactSection } from "./AISalesImpactSection";

/**
 * Shop-side AI Sales Agent settings panel (a section inside SettingsTab).
 *
 * Two halves:
 *   - Status (read-only) — the admin-gated capabilities: whether AI selling
 *     and follow-up nudges are enabled, and the monthly AI budget/spend.
 *     A shop cannot change these here; they are managed by RepairCoin.
 *   - Behavior (editable) — the two settings a shop tunes itself:
 *     the human-handoff threshold and the follow-up delay.
 */
export const AISalesAgentSettings: React.FC = () => {
  const [settings, setSettings] = useState<ShopAiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  // Editable local state
  const [escalationThreshold, setEscalationThreshold] = useState<number>(5);
  const [followupDelay, setFollowupDelay] = useState<number>(20);
  const [humanBaseline, setHumanBaseline] = useState<number>(240);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getShopAiSettings();
        setSettings(data);
        setEscalationThreshold(data.escalationThreshold);
        setFollowupDelay(data.aiFollowupDelayMinutes);
        setHumanBaseline(data.humanReplyBaselineMinutes);
      } catch (err) {
        console.error("Error loading AI settings:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load AI settings"
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const escBounds = AI_SETTINGS_BOUNDS.escalationThreshold;
  const delayBounds = AI_SETTINGS_BOUNDS.aiFollowupDelayMinutes;
  const baselineBounds = AI_SETTINGS_BOUNDS.humanReplyBaselineMinutes;

  const hasChanges =
    !!settings &&
    (escalationThreshold !== settings.escalationThreshold ||
      followupDelay !== settings.aiFollowupDelayMinutes ||
      humanBaseline !== settings.humanReplyBaselineMinutes);

  const inRange = (v: number, b: { min: number; max: number }) =>
    Number.isInteger(v) && v >= b.min && v <= b.max;
  const valid =
    inRange(escalationThreshold, escBounds) &&
    inRange(followupDelay, delayBounds) &&
    inRange(humanBaseline, baselineBounds);

  const handleSave = async () => {
    if (!valid) {
      toast.error("Please enter values within the allowed ranges.");
      return;
    }
    try {
      setSaving(true);
      const update: ShopAiSettingsUpdate = {
        escalationThreshold,
        aiFollowupDelayMinutes: followupDelay,
        humanReplyBaselineMinutes: humanBaseline,
      };
      const fresh = await updateShopAiSettings(update);
      setSettings(fresh);
      setEscalationThreshold(fresh.escalationThreshold);
      setFollowupDelay(fresh.aiFollowupDelayMinutes);
      setHumanBaseline(fresh.humanReplyBaselineMinutes);
      toast.success("AI settings saved");
    } catch (err) {
      console.error("Error saving AI settings:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to save AI settings"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-[#FFCC00] animate-spin" />
        <span className="ml-2 text-gray-400">Loading AI settings…</span>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-400">
            Couldn&apos;t load AI settings
          </p>
          <p className="text-sm text-red-300 mt-1">
            {error || "Please try again."}
          </p>
        </div>
      </div>
    );
  }

  const budgetPct =
    settings.monthlyBudgetUsd > 0
      ? Math.min(
          100,
          (settings.currentMonthSpendUsd / settings.monthlyBudgetUsd) * 100
        )
      : 0;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#FFCC00] flex items-center gap-2">
          <Bot className="w-5 h-5" />
          AI Sales Assistant
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Configure how your AI assistant behaves with customers.
        </p>
      </div>

      {/* ---- Impact (Phase 2/3 of Impact Metrics feature) ----
           Self-contained: owns its own fetch lifecycle, picker state, and
           render branches. Mounts ABOVE the configuration cards so the
           shop owner sees outcome first, then settings. */}
      <AISalesImpactSection />

      {/* ---- Status (read-only, admin-gated) ---- */}
      <div className="border-t border-[#3F3F3F] pt-6">
        <h3 className="text-sm font-semibold text-white mb-3">Status</h3>
        <div className="bg-[#0D0D0D] border border-[#3F3F3F] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">AI Sales Agent</p>
              <p className="text-xs text-gray-500">
                Whether the AI replies to your customers
              </p>
            </div>
            <Badge
              className={
                settings.aiGlobalEnabled
                  ? "bg-green-500/15 text-green-400 border-green-500/30"
                  : "bg-gray-500/15 text-gray-400 border-gray-500/30"
              }
            >
              {settings.aiGlobalEnabled ? "Enabled" : "Not enabled"}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">
                Follow-up nudges
              </p>
              <p className="text-xs text-gray-500">
                The AI re-engages customers who go quiet mid-conversation
              </p>
            </div>
            <Badge
              className={
                settings.aiFollowupEnabled
                  ? "bg-green-500/15 text-green-400 border-green-500/30"
                  : "bg-gray-500/15 text-gray-400 border-gray-500/30"
              }
            >
              {settings.aiFollowupEnabled ? "Enabled" : "Not enabled"}
            </Badge>
          </div>

          <div className="flex items-start gap-2 text-xs text-gray-500 bg-[#1a1a1a] rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              These are managed by RepairCoin. Contact us if you&apos;d like
              them turned on or off for your shop.
            </span>
          </div>

          {/* Monthly AI budget */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-medium text-white">Monthly AI usage</p>
              <p className="text-xs text-gray-400">
                ${settings.currentMonthSpendUsd.toFixed(2)} of $
                {settings.monthlyBudgetUsd.toFixed(2)}
              </p>
            </div>
            <div className="w-full h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  budgetPct >= 100
                    ? "bg-red-500"
                    : budgetPct >= 70
                    ? "bg-orange-400"
                    : "bg-[#FFCC00]"
                }`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ---- Behavior (editable) ---- */}
      <div className="border-t border-[#3F3F3F] pt-6 mt-6">
        <h3 className="text-sm font-semibold text-white mb-3">
          Behavior settings
        </h3>
        <div className="bg-[#0D0D0D] border border-[#3F3F3F] rounded-xl p-5 space-y-6">
          {/* Human handoff threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Human handoff threshold
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={escBounds.min}
                max={escBounds.max}
                value={escalationThreshold}
                onChange={(e) =>
                  setEscalationThreshold(parseInt(e.target.value, 10))
                }
                className="w-24 px-3 py-2 bg-[#F6F8FA] text-[#24292F] rounded-lg border border-[#3F3F3F] focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              />
              <span className="text-sm text-gray-400">
                consecutive AI replies
              </span>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              After this many AI replies in a row without the customer being
              helped, the conversation is handed to a human. Allowed:{" "}
              {escBounds.min}–{escBounds.max}.
            </p>
          </div>

          {/* Follow-up delay */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Follow-up delay
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={delayBounds.min}
                max={delayBounds.max}
                value={followupDelay}
                onChange={(e) =>
                  setFollowupDelay(parseInt(e.target.value, 10))
                }
                className="w-24 px-3 py-2 bg-[#F6F8FA] text-[#24292F] rounded-lg border border-[#3F3F3F] focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              />
              <span className="text-sm text-gray-400">minutes</span>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              How long the AI waits after a customer goes quiet before sending
              one friendly follow-up. Allowed: {delayBounds.min}–
              {delayBounds.max}.
            </p>
            {!settings.aiFollowupEnabled && (
              <p className="mt-1.5 text-xs text-orange-400/80">
                Follow-up nudges aren&apos;t enabled for your shop yet — this
                delay takes effect once RepairCoin turns them on.
              </p>
            )}
          </div>

          {/* Estimated human reply time — baseline for the Impact Metrics
              "Time your AI saved you" estimate. Scope decision E:
              per-shop configurable. */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Estimated human reply time
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={baselineBounds.min}
                max={baselineBounds.max}
                value={humanBaseline}
                onChange={(e) =>
                  setHumanBaseline(parseInt(e.target.value, 10))
                }
                className="w-24 px-3 py-2 bg-[#F6F8FA] text-[#24292F] rounded-lg border border-[#3F3F3F] focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              />
              <span className="text-sm text-gray-400">minutes</span>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              Used to estimate the time your AI saves. Set this to how long
              you typically take to reply when handling customers yourself.
              Allowed: {baselineBounds.min}–{baselineBounds.max} (default 240
              = 4h).
            </p>
          </div>

          <div className="pt-1">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || !valid || saving}
              className="bg-[#FFCC00] text-black hover:bg-[#E6B800] font-medium disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

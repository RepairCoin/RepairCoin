"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Percent } from "lucide-react";
import {
  getCommissionSettings,
  updateCommissionSettings,
  type CommissionSettings as Settings,
} from "@/services/api/commissions";

interface CommissionSettingsProps {
  onSettingsChange?: (settings: Settings) => void;
}

export function CommissionSettings({ onSettingsChange }: CommissionSettingsProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [percentInput, setPercentInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getCommissionSettings();
      setSettings(s);
      setEnabled(s.enabled);
      setPercentInput(String(s.defaultPercent));
      onSettingsChange?.(s);
    } catch {
      toast.error("Couldn't load commission settings.");
    } finally {
      setLoading(false);
    }
  }, [onSettingsChange]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    const n = Number(percentInput.trim() || "0");
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast.error("Default rate must be between 0 and 100.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateCommissionSettings({ enabled, defaultPercent: n });
      setSettings(updated);
      setEnabled(updated.enabled);
      setPercentInput(String(updated.defaultPercent));
      onSettingsChange?.(updated);
      // Let the sidebar re-evaluate whether to show the Commissions nav item.
      window.dispatchEvent(new Event("commissions-changed"));
      toast.success("Commission settings saved.");
    } catch {
      toast.error("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#101010] border border-[#303236] rounded-lg p-6 text-gray-400 text-sm">
        Loading commission settings…
      </div>
    );
  }

  const dirty =
    settings != null &&
    (enabled !== settings.enabled || percentInput.trim() !== String(settings.defaultPercent));

  return (
    <div className="bg-[#101010] border border-[#303236] rounded-lg p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-[#FFCC00]/10 p-2">
          <Percent className="w-5 h-5 text-[#FFCC00]" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">Staff commissions</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            Track a commission for the team member who completes each order. RepairCoin only
            records what&apos;s owed — you pay it out through your own payroll.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <label className="text-sm font-medium text-white">Enable commissions</label>
          <p className="text-sm text-gray-500">Off by default — turn on to start accruing.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-[#FFCC00]" : "bg-gray-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-white">Default rate (%)</label>
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          inputMode="decimal"
          value={percentInput}
          onChange={(e) => setPercentInput(e.target.value)}
          disabled={!enabled}
          className="w-full max-w-[200px] px-3 py-2 rounded-md bg-[#1a1b1e] border border-[#303236] text-white disabled:opacity-50 focus:border-[#FFCC00] outline-none"
        />
        <p className="text-sm text-gray-500">
          Applied to every member unless you set a per-member override below. Commission is a
          percentage of what the customer paid after any RCN discount.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="px-4 py-2 rounded-md bg-[#FFCC00] text-black font-medium hover:bg-[#FFD700] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

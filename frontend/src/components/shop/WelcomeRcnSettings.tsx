"use client";

// Shop "Welcome RCN on claim" settings. Lets the owner opt in to granting a one-time RCN reward
// when an imported/migrated customer (e.g. from Square) claims their account — the conversion
// incentive that pairs with the imported-customer win-back campaign. Shop-funded (debits the
// shop's RCN balance) + off-chain credit. When the platform flag is off, the controls are
// disabled and a note explains why.

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getWelcomeRcnSettings,
  updateWelcomeRcnSettings,
  type WelcomeRcnSettings as Settings,
} from "@/services/api/welcomeRcn";

export const WelcomeRcnSettings: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local form state (amount is a string so the field can be blank = "use default").
  const [enabled, setEnabled] = useState(false);
  const [amountInput, setAmountInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getWelcomeRcnSettings();
      setSettings(s);
      setEnabled(s.enabled);
      setAmountInput(s.amount != null ? String(s.amount) : "");
    } catch {
      toast.error("Couldn't load welcome-reward settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    // Blank amount = clear override (null → fall back to default). Otherwise must be > 0.
    let amount: number | null = null;
    const trimmed = amountInput.trim();
    if (trimmed !== "") {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error("Amount must be a positive number, or leave it blank to use the default.");
        return;
      }
      amount = n;
    }

    setSaving(true);
    try {
      const updated = await updateWelcomeRcnSettings({ enabled, amount });
      setSettings(updated);
      setEnabled(updated.enabled);
      setAmountInput(updated.amount != null ? String(updated.amount) : "");
      toast.success("Welcome-reward settings saved.");
    } catch {
      toast.error("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm p-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading welcome-reward settings…
      </div>
    );
  }

  const featureOff = settings ? !settings.featureEnabled : false;
  const effective = settings?.effectiveAmount ?? settings?.defaultAmount ?? 0;
  const dirty =
    settings != null &&
    (enabled !== settings.enabled ||
      amountInput.trim() !== (settings.amount != null ? String(settings.amount) : ""));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-yellow-50 p-2">
          <Gift className="w-5 h-5 text-yellow-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">Welcome reward on claim</h3>
          <p className="text-sm text-gray-600 mt-0.5">
            Grant a one-time RCN reward when a customer you imported (e.g. from Square) claims
            their account. It&apos;s the incentive that turns &quot;claim later&quot; into
            &quot;claim now&quot; — and it&apos;s funded from your RCN balance.
          </p>
        </div>
      </div>

      {featureOff && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          Welcome rewards aren&apos;t enabled on the platform yet. You can set your preference
          here, but nothing is granted until an admin turns the feature on.
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="welcome-rcn-enabled" className="text-sm font-medium text-gray-900">
            Grant welcome RCN on claim
          </Label>
          <p className="text-sm text-gray-500">Off by default — turn on to start rewarding claims.</p>
        </div>
        <Switch
          id="welcome-rcn-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={featureOff}
          // The base shadcn Switch uses bg-input (near-white) + a white thumb, which is
          // invisible on this white card. Give the track real contrast in both states.
          className="border border-gray-300 data-[state=unchecked]:bg-gray-300 data-[state=checked]:bg-yellow-500"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="welcome-rcn-amount" className="text-sm font-medium text-gray-900">
          Reward amount (RCN)
        </Label>
        <Input
          id="welcome-rcn-amount"
          type="number"
          min={1}
          inputMode="numeric"
          placeholder={`Default: ${settings?.defaultAmount ?? 25} RCN`}
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          disabled={featureOff || !enabled}
          className="max-w-[220px]"
        />
        <p className="text-sm text-gray-500">
          Leave blank to use the {settings?.defaultAmount ?? 25} RCN default. Each claim currently
          grants <span className="font-medium text-gray-700">{effective} RCN</span> (≈ $
          {(effective * 0.1).toFixed(2)}), debited from your RCN balance.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
};

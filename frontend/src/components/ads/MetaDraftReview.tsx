"use client";

// Admin review/edit + Go-live panel for a PAUSED Meta draft (Stage-4 push P5, Option B).
// Shown in the campaign detail when the campaign was created on Meta but not yet activated.
// Level 2 in-app edits (budget / radius / headline / primary text / regenerate image) push to
// the paused Meta objects; "Go live" verifies funding + activates. Deep edits → Ads Manager.

import React, { useState } from "react";
import { Loader2, Rocket, Pencil, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { updateCampaignDraft, goLiveCampaign, fmtUsd, type AdCampaign } from "@/services/api/ads";

export const MetaDraftReview: React.FC<{ campaign: AdCampaign; onChanged?: () => void }> = ({ campaign, onChanged }) => {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"save" | "live" | null>(null);
  const [dailyBudget, setDailyBudget] = useState(String((campaign.dailyBudgetCents / 100).toFixed(0)));
  const [radius, setRadius] = useState(campaign.targetRadiusMiles != null ? String(campaign.targetRadiusMiles) : "");
  const [headline, setHeadline] = useState("");
  const [primaryText, setPrimaryText] = useState("");
  const [regenerateImage, setRegenerateImage] = useState(false);

  // Only for paused Meta drafts.
  if (!campaign.metaCampaignId || campaign.metaStatus !== "PAUSED") return null;

  const save = async () => {
    setBusy("save");
    try {
      const edits: any = {};
      const b = parseFloat(dailyBudget);
      if (!Number.isNaN(b) && Math.round(b * 100) !== campaign.dailyBudgetCents) edits.dailyBudgetCents = Math.round(b * 100);
      const r = parseInt(radius, 10);
      if (!Number.isNaN(r) && r !== campaign.targetRadiusMiles) edits.radiusMiles = r;
      if (headline.trim()) edits.headline = headline.trim();
      if (primaryText.trim()) edits.primaryText = primaryText.trim();
      if (regenerateImage) edits.regenerateImage = true;
      if (Object.keys(edits).length === 0) { toast("Nothing to update."); setBusy(null); return; }
      await updateCampaignDraft(campaign.id, edits);
      toast.success("Draft updated on Meta.");
      setHeadline(""); setPrimaryText(""); setRegenerateImage(false);
      setEditing(false);
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Couldn't update the draft.");
    } finally { setBusy(null); }
  };

  const goLive = async () => {
    if (!window.confirm("Take this campaign live? Your ad account will start spending on Meta.")) return;
    setBusy("live");
    try {
      await goLiveCampaign(campaign.id);
      toast.success("Campaign is live!");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Couldn't go live.");
    } finally { setBusy(null); }
  };

  return (
    <div className="rounded-xl border border-[#FFCC00]/40 bg-[#141414] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <p className="text-sm font-medium text-[#FFCC00]">Drafted on Meta (paused) — review &amp; go live</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:text-white hover:border-[#FFCC00]">
            <Pencil className="w-3.5 h-3.5" /> {editing ? "Close" : "Edit"}
          </button>
          <button onClick={goLive} disabled={busy !== null} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50">
            {busy === "live" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />} Go live
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Budget {fmtUsd(campaign.dailyBudgetCents)}/day{campaign.targetRadiusMiles != null ? ` · ${campaign.targetRadiusMiles} mi radius` : ""}.
        AI-generated image + copy. For deeper targeting/placements, edit the paused campaign in Meta Ads Manager, then Go live.
      </p>

      {editing && (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Daily budget ($)"><input className={inputCls} type="number" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} /></Field>
            <Field label="Radius (mi)"><input className={inputCls} type="number" value={radius} onChange={(e) => setRadius(e.target.value)} /></Field>
          </div>
          <Field label="Headline (leave blank to keep)"><input className={inputCls} value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={40} placeholder="≤ 40 chars" /></Field>
          <Field label="Primary text (leave blank to keep)"><textarea className={inputCls} rows={2} value={primaryText} onChange={(e) => setPrimaryText(e.target.value)} maxLength={125} placeholder="≤ 125 chars" /></Field>
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={regenerateImage} onChange={(e) => setRegenerateImage(e.target.checked)} />
            <Sparkles className="w-3.5 h-3.5 text-[#FFCC00]" /> Regenerate the AI image
          </label>
          <button onClick={save} disabled={busy !== null} className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50">
            {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />} Save changes
          </button>
        </div>
      )}
    </div>
  );
};

const inputCls = "w-full px-2.5 py-1.5 bg-[#0F0F0F] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00]";
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs text-gray-500 mb-1">{label}</label>
    {children}
  </div>
);

export default MetaDraftReview;

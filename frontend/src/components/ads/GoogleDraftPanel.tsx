"use client";

// Admin composer for a Google Search campaign that's been built (PAUSED on the shop's account) but
// isn't live yet. Google-specific fields only (no image / "Push to Meta"): daily budget, RSA
// headlines + descriptions, and keywords — all editable and synced to Google on Save. Regenerate
// re-runs the AI copy. The RSA copy + keywords are stored locally (google_ad_content) so we can show
// and edit them. Custom dark ads theme (the ads UI isn't shadcn).

import React, { useEffect, useState } from "react";
import { Loader2, Rocket, ExternalLink, Plus, X, Wand2, Save } from "lucide-react";
import toast from "react-hot-toast";
import { fmtMoney, updateGoogleDraft, type AdCampaign } from "@/services/api/ads";

const eq = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);

export const GoogleDraftPanel: React.FC<{
  campaign: AdCampaign;
  onGoLive: () => Promise<void> | void;
  onChanged?: () => void;
}> = ({ campaign, onGoLive, onChanged }) => {
  const [busy, setBusy] = useState<null | "save" | "regen" | "golive">(null);
  const [budget, setBudget] = useState("");
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [descriptions, setDescriptions] = useState<string[]>([]);
  const [keywords, setKeywords] = useState("");

  // (Re)initialize the editor from the campaign whenever it changes (e.g. after a save reload).
  useEffect(() => {
    const c = campaign.googleAdContent;
    setBudget(String((campaign.dailyBudgetCents / 100).toFixed(0)));
    setHeadlines(c?.headlines?.length ? c.headlines : [""]);
    setDescriptions(c?.descriptions?.length ? c.descriptions : [""]);
    setKeywords((c?.keywords ?? []).join(", "));
  }, [campaign.id, campaign.dailyBudgetCents, campaign.googleAdContent]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = campaign.googleStatus || "PAUSED";
  const orig = campaign.googleAdContent;
  const cleanH = headlines.map((s) => s.trim()).filter(Boolean);
  const cleanD = descriptions.map((s) => s.trim()).filter(Boolean);
  const kwList = keywords.split(",").map((s) => s.trim()).filter(Boolean);
  const rsaValid = cleanH.length >= 3 && cleanH.every((s) => s.length <= 30) && cleanD.length >= 2 && cleanD.every((s) => s.length <= 90);

  const save = async () => {
    const edits: any = {};
    const b = parseFloat(budget);
    if (!Number.isNaN(b) && Math.round(b * 100) !== campaign.dailyBudgetCents) edits.dailyBudgetCents = Math.round(b * 100);
    const copyChanged = !eq(cleanH, orig?.headlines ?? []) || !eq(cleanD, orig?.descriptions ?? []);
    if (copyChanged) {
      if (!rsaValid) { toast.error("Need at least 3 headlines (≤30 chars) and 2 descriptions (≤90 chars)."); return; }
      edits.headlines = cleanH; edits.descriptions = cleanD;
    }
    if (!eq(kwList, orig?.keywords ?? [])) edits.keywords = kwList;
    if (Object.keys(edits).length === 0) { toast("Nothing to update."); return; }
    setBusy("save");
    try {
      await updateGoogleDraft(campaign.id, edits);
      toast.success("Saved & synced to Google.");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Couldn't save.");
    } finally { setBusy(null); }
  };

  const regenerate = async () => {
    setBusy("regen");
    try {
      await updateGoogleDraft(campaign.id, { regenerate: true });
      toast.success("Fresh copy generated & synced.");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Couldn't regenerate.");
    } finally { setBusy(null); }
  };

  const goLive = async () => {
    setBusy("golive");
    try { await onGoLive(); } finally { setBusy(null); }
  };

  const managerUrl = `https://ads.google.com/aw/campaigns?campaignId=${campaign.googleCampaignId ?? ""}`;

  return (
    <div className="space-y-4">
      {/* Objects summary */}
      <div className="rounded-lg border border-white/10 bg-[#1A1A1A] p-4 space-y-3">
        <p className="text-sm text-gray-300">
          Created on Google Ads as a <span className="text-white font-medium">paused</span> Search campaign. Edit
          the budget, ad copy &amp; keywords below — changes sync to Google. Nothing serves until you go live.
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Row label="Google status" value={status} />
          <Row label="Budget / day" value={fmtMoney(campaign.dailyBudgetCents, campaign.currency)} />
          <Row label="Campaign ID" value={campaign.googleCampaignId ?? "—"} mono />
          <Row label="Ad group ID" value={campaign.googleAdGroupId ?? "—"} mono />
        </dl>
        <a href={managerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
          <ExternalLink className="w-3.5 h-3.5" /> Review in Google Ads
        </a>
      </div>

      {/* Editor */}
      <div className="rounded-lg border border-white/10 bg-[#1A1A1A] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Ad content</p>
          <button onClick={regenerate} disabled={busy !== null}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-gray-300 hover:text-white hover:bg-white/5 disabled:opacity-50">
            {busy === "regen" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Regenerate with AI
          </button>
        </div>

        {/* Budget */}
        <div className="max-w-[220px]">
          <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Daily budget ({campaign.currency || "PHP"})</label>
          <input type="number" min={1} value={budget} onChange={(e) => setBudget(e.target.value)} className={inputCls} />
        </div>

        <ListEditor
          label="Headlines" hint="3–15, ≤30 chars each" max={30} min={3} values={headlines} onChange={setHeadlines} maxItems={15}
        />
        <ListEditor
          label="Descriptions" hint="2–4, ≤90 chars each" max={90} min={2} values={descriptions} onChange={setDescriptions} maxItems={4} textarea
        />

        {/* Keywords */}
        <div>
          <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Keywords <span className="text-gray-600 normal-case">— comma-separated (broad match)</span></label>
          <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} rows={2} className={inputCls} placeholder="phone repair, screen replacement, ..." />
          <p className="text-[11px] text-gray-500 mt-1">{kwList.length} keyword{kwList.length === 1 ? "" : "s"}</p>
        </div>

        <button onClick={save} disabled={busy !== null}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/15 disabled:opacity-50">
          {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save &amp; sync to Google
        </button>
      </div>

      {/* Go live */}
      <div className="rounded-lg border border-[#FFCC00]/20 bg-[#FFCC00]/5 p-4 space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          Going live enables the campaign, ad group &amp; ad on Google — real spend starts. Google requires the
          shop&apos;s account to have a <span className="text-gray-200">conversion action</span> and a
          <span className="text-gray-200"> payment method</span> first; Go Live checks both and tells you what&apos;s missing.
        </p>
        <button onClick={goLive} disabled={busy !== null}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FFCC00] text-black font-medium hover:bg-[#E6B800] disabled:opacity-50">
          {busy === "golive" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />} Go Live on Google
        </button>
      </div>
    </div>
  );
};

const ListEditor: React.FC<{
  label: string; hint: string; max: number; min: number; maxItems: number;
  values: string[]; onChange: (v: string[]) => void; textarea?: boolean;
}> = ({ label, hint, max, min, maxItems, values, onChange, textarea }) => {
  const set = (i: number, v: string) => onChange(values.map((x, idx) => (idx === i ? v : x)));
  const add = () => { if (values.length < maxItems) onChange([...values, ""]); };
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));
  const filled = values.map((s) => s.trim()).filter(Boolean).length;
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
        {label} <span className="text-gray-600 normal-case">— {hint}</span>
        {filled < min && <span className="text-amber-400 normal-case"> · need {min - filled} more</span>}
      </label>
      <div className="space-y-2">
        {values.map((v, i) => {
          const over = v.trim().length > max;
          return (
            <div key={i} className="flex items-start gap-2">
              {textarea ? (
                <textarea value={v} onChange={(e) => set(i, e.target.value)} rows={2} className={`${inputCls} ${over ? "border-red-500/60" : ""}`} />
              ) : (
                <input value={v} onChange={(e) => set(i, e.target.value)} className={`${inputCls} ${over ? "border-red-500/60" : ""}`} />
              )}
              <span className={`text-[11px] w-10 shrink-0 pt-2 text-right ${over ? "text-red-400" : "text-gray-500"}`}>{v.trim().length}/{max}</span>
              <button onClick={() => remove(i)} className="pt-1.5 text-gray-500 hover:text-red-400 shrink-0" title="Remove"><X className="w-4 h-4" /></button>
            </div>
          );
        })}
      </div>
      {values.length < maxItems && (
        <button onClick={add} className="mt-2 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white"><Plus className="w-3.5 h-3.5" /> Add {label.replace(/s$/, "").toLowerCase()}</button>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex flex-col">
    <dt className="text-[11px] uppercase tracking-wide text-gray-500">{label}</dt>
    <dd className={`text-gray-200 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
  </div>
);

const inputCls = "w-full px-2.5 py-1.5 bg-[#0F0F0F] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00]";

export default GoogleDraftPanel;

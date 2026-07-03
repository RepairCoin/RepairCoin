"use client";

// Admin composer for a Google Search campaign that's been built (PAUSED on the shop's account) but
// isn't live yet. Google-specific fields only (no image / "Push to Meta"): daily budget, RSA
// headlines + descriptions, and keywords — all editable and synced to Google on Save. Regenerate
// re-runs the AI copy. The RSA copy + keywords are stored locally (google_ad_content) so we can show
// and edit them. Custom dark ads theme (the ads UI isn't shadcn).

import React, { useEffect, useState } from "react";
import { Loader2, Rocket, ExternalLink, Plus, X, Wand2, Save, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { fmtMoney, updateGoogleDraft, getGoogleDraftContent, type AdCampaign, type GoogleAdContent } from "@/services/api/ads";

const eq = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);

// Soft recommended daily minimum (major units) — roughly a few local-service clicks/day. Google
// enforces NO minimum, so this is advisory only. Per-currency defaults, overridable via env.
const REC_MIN_BY_CCY: Record<string, number> = {
  USD: 5, EUR: 5, GBP: 4, AUD: 7, CAD: 7, SGD: 7, NZD: 8, PHP: 200, INR: 300, MXN: 90, BRL: 25, JPY: 700,
};
const REC_MIN_ENV = parseFloat(process.env.NEXT_PUBLIC_ADS_GOOGLE_MIN_DAILY || "");
function recommendedMinDaily(currency?: string | null): number | null {
  if (Number.isFinite(REC_MIN_ENV) && REC_MIN_ENV > 0) return REC_MIN_ENV;
  return REC_MIN_BY_CCY[(currency || "PHP").toUpperCase()] ?? null;
}

export const GoogleDraftPanel: React.FC<{
  campaign: AdCampaign;
  onGoLive: () => Promise<void> | void;
  onChanged?: () => void;
}> = ({ campaign, onGoLive, onChanged }) => {
  const [busy, setBusy] = useState<null | "save" | "regen" | "golive" | "refresh">(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [budget, setBudget] = useState("");
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [descriptions, setDescriptions] = useState<string[]>([]);
  const [keywords, setKeywords] = useState("");

  const applyContent = (dailyBudgetCents: number, c?: GoogleAdContent | null) => {
    setBudget(String((dailyBudgetCents / 100).toFixed(0)));
    setHeadlines(c?.headlines?.length ? c.headlines : [""]);
    setDescriptions(c?.descriptions?.length ? c.descriptions : [""]);
    setKeywords((c?.keywords ?? []).join(", "));
  };

  // (Re)initialize the editor from the campaign; when we have no copy locally (built before the
  // composer, or first open), backfill it FROM Google so the composer shows the real AI-generated ad.
  useEffect(() => {
    const c = campaign.googleAdContent;
    applyContent(campaign.dailyBudgetCents, c);
    if (c?.headlines?.length) return;
    let alive = true;
    setLoadingContent(true);
    getGoogleDraftContent(campaign.id)
      .then((camp) => { if (alive) applyContent(camp.dailyBudgetCents, camp.googleAdContent); })
      .catch(() => { /* leave empty — admin can regenerate */ })
      .finally(() => { if (alive) setLoadingContent(false); });
    return () => { alive = false; };
  }, [campaign.id, campaign.dailyBudgetCents, campaign.googleAdContent]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async () => {
    setBusy("refresh");
    try {
      const camp = await getGoogleDraftContent(campaign.id, true);
      applyContent(camp.dailyBudgetCents, camp.googleAdContent);
      toast.success("Loaded the latest from Google.");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Couldn't refresh from Google.");
    } finally { setBusy(null); }
  };

  const status = campaign.googleStatus || "PAUSED";
  const recMin = recommendedMinDaily(campaign.currency);
  const budgetNum = parseFloat(budget);
  const lowBudget = recMin != null && Number.isFinite(budgetNum) && budgetNum > 0 && budgetNum < recMin;
  const orig = campaign.googleAdContent;
  const cleanH = headlines.map((s) => s.trim()).filter(Boolean);
  const cleanD = descriptions.map((s) => s.trim()).filter(Boolean);
  const kwList = keywords.split(",").map((s) => s.trim()).filter(Boolean);
  const rsaValid = cleanH.length >= 3 && cleanH.every((s) => s.length <= 30) && cleanD.length >= 2 && cleanD.every((s) => s.length <= 90);

  // Unsaved-changes detection — Go Live only activates what's already synced to Google, so unsaved
  // composer edits would be silently dropped. Used to guard Go Live + show a dirty hint.
  const budgetChanged = Number.isFinite(budgetNum) && Math.round(budgetNum * 100) !== campaign.dailyBudgetCents;
  const copyChanged = !eq(cleanH, orig?.headlines ?? []) || !eq(cleanD, orig?.descriptions ?? []);
  const kwChanged = !eq(kwList, orig?.keywords ?? []);
  const isDirty = budgetChanged || copyChanged || kwChanged;

  // Push only the changed parts to Google. Returns false when RSA validation blocks a copy edit.
  const pushEdits = async (): Promise<boolean> => {
    const edits: any = {};
    if (budgetChanged) edits.dailyBudgetCents = Math.round(budgetNum * 100);
    if (copyChanged) {
      if (!rsaValid) { toast.error("Need at least 3 headlines (≤30 chars) and 2 descriptions (≤90 chars)."); return false; }
      edits.headlines = cleanH; edits.descriptions = cleanD;
    }
    if (kwChanged) edits.keywords = kwList;
    if (Object.keys(edits).length === 0) return true;
    await updateGoogleDraft(campaign.id, edits);
    return true;
  };

  const save = async () => {
    if (!isDirty) { toast("Nothing to update."); return; }
    setBusy("save");
    try {
      if (await pushEdits()) { toast.success("Saved & synced to Google."); onChanged?.(); }
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
    // Guard: Go Live activates what's ON Google, not the composer's unsaved edits — sync them first.
    if (isDirty && !window.confirm(
      "You have unsaved changes to this ad — they won't go live unless synced.\n\nOK = Save & sync to Google, then go live\nCancel = keep editing"
    )) return;
    setBusy("golive");
    try {
      if (isDirty) {
        if (!(await pushEdits())) return; // validation blocked → stay in the composer
        onChanged?.();
      }
      await onGoLive();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Couldn't go live.");
    } finally { setBusy(null); }
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
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            Ad content
            {loadingContent && <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Loader2 className="w-3 h-3 animate-spin" /> loading from Google…</span>}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={refresh} disabled={busy !== null}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-gray-300 hover:text-white hover:bg-white/5 disabled:opacity-50"
              title="Pull the latest copy & keywords from Google Ads">
              {busy === "refresh" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
            </button>
            <button onClick={regenerate} disabled={busy !== null}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-gray-300 hover:text-white hover:bg-white/5 disabled:opacity-50">
              {busy === "regen" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Regenerate with AI
            </button>
          </div>
        </div>

        {/* Budget — Google has no hard minimum (unlike Meta), so this is soft guidance only. */}
        <div>
          <div className="max-w-[220px]">
            <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Daily budget ({campaign.currency || "PHP"})</label>
            <input type="number" min={1} value={budget} onChange={(e) => setBudget(e.target.value)} className={inputCls} />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Google has no minimum — but a very low daily budget may get few or no clicks (it should cover at least a few keyword clicks/day).</p>
          {lowBudget && recMin != null && (
            <p className="text-[11px] text-amber-400 mt-1">This looks low — we recommend at least about {fmtMoney(recMin * 100, campaign.currency)}/day so your ads can get steady clicks. (Not required — you can save any amount.)</p>
          )}
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
        {isDirty && (
          <p className="text-[11px] text-amber-400">You have unsaved changes — Go Live will offer to save &amp; sync them first.</p>
        )}
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

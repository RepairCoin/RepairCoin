"use client";

// Unified DRAFT composer (pre-live). One cohesive card that merges what used to be three
// separate boxes (draft details + Creatives panel + push action) so the creative reads as
// PART OF the draft. The details form is always visible (no "Edit" gate). Handles both
// pre-Meta local drafts ("Push to Meta") and pushed-but-paused drafts ("Go live").
//
//   [ image preview ]   Headline / Primary text / Budget / Radius   →  Save · Push/Go-live
//   pending · AI         (always-visible form)
//   Regenerate · Approve

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, UploadCloud, Rocket, Sparkles, Wand2, Check, X, Maximize2, ImageUp } from "lucide-react";
import toast from "react-hot-toast";
import {
  listCreatives, reviewCreative, regenerateAdImage, updateCampaignDraft,
  uploadAdCreativeImage, useManualAdImage,
  pushCampaignToMeta, goLiveCampaign, type AdCampaign, type AdCreative,
} from "@/services/api/ads";

const inputCls = "w-full px-2.5 py-1.5 bg-[#0F0F0F] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00]";

export const DraftComposer: React.FC<{ campaign: AdCampaign; onChanged?: () => void }> = ({ campaign, onChanged }) => {
  const [creative, setCreative] = useState<AdCreative | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "push" | "live" | "approve" | "reject" | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenPrompt, setRegenPrompt] = useState("");
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [headline, setHeadline] = useState("");
  const [primaryText, setPrimaryText] = useState("");
  const [dailyBudget, setDailyBudget] = useState(String((campaign.dailyBudgetCents / 100).toFixed(0)));
  const [radius, setRadius] = useState(campaign.targetRadiusMiles != null ? String(campaign.targetRadiusMiles) : "");
  const [objective, setObjective] = useState(campaign.objective || "OUTCOME_TRAFFIC");
  const [metaEnhance, setMetaEnhance] = useState(!!campaign.allowMetaEnhancements);

  const onMeta = !!campaign.metaCampaignId; // pushed (PAUSED) vs local draft

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listCreatives(campaign.id).catch(() => []);
      const ai = list.find((c) => c.imageUrl) || null;
      setCreative(ai);
      setHeadline(ai?.headline || "");
      setPrimaryText(ai?.body || "");
      if (!regenOpen) setRegenPrompt(ai?.generationPrompt || "");
    } finally { setLoading(false); }
  }, [campaign.id, regenOpen]);

  useEffect(() => { void load(); }, [campaign.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const approved = creative?.reviewStatus === "approved";

  const saveDetails = async () => {
    const edits: any = {};
    const b = parseFloat(dailyBudget);
    if (!Number.isNaN(b) && Math.round(b * 100) !== campaign.dailyBudgetCents) edits.dailyBudgetCents = Math.round(b * 100);
    const r = parseInt(radius, 10);
    if (!Number.isNaN(r) && r !== campaign.targetRadiusMiles) edits.radiusMiles = r;
    if (!onMeta && objective !== (campaign.objective || "OUTCOME_TRAFFIC")) edits.objective = objective;
    if (metaEnhance !== !!campaign.allowMetaEnhancements) edits.allowMetaEnhancements = metaEnhance;
    if (headline.trim() && headline.trim() !== (creative?.headline || "")) edits.headline = headline.trim();
    if (primaryText.trim() && primaryText.trim() !== (creative?.body || "")) edits.primaryText = primaryText.trim();
    if (Object.keys(edits).length === 0) { toast("Nothing to update."); return; }
    setBusy("save");
    try {
      await updateCampaignDraft(campaign.id, edits);
      toast.success(edits.headline || edits.primaryText ? "Saved — copy changed, so re-approve the creative." : "Saved.");
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Couldn't save.");
    } finally { setBusy(null); }
  };

  const regenerate = async () => {
    if (!regenPrompt.trim()) { toast("Describe the image you want."); return; }
    setBusy("save");
    try {
      await regenerateAdImage(campaign.id, regenPrompt.trim());
      toast.success("New image generated — review and approve it.");
      setRegenOpen(false);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Couldn't regenerate the image.");
    } finally { setBusy(null); }
  };

  const review = async (status: "approved" | "rejected") => {
    if (!creative) return;
    setBusy(status === "approved" ? "approve" : "reject");
    try {
      await reviewCreative(creative.id, status);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't update review.");
    } finally { setBusy(null); }
  };

  const onUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAdCreativeImage(campaign.id, file);
      await useManualAdImage(campaign.id, url);
      toast.success("Image uploaded — review and approve it.");
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Couldn't upload the image.");
    } finally { setUploading(false); }
  };

  const push = async () => {
    setBusy("push");
    try {
      await pushCampaignToMeta(campaign.id);
      toast.success("Pushed to Meta (paused) — review and go live when ready.");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Couldn't push to Meta.");
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
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <p className="text-sm font-medium text-[#FFCC00]">
          {onMeta ? "Drafted on Meta (paused) — review & go live" : "Draft — review & launch"}
        </p>
        {onMeta ? (
          <button onClick={goLive} disabled={busy !== null || !approved} title={approved ? "" : "Approve the creative first"}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-40 disabled:cursor-not-allowed">
            {busy === "live" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />} Go live
          </button>
        ) : (
          <button onClick={push} disabled={busy !== null || !approved} title={approved ? "" : "Approve the creative first"}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-40 disabled:cursor-not-allowed">
            {busy === "push" ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />} Push to Meta
          </button>
        )}
      </div>
      {campaign.notes && <p className="text-xs text-gray-500 mb-3">What the shop asked for: <span className="text-gray-300">{campaign.notes}</span></p>}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading draft…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4">
          {/* Creative preview + review */}
          <div className="space-y-2">
            {creative?.imageUrl ? (
              <button type="button" onClick={() => setPreview(true)} title="Click to enlarge"
                className="relative group block rounded-lg overflow-hidden border border-white/10 hover:border-[#FFCC00]/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={creative.imageUrl} alt={creative.headline || "ad creative"} className="w-full sm:w-64 aspect-[3/2] object-cover" />
                <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-3 h-3" /> Enlarge
                </span>
              </button>
            ) : (
              <div className="w-full sm:w-64 aspect-[3/2] rounded-lg border border-dashed border-white/15 flex items-center justify-center text-xs text-gray-500">No image yet</div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {creative && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${approved ? "bg-green-500/15 text-green-400" : creative.reviewStatus === "rejected" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}>{creative.reviewStatus}</span>
              )}
              <span className="text-xs text-[#FFCC00] inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setRegenOpen((v) => !v)} disabled={busy !== null || uploading}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[#FFCC00]/10 text-[#FFCC00] hover:bg-[#FFCC00]/20 disabled:opacity-50">
                <Wand2 className="w-3.5 h-3.5" /> Regenerate
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onUploadFile} />
              <button onClick={() => fileRef.current?.click()} disabled={busy !== null || uploading} title="Upload a designer-made image instead"
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-white disabled:opacity-50">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageUp className="w-3.5 h-3.5" />} Upload
              </button>
              {creative && !approved && (
                <button onClick={() => review("approved")} disabled={busy !== null}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-50">
                  {busy === "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve
                </button>
              )}
              {creative && creative.reviewStatus !== "rejected" && (
                <button onClick={() => review("rejected")} disabled={busy !== null}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50">
                  <X className="w-3.5 h-3.5" /> Reject
                </button>
              )}
            </div>
            {regenOpen && (
              <div className="space-y-2 rounded-lg border border-white/10 bg-[#1A1A1A] p-2.5">
                <textarea value={regenPrompt} onChange={(e) => setRegenPrompt(e.target.value)} rows={3} maxLength={1000}
                  placeholder="Describe the image, e.g. a cozy café counter with fresh pastries and warm morning light"
                  className={inputCls} />
                <p className="text-[11px] text-gray-500">Brand colors + logo applied automatically · ~20–60s · lands back as pending for approval.</p>
                <button onClick={regenerate} disabled={busy !== null}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50">
                  {busy === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Generate image
                </button>
              </div>
            )}
          </div>

          {/* Always-visible details form */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Headline</label>
              <input className={inputCls} value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={40} placeholder="≤ 40 chars" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Primary text</label>
              <textarea className={inputCls} rows={2} value={primaryText} onChange={(e) => setPrimaryText(e.target.value)} maxLength={125} placeholder="≤ 125 chars" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Objective {onMeta && <span className="text-gray-600">(locked after push)</span>}</label>
              <select className={inputCls} value={objective} disabled={onMeta} onChange={(e) => setObjective(e.target.value)}>
                <option value="OUTCOME_TRAFFIC">Website clicks — send to a landing page</option>
                <option value="OUTCOME_ENGAGEMENT" disabled>Messages (Messenger) — coming soon · needs Meta App Review</option>
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Optimizes for clicks to the shop&apos;s landing page, where the lead form captures the customer.
              </p>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-[#FFCC00]" checked={metaEnhance} onChange={(e) => setMetaEnhance(e.target.checked)} />
              <span className="text-xs text-gray-300">
                Allow Meta AI creative enhancements
                <span className="block text-[11px] text-gray-500">
                  After approval, lets Meta auto-generate on-delivery variations (image expansion, background, text) of your approved ad. Off = your approved creative only.
                </span>
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Daily budget</label>
                <input className={inputCls} type="number" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Radius (mi)</label>
                <input className={inputCls} type="number" value={radius} onChange={(e) => setRadius(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={saveDetails} disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-200 hover:border-[#FFCC00] hover:text-white disabled:opacity-50">
                {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save changes
              </button>
              {!approved && <span className="text-xs text-amber-400/90">Approve the creative to enable {onMeta ? "“Go live”" : "“Push to Meta”"}.</span>}
            </div>
            <p className="text-[11px] text-gray-500">
              {onMeta
                ? "Edits push to the paused Meta ad. For deeper targeting, edit in Ads Manager, then Go live."
                : "Nothing reaches Meta until you push — and the daily budget must clear the ad account's minimum (shown if it's too low)."}
            </p>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {preview && creative?.imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(false)}>
          <button onClick={() => setPreview(false)} title="Close" className="absolute top-4 right-4 text-white/80 hover:text-white"><X className="w-6 h-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={creative.imageUrl} alt="ad creative full preview" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default DraftComposer;

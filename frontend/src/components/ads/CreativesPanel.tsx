"use client";

// Ads System (Q8) — creative management + review for a campaign (admin). The admin
// creates creatives, then approves/rejects them before they can launch. This gates
// the SHARED Meta Business Manager account: one policy-violating creative can get
// the whole platform's ad account restricted, not just one shop's. Reads/writes
// /ads/campaigns/:id/creatives + /ads/creatives/:id (+ /review).

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, ImageIcon, Plus, Check, X, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  listCreatives, createCreative, reviewCreative, deleteCreative,
  type AdCreative, type CreativeType, type LandingUrlType, type CreateCreativeInput,
} from "@/services/api/ads";

const CREATIVE_TYPES: CreativeType[] = ["image", "video", "carousel"];
const LANDING_TYPES: { value: LandingUrlType; label: string }[] = [
  { value: "booking_page", label: "Booking page" },
  { value: "shop_profile", label: "Shop profile" },
  { value: "lead_form", label: "Lead form" },
];

const REVIEW_BADGE: Record<AdCreative["reviewStatus"], string> = {
  pending: "bg-amber-500/15 text-amber-400",
  approved: "bg-green-500/15 text-green-400",
  rejected: "bg-red-500/15 text-red-400",
};

const inputCls =
  "w-full min-w-0 px-2.5 py-1.5 bg-[#0F0F0F] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00]";

export const CreativesPanel: React.FC<{ campaignId: string }> = ({ campaignId }) => {
  const [creatives, setCreatives] = useState<AdCreative[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateCreativeInput>({ creativeType: "image" });

  const load = useCallback(async () => {
    setLoading(true);
    try { setCreatives(await listCreatives(campaignId).catch(() => [])); }
    finally { setLoading(false); }
  }, [campaignId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    setSaving(true);
    try {
      await createCreative(campaignId, {
        creativeType: form.creativeType,
        headline: form.headline?.trim() || null,
        body: form.body?.trim() || null,
        landingUrlType: form.landingUrlType ?? null,
        landingUrl: form.landingUrl?.trim() || null,
      });
      setForm({ creativeType: "image" });
      setShowForm(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't create creative.");
    } finally {
      setSaving(false);
    }
  };

  const review = async (id: string, status: "approved" | "rejected") => {
    setBusyId(id);
    try {
      await reviewCreative(id, status);
      toast.success(status === "approved" ? "Creative approved." : "Creative rejected.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't update review.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await deleteCreative(id);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't delete creative.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-400 text-sm py-3"><Loader2 className="w-4 h-4 animate-spin" /> Loading creatives…</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-[#FFCC00]" />
          <p className="text-sm font-medium text-gray-300">Creatives</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-white"
        >
          <Plus className="w-3.5 h-3.5" /> {showForm ? "Cancel" : "New creative"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-white/10 bg-[#1A1A1A] p-3 mb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.creativeType}
              onChange={(e) => setForm((f) => ({ ...f, creativeType: e.target.value as CreativeType }))}
              className={inputCls}
            >
              {CREATIVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={form.landingUrlType ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, landingUrlType: (e.target.value || null) as LandingUrlType | null }))}
              className={inputCls}
            >
              <option value="">Landing: none</option>
              {LANDING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <input
            value={form.headline ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
            placeholder="Headline"
            className={inputCls}
          />
          <textarea
            value={form.body ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="Body copy"
            rows={2}
            className={inputCls}
          />
          <input
            value={form.landingUrl ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, landingUrl: e.target.value }))}
            placeholder="Landing URL (optional)"
            className={inputCls}
          />
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add creative
            </button>
          </div>
        </div>
      )}

      {creatives.length === 0 ? (
        <p className="text-xs text-gray-500">No creatives yet. New creatives start as <span className="text-amber-400">pending</span> and must be approved before launch.</p>
      ) : (
        <div className="space-y-2">
          {creatives.map((c) => (
            <div key={c.id} className="rounded-lg border border-white/10 bg-[#1A1A1A] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-white truncate">{c.headline || <span className="text-gray-500 italic">No headline</span>}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${REVIEW_BADGE[c.reviewStatus]}`}>{c.reviewStatus}</span>
                    <span className="text-xs text-gray-500">{c.creativeType} · v{c.version}</span>
                  </div>
                  {c.body && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{c.body}</p>}
                  {c.landingUrl && <p className="text-xs text-gray-500 mt-0.5 truncate">→ {c.landingUrl}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {c.reviewStatus !== "approved" && (
                    <button
                      onClick={() => review(c.id, "approved")}
                      disabled={busyId === c.id}
                      title="Approve"
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                  )}
                  {c.reviewStatus !== "rejected" && (
                    <button
                      onClick={() => review(c.id, "rejected")}
                      disabled={busyId === c.id}
                      title="Reject"
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  )}
                  <button
                    onClick={() => remove(c.id)}
                    disabled={busyId === c.id}
                    title="Delete"
                    className="inline-flex items-center text-gray-500 hover:text-red-400 p-1 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreativesPanel;

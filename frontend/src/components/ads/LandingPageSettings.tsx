"use client";

// Phase 2 — shop-controlled landing-page magnet editor. Collapsible card (lazy-loads config on
// first open) for overriding the auto-composed landing page: headline/subhead, urgency, benefit
// bullets, CTA label, show-rating, and an opt-in "Call now" button. Styled to match the
// DraftComposer (the ads UI is custom dark-themed, not shadcn).

import React, { useState } from "react";
import { Loader2, Megaphone, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import { getLandingConfig, updateLandingConfig, type AdCampaign } from "@/services/api/ads";

const inputCls = "w-full px-2.5 py-1.5 bg-[#0F0F0F] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00]";

export const LandingPageSettings: React.FC<{ campaign: AdCampaign }> = ({ campaign }) => {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [headline, setHeadline] = useState("");
  const [subhead, setSubhead] = useState("");
  const [urgencyText, setUrgencyText] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [bullets, setBullets] = useState(""); // one per line
  const [showRating, setShowRating] = useState(true);
  const [callNowEnabled, setCallNowEnabled] = useState(false);

  const landingUrl = typeof window !== "undefined" ? `${window.location.origin}/l/${campaign.id}` : "";

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoading(true);
      try {
        const cfg = await getLandingConfig(campaign.id);
        setHeadline(cfg.headline || "");
        setSubhead(cfg.subhead || "");
        setUrgencyText(cfg.urgencyText || "");
        setCtaLabel(cfg.ctaLabel || "");
        setBullets((cfg.benefitBullets || []).join("\n"));
        setShowRating(cfg.showRating !== false);
        setCallNowEnabled(!!cfg.callNowEnabled);
        setLoaded(true);
      } catch {
        toast.error("Couldn't load landing settings.");
      } finally { setLoading(false); }
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateLandingConfig(campaign.id, {
        headline: headline.trim() || undefined,
        subhead: subhead.trim() || undefined,
        urgencyText: urgencyText.trim() || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        benefitBullets: bullets.split("\n").map((b) => b.trim()).filter(Boolean).slice(0, 6),
        showRating,
        callNowEnabled,
      });
      toast.success("Landing page updated.");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Couldn't save landing settings.");
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#141414] mt-4">
      <button onClick={toggle} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-200">
          <Megaphone className="w-4 h-4 text-[#FFCC00]" /> Landing page
          <span className="text-xs text-gray-500">— customize the lead-capture page</span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : (
            <>
              <p className="text-[11px] text-gray-500">
                Leave a field blank to use the automatic default (the offer, your rating, FixFlow CTA).
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Headline (defaults to the offer)</label>
                <input className={inputCls} value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120} placeholder="e.g. 20% off your first repair this week" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Subhead</label>
                <input className={inputCls} value={subhead} onChange={(e) => setSubhead(e.target.value)} maxLength={200} placeholder="A short supporting line" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Urgency / scarcity</label>
                <input className={inputCls} value={urgencyText} onChange={(e) => setUrgencyText(e.target.value)} maxLength={80} placeholder="e.g. Offer ends Sunday · 3 slots left" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Benefit bullets (one per line, up to 6)</label>
                <textarea className={inputCls} rows={4} value={bullets} onChange={(e) => setBullets(e.target.value)}
                  placeholder={"Certified technicians\nSame-day service\nWarranty included"} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Button label</label>
                <input className={inputCls} value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={40} placeholder="Get my free quote" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-[#FFCC00]" checked={showRating} onChange={(e) => setShowRating(e.target.checked)} />
                <span className="text-sm text-gray-300">Show my star rating &amp; review count</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="mt-0.5 accent-[#FFCC00]" checked={callNowEnabled} onChange={(e) => setCallNowEnabled(e.target.checked)} />
                <span className="text-sm text-gray-300">
                  Show a &quot;Call now&quot; button
                  <span className="block text-[11px] text-gray-500">Displays your shop phone publicly as a secondary CTA.</span>
                </span>
              </label>
              <div className="flex items-center gap-3 pt-1">
                <button onClick={save} disabled={saving}
                  className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save landing page
                </button>
                <a href={landingUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white">
                  <ExternalLink className="w-3.5 h-3.5" /> Preview
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default LandingPageSettings;

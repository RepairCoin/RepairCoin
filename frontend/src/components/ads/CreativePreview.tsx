"use client";

// Read-only "current ad" preview for the LIVE/operating view. Creative editing — approve,
// regenerate, swap — lives in the DraftComposer (pre-push); once a campaign is live we just
// show what's running (image + copy), with click-to-enlarge. No edit controls here.

import React, { useEffect, useState } from "react";
import { Loader2, ImageIcon, Maximize2, X } from "lucide-react";
import { listCreatives, type AdCreative } from "@/services/api/ads";

export const CreativePreview: React.FC<{ campaignId: string }> = ({ campaignId }) => {
  const [creative, setCreative] = useState<AdCreative | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listCreatives(campaignId)
      .then((list) => { if (alive) setCreative(list.find((c) => c.imageUrl) || null); })
      .catch(() => { if (alive) setCreative(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [campaignId]);

  if (loading) return <div className="flex items-center gap-2 text-gray-400 text-sm py-3"><Loader2 className="w-4 h-4 animate-spin" /> Loading ad…</div>;
  if (!creative) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <ImageIcon className="w-4 h-4 text-[#FFCC00]" />
        <p className="text-sm font-medium text-gray-300">Current ad</p>
        <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">{creative.reviewStatus}</span>
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#1A1A1A] p-3">
        {creative.imageUrl && (
          <button
            type="button"
            onClick={() => setPreview(true)}
            title="Click to enlarge"
            className="relative group shrink-0 rounded-md overflow-hidden border border-white/10 hover:border-[#FFCC00]/60"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={creative.imageUrl} alt={creative.headline || "ad creative"} className="w-28 h-28 sm:w-36 sm:h-36 object-cover" />
            <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="w-3 h-3" /> Enlarge
            </span>
          </button>
        )}
        <div className="min-w-0">
          <p className="text-sm text-white">{creative.headline || <span className="text-gray-500 italic">No headline</span>}</p>
          {creative.body && <p className="text-xs text-gray-400 mt-1 line-clamp-3">{creative.body}</p>}
          {creative.landingUrl && <p className="text-xs text-gray-500 mt-1 truncate">→ {creative.landingUrl}</p>}
          <p className="text-[11px] text-gray-600 mt-1.5">To change the ad, edit it before launch (in the draft).</p>
        </div>
      </div>

      {preview && creative.imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(false)}>
          <button onClick={() => setPreview(false)} title="Close" className="absolute top-4 right-4 text-white/80 hover:text-white"><X className="w-6 h-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={creative.imageUrl} alt="ad creative full preview" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default CreativePreview;

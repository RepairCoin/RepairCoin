"use client";

import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Sparkles, Loader2, Play, Ban, X, ShieldCheck, Trash2 } from "lucide-react";
import {
  scanContent,
  deactivateFlaggedService,
  removeFlaggedReview,
  ContentModerationResult,
  FlaggedContent,
} from "@/services/api/contentModeration";

export const AdminContentModerationTab: React.FC = () => {
  const [result, setResult] = useState<ContentModerationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = async (refresh = false) => {
    refresh ? setScanning(true) : setLoading(true);
    try {
      const r = await scanContent(refresh);
      setResult(r);
      if (refresh) {
        toast.success(r ? `Scanned ${r.scannedServices + r.scannedReviews} items — ${r.flagged.length} flagged` : "Scan complete");
      }
    } catch {
      toast.error("Content scan failed");
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  const deactivate = async (item: FlaggedContent) => {
    setActioningId(item.id);
    try {
      await deactivateFlaggedService(item.id);
      toast.success("Service deactivated");
      setDismissed((s) => new Set(s).add(item.id));
    } catch {
      toast.error("Failed to deactivate");
    } finally {
      setActioningId(null);
    }
  };

  const removeReview = async (item: FlaggedContent) => {
    setActioningId(item.id);
    try {
      await removeFlaggedReview(item.id);
      toast.success("Review removed");
      setDismissed((s) => new Set(s).add(item.id));
    } catch {
      toast.error("Failed to remove review");
    } finally {
      setActioningId(null);
      setConfirmRemoveId(null);
    }
  };

  const flagged = (result?.flagged ?? []).filter((f) => !dismissed.has(f.id));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-[#FFCC00]" />
          <div>
            <h2 className="text-2xl font-bold text-white">Content Moderation</h2>
            <p className="text-gray-400 text-sm">
              AI-flagged service listings &amp; reviews for review.
            </p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={scanning}
          className="px-3 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-60"
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {scanning ? "Scanning…" : "Run scan now"}
        </button>
      </div>

      {result && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Services scanned" value={result.scannedServices} />
          <Stat label="Reviews scanned" value={result.scannedReviews} />
          <Stat label="Flagged" value={flagged.length} danger={flagged.length > 0} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
        </div>
      ) : flagged.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-green-700" />
          <p>No flagged content. {result ? "All scanned content looks clean." : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flagged.map((item) => (
            <div key={item.id} className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 uppercase">
                      {item.type}
                    </span>
                    {item.categories.map((c) => (
                      <span key={c} className="text-[11px] px-2 py-0.5 rounded-full border bg-red-500/15 text-red-400 border-red-500/40">
                        {c.replace(/[_/]/g, " ")}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-300 break-words">“{item.snippet}”</p>
                  {item.shopId && (
                    <p className="text-xs text-gray-500 mt-1 break-all">Shop: {item.shopId}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {item.type === "service" && (
                    <button
                      onClick={() => deactivate(item)}
                      disabled={actioningId === item.id}
                      className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {actioningId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                      Deactivate
                    </button>
                  )}
                  {item.type === "review" && (
                    confirmRemoveId === item.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => removeReview(item)}
                          disabled={actioningId === item.id}
                          className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {actioningId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="px-2 py-1.5 text-xs rounded-lg bg-[#101010] border border-gray-700 text-gray-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemoveId(item.id)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove review
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setDismissed((s) => new Set(s).add(item.id))}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[#101010] border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" /> Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-gray-600">
        Flagged by automated moderation — review before acting. Deactivate hides a service; Remove deletes a review permanently. Dismiss clears it from this list only (until the next scan).
      </p>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number; danger?: boolean }> = ({ label, value, danger }) => (
  <div className={`rounded-lg p-3 border ${danger ? "bg-red-900/20 border-red-500/40" : "bg-[#1A1A1A] border-gray-800"}`}>
    <p className="text-gray-400 text-xs">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${danger ? "text-red-400" : "text-white"}`}>{value}</p>
  </div>
);

export default AdminContentModerationTab;

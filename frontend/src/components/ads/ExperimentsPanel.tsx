"use client";

// Ads System Stage 5 — A/B experiments for a campaign (admin). Create experiments,
// view the per-creative arm report (leads / bookings / conversion), and declare a
// winner. Reads/writes /ads/campaigns/:id/experiments + /ads/experiments/:id/*.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, FlaskConical, Plus, Trophy } from "lucide-react";
import toast from "react-hot-toast";
import {
  listExperiments, createExperiment, getExperimentReport, setExperimentWinner,
  type AdExperiment, type ExperimentArm,
} from "@/services/api/ads";

export const ExperimentsPanel: React.FC<{ campaignId: string }> = ({ campaignId }) => {
  const [experiments, setExperiments] = useState<AdExperiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [reports, setReports] = useState<Record<string, ExperimentArm[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { setExperiments(await listExperiments(campaignId).catch(() => [])); }
    finally { setLoading(false); }
  }, [campaignId]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createExperiment(campaignId, name.trim());
      setName("");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't create experiment.");
    } finally {
      setCreating(false);
    }
  };

  const viewReport = async (id: string) => {
    try {
      const arms = await getExperimentReport(id);
      setReports((p) => ({ ...p, [id]: arms }));
    } catch (e: any) {
      toast.error(e?.message || "Couldn't load report.");
    }
  };

  const declareWinner = async (expId: string, creativeId: string) => {
    try {
      await setExperimentWinner(expId, creativeId);
      toast.success("Winner declared.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't set winner.");
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-400 text-sm py-3"><Loader2 className="w-4 h-4 animate-spin" /> Loading experiments…</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="w-4 h-4 text-[#FFCC00]" />
        <p className="text-sm font-medium text-gray-300">A/B Experiments</p>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New experiment name"
          className="flex-1 min-w-0 px-2.5 py-1.5 bg-[#0F0F0F] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00]"
        />
        <button
          onClick={create}
          disabled={creating || !name.trim()}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-white disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Create
        </button>
      </div>

      {experiments.length === 0 ? (
        <p className="text-xs text-gray-500">No experiments yet. Create one, then tag creatives with its id.</p>
      ) : (
        <div className="space-y-2">
          {experiments.map((exp) => (
            <div key={exp.id} className="rounded-lg border border-white/10 bg-[#1A1A1A] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-white">{exp.name}</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${exp.status === "ended" ? "bg-gray-700/40 text-gray-400" : "bg-green-500/15 text-green-400"}`}>{exp.status}</span>
                </div>
                <button onClick={() => viewReport(exp.id)} className="text-xs text-[#FFCC00] hover:text-[#E6B800]">View report</button>
              </div>

              {reports[exp.id] && (
                <div className="mt-2 space-y-1">
                  {reports[exp.id].length === 0 && <p className="text-xs text-gray-500">No creatives tagged to this experiment yet.</p>}
                  {reports[exp.id].map((arm) => (
                    <div key={arm.creativeId} className="flex items-center justify-between text-xs text-gray-300 border-t border-white/5 pt-1">
                      <span className="truncate flex items-center gap-1.5">
                        {exp.winnerCreativeId === arm.creativeId && <Trophy className="w-3 h-3 text-[#FFCC00]" />}
                        {arm.headline || arm.creativeId.slice(0, 8)}
                      </span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span>{arm.leads} leads</span>
                        <span>{arm.bookings} bk</span>
                        <span className="text-gray-400">{arm.conversionRate != null ? `${(arm.conversionRate * 100).toFixed(0)}%` : "—"}</span>
                        {exp.status !== "ended" && (
                          <button onClick={() => declareWinner(exp.id, arm.creativeId)} className="text-[#FFCC00] hover:text-[#E6B800]">Winner</button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExperimentsPanel;

"use client";

// Custom Workflows A2 — the Automation surface.
//
// A workflows LIST, not a card wall: Status, Total enrolled, Active enrolled, Last updated, Created —
// the shape a shop owner can scan to answer "what is running, and is anyone in it right now?".
//
// It reads the SAME engine as AI Campaigns and is separated only by `surface` (D7). Enrolled counts are
// derived from auto_message_sends, which has tracked per-customer step progress all along.

import React, { useEffect, useState } from "react";
import { Plus, Play, Pause, Pencil, Trash2, Workflow as WorkflowIcon, Search, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import {
  getAutoMessages,
  createAutoMessage,
  updateAutoMessage,
  deleteAutoMessage,
  AutoMessage,
  CreateAutoMessageRequest,
  UpdateAutoMessageRequest,
} from "@/services/api/messaging";
import { AutoMessageRuleModal } from "@/components/messaging/AutoMessageRuleModal";
import { WORKFLOW_TEMPLATES, WorkflowTemplateDraft } from "./workflowTemplates";

const EVENT_LABELS: Record<string, string> = {
  booking_completed: "Booking completed",
  booking_cancelled: "Booking cancelled",
  first_visit: "First visit",
  inactive_30_days: "Inactive 30 days",
  low_bookings: "Slow week",
};

function triggerLabel(w: AutoMessage): string {
  if (w.triggerType === "event") {
    const base = EVENT_LABELS[w.eventType || ""] || w.eventType || "Event";
    return w.delayHours ? `${base} + ${w.delayHours}h` : base;
  }
  const at = `${String(w.scheduleHour ?? 10).padStart(2, "0")}:00`;
  return `${w.scheduleType || "daily"} at ${at}`;
}

/** A workflow's shape in one line — how many steps and what they do. */
function stepsSummary(w: AutoMessage): string {
  if (!w.steps || w.steps.length === 0) {
    return w.actionType === "issue_reward"
      ? `Issue ${w.actionPayload?.amountRcn ?? "?"} RCN`
      : "Send a message";
  }
  return w.steps
    .map((s: any) => (s.actionType === "issue_reward" ? `${s.actionPayload?.amountRcn ?? "?"} RCN` : "Message"))
    .join(" → ");
}

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

export const WorkflowsList: React.FC = () => {
  const [workflows, setWorkflows] = useState<AutoMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AutoMessage | null>(null);
  const [creating, setCreating] = useState(false);
  // A3: the builder opened from a template — a prefill with no id, so it saves as a new workflow.
  const [fromTemplate, setFromTemplate] = useState<WorkflowTemplateDraft | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const load = async () => {
    try {
      setWorkflows(await getAutoMessages("workflow"));
    } catch {
      toast.error("Could not load workflows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (data: CreateAutoMessageRequest | UpdateAutoMessageRequest) => {
    try {
      if (editing) {
        await updateAutoMessage(editing.id, data as UpdateAutoMessageRequest);
        toast.success("Workflow updated");
      } else {
        // Stamp the surface so this rule belongs to Automation, not AI Campaigns (D7).
        await createAutoMessage({ ...(data as CreateAutoMessageRequest), surface: "workflow" });
        toast.success("Workflow created");
      }
      setEditing(null);
      setCreating(false);
      setFromTemplate(null);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Could not save workflow");
    }
  };

  const toggle = async (w: AutoMessage) => {
    try {
      await updateAutoMessage(w.id, { isActive: !w.isActive } as any);
      await load();
    } catch {
      toast.error("Could not change status");
    }
  };

  const remove = async (w: AutoMessage) => {
    if (!confirm(`Delete "${w.name}"? Customers already enrolled will stop mid-workflow.`)) return;
    try {
      await deleteAutoMessage(w.id);
      toast.success("Workflow deleted");
      await load();
    } catch {
      toast.error("Could not delete workflow");
    }
  };

  const shown = workflows.filter((w) => w.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Workflows</h2>
          <p className="text-sm text-gray-400">
            When something happens in your shop, do this — automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:border-[#FFCC00] hover:text-[#FFCC00] text-sm font-medium"
          >
            <Sparkles className="w-4 h-4" /> Start from a template
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FFCC00] hover:bg-[#E6B800] text-black text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Create workflow
          </button>
        </div>
      </div>

      {/* A3 — repair-shop templates. Shown on demand, and automatically when there's nothing yet:
          a blank canvas is the worst first screen for someone who has never built an automation. */}
      {(showTemplates || (!loading && workflows.length === 0)) && (
        <div className="rounded-lg border border-gray-800 bg-[#0D0D0D] p-4">
          <p className="text-sm text-gray-300 mb-3">
            Start from one of these — you can change the wording and timing before it goes live.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setFromTemplate(t.draft);
                  setShowTemplates(false);
                }}
                className="text-left rounded-lg border border-gray-700 bg-[#111] p-3 hover:border-[#FFCC00] transition-colors"
              >
                <p className="text-base text-white font-medium">{t.name}</p>
                <p className="text-sm text-gray-400 mt-1">{t.description}</p>
                <p className="text-xs text-[#FFCC00] mt-2">{t.shape}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search workflows"
          className="w-full pl-9 pr-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none"
        />
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-700 rounded-lg">
          <WorkflowIcon className="w-10 h-10 mx-auto mb-3 text-gray-600" />
          <p className="text-gray-300 text-base mb-1">
            {workflows.length === 0 ? "No workflows yet" : "No workflows match that search"}
          </p>
          {workflows.length === 0 && (
            <p className="text-gray-500 text-sm">
              Try: when a booking completes, wait 3 days, then issue a loyalty reward.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-[#0D0D0D] text-gray-400">
              <tr>
                <th className="text-left font-medium px-4 py-3">Name</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-right font-medium px-4 py-3">Total enrolled</th>
                <th className="text-right font-medium px-4 py-3">Active enrolled</th>
                <th className="text-left font-medium px-4 py-3">Last run</th>
                <th className="text-left font-medium px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((w) => (
                <tr key={w.id} className="border-t border-gray-800 hover:bg-[#141414]">
                  <td className="px-4 py-3">
                    <button onClick={() => setEditing(w)} className="text-white hover:text-[#FFCC00] text-left">
                      {w.name}
                    </button>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {triggerLabel(w)} → {stepsSummary(w)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                        w.isActive ? "bg-green-500/15 text-green-400" : "bg-gray-700/40 text-gray-400"
                      }`}
                    >
                      {w.isActive ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{w.totalEnrolled ?? 0}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{w.activeEnrolled ?? 0}</td>
                  <td className="px-4 py-3 text-gray-400">{fmtDate(w.lastSentAt)}</td>
                  <td className="px-4 py-3 text-gray-400">{fmtDate(w.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggle(w)} title={w.isActive ? "Pause" : "Activate"} className="p-2 text-gray-400 hover:text-white">
                        {w.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setEditing(w)} title="Edit" className="p-2 text-gray-400 hover:text-white">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove(w)} title="Delete" className="p-2 text-gray-400 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing || fromTemplate) && (
        <AutoMessageRuleModal
          rule={editing ?? fromTemplate}
          surface="workflow"
          onClose={() => {
            setCreating(false);
            setEditing(null);
            setFromTemplate(null);
          }}
          onSave={save}
        />
      )}
    </div>
  );
};

"use client";

// Custom Workflows A2 — the Automation surface.
//
// A workflows LIST, not a card wall: Status, Total enrolled, Active enrolled, Last updated, Created —
// the shape a shop owner can scan to answer "what is running, and is anyone in it right now?".
//
// It reads the SAME engine as AI Campaigns and is separated only by `surface` (D7). Enrolled counts are
// derived from auto_message_sends, which has tracked per-customer step progress all along.

import React, { useEffect, useState } from "react";
import { Plus, Play, Pause, Pencil, Trash2, Workflow as WorkflowIcon, Search, Sparkles, Zap, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import {
  getAutoMessages,
  createAutoMessage,
  updateAutoMessage,
  deleteAutoMessage,
  publishAutoMessage,
  getTemplateRelevance,
  getWorkflowMetrics,
  WorkflowMetrics,
  AutoMessage,
  CreateAutoMessageRequest,
  UpdateAutoMessageRequest,
} from "@/services/api/messaging";
import { AutoMessageRuleModal } from "@/components/messaging/AutoMessageRuleModal";
import { AutoMessageResults } from "@/components/messaging/autoMessageResults";
import { WORKFLOW_TEMPLATES, WorkflowTemplateDraft, WorkflowRelevance } from "./workflowTemplates";

const EVENT_LABELS: Record<string, string> = {
  booking_completed: "Booking completed",
  booking_cancelled: "Booking cancelled",
  first_visit: "First visit",
  inactive_30_days: "Inactive 30 days",
  low_bookings: "Slow week",
  no_show: "Customer no-show",
  review_received: "Review received",
  low_rating: "Low rating",
  payment_failed: "Payment failed",
  low_stock: "Low stock",
};

function triggerLabel(w: AutoMessage): string {
  if (w.triggerType === "event") {
    const base = EVENT_LABELS[w.eventType || ""] || w.eventType || "Event";
    return w.delayHours ? `${base} + ${w.delayHours}h` : base;
  }
  const at = `${String(w.scheduleHour ?? 10).padStart(2, "0")}:00`;
  return `${w.scheduleType || "daily"} at ${at}`;
}

/**
 * One action described in a few words. Shared by the rule-level and per-step summaries so they can't
 * disagree — the rule-level version previously fell through to "Send a message" for ANY non-reward
 * action, which mislabelled every notify_staff workflow in the list.
 */
function actionLabel(actionType: string | undefined, payload: any, short: boolean): string {
  switch (actionType) {
    case "issue_reward":
      return short ? `${payload?.amountRcn ?? "?"} RCN` : `Issue ${payload?.amountRcn ?? "?"} RCN`;
    case "notify_staff":
      return "Notify team";
    case "run_campaign":
      return short ? "Campaign" : "Send a campaign";
    default:
      return short ? "Message" : "Send a message";
  }
}

/** A workflow's shape in one line — how many steps and what they do. */
function stepsSummary(w: AutoMessage): string {
  if (!w.steps || w.steps.length === 0) {
    return actionLabel(w.actionType, w.actionPayload, false);
  }
  return w.steps.map((s: any) => actionLabel(s.actionType, s.actionPayload, true)).join(" → ");
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
  /**
   * This shop's own numbers behind each template's relevance line. Starts empty and stays empty on
   * failure — a card with no number shows no line, which is the whole integrity rule. Decision support
   * must never be able to stop the gallery from opening.
   */
  const [relevance, setRelevance] = useState<WorkflowRelevance>({});
  /** Outcome metrics per rule id, and the attribution window they were computed with. */
  const [metrics, setMetrics] = useState<Record<string, WorkflowMetrics>>({});
  const [attributionDays, setAttributionDays] = useState(14);

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
    // Fetched alongside the list rather than on gallery open: the gallery auto-opens for a shop with no
    // workflows, and fetching then would show the cards for a beat before their numbers appeared.
    getTemplateRelevance()
      .then(setRelevance)
      .catch(() => setRelevance({}));
    // Separate from the list: the attribution join is heavier, and the list must render without it.
    getWorkflowMetrics()
      .then((r) => {
        setMetrics(r.metrics ?? {});
        if (r.attributionDays) setAttributionDays(r.attributionDays);
      })
      .catch(() => setMetrics({}));
  }, []);

  /**
   * Arriving from an AI recommendation — "I recommend enabling the Win Back workflow" deep-links here with
   * ?template=<id>, and we open that template's builder prefilled.
   *
   * Runs once and strips the param, so a later back-navigation or refresh doesn't reopen the builder over
   * whatever the owner is doing by then. An unknown id opens the gallery rather than failing silently:
   * the recommendation still told them something true, it just named a template we no longer ship.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("template");
    if (!wanted) return;

    const match = WORKFLOW_TEMPLATES.find((t) => t.id === wanted);
    if (match) setFromTemplate(match.draft);
    else setShowTemplates(true);

    params.delete("template");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, []);

  const save = async (data: CreateAutoMessageRequest | UpdateAutoMessageRequest) => {
    try {
      if (editing) {
        await updateAutoMessage(editing.id, data as UpdateAutoMessageRequest);
        toast.success("Workflow updated");
      } else {
        // Stamp the surface so this rule belongs to Automation, not AI Campaigns (D7).
        // A4: workflows are born as DRAFTS. Save must not mean "go live" when the thing being
        // saved can message customers and issue RCN.
        await createAutoMessage({ ...(data as CreateAutoMessageRequest), surface: "workflow", status: "draft" });
        toast.success("Draft saved — publish it when you're ready");
      }
      setEditing(null);
      setCreating(false);
      setFromTemplate(null);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Could not save workflow");
    }
  };

  const publish = async (w: AutoMessage) => {
    const shape = stepsSummary(w);
    if (!confirm(`Publish "${w.name}"?\n\nIt will start running for real: ${shape}.`)) return;
    try {
      await publishAutoMessage(w.id);
      toast.success("Workflow published — it's live now");
      await load();
    } catch {
      toast.error("Could not publish workflow");
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

  // With no workflows yet the gallery opens on its own — a blank canvas is the worst first screen. In
  // that state the toggle button can only be a no-op, so it is hidden rather than sitting there doing
  // nothing on the very screen a new shop sees first.
  const galleryAutoOpen = !loading && workflows.length === 0;
  const galleryOpen = showTemplates || galleryAutoOpen;

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
          {!galleryAutoOpen && (
            <button
              onClick={() => setShowTemplates((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:border-[#FFCC00] hover:text-[#FFCC00] text-sm font-medium"
            >
              <Sparkles className="w-4 h-4" />
              {/* Label follows what the click will actually do — "Start from a template" while the
                  gallery is open would be describing the opposite of the outcome. */}
              {showTemplates ? "Hide templates" : "Start from a template"}
            </button>
          )}
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
      {galleryOpen && (
        <div className="rounded-lg border border-gray-800 bg-[#0D0D0D] p-4">
          <p className="text-sm text-gray-300 mb-3">
            Start from one of these — you can change the wording and timing before it goes live.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW_TEMPLATES.map((t) => {
              // Null when the number is missing or below the template's own floor — render nothing then.
              const applies = t.relevance?.(relevance) ?? null;
              const use = () => {
                setFromTemplate(t.draft);
                setShowTemplates(false);
              };
              return (
                <div
                  key={t.id}
                  onClick={use}
                  className="flex flex-col text-left rounded-lg border border-gray-700 bg-[#111] p-3 hover:border-[#FFCC00] transition-colors cursor-pointer"
                >
                  <p className="text-base text-white font-medium">{t.name}</p>
                  <p className="text-sm text-gray-400 mt-1">{t.description}</p>
                  <p className="text-sm text-gray-300 mt-2">{t.benefit}</p>

                  {/* This shop's own number. Stronger than a platform average, and it's true. */}
                  {applies && (
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-[#7ED957]">
                      <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{applies}</span>
                    </p>
                  )}

                  <p className="text-sm text-[#FFCC00] mt-2">{t.shape}</p>

                  {/* The whole card is clickable, but an explicit CTA is what makes "one click to start"
                      discoverable. It opens the editor prefilled — deliberately NOT straight to live:
                      a template can issue real RCN and message real customers, which is why
                      Draft -> Publish exists (migration 253). One click to START, not to go live. */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); use(); }}
                    className="mt-3 self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFCC00] text-black text-sm font-medium hover:bg-[#e6b800] transition-colors"
                  >
                    <Zap className="w-4 h-4" /> Use template
                  </button>
                </div>
              );
            })}
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
                    {/* Outcomes, so the workflow is measurable and not just configurable. Rendered as a
                        subtitle rather than four more columns — the table is already seven wide, and
                        these numbers are read together or not at all. */}
                    <AutoMessageResults
                      metrics={metrics[w.id]}
                      attributionDays={attributionDays}
                      className="mt-1"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {/* Three states, not two (A4): a draft is composed but inert, which is different
                        from a published workflow that's been paused. */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                        w.status === "draft"
                          ? "bg-amber-500/15 text-amber-400"
                          : w.isActive
                          ? "bg-green-500/15 text-green-400"
                          : "bg-gray-700/40 text-gray-400"
                      }`}
                    >
                      {w.status === "draft" ? "Draft" : w.isActive ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{w.totalEnrolled ?? 0}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{w.activeEnrolled ?? 0}</td>
                  <td className="px-4 py-3 text-gray-400">{fmtDate(w.lastSentAt)}</td>
                  <td className="px-4 py-3 text-gray-400">{fmtDate(w.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {w.status === "draft" ? (
                        // Publishing is the deliberate act that takes a workflow live — it will start
                        // sending real messages and issuing real RCN, so it gets its own button.
                        <button
                          onClick={() => publish(w)}
                          className="px-2.5 py-1 rounded text-xs font-medium bg-[#FFCC00] hover:bg-[#E6B800] text-black"
                        >
                          Publish
                        </button>
                      ) : (
                        <button onClick={() => toggle(w)} title={w.isActive ? "Pause" : "Resume"} className="p-2 text-gray-400 hover:text-white">
                          {w.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                      )}
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

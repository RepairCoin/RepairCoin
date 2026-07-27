"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Zap, Calendar, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AutoMessage, CreateAutoMessageRequest, UpdateAutoMessageRequest } from "@/services/api/messaging";
import { generateAutoMessageContent, getAutoMessageAbResults, type AbResults } from "@/services/api/messaging";
import toast from "react-hot-toast";

const SCHEDULE_TYPES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const EVENT_TYPES = [
  { value: "booking_completed", label: "Booking Completed" },
  { value: "booking_cancelled", label: "Booking Cancelled" },
  { value: "first_visit", label: "First Visit" },
  { value: "inactive_30_days", label: "Inactive 30 Days" },
  { value: "low_bookings", label: "Slow Week (low bookings)" },
];

const TARGET_AUDIENCES = [
  { value: "all", label: "All Customers" },
  { value: "active", label: "Active (last 30 days)" },
  { value: "inactive_30d", label: "Inactive (30+ days)" },
  { value: "has_balance", label: "Has RCN Balance" },
  { value: "completed_booking", label: "Completed a Booking" },
];

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TEMPLATE_VARIABLES = [
  { key: "{{customerName}}", label: "Customer Name" },
  { key: "{{rcnBalance}}", label: "RCN Balance" },
  { key: "{{shopName}}", label: "Shop Name" },
  { key: "{{lastServiceName}}", label: "Last Service" },
  { key: "{{lastVisitDate}}", label: "Last Visit Date" },
];

interface AutoMessageRuleModalProps {
  rule?: AutoMessage | null;
  onClose: () => void;
  onSave: (data: CreateAutoMessageRequest | UpdateAutoMessageRequest) => Promise<void>;
}

export const AutoMessageRuleModal: React.FC<AutoMessageRuleModalProps> = ({
  rule,
  onClose,
  onSave,
}) => {
  const isEditing = !!rule;
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [name, setName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [triggerType, setTriggerType] = useState<"schedule" | "event">("schedule");
  const [scheduleType, setScheduleType] = useState("daily");
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(1);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);
  const [scheduleHour, setScheduleHour] = useState(10);
  const [eventType, setEventType] = useState("booking_completed");
  const [delayHours, setDelayHours] = useState(24);
  const [targetAudience, setTargetAudience] = useState("all");
  const [maxSendsPerCustomer, setMaxSendsPerCustomer] = useState(1);
  // Drip sequence (multi-step) state. Sequences are event-triggered only.
  const [useSequence, setUseSequence] = useState(false);
  const [steps, setSteps] = useState<{ messageTemplate: string; delayHours: number }[]>([]);
  const [stopOnBooking, setStopOnBooking] = useState(false);
  const [generatingStep, setGeneratingStep] = useState<number | null>(null);
  // A/B test state (Phase 4). Mutually exclusive with sequences.
  const [useAbTest, setUseAbTest] = useState(false);
  const [variantB, setVariantB] = useState("");
  const [generatingB, setGeneratingB] = useState(false);
  const [abResults, setAbResults] = useState<AbResults | null>(null);

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setMessageTemplate(rule.messageTemplate);
      setTriggerType(rule.triggerType);
      setScheduleType(rule.scheduleType || "daily");
      setScheduleDayOfWeek(rule.scheduleDayOfWeek ?? 1);
      setScheduleDayOfMonth(rule.scheduleDayOfMonth ?? 1);
      setScheduleHour(rule.scheduleHour);
      setEventType(rule.eventType || "booking_completed");
      setDelayHours(rule.delayHours);
      setTargetAudience(rule.targetAudience);
      setMaxSendsPerCustomer(rule.maxSendsPerCustomer);
      const hasSteps = !!rule.steps && rule.steps.length > 0;
      setUseSequence(hasSteps);
      setSteps(hasSteps ? rule.steps!.map((s) => ({ ...s })) : []);
      setStopOnBooking(rule.stopOnBooking ?? false);
      setUseAbTest(!!rule.variantB);
      setVariantB(rule.variantB || "");
      // Load A/B results for an existing A/B rule.
      if (rule.variantB) {
        getAutoMessageAbResults(rule.id).then(setAbResults).catch(() => setAbResults(null));
      }
    }
  }, [rule]);

  const generateB = async () => {
    setGeneratingB(true);
    try {
      const { messageTemplate: text } = await generateAutoMessageContent({
        triggerType,
        eventType: triggerType === "event" ? eventType : undefined,
        targetAudience,
        name: name || undefined,
        prompt: "This is variant B of an A/B test — write a distinctly different angle from variant A.",
      });
      setVariantB(text);
      toast.success("AI drafted variant B");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Couldn't generate — please try again");
    } finally {
      setGeneratingB(false);
    }
  };

  const addStep = () =>
    setSteps((p) => [...p, { messageTemplate: "", delayHours: p.length === 0 ? 0 : 24 }]);
  const removeStep = (i: number) => setSteps((p) => p.filter((_, idx) => idx !== i));
  const updateStep = (i: number, patch: Partial<{ messageTemplate: string; delayHours: number }>) =>
    setSteps((p) => p.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const generateStep = async (i: number) => {
    setGeneratingStep(i);
    try {
      const { messageTemplate: text } = await generateAutoMessageContent({
        triggerType,
        eventType: triggerType === "event" ? eventType : undefined,
        targetAudience,
        name: name || undefined,
        prompt: `This is step ${i + 1} of a multi-step sequence. Keep it distinct from earlier steps.`,
      });
      updateStep(i, { messageTemplate: text });
      toast.success(`AI drafted step ${i + 1}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Couldn't generate — please try again");
    } finally {
      setGeneratingStep(null);
    }
  };

  const insertVariable = (variable: string) => {
    setMessageTemplate((prev) => prev + variable);
  };

  // AI-draft the message from the rule's current trigger/audience/name context.
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { messageTemplate: text } = await generateAutoMessageContent({
        triggerType,
        scheduleType: triggerType === "schedule" ? scheduleType : undefined,
        eventType: triggerType === "event" ? eventType : undefined,
        targetAudience,
        name: name || undefined,
      });
      setMessageTemplate(text);
      toast.success("AI drafted your message — edit as you like");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Couldn't generate a message — please try again");
    } finally {
      setGenerating(false);
    }
  };

  const resolvePreview = (template: string) => {
    return template
      .replace(/\{\{customerName\}\}/g, "John")
      .replace(/\{\{rcnBalance\}\}/g, "150")
      .replace(/\{\{shopName\}\}/g, "My Shop")
      .replace(/\{\{lastServiceName\}\}/g, "Oil Change")
      .replace(/\{\{lastVisitDate\}\}/g, "Mar 1, 2026");
  };

  // Sequences are event-triggered only (enrollment is wired into the event path).
  const sequenceMode = useSequence && triggerType === "event";
  // A/B works on any single-message rule; can't combine with a sequence.
  const abMode = useAbTest && !sequenceMode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let cleanSteps: { messageTemplate: string; delayHours: number }[] = [];
    if (sequenceMode) {
      cleanSteps = steps
        .map((s) => ({ messageTemplate: s.messageTemplate.trim(), delayHours: Number(s.delayHours) || 0 }))
        .filter((s) => s.messageTemplate);
      if (cleanSteps.length === 0) {
        toast.error("Add at least one step with a message");
        return;
      }
    } else if (!messageTemplate.trim()) {
      return;
    }

    setSaving(true);
    try {
      const data: CreateAutoMessageRequest = {
        name: name.trim(),
        // messageTemplate is required by the API; in a sequence it mirrors the first step.
        messageTemplate: sequenceMode ? cleanSteps[0].messageTemplate : messageTemplate.trim(),
        triggerType,
        ...(triggerType === "schedule" && {
          scheduleType,
          ...(scheduleType === "weekly" && { scheduleDayOfWeek }),
          ...(scheduleType === "monthly" && { scheduleDayOfMonth }),
          scheduleHour,
        }),
        ...(triggerType === "event" && {
          eventType,
          delayHours,
        }),
        targetAudience,
        maxSendsPerCustomer,
        // Send the sequence (or clear it when not in sequence mode).
        steps: sequenceMode ? cleanSteps : null,
        stopOnBooking: sequenceMode ? stopOnBooking : false,
        // A/B variant B (or clear it) — never alongside a sequence.
        variantB: abMode ? (variantB.trim() || null) : null,
      };
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">
            {isEditing ? "Edit Auto-Message Rule" : "New Auto-Message Rule"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Rule Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly Loyalty Reminder"
              maxLength={200}
              className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none"
            />
          </div>

          {/* Trigger Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Trigger Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTriggerType("schedule")}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  triggerType === "schedule"
                    ? "border-[#FFCC00] bg-[#FFCC00]/10 text-white"
                    : "border-gray-700 bg-[#0D0D0D] text-gray-400 hover:border-gray-500"
                }`}
              >
                <Calendar className="w-5 h-5 mb-1" />
                <p className="text-sm font-medium">Schedule</p>
                <p className="text-xs text-gray-500">Daily, weekly, or monthly</p>
              </button>
              <button
                type="button"
                onClick={() => setTriggerType("event")}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  triggerType === "event"
                    ? "border-[#FFCC00] bg-[#FFCC00]/10 text-white"
                    : "border-gray-700 bg-[#0D0D0D] text-gray-400 hover:border-gray-500"
                }`}
              >
                <Zap className="w-5 h-5 mb-1" />
                <p className="text-sm font-medium">Event</p>
                <p className="text-xs text-gray-500">After booking actions</p>
              </button>
            </div>
          </div>

          {/* Schedule Config */}
          {triggerType === "schedule" && (
            <div className="space-y-3 p-4 bg-[#0D0D0D] border border-gray-800 rounded-lg">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Frequency</label>
                <Select value={scheduleType} onValueChange={(value) => setScheduleType(value)}>
                  <SelectTrigger variant="dark" className="w-full px-3 py-2 h-auto bg-[#1A1A1A] border-gray-700 rounded-lg text-white text-sm">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent variant="dark">
                    {SCHEDULE_TYPES.map((t) => (
                      <SelectItem variant="dark" key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {scheduleType === "weekly" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Day of Week</label>
                  <Select value={String(scheduleDayOfWeek)} onValueChange={(value) => setScheduleDayOfWeek(parseInt(value))}>
                    <SelectTrigger variant="dark" className="w-full px-3 py-2 h-auto bg-[#1A1A1A] border-gray-700 rounded-lg text-white text-sm">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent variant="dark">
                      {DAYS_OF_WEEK.map((day, i) => (
                        <SelectItem variant="dark" key={i} value={String(i)}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {scheduleType === "monthly" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Day of Month</label>
                  <Select value={String(scheduleDayOfMonth)} onValueChange={(value) => setScheduleDayOfMonth(parseInt(value))}>
                    <SelectTrigger variant="dark" className="w-full px-3 py-2 h-auto bg-[#1A1A1A] border-gray-700 rounded-lg text-white text-sm">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent variant="dark">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <SelectItem variant="dark" key={d} value={String(d)}>{String(d)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-1">Send at (UTC Hour)</label>
                <Select value={String(scheduleHour)} onValueChange={(value) => setScheduleHour(parseInt(value))}>
                  <SelectTrigger variant="dark" className="w-full px-3 py-2 h-auto bg-[#1A1A1A] border-gray-700 rounded-lg text-white text-sm">
                    <SelectValue placeholder="Select hour" />
                  </SelectTrigger>
                  <SelectContent variant="dark">
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem variant="dark" key={i} value={String(i)}>
                        {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`} (UTC)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Event Config */}
          {triggerType === "event" && (
            <div className="space-y-3 p-4 bg-[#0D0D0D] border border-gray-800 rounded-lg">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Event</label>
                <Select value={eventType} onValueChange={(value) => setEventType(value)}>
                  <SelectTrigger variant="dark" className="w-full px-3 py-2 h-auto bg-[#1A1A1A] border-gray-700 rounded-lg text-white text-sm">
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent variant="dark">
                    {EVENT_TYPES.map((t) => (
                      <SelectItem variant="dark" key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Delay (hours after event)</label>
                <input
                  type="number"
                  value={delayHours}
                  onChange={(e) => setDelayHours(Math.max(0, parseInt(e.target.value) || 0))}
                  min={0}
                  max={720}
                  className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFCC00] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Target Audience */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Target Audience</label>
            <Select value={targetAudience} onValueChange={(value) => setTargetAudience(value)}>
              <SelectTrigger variant="dark" className="w-full px-3 py-2 h-auto bg-[#0D0D0D] border-gray-700 rounded-lg text-white text-sm">
                <SelectValue placeholder="Select audience" />
              </SelectTrigger>
              <SelectContent variant="dark">
                {TARGET_AUDIENCES.map((a) => (
                  <SelectItem variant="dark" key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Max Sends */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max sends per customer</label>
            <input
              type="number"
              value={maxSendsPerCustomer}
              onChange={(e) => setMaxSendsPerCustomer(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={100}
              className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFCC00] focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">How many times this rule can message the same customer</p>
          </div>

          {/* Advanced-mode toggles: a rule is a single message, OR a drip sequence, OR an A/B test. */}
          <div className="flex flex-col gap-1.5">
            {/* Multi-step sequence toggle (event triggers only — enrollment is event-driven) */}
            {triggerType === "event" && (
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSequence}
                  onChange={(e) => {
                    setUseSequence(e.target.checked);
                    if (e.target.checked) {
                      setUseAbTest(false); // sequence + A/B are mutually exclusive
                      if (steps.length === 0) setSteps([{ messageTemplate: messageTemplate || "", delayHours: 0 }]);
                    }
                  }}
                  className="accent-[#FFCC00]"
                />
                Multi-step sequence (drip) — send several messages over time
              </label>
            )}
            {/* A/B test toggle (any single-message rule) */}
            {!sequenceMode && (
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAbTest}
                  onChange={(e) => {
                    setUseAbTest(e.target.checked);
                    if (e.target.checked) setUseSequence(false);
                  }}
                  className="accent-[#FFCC00]"
                />
                A/B test — send two versions and compare which books more
              </label>
            )}
          </div>

          {sequenceMode ? (
            /* Sequence steps editor */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm text-gray-400">Sequence steps</label>
                <span className="text-xs text-gray-500">Sent in order, each after its wait</span>
              </div>
              {steps.map((s, i) => (
                <div key={i} className="rounded-lg border border-gray-700 bg-[#0D0D0D] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#FFCC00]">Step {i + 1}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => generateStep(i)}
                        disabled={generatingStep === i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-[#FFCC00] text-black hover:bg-[#e6b800] disabled:opacity-50"
                      >
                        {generatingStep === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        AI
                      </button>
                      {steps.length > 1 && (
                        <button type="button" onClick={() => removeStep(i)} className="text-gray-500 hover:text-red-400" aria-label="Remove step">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={s.messageTemplate}
                    onChange={(e) => updateStep(i, { messageTemplate: e.target.value })}
                    placeholder="Hi {{customerName}}! ..."
                    rows={3}
                    maxLength={2000}
                    className="w-full px-3 py-2 bg-[#111] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none resize-none"
                  />
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>Wait</span>
                    <input
                      type="number"
                      min={0}
                      value={s.delayHours}
                      onChange={(e) => updateStep(i, { delayHours: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-20 px-2 py-1 bg-[#111] border border-gray-700 rounded text-white focus:border-[#FFCC00] focus:outline-none"
                    />
                    <span>hours {i === 0 ? "after the trigger" : "after the previous step"}</span>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addStep}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-[#FFCC00] transition-colors"
              >
                <Plus className="w-4 h-4" /> Add step
              </button>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" checked={stopOnBooking} onChange={(e) => setStopOnBooking(e.target.checked)} className="accent-[#FFCC00]" />
                Stop the sequence if the customer books
              </label>
              <p className="text-xs text-gray-500">
                Available placeholders: {TEMPLATE_VARIABLES.map((v) => v.key).join(", ")}
              </p>
            </div>
          ) : (
            /* Single Message Template (= Variant A when A/B is on) */
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm text-gray-400">{abMode ? "Message — Variant A" : "Message Template"}</label>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  title="Let AI draft this message from the trigger + audience above"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-[#FFCC00] text-black hover:bg-[#e6b800] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {generating ? "Generating…" : "Generate with AI"}
                </button>
              </div>
              <textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Hi {{customerName}}! ..."
                rows={4}
                maxLength={2000}
                className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none resize-none"
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">{messageTemplate.length}/2000</p>
              </div>
              {/* Variable Buttons */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="px-2 py-1 text-xs bg-[#0D0D0D] border border-gray-700 rounded text-gray-400 hover:border-[#FFCC00] hover:text-[#FFCC00] transition-colors"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* A/B Variant B editor + results (single-message A/B rules) */}
          {abMode && (
            <div className="space-y-2 rounded-lg border border-gray-700 bg-[#0D0D0D] p-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm text-gray-400">Message — Variant B</label>
                <button
                  type="button"
                  onClick={generateB}
                  disabled={generatingB}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-[#FFCC00] text-black hover:bg-[#e6b800] disabled:opacity-50"
                >
                  {generatingB ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {generatingB ? "Generating…" : "Generate with AI"}
                </button>
              </div>
              <textarea
                value={variantB}
                onChange={(e) => setVariantB(e.target.value)}
                placeholder="A different angle from Variant A…"
                rows={4}
                maxLength={2000}
                className="w-full px-3 py-2 bg-[#111] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none resize-none"
              />
              <p className="text-xs text-gray-500">{variantB.length}/2000 · Each send is split 50/50 between A and B.</p>
              {abResults && abResults.results.length > 0 && (
                <div className="mt-1 border-t border-gray-800 pt-2">
                  <p className="text-xs text-gray-400 mb-1">Results so far (booked within 7 days of send):</p>
                  {abResults.results.map((r) => (
                    <div key={r.variant} className="flex justify-between text-xs text-gray-300">
                      <span>Variant {r.variant}</span>
                      <span>
                        {r.sends} sent · {r.conversions} booked ({r.sends ? Math.round((r.conversions / r.sends) * 100) : 0}%)
                      </span>
                    </div>
                  ))}
                  <p className="text-[11px] text-gray-500 mt-1">An indicator, not proof — bookings may have other causes.</p>
                </div>
              )}
            </div>
          )}

          {/* Preview (single-message mode only; the sequence editor shows each step inline) */}
          {!sequenceMode && messageTemplate.trim() && (
            <div className="p-3 bg-[#0D0D0D] border border-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Preview (sample data):</p>
              <p className="text-sm text-white">{resolvePreview(messageTemplate)}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-[#0D0D0D] border border-gray-700 rounded-lg text-gray-300 text-sm hover:border-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !messageTemplate.trim()}
            className="flex-1 px-4 py-2.5 bg-[#FFCC00] rounded-lg text-black text-sm font-medium hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Saving..." : isEditing ? "Update Rule" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
};

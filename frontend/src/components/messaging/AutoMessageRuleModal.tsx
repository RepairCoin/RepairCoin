"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Zap, Calendar } from "lucide-react";
import type { AutoMessage, CreateAutoMessageRequest, UpdateAutoMessageRequest } from "@/services/api/messaging";

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
    }
  }, [rule]);

  const insertVariable = (variable: string) => {
    setMessageTemplate((prev) => prev + variable);
  };

  const resolvePreview = (template: string) => {
    return template
      .replace(/\{\{customerName\}\}/g, "John")
      .replace(/\{\{rcnBalance\}\}/g, "150")
      .replace(/\{\{shopName\}\}/g, "My Shop")
      .replace(/\{\{lastServiceName\}\}/g, "Oil Change")
      .replace(/\{\{lastVisitDate\}\}/g, "Mar 1, 2026");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !messageTemplate.trim()) return;

    setSaving(true);
    try {
      const data: CreateAutoMessageRequest = {
        name: name.trim(),
        messageTemplate: messageTemplate.trim(),
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
                <select
                  value={scheduleType}
                  onChange={(e) => setScheduleType(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFCC00] focus:outline-none"
                >
                  {SCHEDULE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {scheduleType === "weekly" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Day of Week</label>
                  <select
                    value={scheduleDayOfWeek}
                    onChange={(e) => setScheduleDayOfWeek(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFCC00] focus:outline-none"
                  >
                    {DAYS_OF_WEEK.map((day, i) => (
                      <option key={i} value={i}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              {scheduleType === "monthly" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Day of Month</label>
                  <select
                    value={scheduleDayOfMonth}
                    onChange={(e) => setScheduleDayOfMonth(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFCC00] focus:outline-none"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-1">Send at (UTC Hour)</label>
                <select
                  value={scheduleHour}
                  onChange={(e) => setScheduleHour(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFCC00] focus:outline-none"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`} (UTC)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Event Config */}
          {triggerType === "event" && (
            <div className="space-y-3 p-4 bg-[#0D0D0D] border border-gray-800 rounded-lg">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Event</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFCC00] focus:outline-none"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
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
            <select
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFCC00] focus:outline-none"
            >
              {TARGET_AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
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

          {/* Message Template */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Message Template</label>
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

          {/* Preview */}
          {messageTemplate.trim() && (
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

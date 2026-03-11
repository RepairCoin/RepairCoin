"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Loader2,
  Zap,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Trash2,
  Clock,
  Send,
  Users,
  AlertCircle,
} from "lucide-react";
import * as messagingApi from "@/services/api/messaging";
import type {
  AutoMessage,
  CreateAutoMessageRequest,
  UpdateAutoMessageRequest,
} from "@/services/api/messaging";
import { AutoMessageRuleModal } from "./AutoMessageRuleModal";

const AUDIENCE_LABELS: Record<string, string> = {
  all: "All Customers",
  active: "Active (30d)",
  inactive_30d: "Inactive (30d+)",
  has_balance: "Has RCN Balance",
  completed_booking: "Completed Booking",
};

const EVENT_LABELS: Record<string, string> = {
  booking_completed: "Booking Completed",
  booking_cancelled: "Booking Cancelled",
  first_visit: "First Visit",
  inactive_30_days: "Inactive 30 Days",
};

export const AutoMessagesManager: React.FC = () => {
  const [rules, setRules] = useState<AutoMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoMessage | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      setError(null);
      const data = await messagingApi.getAutoMessages();
      setRules(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load auto-message rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleSave = async (data: CreateAutoMessageRequest | UpdateAutoMessageRequest) => {
    if (editingRule) {
      await messagingApi.updateAutoMessage(editingRule.id, data as UpdateAutoMessageRequest);
    } else {
      await messagingApi.createAutoMessage(data as CreateAutoMessageRequest);
    }
    setShowModal(false);
    setEditingRule(null);
    await fetchRules();
  };

  const handleToggle = async (rule: AutoMessage) => {
    setTogglingId(rule.id);
    try {
      await messagingApi.toggleAutoMessage(rule.id);
      await fetchRules();
    } catch (err: any) {
      setError(err?.message || "Failed to toggle rule");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (rule: AutoMessage) => {
    if (!confirm(`Delete "${rule.name}"? This will also remove all send history.`)) return;
    setDeletingId(rule.id);
    try {
      await messagingApi.deleteAutoMessage(rule.id);
      await fetchRules();
    } catch (err: any) {
      setError(err?.message || "Failed to delete rule");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (rule: AutoMessage) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingRule(null);
    setShowModal(true);
  };

  const formatSchedule = (rule: AutoMessage): string => {
    if (rule.triggerType === "event") {
      const eventLabel = EVENT_LABELS[rule.eventType || ""] || rule.eventType;
      return rule.delayHours > 0
        ? `${eventLabel} (+${rule.delayHours}h delay)`
        : eventLabel || "Event";
    }

    const hour = rule.scheduleHour;
    const timeStr =
      hour === 0 ? "12:00 AM" : hour < 12 ? `${hour}:00 AM` : hour === 12 ? "12:00 PM" : `${hour - 12}:00 PM`;

    switch (rule.scheduleType) {
      case "daily":
        return `Daily at ${timeStr} UTC`;
      case "weekly": {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return `${days[rule.scheduleDayOfWeek ?? 0]} at ${timeStr} UTC`;
      }
      case "monthly":
        return `${rule.scheduleDayOfMonth ?? 1}${ordinalSuffix(rule.scheduleDayOfMonth ?? 1)} of month at ${timeStr} UTC`;
      default:
        return "Schedule";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Auto-Messages</h3>
          <p className="text-sm text-gray-400">
            Automatically send messages to customers on a schedule or after events
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-[#FFCC00] rounded-lg text-black text-sm font-medium hover:bg-[#FFD700] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="text-center py-16 bg-[#1A1A1A] border border-gray-800 rounded-lg">
          <Send className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No auto-message rules yet</p>
          <p className="text-gray-500 text-xs mt-1">
            Create a rule to automatically message your customers
          </p>
          <button
            onClick={handleCreate}
            className="mt-4 px-4 py-2 bg-[#FFCC00] rounded-lg text-black text-sm font-medium hover:bg-[#FFD700] transition-colors"
          >
            Create First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`bg-[#1A1A1A] border rounded-lg p-4 transition-colors ${
                rule.isActive ? "border-gray-800" : "border-gray-800/50 opacity-60"
              }`}
            >
              {/* Top Row: Name + Toggle */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {rule.triggerType === "schedule" ? (
                    <Calendar className="w-4 h-4 text-[#FFCC00]" />
                  ) : (
                    <Zap className="w-4 h-4 text-blue-400" />
                  )}
                  <h4 className="text-white font-medium text-sm">{rule.name}</h4>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      rule.isActive
                        ? "bg-green-500/10 text-green-400"
                        : "bg-gray-700/50 text-gray-500"
                    }`}
                  >
                    {rule.isActive ? "Active" : "Paused"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(rule)}
                    disabled={togglingId === rule.id}
                    className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    title={rule.isActive ? "Pause rule" : "Activate rule"}
                  >
                    {togglingId === rule.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : rule.isActive ? (
                      <ToggleRight className="w-6 h-6 text-green-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleEdit(rule)}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Edit rule"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(rule)}
                    disabled={deletingId === rule.id}
                    className="p-1.5 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Delete rule"
                  >
                    {deletingId === rule.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Message Preview */}
              <p className="text-gray-400 text-xs mb-3 line-clamp-2">
                {rule.messageTemplate}
              </p>

              {/* Meta Row */}
              <div className="flex items-center flex-wrap gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatSchedule(rule)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {AUDIENCE_LABELS[rule.targetAudience] || rule.targetAudience}
                </span>
                <span className="flex items-center gap-1">
                  <Send className="w-3.5 h-3.5" />
                  {rule.totalSends ?? 0} sent
                </span>
                {rule.lastSentAt && (
                  <span className="text-gray-600">
                    Last: {new Date(rule.lastSentAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <AutoMessageRuleModal
          rule={editingRule}
          onClose={() => {
            setShowModal(false);
            setEditingRule(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

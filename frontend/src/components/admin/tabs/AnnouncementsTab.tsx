"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Megaphone, Store, Users, Globe, Send, Loader2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { adminApi } from "@/services/api/admin";

type Audience = "shops" | "customers" | "all";

interface AudienceCounts {
  shops: number;
  customers: number;
  all: number;
}

const MAX_TITLE = 80;
const MAX_MESSAGE = 500;

export function AnnouncementsTab() {
  const [counts, setCounts] = useState<AudienceCounts | null>(null);
  const [audience, setAudience] = useState<Audience>("shops");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const loadCounts = useCallback(async () => {
    try {
      const res = await adminApi.getAudienceCounts();
      if (res?.success) setCounts(res.data);
    } catch (err) {
      console.error("Failed to load audience counts:", err);
    }
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const recipientCount = counts ? counts[audience] : undefined;

  const send = async () => {
    setSending(true);
    try {
      const res = await adminApi.sendBroadcast({
        audience,
        title: title.trim() || undefined,
        message: message.trim(),
      });
      if (res?.success) {
        toast.success(
          `Announcement sent — delivered to ${res.data?.delivered ?? 0} of ${res.data?.recipients ?? 0} recipients`
        );
        setTitle("");
        setMessage("");
        setConfirming(false);
      } else {
        toast.error(res?.error || "Failed to send announcement");
      }
    } catch (err) {
      console.error("Broadcast failed:", err);
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(msg || "Failed to send announcement");
    } finally {
      setSending(false);
    }
  };

  const audiences: { key: Audience; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { key: "shops", label: "Shops", icon: Store, count: counts?.shops },
    { key: "customers", label: "Customers", icon: Users, count: counts?.customers },
    { key: "all", label: "Everyone", icon: Globe, count: counts?.all },
  ];

  const canSend = message.trim().length > 0 && message.length <= MAX_MESSAGE && title.length <= MAX_TITLE;

  return (
    <div>
      <DashboardHeader
        title="Announcements"
        subtitle="Broadcast a platform announcement to shops and customers (in-app, real-time, and push)"
        icon={Megaphone}
        gradientFrom="from-pink-500"
        gradientTo="to-rose-600"
      />

      <div className="max-w-2xl space-y-6">
        {/* Audience */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Send to</label>
          <div className="grid grid-cols-3 gap-3">
            {audiences.map((a) => {
              const Icon = a.icon;
              const active = audience === a.key;
              return (
                <button
                  key={a.key}
                  onClick={() => setAudience(a.key)}
                  className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-colors ${
                    active
                      ? "bg-pink-500/10 border-pink-500/50 text-white"
                      : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? "text-pink-400" : "text-gray-500"}`} />
                  <span className="text-sm font-medium">{a.label}</span>
                  <span className="text-xs text-gray-500">
                    {a.count !== undefined ? `${a.count.toLocaleString()} recipients` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">Title (optional)</label>
            <span className={`text-xs ${title.length > MAX_TITLE ? "text-red-400" : "text-gray-500"}`}>
              {title.length}/{MAX_TITLE}
            </span>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="RepairCoin Announcement"
            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-pink-500/50"
          />
        </div>

        {/* Message */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">Message</label>
            <span className={`text-xs ${message.length > MAX_MESSAGE ? "text-red-400" : "text-gray-500"}`}>
              {message.length}/{MAX_MESSAGE}
            </span>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Write your announcement… (e.g. scheduled maintenance, policy change, new feature)"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-pink-500/50 resize-none"
          />
        </div>

        {/* Send */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Recipients who muted announcements in their preferences won't receive it.
          </p>
          <button
            onClick={() => setConfirming(true)}
            disabled={!canSend}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            Send Announcement
          </button>
        </div>
      </div>

      {/* Confirmation modal */}
      {confirming && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-500/10 rounded-lg">
                <Megaphone className="w-5 h-5 text-pink-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Send this announcement?</h3>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              {title.trim() && <p className="text-white text-sm font-semibold mb-1">{title.trim()}</p>}
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{message.trim()}</p>
            </div>
            <p className="text-sm text-gray-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
              Broadcasting to{" "}
              <strong className="text-white">
                {recipientCount !== undefined ? `~${recipientCount.toLocaleString()} ` : ""}
                {audience === "all" ? "recipients (shops + customers)" : audience}
              </strong>
              .
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirming(false)}
                disabled={sending}
                className="flex-1 py-2.5 border border-gray-700 text-gray-300 hover:bg-gray-800 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending}
                className="flex-1 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending…
                  </>
                ) : (
                  "Send Now"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnnouncementsTab;

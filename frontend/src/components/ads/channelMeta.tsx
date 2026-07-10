// Single source of truth for how each lead channel is labelled + iconed across the ads UI
// (per-channel performance table + the Kanban/inbox channel badge). Keep in lockstep with the
// backend deriveLeadChannel (messenger_id/whatsapp_id/gclid/meta_lead_id → channel).

import React from "react";
import { MessageCircle, Globe, Search, FileText, Phone } from "lucide-react";
import type { LeadChannel } from "@/services/api/ads";

export const CHANNEL_META: Record<LeadChannel, { label: string; Icon: React.ComponentType<{ className?: string }>; color: string }> = {
  messenger: { label: "Messenger", Icon: MessageCircle, color: "text-[#0084FF]" },
  whatsapp: { label: "WhatsApp", Icon: Phone, color: "text-[#25D366]" },
  google: { label: "Google", Icon: Search, color: "text-[#EA4335]" },
  meta_form: { label: "Instant form", Icon: FileText, color: "text-[#FFCC00]" },
  webform: { label: "Web form", Icon: Globe, color: "text-gray-300" },
};

export const channelMeta = (channel?: LeadChannel | null) => CHANNEL_META[channel ?? "webform"] ?? CHANNEL_META.webform;

// Compact pill for a single lead (Kanban card / inbox row).
export const ChannelBadge: React.FC<{ channel?: LeadChannel | null; className?: string }> = ({ channel, className }) => {
  const m = channelMeta(channel);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] font-medium text-gray-200 ${className ?? ""}`}
      title={`Lead source: ${m.label}`}
    >
      <m.Icon className={`w-3 h-3 ${m.color}`} /> {m.label}
    </span>
  );
};

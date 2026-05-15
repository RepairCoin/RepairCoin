"use client";

import { User } from "lucide-react";

/**
 * HumanStaffLabel
 *
 * Small disclosure label rendered above a shop-side message bubble that
 * was authored by a real shop staff member (not the AI sales agent).
 * Companion to AIMessageLabel — together they let the customer (and
 * shop staff in their own dashboard) tell at a glance "who said this"
 * when a conversation has mixed AI + human authorship.
 *
 * Detection rule used by callers: message.senderType === "shop" AND
 * message.metadata.generated_by !== "ai_agent". The orchestrator
 * stamps generated_by="ai_agent" on every reply it inserts; manual
 * staff replies through the dashboard chat lack that stamp.
 *
 * Visual: muted yellow/amber to read as "shop team" — contrasts with
 * AIMessageLabel's violet so the two are scannable as distinct sources
 * without competing with the message bubble itself.
 */

export interface HumanStaffLabelProps {
  className?: string;
}

const TOOLTIP_TEXT =
  "This reply was sent by a real team member at the shop, not the AI assistant.";

export function HumanStaffLabel({ className = "" }: HumanStaffLabelProps) {
  return (
    <div
      title={TOOLTIP_TEXT}
      aria-label={TOOLTIP_TEXT}
      className={`inline-flex items-center gap-1 text-[10px] font-medium text-amber-300/90 mb-1 ${className}`}
    >
      <User className="w-3 h-3" aria-hidden="true" />
      <span>Team member</span>
    </div>
  );
}

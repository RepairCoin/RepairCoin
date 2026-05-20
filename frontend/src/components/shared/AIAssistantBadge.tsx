"use client";

import { Bot } from "lucide-react";

/**
 * AIAssistantBadge
 *
 * Customer-facing visual disclosure that a service has the AI Sales Assistant
 * enabled. Shown next to service titles on the marketplace card and in the
 * service detail view. Tooltip explains what AI participation means so the
 * customer isn't surprised when their first reply comes from a bot.
 *
 * Phase 3 Task 9. Pairs with `AIMessageLabel` (which marks individual AI
 * messages inside a chat thread).
 *
 * Variants:
 *   - "compact" (default): small pill, fits inline next to a category badge
 *     on a marketplace card
 *   - "default": slightly larger pill with longer label, fits next to a
 *     service title in the detail modal
 */

export interface AIAssistantBadgeProps {
  variant?: "compact" | "default";
  className?: string;
  /**
   * Override the default tooltip text. The default is customer-facing
   * ("This shop uses an AI assistant…"). Pass a shop-facing string when
   * rendering this badge inside a shop dashboard surface (e.g. the
   * Services grid) so the wording matches the audience.
   */
  tooltip?: string;
}

const DEFAULT_TOOLTIP =
  "This shop uses an AI assistant to reply quickly. You can always ask for a human if you'd like.";

export function AIAssistantBadge({
  variant = "compact",
  className = "",
  tooltip,
}: AIAssistantBadgeProps) {
  const isCompact = variant === "compact";
  const sizeClasses = isCompact
    ? "text-[10px] px-2 py-0.5 gap-1"
    : "text-xs px-2.5 py-1 gap-1.5";
  const iconSize = isCompact ? "w-3 h-3" : "w-3.5 h-3.5";
  const tooltipText = tooltip ?? DEFAULT_TOOLTIP;

  return (
    <span
      title={tooltipText}
      aria-label={tooltipText}
      className={`inline-flex items-center font-semibold rounded-full bg-violet-500/10 border border-violet-400/30 text-violet-300 ${sizeClasses} ${className}`}
    >
      <Bot className={iconSize} aria-hidden="true" />
      {isCompact ? "AI" : "AI-assisted"}
    </span>
  );
}

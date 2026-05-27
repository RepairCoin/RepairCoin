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
  /**
   * Optional — shop-level AI gate state. When provided and `false`, the
   * badge renders in a muted gray variant + overrides the tooltip to
   * explain the gate. Use on shop-side surfaces (e.g. ServicesTab) where
   * the shop owner can see this info and act on it; do NOT pass on
   * customer-facing surfaces (ServiceCard etc.) — customers don't have
   * the shop's settings in scope.
   *
   * Behavior:
   *   - undefined or true → existing violet "AI enabled" rendering
   *   - false              → gray rendering + "Shop AI not yet
   *     activated" tooltip; badge stays visible so the shop owner sees
   *     the per-service intent but understands it isn't firing.
   *
   * See docs/tasks/ai-ux-shop-gate-clarity.md for context.
   */
  shopAiEnabled?: boolean;
}

const DEFAULT_TOOLTIP =
  "This shop uses an AI assistant to reply quickly. You can always ask for a human if you'd like.";

const SHOP_GATE_OFF_TOOLTIP =
  "AI is configured for this service but your shop's AI Sales Agent isn't activated yet. Contact RepairCoin to enable it.";

export function AIAssistantBadge({
  variant = "compact",
  className = "",
  tooltip,
  shopAiEnabled,
}: AIAssistantBadgeProps) {
  const isCompact = variant === "compact";
  const sizeClasses = isCompact
    ? "text-[10px] px-2 py-0.5 gap-1"
    : "text-xs px-2.5 py-1 gap-1.5";
  const iconSize = isCompact ? "w-3 h-3" : "w-3.5 h-3.5";

  // Muted state — service is configured for AI but the shop-level gate
  // is off, so AI won't actually fire. Only kicks in when the caller
  // explicitly passes `shopAiEnabled={false}`; undefined preserves the
  // existing violet rendering (customer-facing call sites).
  const isGated = shopAiEnabled === false;
  const colorClasses = isGated
    ? "bg-gray-500/10 border-gray-500/30 text-gray-400"
    : "bg-violet-500/10 border-violet-400/30 text-violet-300";
  const tooltipText = isGated
    ? SHOP_GATE_OFF_TOOLTIP
    : (tooltip ?? DEFAULT_TOOLTIP);

  return (
    <span
      title={tooltipText}
      aria-label={tooltipText}
      className={`inline-flex items-center font-semibold rounded-full ${colorClasses} ${sizeClasses} ${className}`}
    >
      <Bot className={iconSize} aria-hidden="true" />
      {isCompact ? "AI" : "AI-assisted"}
    </span>
  );
}

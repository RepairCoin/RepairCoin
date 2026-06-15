"use client";

// Shop "Plans & Billing" hub (add-on access — Phase 0 + 1).
// One front door for the subscription + the add-on catalog. The catalog renders from
// ADDON_REGISTRY; per-shop status comes from resolveAddonStatuses(). Operational config
// lives in each feature and is reached via deep-links (manageLink). Built add-ons are
// usable; not-yet-built ones render as disabled "Coming soon" cards.
// Style matches the dark dashboard tabs (sibling ShopAdsTab); shadcn Card would clash
// with the dark surface, so raw Tailwind is used for visual consistency.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, CreditCard } from "lucide-react";
import { ADDON_REGISTRY, type AddonDef } from "@/config/addonRegistry";
import {
  resolveAddonStatuses,
  getAiUsageSummary,
  getPaymentMethod,
  type AddonStatusMap,
  type AddonStatus,
  type AiUsageSummary,
  type PaymentMethodSummary,
} from "@/services/api/addons";

export interface ShopPlansBillingTabProps {
  /** Current subscription label, e.g. "Standard — $500/mo". From shopData when available. */
  planLabel?: string;
  /** Whether the subscription is active (drives the YOUR PLAN status dot). */
  subscriptionActive?: boolean;
  /** Raw subscription status (active/cancelled/paused/…) from shopData. */
  subscriptionStatus?: string | null;
  /** ISO date access ends / renews (period end), from shopData. */
  subscriptionEndsAt?: string | null;
  /** ISO date the subscription was cancelled, from shopData (drives the wind-down notice). */
  subscriptionCancelledAt?: string | null;
}

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_BADGE: Record<AddonStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  off: { label: "Not enabled", cls: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  coming_soon: { label: "Coming soon", cls: "bg-gray-500/10 text-gray-500 border-gray-600/30" },
};

export const ShopPlansBillingTab: React.FC<ShopPlansBillingTabProps> = ({
  planLabel,
  subscriptionActive,
  subscriptionStatus,
  subscriptionEndsAt,
  subscriptionCancelledAt,
}) => {
  const [statuses, setStatuses] = useState<AddonStatusMap>({});
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);
  const [card, setCard] = useState<PaymentMethodSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [s, u, pm] = await Promise.all([
        resolveAddonStatuses(),
        getAiUsageSummary(),
        getPaymentMethod(),
      ]);
      if (!active) return;
      setStatuses(s);
      setUsage(u);
      setCard(pm);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-10">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your plan…
      </div>
    );
  }

  const pct = usage ? Math.min(100, Math.round(usage.percentUsed * 100)) : 0;
  const endsLabel = formatDate(subscriptionEndsAt);
  const isCancelled = !!subscriptionCancelledAt || subscriptionStatus === "cancelled";
  const statusText = isCancelled
    ? "Cancelled"
    : subscriptionActive
    ? "Active"
    : subscriptionStatus
    ? subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)
    : "No active subscription";

  return (
    <div className="space-y-6">
      {/* YOUR PLAN */}
      <section className="rounded-xl border border-gray-700 bg-gray-800/40 p-5">
        <h2 className="text-base font-semibold text-white mb-3">Your Plan</h2>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                isCancelled ? "bg-amber-400" : subscriptionActive ? "bg-green-400" : "bg-gray-500"
              }`}
            />
            <span className="text-sm text-gray-200">
              {planLabel || (subscriptionActive ? "Active subscription" : "No active subscription")}
            </span>
            <span className="text-xs text-gray-400">· {statusText}</span>
          </div>
          {/* Change-plan deep-link — tiered plans land with the P0 subscription work. */}
          <Link
            href="/shop?tab=settings"
            className="text-sm text-yellow-400 hover:text-yellow-300 underline-offset-2 hover:underline"
          >
            Manage subscription
          </Link>
        </div>

        {endsLabel && (
          <p className="text-sm text-gray-400 mt-2">
            {isCancelled ? `Access ends ${endsLabel}` : `Renews ${endsLabel}`}
          </p>
        )}

        {usage && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-300 mb-1">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-yellow-400" /> AI usage this month
              </span>
              <span>
                ${usage.spentUsd.toFixed(2)} / ${usage.budgetUsd.toFixed(2)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  pct >= 100 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-green-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* ADD-ONS */}
      <section>
        <h2 className="text-base font-semibold text-white mb-3">Add-ons</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Per-card featureFlag gating, when needed, must use a STATIC
              process.env.NEXT_PUBLIC_* reference (Next only inlines those) — a
              dynamic lookup won't work in the browser bundle. No flagged entries
              today; the whole hub is gated at the sidebar via NEXT_PUBLIC_ADDON_HUB_ENABLED. */}
          {ADDON_REGISTRY.map((addon) => (
            <AddonCard key={addon.id} addon={addon} status={statuses[addon.id] ?? "coming_soon"} />
          ))}
        </div>
      </section>

      {/* BILLING */}
      <section className="rounded-xl border border-gray-700 bg-gray-800/40 p-5">
        <h2 className="text-base font-semibold text-white mb-3">Billing</h2>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="w-4 h-4 text-gray-400" />
            {card ? (
              <span className="text-gray-200">
                <span className="capitalize">{card.brand}</span> •••• {card.last4}
                {card.expMonth && card.expYear && (
                  <span className="text-gray-400">
                    {" "}
                    · expires {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-gray-400">No card on file</span>
            )}
          </div>
          <Link
            href="/shop?tab=settings"
            className="text-sm text-yellow-400 hover:text-yellow-300 underline-offset-2 hover:underline"
          >
            Manage billing
          </Link>
        </div>
      </section>
    </div>
  );
};

const AddonCard: React.FC<{ addon: AddonDef; status: AddonStatus }> = ({ addon, status }) => {
  const badge = STATUS_BADGE[status];
  const isComingSoon = status === "coming_soon";

  // CTA: active/pending → manage (deep-link); off → activate (deep-link); coming_soon → disabled.
  const ctaLabel =
    status === "active"
      ? "Manage"
      : status === "pending"
      ? "View request"
      : addon.ctaLabel;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{addon.displayName}</h3>
          <p className="text-sm text-gray-400 mt-0.5">{addon.priceLabel}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.cls}`}>
          {badge.label}
        </span>
      </div>
      <p className="text-sm text-gray-300 leading-relaxed">{addon.description}</p>
      <div className="mt-auto pt-1">
        {isComingSoon || !addon.manageLink ? (
          <button
            disabled
            className="text-sm px-3 py-1.5 rounded-lg bg-gray-700/50 text-gray-500 cursor-not-allowed"
          >
            {isComingSoon ? "Coming soon" : ctaLabel}
          </button>
        ) : (
          <Link
            href={addon.manageLink}
            className="inline-block text-sm px-3 py-1.5 rounded-lg bg-yellow-400 text-gray-900 font-medium hover:bg-yellow-300 transition-colors"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
};

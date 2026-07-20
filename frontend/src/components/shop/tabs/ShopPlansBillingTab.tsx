"use client";

// Shop "Plans & Billing" hub (add-on access — Phase 0 + 1).
// One front door for the subscription + the add-on catalog. The catalog renders from
// ADDON_REGISTRY; per-shop status comes from resolveAddonStatuses(). Operational config
// lives in each feature and is reached via deep-links (manageLink). Built add-ons are
// usable; not-yet-built ones render as disabled "Coming soon" cards.
// Style matches the dark dashboard tabs (sibling ShopAdsTab); shadcn Card would clash
// with the dark surface, so raw Tailwind is used for visual consistency.

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, Sparkles, CreditCard } from "lucide-react";
import { ADDON_REGISTRY, type AddonDef } from "@/config/addonRegistry";
import { agencyApi } from "@/services/api/agency";
import {
  resolveAddonStatuses,
  getAiUsageSummary,
  getPaymentMethod,
  setOverage,
  getOverageState,
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
  const [overageInfo, setOverageInfo] = useState<{ enabled: boolean; chargeUsd: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [cancelingAgency, setCancelingAgency] = useState(false);

  const cancelAgency = async () => {
    if (
      !window.confirm(
        "Cancel the Agency Program? It stays active until your billing period ends, then your client shops lose Growth coverage and each will need its own subscription."
      )
    ) {
      return;
    }
    setCancelingAgency(true);
    try {
      const res: any = await agencyApi.cancel();
      const end = res?.data?.currentPeriodEnd
        ? new Date(res.data.currentPeriodEnd).toLocaleDateString()
        : null;
      toast.success(end ? `Agency Program will cancel on ${end}` : "Agency Program will cancel at period end");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to cancel the Agency Program");
    } finally {
      setCancelingAgency(false);
    }
  };

  const handleCheckout = async (addon: AddonDef) => {
    if (addon.id !== "agency") return;
    setCheckoutBusy(addon.id);
    try {
      const res: any = await agencyApi.activate({});
      const url = res?.data?.paymentUrl;
      if (url) {
        window.location.href = url;
      } else {
        toast.error("Couldn't start checkout. Please try again.");
        setCheckoutBusy(null);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to start activation");
      setCheckoutBusy(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [s, u, pm, ov] = await Promise.all([
      resolveAddonStatuses(),
      getAiUsageSummary(),
      getPaymentMethod(),
      getOverageState(),
    ]);
    setStatuses(s);
    setUsage(u);
    setCard(pm);
    setOverageInfo({ enabled: ov.enabled, chargeUsd: ov.chargeUsd });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // AI Usage Overage (T3.2 Slice 1): inline enable/disable from the card, then refresh statuses.
  const [togglingOverage, setTogglingOverage] = useState(false);
  const handleOverageToggle = useCallback(async (enabled: boolean) => {
    // Consent-at-enable (Slice 2.5): explicit acknowledgement of the Usage x3 terms before turning it on.
    if (enabled) {
      const ok = window.confirm(
        "Enable AI Usage Overage?\n\n" +
          "Full-power AI keeps running past your monthly allowance. Any usage beyond it is billed at " +
          "3× the AI cost (pay as you grow), up to a monthly cap. You can turn this off anytime.\n\n" +
          "Click OK to agree and enable."
      );
      if (!ok) return;
    }
    setTogglingOverage(true);
    try {
      await setOverage(enabled, enabled ? true : undefined);
      toast.success(enabled ? "AI Usage overage enabled" : "AI Usage overage disabled");
      await load();
    } catch (e: any) {
      // Surface the server reason (e.g. 402 "Add a payment method before enabling…").
      toast.error(e?.response?.data?.error || "Couldn't update overage — please try again");
    } finally {
      setTogglingOverage(false);
    }
  }, [load]);

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
          {/* Deep-link to the SubscriptionManagement tab (handles plan + payment method).
              Tiered plans land with the P0 subscription work. */}
          <Link
            href="/shop?tab=subscription"
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
            {/* AI Usage Overage indicator (T3.2): shown when the shop is on overage this month. */}
            {overageInfo?.enabled && overageInfo.chargeUsd > 0 && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-amber-300">Overage this month · billed at 3×</span>
                <span className="font-semibold text-amber-300">${overageInfo.chargeUsd.toFixed(2)}</span>
              </div>
            )}
            {/* Billing clarity: which AI counts toward the allowance/overage (ad-lead replies do not). */}
            <p className="mt-2 text-xs text-gray-500">
              Counts your AI assistant, insights, marketing &amp; customer auto-replies. Ad-lead replies
              (AI&nbsp;Ads&nbsp;Management) don&apos;t count.
            </p>
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
            <AddonCard
              key={addon.id}
              addon={addon}
              status={statuses[addon.id] ?? "coming_soon"}
              onToggle={addon.id === "ai_overage" ? handleOverageToggle : undefined}
              onCheckout={handleCheckout}
              onCancel={addon.id === "agency" ? cancelAgency : undefined}
              canceling={cancelingAgency}
              busy={addon.id === "ai_overage" ? togglingOverage : checkoutBusy === addon.id}
            />
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
            href="/shop?tab=payment-methods"
            className="text-sm text-yellow-400 hover:text-yellow-300 underline-offset-2 hover:underline"
          >
            Manage billing
          </Link>
        </div>
      </section>
    </div>
  );
};

interface CtaSpec {
  label: string;
  href?: string;
  disabled?: boolean;
  checkout?: boolean;
}

/** Dispatch the card's CTA by status, then activation type. Keeping this declarative
 *  means an add-on flipping from 'coming_soon' → live needs no card-code change — its
 *  registry activationType already drives the right button. */
function ctaFor(addon: AddonDef, status: AddonStatus): CtaSpec {
  if (status === "coming_soon") return { label: "Coming soon", disabled: true };
  if (status === "active") return { label: "Manage", href: addon.manageLink, disabled: !addon.manageLink };
  if (status === "pending") return { label: "View request", href: addon.manageLink, disabled: !addon.manageLink };

  // status === 'off' → route by how this add-on is activated.
  switch (addon.activationType) {
    case "checkout":
      return { label: addon.ctaLabel, checkout: true };
    case "request": // request → admin approves (deep-link to the feature's request UI)
    case "onboarding": // external onboarding (e.g. Stripe Connect) lives in the feature
    case "toggle": // inline enable handled on the feature's settings page in v1
      return { label: addon.ctaLabel, href: addon.manageLink, disabled: !addon.manageLink };
    case "contact": // sales-assisted → Support (falls back to disabled if no link)
      return { label: addon.ctaLabel, href: addon.manageLink, disabled: !addon.manageLink };
    default:
      return { label: addon.ctaLabel, disabled: true };
  }
}

const AddonCard: React.FC<{
  addon: AddonDef;
  status: AddonStatus;
  /** When provided (functional toggle add-ons like AI Usage Overage), the card renders an inline
   *  Enable/Disable button that calls this, instead of the deep-link CTA. */
  onToggle?: (enabled: boolean) => void | Promise<void>;
  onCheckout?: (addon: AddonDef) => void | Promise<void>;
  busy?: boolean;
  onCancel?: () => void | Promise<void>;
  canceling?: boolean;
}> = ({ addon, status, onToggle, onCheckout, busy, onCancel, canceling }) => {
  const badge = STATUS_BADGE[status];
  const cta = ctaFor(addon, status);
  // Inline toggle is available once the add-on is live for this shop (status off/active).
  const canToggle = !!onToggle && (status === "off" || status === "active");
  const isOn = status === "active";

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
      <div className="mt-auto pt-1 flex items-center gap-3">
        {canToggle ? (
          <button
            onClick={() => onToggle!(!isOn)}
            disabled={busy}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60 ${
              isOn
                ? "bg-gray-700 text-white hover:bg-gray-600"
                : "bg-yellow-400 text-gray-900 hover:bg-yellow-300"
            }`}
          >
            {busy ? "Saving…" : isOn ? "Disable" : addon.ctaLabel}
          </button>
        ) : cta.checkout ? (
          <button
            onClick={() => onCheckout?.(addon)}
            disabled={busy}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-yellow-400 text-gray-900 font-medium hover:bg-yellow-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {cta.label}
          </button>
        ) : cta.disabled || !cta.href ? (
          <button
            disabled
            className="text-sm px-3 py-1.5 rounded-lg bg-gray-700/50 text-gray-500 cursor-not-allowed"
          >
            {cta.label}
          </button>
        ) : (
          <Link
            href={cta.href}
            className="inline-block text-sm px-3 py-1.5 rounded-lg bg-yellow-400 text-gray-900 font-medium hover:bg-yellow-300 transition-colors"
          >
            {cta.label}
          </Link>
        )}

        {/* Cancel action (agency add-on when active) */}
        {onCancel && status === "active" && (
          <button
            onClick={onCancel}
            disabled={canceling}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {canceling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

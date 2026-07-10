"use client";

import React, { useEffect, useState } from "react";
import { Headset, Crown, Mail, Phone, MessageSquare, Zap, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import apiClient from "@/services/api/client";

type SupportTier = "business" | "growth" | "starter";

interface SupportLevel {
  title: string;
  blurb: string;
  perks: { icon: React.ComponentType<{ className?: string }>; label: string }[];
  accent: string; // border/bg accent classes
  badge: string;
  hasAccountManager: boolean;
}

const LEVELS: Record<SupportTier, SupportLevel> = {
  business: {
    title: "Priority Support",
    blurb: "You're on Business — the highest support tier.",
    accent: "border-emerald-500/40 bg-emerald-500/[0.06]",
    badge: "text-emerald-400 bg-emerald-500/15",
    hasAccountManager: true,
    perks: [
      { icon: Crown, label: "Dedicated Account Manager" },
      { icon: Phone, label: "Priority phone & chat support" },
      { icon: Zap, label: "Fastest response times" },
    ],
  },
  growth: {
    title: "Priority Email Support",
    blurb: "You're on Growth — priority support included.",
    accent: "border-blue-500/40 bg-blue-500/[0.06]",
    badge: "text-blue-400 bg-blue-500/15",
    hasAccountManager: false,
    perks: [
      { icon: Mail, label: "Priority email support" },
      { icon: Zap, label: "Faster response times" },
    ],
  },
  starter: {
    title: "Standard Support",
    blurb: "You're on Starter — standard email & in-app support.",
    accent: "border-gray-700 bg-gray-900/40",
    badge: "text-gray-300 bg-white/10",
    hasAccountManager: false,
    perks: [
      { icon: Mail, label: "Email & in-app support" },
      { icon: MessageSquare, label: "Help center & community" },
    ],
  },
};

function toSupportTier(tier: string | undefined): SupportTier {
  if (tier === "business" || tier === "elite") return "business";
  if (tier === "growth" || tier === "premium") return "growth";
  return "starter";
}

/**
 * Shows the shop's plan-based support entitlement (Dedicated Account Manager +
 * Priority Support on Business, Priority Email on Growth, Standard otherwise),
 * with an upgrade nudge for lower tiers. Self-contained — fetches its own tier.
 */
export function SupportLevelCard() {
  const [tier, setTier] = useState<SupportTier | null>(null);

  useEffect(() => {
    let active = true;
    apiClient
      .get("/shops/subscription/status")
      .then((res) => {
        if (!active) return;
        const sub = res?.data?.currentSubscription;
        setTier(toSupportTier(sub?.tier));
      })
      .catch(() => active && setTier("starter"));
    return () => {
      active = false;
    };
  }, []);

  if (!tier) return null;
  const level = LEVELS[tier];

  return (
    <div className={`rounded-2xl border p-5 mb-6 ${level.accent}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <Headset className="w-5 h-5 text-[#FFCC00]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold">{level.title}</h3>
              <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${level.badge}`}>
                {tier}
              </span>
            </div>
            <p className="text-sm text-gray-400">{level.blurb}</p>
          </div>
        </div>

        {tier !== "business" && (
          <Link href="/pricing">
            <button className="inline-flex items-center gap-1.5 text-sm font-medium text-[#FFCC00] hover:text-[#FFD700] transition-colors">
              {tier === "starter" ? "Upgrade for a dedicated manager" : "Upgrade to Business"}
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        {level.perks.map((perk) => {
          const Icon = perk.icon;
          return (
            <div key={perk.label} className="flex items-center gap-2 rounded-xl bg-black/20 border border-white/5 px-3 py-2.5">
              <Icon className="w-4 h-4 text-[#FFCC00] flex-shrink-0" />
              <span className="text-sm text-gray-200">{perk.label}</span>
            </div>
          );
        })}
      </div>

      {level.hasAccountManager && (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">Your Dedicated Account Manager</span>
          </div>
          <p className="text-sm text-gray-400">
            Your account manager handles onboarding, best-practices, and any escalations. They'll reach out after you
            subscribe — or open a <span className="text-white">high-priority</span> ticket below and they'll respond first.
          </p>
        </div>
      )}
    </div>
  );
}

export default SupportLevelCard;

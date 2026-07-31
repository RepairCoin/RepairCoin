"use client";

import React from "react";
import { Award, Star, Crown, Wrench, Users, TrendingUp } from "lucide-react";
import { useCustomerStore } from "@/stores/customerStore";

/**
 * Rewards hub — the always-visible companion to the compact "Your Tier Level" card
 * on the overview. Shows the full tier ladder with perks, progress to the next tier,
 * lifetime earnings, and the concrete ways to earn more RCN. Pure retention surface:
 * make the next tier feel reachable and the perks worth chasing.
 */

interface TierDef {
  key: "BRONZE" | "SILVER" | "GOLD";
  label: string;
  min: number;
  max: number | null;
  bonus: number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  perks: string[];
}

const TIERS: TierDef[] = [
  {
    key: "BRONZE",
    label: "Bronze",
    min: 0,
    max: 200,
    bonus: 0,
    icon: Award,
    color: "#CD7F32",
    perks: ["Base RCN rewards", "Access to the full marketplace"],
  },
  {
    key: "SILVER",
    label: "Silver",
    min: 200,
    max: 1000,
    bonus: 2,
    icon: Star,
    color: "#C0C0C0",
    perks: ["+2 RCN bonus per repair", "Priority support", "Early access to promotions"],
  },
  {
    key: "GOLD",
    label: "Gold",
    min: 1000,
    max: null,
    bonus: 5,
    icon: Crown,
    color: "#FFD700",
    perks: ["+5 RCN bonus per repair", "VIP support", "Exclusive offers", "Higher redemption rates"],
  },
];

export const RewardsTab: React.FC = () => {
  // Read-only display: pull tier/balance straight from the store (populated by the
  // dashboard's data flow) rather than re-running the heavy useCustomer hook.
  const customerData = useCustomerStore((s) => s.customerData);
  const balanceData = useCustomerStore((s) => s.balanceData);

  const normalizedTier = (customerData?.tier || "BRONZE").toUpperCase() as TierDef["key"];
  const lifetimeEarned = balanceData?.lifetimeEarned || 0;
  const availableBalance = balanceData?.availableBalance || 0;

  const currentIndex = TIERS.findIndex((t) => t.key === normalizedTier);
  const current = TIERS[currentIndex] ?? TIERS[0];
  const next = TIERS[currentIndex + 1] ?? null;

  const rcnToNext = next ? Math.max(next.min - lifetimeEarned, 0) : 0;
  const progress = current.max
    ? Math.min(((lifetimeEarned - current.min) / (current.max - current.min)) * 100, 100)
    : 100;

  return (
    <div className="max-w-[1080px] mx-auto space-y-5">
      {/* Progress hero */}
      <section className="rounded-2xl border border-[#262626] bg-[#161616] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${current.color}22` }}
            >
              <current.icon className="h-6 w-6" style={{ color: current.color }} />
            </span>
            <div>
              <p className="text-xs text-gray-400">Your tier</p>
              <p className="text-xl font-bold text-white">{current.label}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-gray-400">Lifetime earned</p>
              <p className="text-lg font-bold text-[#FFCC00]">{lifetimeEarned} RCN</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Available</p>
              <p className="text-lg font-bold text-white">{availableBalance} RCN</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#2A2A2A]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FFCC00] to-[#FFD700] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-gray-300">
            {next ? (
              <>
                Earn <span className="font-bold text-white">{rcnToNext} RCN</span> more to reach{" "}
                <span className="font-bold" style={{ color: next.color }}>
                  {next.label}
                </span>{" "}
                and unlock <span className="font-semibold text-white">+{next.bonus} RCN</span> per repair.
              </>
            ) : (
              <span className="font-medium text-[#FFCC00]">
                You&apos;ve reached the highest tier — enjoy your Gold perks!
              </span>
            )}
          </p>
        </div>
      </section>

      {/* Tier ladder */}
      <section>
        <h3 className="mb-3 text-base font-semibold text-white">Tier benefits</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TIERS.map((tier) => {
            const isCurrent = tier.key === normalizedTier;
            const isUnlocked = lifetimeEarned >= tier.min;
            return (
              <div
                key={tier.key}
                className={`rounded-2xl border p-5 transition-colors ${
                  isCurrent
                    ? "border-[#FFCC00]/50 bg-[#FFCC00]/[0.06]"
                    : "border-[#262626] bg-[#161616]"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <tier.icon className="h-5 w-5" style={{ color: tier.color }} />
                    <span className="font-semibold text-white">{tier.label}</span>
                  </div>
                  {isCurrent ? (
                    <span className="rounded bg-[#FFCC00] px-1.5 py-0.5 text-[10px] font-bold text-black">
                      CURRENT
                    </span>
                  ) : isUnlocked ? (
                    <span className="text-[10px] font-semibold text-green-400">UNLOCKED</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-gray-500">
                      {tier.min}+ RCN
                    </span>
                  )}
                </div>
                <p className="mb-3 text-xs text-gray-400">
                  {tier.max ? `${tier.min} – ${tier.max} RCN earned` : `${tier.min}+ RCN earned`}
                </p>
                <ul className="space-y-1.5">
                  {tier.perks.map((perk, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-gray-300">
                      <span className="mt-0.5 text-[#FFCC00]">+</span> {perk}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Ways to earn */}
      <section className="rounded-2xl border border-[#262626] bg-[#161616] p-5">
        <h3 className="mb-4 text-base font-semibold text-white">Ways to earn more RCN</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <EarnItem
            icon={<Wrench className="h-5 w-5 text-[#FFCC00]" />}
            title="Book repairs"
            desc={`Earn 1 RCN per $10 spent${current.bonus ? `, plus your +${current.bonus} ${current.label} bonus` : ""}.`}
          />
          <EarnItem
            icon={<Users className="h-5 w-5 text-[#FFCC00]" />}
            title="Refer friends"
            desc="Earn 25 RCN when a friend completes their first repair — they get 10 RCN too."
          />
          <EarnItem
            icon={<TrendingUp className="h-5 w-5 text-[#FFCC00]" />}
            title="Level up"
            desc="Higher tiers earn bigger per-repair bonuses on every future booking."
          />
        </div>
      </section>
    </div>
  );
};

const EarnItem: React.FC<{ icon: React.ReactNode; title: string; desc: string }> = ({
  icon,
  title,
  desc,
}) => (
  <div className="rounded-xl border border-[#262626] bg-[#0a0a0a] p-4">
    <div className="mb-2 flex items-center gap-2">
      {icon}
      <span className="text-sm font-semibold text-white">{title}</span>
    </div>
    <p className="text-xs leading-relaxed text-gray-400">{desc}</p>
  </div>
);

export default RewardsTab;

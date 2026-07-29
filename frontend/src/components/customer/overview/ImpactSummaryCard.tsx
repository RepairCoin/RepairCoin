"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, PiggyBank, Coins, ClipboardCheck } from "lucide-react";
import { getCustomerOrders } from "@/services/api/services";

/** 1 RCN = $0.10 — used to express redeemed RCN as dollars saved. */
const RCN_TO_USD = 0.1;

interface ImpactSummaryCardProps {
  /** Lifetime RCN earned (from balance data). */
  lifetimeEarned: number;
  /** Total RCN redeemed — the basis for dollars saved. */
  totalRedeemed: number;
}

/**
 * "Your impact" — a small retention card that reflects the value the customer has
 * gotten from RepairCoin: dollars saved via RCN, RCN earned, and bookings made.
 * Reads existing balance data; fetches only a lightweight bookings count.
 */
export const ImpactSummaryCard: React.FC<ImpactSummaryCardProps> = ({
  lifetimeEarned,
  totalRedeemed,
}) => {
  const [bookings, setBookings] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getCustomerOrders({ page: 1, limit: 1 })
      .then((r) => active && setBookings(r?.pagination?.totalItems ?? 0))
      .catch(() => active && setBookings(0));
    return () => {
      active = false;
    };
  }, []);

  const savedUsd = totalRedeemed * RCN_TO_USD;

  return (
    <div className="rounded-2xl border border-[#262626] bg-[#161616] p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#FFCC00]" />
        <h3 className="text-sm font-semibold text-white">Your impact</h3>
      </div>

      <div className="space-y-3">
        <Row
          icon={<PiggyBank className="h-4 w-4 text-green-400" />}
          label="Saved with RCN"
          value={`$${savedUsd.toFixed(2)}`}
          accent="text-green-400"
        />
        <Row
          icon={<Coins className="h-4 w-4 text-[#FFCC00]" />}
          label="RCN earned"
          value={`${lifetimeEarned} RCN`}
          accent="text-[#FFCC00]"
        />
        <Row
          icon={<ClipboardCheck className="h-4 w-4 text-gray-300" />}
          label="Bookings made"
          value={bookings === null ? "—" : String(bookings)}
          accent="text-white"
        />
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-gray-500">
        Keep booking to earn more RCN and save on every repair.
      </p>
    </div>
  );
};

const Row: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}> = ({ icon, label, value, accent }) => (
  <div className="flex items-center justify-between">
    <span className="flex items-center gap-2 text-sm text-gray-400">
      {icon}
      {label}
    </span>
    <span className={`text-base font-bold ${accent}`}>{value}</span>
  </div>
);

export default ImpactSummaryCard;

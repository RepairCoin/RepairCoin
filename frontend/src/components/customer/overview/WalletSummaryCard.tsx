"use client";

import React, { useState } from "react";
import { Wallet, TrendingUp, Gift } from "lucide-react";
import { useBlockchainEnabled } from "@/contexts/AppConfigContext";

interface WalletSummaryCardProps {
  availableBalance: number;
  walletBalance: number;
  tokensEarned: number;
  tokensRedeemed: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export const WalletSummaryCard: React.FC<WalletSummaryCardProps> = ({
  availableBalance,
  walletBalance,
  tokensEarned,
  tokensRedeemed,
}) => {
  const [bgError, setBgError] = useState(false);
  const blockchainEnabled = useBlockchainEnabled();

  const rows = [
    // On-chain wallet balance is blockchain-only — hidden in database-only mode.
    ...(blockchainEnabled ? [{ label: "Wallet Balance", value: fmt(walletBalance), icon: Wallet }] : []),
    { label: "Tokens Earned", value: fmt(tokensEarned), icon: TrendingUp },
    { label: "Tokens Redeemed", value: fmt(tokensRedeemed), icon: Gift },
  ];

  return (
    <div className="rounded-2xl border border-[#262626] bg-[#161616]">
      <div className="flex items-center gap-4 border-b border-[#262626] px-4 py-5">
        <Wallet className="w-4 h-4 text-[#FFCC00]" />
        <h3 className="text-sm font-semibold text-white">{blockchainEnabled ? "My FixFlow Wallet" : "My Rewards"}</h3>
      </div>

      <div className="p-4 space-y-5">
      {/* Available balance hero */}
      <div
        className="relative flex h-20 flex-col justify-center overflow-hidden rounded-xl px-4"
        style={
          bgError
            ? { background: "linear-gradient(135deg, #FFCC00, #e6a700)" }
            : { backgroundImage: "url('/img/rcn-balance.png')", backgroundSize: "cover", backgroundPosition: "center" }
        }
      >
        {/* hidden probe to detect a missing bg image */}
        <img src="/img/rcn-balance.png" alt="" className="hidden" onError={() => setBgError(true)} />
        <div className="relative z-10">
          <p className="text-xs font-semibold text-[#4a3200]">Available Balance</p>
          <p className="text-3xl font-semibold text-[#211500]">
            {fmt(availableBalance)} RCN
          </p>
        </div>
      </div>

      {/* Breakdown rows */}
      <div className="space-y-2.5">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-gray-400">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFCC00]/15">
                  <Icon className="w-4 h-4 text-[#FFCC00]" />
                </span>
                {row.label}
              </span>
              <span className="text-lg font-bold text-white">{row.value}</span>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
};

export default WalletSummaryCard;

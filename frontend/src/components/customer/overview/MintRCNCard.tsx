"use client";

import React, { useState } from "react";
import { Coins, Info, X } from "lucide-react";

interface MintRCNCardProps {
  availableBalance: number;
  onMintClick: () => void;
  disabled?: boolean;
}

export const MintRCNCard: React.FC<MintRCNCardProps> = ({
  availableBalance,
  onMintClick,
  disabled = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (availableBalance <= 0) {
    return null;
  }

  return (
    <div className="bg-[#212121] rounded-xl overflow-visible relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-white font-semibold text-base">Mint RCN to Wallet</h3>
        </div>
        <div className="relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
            className="p-1 hover:bg-[#2A2A2A] rounded-full transition-colors"
          >
            <Info className="w-4 h-4 text-gray-400 hover:text-[#FFCC00]" />
          </button>

          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute right-0 top-8 z-[100] w-72 bg-[#1A1A1A] border border-gray-700 rounded-xl shadow-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-semibold text-sm">How it works</h4>
                <button
                  onClick={() => setShowTooltip(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-[#FFCC00]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-[#FFCC00]">1</span>
                  </div>
                  <span className="text-gray-300">
                    Choose the amount of RCN you want to convert to blockchain tokens
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-[#FFCC00]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-[#FFCC00]">2</span>
                  </div>
                  <span className="text-gray-300">
                    Your offchain RCN balance will be converted to actual blockchain tokens
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-[#FFCC00]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-[#FFCC00]">3</span>
                  </div>
                  <span className="text-gray-300">
                    Tokens are minted and transferred to your connected wallet (gas fees covered!)
                  </span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-sm text-gray-400 mb-4">
          Convert your offchain RCN to blockchain tokens.
        </p>

        {/* Mint Button */}
        <button
          onClick={onMintClick}
          disabled={disabled}
          className={`w-full py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
            disabled
              ? "bg-gray-600 text-gray-400 cursor-not-allowed"
              : "bg-[#FFCC00] text-black hover:bg-[#FFD700]"
          }`}
        >
          <Coins className="w-4 h-4" />
          Mint to Wallet
        </button>

        {/* Available Balance */}
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-400">Available to mint:</span>
          <span className="text-[#FFCC00] font-bold text-base">{availableBalance} RCN</span>
        </div>
      </div>
    </div>
  );
};

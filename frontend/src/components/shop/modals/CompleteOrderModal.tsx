"use client";

import React from "react";
import { X, CheckCircle, DollarSign, Coins, AlertCircle } from "lucide-react";

interface CompleteOrderModalProps {
  orderAmount: number;
  serviceName: string;
  customerAddress: string;
  onConfirm: () => void;
  onClose: () => void;
  isProcessing: boolean;
}

export const CompleteOrderModal: React.FC<CompleteOrderModalProps> = ({
  orderAmount,
  serviceName,
  customerAddress,
  onConfirm,
  onClose,
  isProcessing,
}) => {
  // Calculate RCN rewards based on business logic
  const calculateRcnReward = (amount: number): number => {
    if (amount >= 100) return 25;
    if (amount >= 50) return 10;
    return 0;
  };

  const rcnReward = calculateRcnReward(orderAmount);
  const hasReward = rcnReward > 0;

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white">Complete Order</h2>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Service Info */}
          <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Order Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Service:</span>
                <span className="text-white font-semibold">{serviceName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Amount:</span>
                <span className="text-green-500 font-bold flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {orderAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Customer:</span>
                <code className="text-[#FFCC00] bg-[#FFCC00]/10 px-2 py-1 rounded text-xs">
                  {truncateAddress(customerAddress)}
                </code>
              </div>
            </div>
          </div>

          {/* RCN Rewards Info */}
          {hasReward ? (
            <div className="bg-gradient-to-r from-[#FFCC00]/10 to-[#FFD700]/10 border border-[#FFCC00]/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[#FFCC00]/20 rounded-lg">
                  <Coins className="w-6 h-6 text-[#FFCC00]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white mb-1">RCN Rewards</p>
                  <p className="text-xs text-gray-400 mb-2">
                    Customer will earn <span className="text-[#FFCC00] font-bold">{rcnReward} RCN</span> tokens
                    upon completion
                  </p>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <CheckCircle className="w-3 h-3" />
                    <span>Automatically credited to their wallet</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-400">No RCN Rewards</p>
                  <p className="text-xs text-yellow-300 mt-1">
                    Order amount is below $50 minimum for RCN rewards
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Message */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <p className="text-sm text-blue-300">
              <span className="font-semibold text-blue-400">Confirm completion:</span> This action
              marks the service as complete and cannot be undone.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-800">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 bg-[#0D0D0D] border border-gray-800 text-white font-semibold px-4 py-3 rounded-xl hover:border-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex-1 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-bold px-4 py-3 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Mark Complete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

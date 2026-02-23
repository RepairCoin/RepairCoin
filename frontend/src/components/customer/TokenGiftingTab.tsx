"use client";

import React, { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import toast from "react-hot-toast";
import {
  Send,
  Gift,
  CheckCircle,
  AlertCircle,
  Camera,
  Wallet,
  Clock,
  HelpCircle,
} from "lucide-react";
import { QRScanner } from "@/components/ui/QRScanner";
import Tooltip from "../ui/tooltip";
import { useAuthStore } from "@/stores/authStore";
import { useCustomerStore } from "@/stores/customerStore";
import { SuspendedActionModal } from "./SuspendedActionModal";

interface TransferForm {
  recipientAddress: string;
  amount: string;
  message: string;
}

interface TransferHistory {
  id: string;
  type: "transfer_in" | "transfer_out";
  amount: number;
  direction: "sent" | "received";
  otherParty: string;
  message?: string;
  transactionHash: string;
  timestamp: string;
  status: string;
}

export function TokenGiftingTab() {
  const account = useActiveAccount();
  const { userProfile } = useAuthStore();
  const { balanceData } = useCustomerStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);
  const [transferHistory, setTransferHistory] = useState<TransferHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isSuspended = userProfile?.suspended || false;

  const [formData, setFormData] = useState<TransferForm>({
    recipientAddress: "",
    amount: "",
    message: "",
  });

  const [validation, setValidation] = useState<{
    valid: boolean;
    message: string;
    senderBalance: number;
    recipientExists: boolean;
  } | null>(null);

  const validateTransfer = async () => {
    if (!formData.recipientAddress || !formData.amount || !account?.address) {
      setValidation(null);
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/validate-transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromAddress: account.address,
            toAddress: formData.recipientAddress,
            amount: parseFloat(formData.amount),
          }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setValidation(result.data);
      }
    } catch (error) {
      console.error("Validation error:", error);
    }
  };

  const handleQRScan = (result: string) => {
    if (/^0x[a-fA-F0-9]{40}$/.test(result)) {
      setFormData((prev) => ({ ...prev, recipientAddress: result }));
      setShowQRScanner(false);
      toast.success("Address scanned successfully!");
    } else {
      toast.error("Invalid wallet address in QR code");
    }
  };

  const handleSendTokens = () => {
    if (isSuspended) {
      setShowSuspendedModal(true);
      return;
    }

    if (!account?.address || !formData.recipientAddress || !formData.amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!validation?.valid) {
      toast.error(validation?.message || "Transfer validation failed");
      return;
    }

    setShowConfirmModal(true);
  };

  const confirmSendTokens = async () => {
    if (!account?.address) return;

    setIsLoading(true);
    setShowConfirmModal(false);

    try {
      const mockTransactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromAddress: account.address,
            toAddress: formData.recipientAddress,
            amount: parseFloat(formData.amount),
            message: formData.message,
            transactionHash: mockTransactionHash,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        toast.success(`Successfully sent ${formData.amount} RCN tokens!`);
        setFormData({ recipientAddress: "", amount: "", message: "" });
        setValidation(null);
        fetchTransferHistory();
      } else {
        toast.error(result.message || "Transfer failed");
      }
    } catch (error) {
      console.error("Transfer error:", error);
      toast.error("Failed to send tokens. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransferHistory = async () => {
    if (!account?.address) return;

    setLoadingHistory(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/transfer-history/${account.address}`
      );
      const result = await response.json();

      if (result.success) {
        setTransferHistory(result.data.transfers);
      }
    } catch (error) {
      console.error("History fetch error:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchTransferHistory();
  }, [account?.address]);

  useEffect(() => {
    if (formData.recipientAddress && formData.amount) {
      validateTransfer();
    }
  }, [formData.recipientAddress, formData.amount]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (timestamp: string) => {
    try {
      let date: Date;

      if (/^\d+$/.test(timestamp)) {
        const numTimestamp = parseInt(timestamp);
        date = new Date(
          numTimestamp < 10000000000 ? numTimestamp * 1000 : numTimestamp
        );
      } else {
        date = new Date(timestamp);
      }

      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (error) {
      console.error("Date formatting error:", error, "timestamp:", timestamp);
      return "Invalid Date";
    }
  };

  const availableBalance = balanceData?.availableBalance ?? validation?.senderBalance ?? 0;

  // Calculate today's gifts total
  const todaysGifts = transferHistory
    .filter((t) => {
      if (t.direction !== "sent") return false;
      try {
        let date: Date;
        if (/^\d+$/.test(t.timestamp)) {
          const num = parseInt(t.timestamp);
          date = new Date(num < 10000000000 ? num * 1000 : num);
        } else {
          date = new Date(t.timestamp);
        }
        const today = new Date();
        return (
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear()
        );
      } catch {
        return false;
      }
    })
    .reduce((sum, t) => sum + t.amount, 0);

  // Recent sent gifts for the sidebar history (last 10)
  const recentSentGifts = transferHistory
    .filter((t) => t.direction === "sent")
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Two Column Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column - Token Gifting Form */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#1A1A1A] rounded-2xl border border-gray-800 overflow-hidden">
            {/* Card Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <Gift className="w-5 h-5 text-[#FFCC00]" />
                <h3 className="text-[#FFCC00] font-semibold text-lg">
                  Token Gifting
                </h3>
              </div>
              <Tooltip
                title="How it works"
                position="bottom"
                className="right-0 left-auto"
                icon={
                  <HelpCircle className="w-4 h-4 text-gray-500 hover:text-gray-300 transition-colors" />
                }
                content={
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-blue-400">1</span>
                      </div>
                      <span className="text-gray-300">
                        Enter recipient&apos;s wallet address or scan their QR code
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-blue-400">2</span>
                      </div>
                      <span className="text-gray-300">
                        Specify the amount of RCN tokens you want to send
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-blue-400">3</span>
                      </div>
                      <span className="text-gray-300">
                        Add an optional personal message with your gift
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-blue-400">4</span>
                      </div>
                      <span className="text-gray-300">
                        Confirm and send - tokens are instantly transferred
                      </span>
                    </li>
                  </ul>
                }
              />
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-6">
              {/* Recipient Wallet Address */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Recipient Wallet Address{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.recipientAddress}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        recipientAddress: e.target.value,
                      }))
                    }
                    placeholder="Scan or Paste Wallet Address.."
                    className="flex-1 px-4 py-3 bg-[#2A2A2A] border border-gray-700 text-white rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]/50 focus:border-[#FFCC00]/50 transition-colors"
                  />
                  <button
                    onClick={() => setShowQRScanner(true)}
                    className="px-5 py-3 bg-[#FFCC00] text-black rounded-lg hover:bg-yellow-400 transition-colors flex items-center gap-2 font-medium whitespace-nowrap"
                    title="Scan QR Code"
                  >
                    <Camera className="w-4 h-4" />
                    <span className="text-sm">Scan QR</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Make sure the address belongs to a RepairCoin-compatible
                  wallet.
                </p>
              </div>

              {/* Amount RCN */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Amount RCN <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-[#2A2A2A] border border-gray-700 text-white rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]/50 focus:border-[#FFCC00]/50 transition-colors"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Set how many RCN you want to send.
                </p>
              </div>

              {/* Your Message */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Your Message (Optional)
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                  placeholder="Add a short note or message for the recipient."
                  rows={3}
                  className="w-full px-4 py-3 bg-[#2A2A2A] border border-gray-700 text-white rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]/50 focus:border-[#FFCC00]/50 transition-colors resize-none"
                />
              </div>

              {/* Validation Status */}
              {validation && (
                <div
                  className={`p-4 rounded-lg flex items-center gap-3 ${
                    validation.valid
                      ? "bg-green-900/20 border border-green-800"
                      : "bg-red-900/20 border border-red-800"
                  }`}
                >
                  {validation.valid ? (
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  )}
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        validation.valid ? "text-green-300" : "text-red-300"
                      }`}
                    >
                      {validation.message}
                    </p>
                    {validation.valid && (
                      <p className="text-xs text-gray-400 mt-1">
                        Your balance: {validation.senderBalance} RCN
                        {!validation.recipientExists &&
                          " · New recipient will be created"}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Footer: Warning + Send Button */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                <p className="text-xs text-gray-500 max-w-sm">
                  Review the recipient and amount carefully. Token transfers
                  cannot be reversed.
                </p>
                <button
                  onClick={handleSendTokens}
                  disabled={isLoading || !validation?.valid}
                  className="px-8 py-3 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isLoading ? "Sending..." : "Send Token"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Balance & History */}
        <div className="w-full lg:w-[400px] flex-shrink-0 space-y-6">
          {/* Available Balance Card */}
          <div className="bg-[#1A1A1A] rounded-2xl border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
              <Wallet className="w-5 h-5 text-[#FFCC00]" />
              <h3 className="text-[#FFCC00] font-semibold">
                Available Balance
              </h3>
            </div>
            <div className="px-6 py-6 text-center">
              <p className="text-4xl font-bold text-white">
                {availableBalance}{" "}
                <span className="text-2xl font-semibold">RCN</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                This is the maximum amount you can gift right now.
              </p>
            </div>
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800">
              <span className="text-sm text-gray-400">Today&apos;s Gifts:</span>
              <span className="text-sm font-semibold text-[#FFCC00]">
                {todaysGifts} RCN
              </span>
            </div>
          </div>

          {/* Recent Gift History Card */}
          <div className="bg-[#1A1A1A] rounded-2xl border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
              <Clock className="w-5 h-5 text-[#FFCC00]" />
              <h3 className="text-[#FFCC00] font-semibold">
                Recent Gift History
              </h3>
            </div>

            {loadingHistory ? (
              <div className="px-6 py-8 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#FFCC00] border-t-transparent mx-auto"></div>
                <p className="text-gray-500 text-xs mt-3">Loading history...</p>
              </div>
            ) : recentSentGifts.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <Gift className="w-10 h-10 mx-auto mb-2 text-gray-700" />
                <p className="text-gray-500 text-sm">No gifts sent yet</p>
              </div>
            ) : (
              <div>
                {/* Table Header */}
                <div className="grid grid-cols-3 gap-2 px-6 py-3 border-b border-gray-800">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </span>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipient
                  </span>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                    Amount
                  </span>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-gray-800/50">
                  {recentSentGifts.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="grid grid-cols-3 gap-2 px-6 py-3 hover:bg-white/[0.02] transition-colors items-center"
                    >
                      <span className="text-xs text-gray-400">
                        {formatDate(transfer.timestamp)}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {formatAddress(transfer.otherParty)}
                      </span>
                      <span className="text-right">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#FFCC00]/10 text-[#FFCC00] text-xs font-medium">
                          Sent {transfer.amount} RCN
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Scanner */}
      <QRScanner
        isOpen={showQRScanner}
        onScan={handleQRScan}
        onClose={() => setShowQRScanner(false)}
      />

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-2xl max-w-md w-full p-6 border border-gray-800">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-[#FFCC00]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-[#FFCC00]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Confirm Token Transfer
              </h3>
              <p className="text-sm text-gray-400">
                Please review the details before sending
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-[#2A2A2A] rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Recipient Address</p>
                <p className="text-white font-medium text-sm break-all">
                  {formData.recipientAddress}
                </p>
              </div>

              <div className="bg-[#2A2A2A] rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Amount</p>
                <p className="text-white font-bold text-2xl">
                  {formData.amount} RCN
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ≈ ${(parseFloat(formData.amount) * 0.1).toFixed(2)} USD
                </p>
              </div>

              {formData.message && (
                <div className="bg-[#2A2A2A] rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Message</p>
                  <p className="text-white italic text-sm">
                    &quot;{formData.message}&quot;
                  </p>
                </div>
              )}

              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                <p className="text-xs text-blue-300">
                  The recipient can redeem these tokens at any participating shop
                  (20% value) or at the shop where you earned them (100% value).
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-3 bg-[#2A2A2A] text-white rounded-lg font-medium hover:bg-[#333] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSendTokens}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? "Sending..." : "Confirm & Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspended Action Modal */}
      <SuspendedActionModal
        isOpen={showSuspendedModal}
        onClose={() => setShowSuspendedModal(false)}
        action="send token gifts"
        reason={userProfile?.suspensionReason}
      />
    </div>
  );
}

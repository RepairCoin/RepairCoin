"use client";

import React, { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import toast from "react-hot-toast";
import {
  Send,
  Gift,
  History,
  CheckCircle,
  AlertCircle,
  Camera
} from "lucide-react";
import { QRScanner } from "@/components/ui/QRScanner";
import Tooltip from "../ui/tooltip";
import { useAuthStore } from "@/stores/authStore";
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
  const [activeView, setActiveView] = useState<"send" | "history">("send");
  const [isLoading, setIsLoading] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);
  const [transferHistory, setTransferHistory] = useState<TransferHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Check if user is suspended
  const isSuspended = userProfile?.suspended || false;
  
  const [formData, setFormData] = useState<TransferForm>({
    recipientAddress: "",
    amount: "",
    message: ""
  });

  const [validation, setValidation] = useState<{
    valid: boolean;
    message: string;
    senderBalance: number;
    recipientExists: boolean;
  } | null>(null);

  // Validate transfer before sending
  const validateTransfer = async () => {
    if (!formData.recipientAddress || !formData.amount || !account?.address) {
      setValidation(null);
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/validate-transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAddress: account.address,
          toAddress: formData.recipientAddress,
          amount: parseFloat(formData.amount)
        })
      });

      const result = await response.json();
      if (result.success) {
        setValidation(result.data);
      }
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  // Handle QR code scan result
  const handleQRScan = (result: string) => {
    // Check if it's a valid Ethereum address
    if (/^0x[a-fA-F0-9]{40}$/.test(result)) {
      setFormData(prev => ({ ...prev, recipientAddress: result }));
      setShowQRScanner(false);
      toast.success("Address scanned successfully!");
    } else {
      toast.error("Invalid wallet address in QR code");
    }
  };

  // Show confirmation modal
  const handleSendTokens = () => {
    // Check if suspended
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

  // Actually send tokens after confirmation
  const confirmSendTokens = async () => {
    if (!account?.address) return;

    setIsLoading(true);
    setShowConfirmModal(false);

    try {
      // This would normally involve blockchain transaction
      // For now, we'll simulate the transaction hash
      const mockTransactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAddress: account.address,
          toAddress: formData.recipientAddress,
          amount: parseFloat(formData.amount),
          message: formData.message,
          transactionHash: mockTransactionHash
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Successfully sent ${formData.amount} RCN tokens!`);
        setFormData({ recipientAddress: "", amount: "", message: "" });
        setValidation(null);
        // Refresh history if we're viewing it
        if (activeView === "history") {
          fetchTransferHistory();
        }
      } else {
        toast.error(result.message || "Transfer failed");
      }
    } catch (error) {
      console.error('Transfer error:', error);
      toast.error("Failed to send tokens. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch transfer history
  const fetchTransferHistory = async () => {
    if (!account?.address) return;

    setLoadingHistory(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/transfer-history/${account.address}`);
      const result = await response.json();

      if (result.success) {
        setTransferHistory(result.data.transfers);
      }
    } catch (error) {
      console.error('History fetch error:', error);
      toast.error("Failed to load transfer history");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load history when switching to history view
  React.useEffect(() => {
    if (activeView === "history") {
      fetchTransferHistory();
    }
  }, [activeView, account?.address]);

  // Validate transfer when form changes
  React.useEffect(() => {
    if (formData.recipientAddress && formData.amount) {
      validateTransfer();
    }
  }, [formData.recipientAddress, formData.amount]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (timestamp: string) => {
    try {
      // Handle various timestamp formats
      let date: Date;

      // If timestamp is a number string (Unix timestamp in seconds or milliseconds)
      if (/^\d+$/.test(timestamp)) {
        const numTimestamp = parseInt(timestamp);
        // If timestamp is in seconds (10 digits), convert to milliseconds
        date = new Date(numTimestamp < 10000000000 ? numTimestamp * 1000 : numTimestamp);
      } else {
        // Otherwise, try to parse as ISO string or other date format
        date = new Date(timestamp);
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Date formatting error:', error, 'timestamp:', timestamp);
      return 'Invalid Date';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#212121] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden">
        <div
          className="w-full flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
              Token Gifting
            </h2>
            <Tooltip
              title="How it works"
              position="bottom"
              className="right-0"
              content={
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">
                        1
                      </span>
                    </div>
                    <span className="text-gray-300">
                      Enter recipient's wallet address or scan their QR code
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">
                        2
                      </span>
                    </div>
                    <span className="text-gray-300">
                      Specify the amount of RCN tokens you want to send
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">
                        3
                      </span>
                    </div>
                    <span className="text-gray-300">
                      Add an optional personal message with your gift
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">
                        4
                      </span>
                    </div>
                    <span className="text-gray-300">
                      Confirm and send - tokens are instantly transferred to recipient
                    </span>
                  </li>
                </ul>
              }
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView("send")}
              className={`text-xs sm:text-sm px-4 py-2 rounded-3xl font-medium transition-colors ${
                activeView === "send"
                  ? "bg-black text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              <Send className="w-4 h-4 inline mr-1" />
              Send Tokens
            </button>
            <button
              onClick={() => setActiveView("history")}
              className={`text-xs sm:text-sm px-4 py-2 rounded-3xl font-medium transition-colors ${
                activeView === "history"
                  ? "bg-black text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              <History className="w-4 h-4 inline mr-1" />
              History
            </button>
          </div>
        </div>

        {/* Send Tokens View */}
        {activeView === "send" && (
          <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center mb-8">
                <Gift className="w-16 h-16 mx-auto mb-4 text-[#FFCC00]" />
                <p className="text-gray-300 text-sm sm:text-base">
                  Send RCN tokens to family and friends. They can redeem them at any participating shop.
                </p>
              </div>

              <div className="space-y-4">
                {/* Recipient Address */}
                <div>
                  <label className="block text-sm sm:text-base font-medium text-gray-300 mb-2">
                    Recipient Wallet Address *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.recipientAddress}
                      onChange={(e) => setFormData(prev => ({ ...prev, recipientAddress: e.target.value }))}
                      placeholder="0x..."
                      className="flex-1 px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => setShowQRScanner(true)}
                      className="px-4 py-3 bg-[#FFCC00] text-black rounded-xl hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
                      title="Scan QR Code"
                    >
                      <Camera className="w-5 h-5" />
                      <span className="hidden sm:inline text-sm font-medium">Scan QR</span>
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm sm:text-base font-medium text-gray-300 mb-2">
                    Amount (RCN) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm sm:text-base font-medium text-gray-300 mb-2">
                    Message (Optional)
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Happy Birthday! Enjoy some RCN tokens..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Validation Status */}
                {validation && (
                  <div className={`p-4 rounded-xl flex items-center gap-3 ${
                    validation.valid ? "bg-green-900/30 border border-green-700" : "bg-red-900/30 border border-red-700"
                  }`}>
                    {validation.valid ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    )}
                    <div>
                      <p className={`font-medium ${validation.valid ? "text-green-300" : "text-red-300"}`}>
                        {validation.message}
                      </p>
                      {validation.valid && (
                        <p className="text-sm text-gray-400 mt-1">
                          Your balance: {validation.senderBalance} RCN
                          {!validation.recipientExists && " • New recipient will be created"}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Send Button */}
                <button
                  onClick={handleSendTokens}
                  disabled={isLoading || !validation?.valid}
                  className="w-full px-6 py-3 bg-[#FFCC00] text-black rounded-xl font-medium hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Sending..." : "Send Tokens"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transfer History View */}
        {activeView === "history" && (
          <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
            <div className="space-y-4">
              {loadingHistory ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-yellow-400 border-t-transparent mx-auto"></div>
                  <p className="text-gray-400 mt-2">Loading transfer history...</p>
                </div>
              ) : transferHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400">No token transfers yet</p>
                  <p className="text-sm text-gray-500 mt-1">Start sending tokens to see your history here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transferHistory.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="bg-[#2F2F2F] rounded-xl p-4 border border-gray-700"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            transfer.direction === "sent" ? "bg-red-900/30" : "bg-green-900/30"
                          }`}>
                            <Send className={`w-4 h-4 ${
                              transfer.direction === "sent" ? "text-red-400 rotate-45" : "text-green-400 -rotate-45"
                            }`} />
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {transfer.direction === "sent" ? "Sent to" : "Received from"} {formatAddress(transfer.otherParty)}
                            </p>
                            <p className="text-sm text-gray-400">
                              {formatDate(transfer.timestamp)}
                            </p>
                            {transfer.message && (
                              <p className="text-sm text-gray-300 mt-1 italic">"{transfer.message}"</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${
                            transfer.direction === "sent" ? "text-red-400" : "text-green-400"
                          }`}>
                            {transfer.direction === "sent" ? "-" : "+"}{transfer.amount} RCN
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatAddress(transfer.transactionHash)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* QR Scanner */}
      <QRScanner
        isOpen={showQRScanner}
        onScan={handleQRScan}
        onClose={() => setShowQRScanner(false)}
      />

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] rounded-2xl max-w-md w-full p-6 border border-gray-700">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Confirm Token Transfer
              </h3>
              <p className="text-sm text-gray-400">
                Please review the details before sending
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-[#2F2F2F] rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-1">Recipient Address</p>
                <p className="text-white font-medium break-all">
                  {formData.recipientAddress}
                </p>
              </div>

              <div className="bg-[#2F2F2F] rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-1">Amount</p>
                <p className="text-white font-medium text-2xl">
                  {formData.amount} RCN
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  ≈ ${(parseFloat(formData.amount) * 0.10).toFixed(2)} USD
                </p>
              </div>

              {formData.message && (
                <div className="bg-[#2F2F2F] rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Message</p>
                  <p className="text-white italic">&quot;{formData.message}&quot;</p>
                </div>
              )}

              <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4">
                <p className="text-sm text-blue-300">
                  The recipient can redeem these tokens at any participating shop (20% value)
                  or at the shop where you earned them (100% value).
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSendTokens}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-[#FFCC00] text-black rounded-xl font-medium hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
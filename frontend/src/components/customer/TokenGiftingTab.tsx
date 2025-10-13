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
  QrCode,
  ScanLine
} from "lucide-react";
import { QrScanner } from 'qr-scanner';

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
  const [activeView, setActiveView] = useState<"send" | "history">("send");
  const [isLoading, setIsLoading] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [transferHistory, setTransferHistory] = useState<TransferHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
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
      const response = await fetch('http://localhost:4000/api/tokens/validate-transfer', {
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

  // Send tokens
  const handleSendTokens = async () => {
    if (!account?.address || !formData.recipientAddress || !formData.amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!validation?.valid) {
      toast.error(validation?.message || "Transfer validation failed");
      return;
    }

    setIsLoading(true);
    try {
      // This would normally involve blockchain transaction
      // For now, we'll simulate the transaction hash
      const mockTransactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;

      const response = await fetch('http://localhost:4000/api/tokens/transfer', {
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
      const response = await fetch(`http://localhost:4000/api/tokens/transfer-history/${account.address}`);
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
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
          <h2 className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
            Token Gifting
          </h2>
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
                      className="px-4 py-3 bg-[#FFCC00] text-black rounded-xl hover:bg-yellow-500 transition-colors"
                      title="Scan QR Code"
                    >
                      <QrCode className="w-5 h-5" />
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

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] rounded-2xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h3 className="text-xl font-semibold text-white">Scan QR Code</h3>
              <button
                onClick={() => setShowQRScanner(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 text-center">
              <ScanLine className="w-16 h-16 mx-auto mb-4 text-[#FFCC00]" />
              <p className="text-gray-300 mb-4">
                Position the QR code within the camera view to scan the wallet address
              </p>
              <div className="bg-[#2F2F2F] rounded-lg p-4 mb-4">
                <div className="aspect-square bg-gray-800 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">Camera view would appear here</p>
                </div>
              </div>
              <button
                onClick={() => setShowQRScanner(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
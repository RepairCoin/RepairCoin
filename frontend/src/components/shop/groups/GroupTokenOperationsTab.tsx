"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Coins, TrendingUp, TrendingDown, Camera, X } from "lucide-react";
import QrScanner from "qr-scanner";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";

interface GroupTokenOperationsTabProps {
  groupId: string;
  tokenSymbol: string;
  shopRcnBalance?: number;
  onTransactionComplete?: () => void;
}

export default function GroupTokenOperationsTab({
  groupId,
  tokenSymbol,
  shopRcnBalance = 0,
  onTransactionComplete,
}: GroupTokenOperationsTabProps) {
  const [operationType, setOperationType] = useState<"earn" | "redeem">("earn");
  const [customerAddress, setCustomerAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [customerBalance, setCustomerBalance] =
    useState<shopGroupsAPI.CustomerAffiliateGroupBalance | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // QR Scanner states
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch customer balance
  const fetchCustomerBalance = async (address: string) => {
    if (!address) {
      return;
    }

    try {
      setLoadingBalance(true);
      const balance = await shopGroupsAPI.getCustomerBalance(groupId, address);
      setCustomerBalance(balance);
      if (!balance) {
        toast("Customer has no balance in this group yet");
      }
    } catch (error) {
      console.error("Error checking balance:", error);
      toast.error("Failed to check balance");
    } finally {
      setLoadingBalance(false);
    }
  };

  // QR Scanner functions
  const startQRScanner = async () => {
    try {
      setShowQRScanner(true);
      setCameraLoading(true);

      // Wait for video element to be ready in the DOM
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!videoRef.current) {
        throw new Error("Video element not ready");
      }

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const scannedText = result.data;
          console.log("QR scan result:", scannedText);

          // Validate if it's an Ethereum address
          const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
          if (ethAddressRegex.test(scannedText)) {
            const address = scannedText.toLowerCase();
            setCustomerAddress(address);
            stopQRScanner();
            toast.success("Customer wallet address scanned successfully!");
            // Auto-fetch customer balance after scan
            fetchCustomerBalance(address);
          } else {
            toast.error("Invalid wallet address in QR code");
          }
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: "environment", // Use back camera on mobile
        }
      );

      setQrScanner(scanner);

      // Start the scanner with better error handling
      try {
        await scanner.start();
        setCameraLoading(false);
      } catch (startError: any) {
        console.error("Scanner start error:", startError);

        // Provide more specific error messages
        if (startError.name === "NotAllowedError") {
          toast.error(
            "Camera permission denied. Please allow camera access in your browser settings."
          );
        } else if (startError.name === "NotFoundError") {
          toast.error("No camera found on this device.");
        } else if (startError.name === "NotReadableError") {
          toast.error("Camera is already in use by another application.");
        } else {
          toast.error("Failed to start camera. Please try again.");
        }

        setShowQRScanner(false);
        setQrScanner(null);
        setCameraLoading(false);
      }
    } catch (error) {
      console.error("Error initializing QR scanner:", error);
      toast.error("Failed to initialize camera. Please try again.");
      setShowQRScanner(false);
      setCameraLoading(false);
    }
  };

  const stopQRScanner = () => {
    if (qrScanner) {
      qrScanner.stop();
      qrScanner.destroy();
      setQrScanner(null);
    }

    // Explicitly stop all video tracks to ensure camera is released
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        track.stop();
        console.log("Camera track stopped:", track.kind);
      });
      videoRef.current.srcObject = null;
    }

    setShowQRScanner(false);
    setCameraLoading(false);
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
      }
    };
  }, [qrScanner]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerAddress || !amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      setSubmitting(true);

      if (operationType === "earn") {
        const result = await shopGroupsAPI.earnGroupTokens(groupId, {
          customerAddress,
          amount: amountNum,
          reason: reason || undefined,
        });
        toast.success(`Successfully issued ${amountNum} ${tokenSymbol}!`);
        if (result) {
          setCustomerBalance({
            ...result,
            customerAddress,
            groupId,
            balance: result.newBalance,
          } as shopGroupsAPI.CustomerAffiliateGroupBalance);
        }
      } else {
        const result = await shopGroupsAPI.redeemGroupTokens(groupId, {
          customerAddress,
          amount: amountNum,
          reason: reason || undefined,
        });
        toast.success(`Successfully redeemed ${amountNum} ${tokenSymbol}!`);
        if (result) {
          setCustomerBalance({
            ...result,
            customerAddress,
            groupId,
            balance: result.newBalance,
          } as shopGroupsAPI.CustomerAffiliateGroupBalance);
        }
      }

      // Reset form
      setAmount("");
      setReason("");

      // Notify parent component to refresh data
      onTransactionComplete?.();
    } catch (error: any) {
      console.error("Error processing transaction:", error);
      toast.error(
        error?.response?.data?.error || `Failed to ${operationType} tokens`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#101010] rounded-xl p-6">
      <div className="flex items-center gap-2 mb-6">
        <Coins className="w-5 h-5 text-[#FFCC00]" />
        <h3 className="text-[#FFCC00] font-semibold">Token Operations</h3>
      </div>

      {/* Operation Type Selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setOperationType("earn")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            operationType === "earn"
              ? "bg-green-600 text-white"
              : "bg-[#1e1f22] text-white hover:bg-[#2a2b2f]"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Issue Tokens
        </button>
        <button
          onClick={() => setOperationType("redeem")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            operationType === "redeem"
              ? "bg-orange-600 text-white"
              : "bg-[#1e1f22] text-white hover:bg-[#2a2b2f]"
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          Redeem Tokens
        </button>
      </div>

      {/* RCN Balance & Requirement Display */}
      {operationType === "earn" && (
        <div className="bg-[#1e1f22] border border-blue-500/20 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-300">
              Your RCN Balance
            </p>
            <p className="text-lg font-bold text-[#FFCC00]">
              {shopRcnBalance.toFixed(2)} RCN
            </p>
          </div>
          <p className="text-xs text-gray-400 mb-2">
            <strong>RCN Backing Requirement:</strong> 1:2 ratio (100{" "}
            {tokenSymbol} requires 50 RCN)
          </p>
          {amount && parseFloat(amount) > 0 && (
            <p className="text-xs text-gray-400">
              Issuing{" "}
              <strong>
                {amount} {tokenSymbol}
              </strong>{" "}
              requires{" "}
              <strong className="text-[#FFCC00]">
                {(parseFloat(amount) / 2).toFixed(2)} RCN
              </strong>
            </p>
          )}
        </div>
      )}

      {/* Customer Lookup */}
      <div className="bg-[#1e1f22] rounded-lg p-4 mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Customer Wallet Address *
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value.toLowerCase())}
            placeholder="0x..."
            className="flex-1 px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00] text-sm"
          />
          <button
            onClick={startQRScanner}
            className="px-4 py-2 bg-[#FFCC00] text-[#101010] hover:bg-[#FFD700] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            title="Scan customer's QR code"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Scan QR</span>
          </button>
        </div>

        {/* Customer Balance Display */}
        {customerBalance && (
          <div className="mt-4 p-4 bg-[#101010] rounded-lg border border-gray-700">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-400 mb-1">Current Balance</p>
                <p className="text-xl font-bold text-[#FFCC00]">
                  {customerBalance.balance} {tokenSymbol}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Lifetime Earned</p>
                <p className="text-base font-bold text-green-500">
                  {customerBalance.lifetimeEarned} {tokenSymbol}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Lifetime Redeemed</p>
                <p className="text-base font-bold text-orange-500">
                  {customerBalance.lifetimeRedeemed} {tokenSymbol}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Amount ({tokenSymbol}) *
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            min="0"
            step="0.01"
            required
            className="w-full px-4 py-2 bg-[#1e1f22] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00] text-sm"
          />
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Reason (optional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              operationType === "earn"
                ? "e.g., Oil change service"
                : "e.g., Discount on brake service"
            }
            className="w-full px-4 py-2 bg-[#1e1f22] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00] text-sm"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className={`w-full py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            operationType === "earn"
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-orange-600 hover:bg-orange-700 text-white"
          }`}
        >
          {submitting
            ? "Processing..."
            : operationType === "earn"
            ? `Issue ${amount || "0"} ${tokenSymbol}`
            : `Redeem ${amount || "0"} ${tokenSymbol}`}
        </button>
      </form>

      {/* Info Box */}
      <div className="mt-6 bg-[#1e1f22] rounded-lg p-4">
        <p className="text-sm text-gray-400">
          {operationType === "earn" ? (
            <>
              <strong className="text-gray-300">Issue Tokens:</strong> Give custom tokens to customers for
              purchases or services. These tokens can only be redeemed at member
              shops.
            </>
          ) : (
            <>
              <strong className="text-gray-300">Redeem Tokens:</strong> Allow customers to use their
              custom tokens for discounts or rewards at your shop.
            </>
          )}
        </p>
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101010] rounded-xl border border-gray-800 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#FFCC00]" />
                Scan Customer QR Code
              </h3>
              <button
                onClick={stopQRScanner}
                className="p-2 hover:bg-[#1e1f22] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="relative rounded-lg overflow-hidden bg-black">
              <video
                ref={videoRef}
                className="w-full h-64 object-cover rounded-lg"
                playsInline
                muted
              />
              {cameraLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <div className="text-center">
                    <div className="w-10 h-10 border-4 border-gray-800 border-t-[#FFCC00] rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-white text-sm">Starting camera...</p>
                  </div>
                </div>
              )}
              {!cameraLoading && (
                <div className="absolute inset-0 border-2 border-[#FFCC00] rounded-lg">
                  <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#FFCC00]"></div>
                  <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#FFCC00]"></div>
                  <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#FFCC00]"></div>
                  <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#FFCC00]"></div>
                </div>
              )}
            </div>

            <p className="text-gray-400 text-sm mt-4 text-center">
              Position the customer&apos;s QR code within the frame to scan
              their wallet address
            </p>

            <button
              onClick={stopQRScanner}
              className="w-full mt-4 px-4 py-3 bg-[#1e1f22] hover:bg-[#2a2b2f] text-white rounded-lg transition-colors font-medium border border-gray-700"
            >
              Cancel Scan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

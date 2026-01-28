"use client";

import React, { useState, useEffect } from "react";
import { createThirdwebClient, getContract, prepareContractCall, sendTransaction, readContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { inAppWallet, preAuthenticate } from "thirdweb/wallets";
import { toast } from "react-hot-toast";

// Configuration - CHANGE THESE VALUES AS NEEDED
const FROM_EMAIL = "testdeo016@gmail.com";
const FROM_ADDRESS = "0x3d4841b6e2b1f49ef54ea7a794328582c6d5c14d";
const TO_ADDRESS = "0xb3afc20c0f66e9ec902bd7df2313b57ae8fb1d81";
const RCG_CONTRACT = "0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

export default function TransferRCGPage() {
  const [balance, setBalance] = useState<string>("Loading...");
  const [balanceRaw, setBalanceRaw] = useState<bigint>(BigInt(0));
  const [isTransferring, setIsTransferring] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Email verification states
  const [step, setStep] = useState<"initial" | "verify" | "connected">("initial");
  const [verificationCode, setVerificationCode] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);

  // Fetch balance
  useEffect(() => {
    async function fetchBalance() {
      try {
        const contract = getContract({
          client,
          chain: baseSepolia,
          address: RCG_CONTRACT,
        });

        const bal = await readContract({
          contract,
          method: "function balanceOf(address account) view returns (uint256)",
          params: [FROM_ADDRESS],
        });

        setBalanceRaw(bal);
        setBalance((Number(bal) / 1e18).toLocaleString() + " RCG");
      } catch (err) {
        console.error("Error fetching balance:", err);
        setBalance("Error loading balance");
      }
    }

    fetchBalance();
  }, [txHash]);

  const handleSendCode = async () => {
    setIsSendingCode(true);
    setError(null);

    try {
      await preAuthenticate({
        client,
        strategy: "email",
        email: FROM_EMAIL,
      });

      toast.success(`Verification code sent to ${FROM_EMAIL}`);
      setStep("verify");
    } catch (err: any) {
      console.error("Error sending code:", err);
      setError(err.message || "Failed to send verification code");
      toast.error(err.message || "Failed to send verification code");
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      toast.error("Please enter the verification code");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const newWallet = inAppWallet();

      const connectedAccount = await newWallet.connect({
        client,
        chain: baseSepolia,
        strategy: "email",
        email: FROM_EMAIL,
        verificationCode: verificationCode.trim(),
      });

      setWallet(newWallet);
      setAccount(connectedAccount);
      setConnectedAddress(connectedAccount.address);
      setStep("connected");
      toast.success("Wallet connected!");
    } catch (err: any) {
      console.error("Verification error:", err);
      setError(err.message || "Invalid verification code");
      toast.error(err.message || "Invalid verification code");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnect = () => {
    setWallet(null);
    setAccount(null);
    setConnectedAddress(null);
    setVerificationCode("");
    setStep("initial");
    toast.success("Disconnected");
  };

  const handleTransfer = async () => {
    if (!account) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (account.address.toLowerCase() !== FROM_ADDRESS.toLowerCase()) {
      toast.error(`Connected wallet doesn't match source address`);
      return;
    }

    if (balanceRaw === BigInt(0)) {
      toast.error("No RCG balance to transfer");
      return;
    }

    setIsTransferring(true);
    setError(null);

    try {
      const contract = getContract({
        client,
        chain: baseSepolia,
        address: RCG_CONTRACT,
      });

      const transaction = prepareContractCall({
        contract,
        method: "function transfer(address to, uint256 amount) returns (bool)",
        params: [TO_ADDRESS, balanceRaw],
      });

      const result = await sendTransaction({
        transaction,
        account,
      });

      setTxHash(result.transactionHash);
      toast.success("Transfer successful!");
    } catch (err: any) {
      console.error("Transfer error:", err);
      setError(err.message || "Transfer failed");
      toast.error(err.message || "Transfer failed");
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-[#FFCC00] mb-8">RCG Token Transfer</h1>

        {/* Transfer Details */}
        <div className="bg-[#101010] border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Transfer Details</h2>

          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm">From Email:</label>
              <p className="font-medium text-[#FFCC00] mt-1">{FROM_EMAIL}</p>
            </div>

            <div>
              <label className="text-gray-400 text-sm">From Address:</label>
              <p className="font-mono text-sm bg-black/50 p-2 rounded mt-1 break-all">
                {FROM_ADDRESS}
              </p>
            </div>

            <div>
              <label className="text-gray-400 text-sm">To Address:</label>
              <p className="font-mono text-sm bg-black/50 p-2 rounded mt-1 break-all">
                {TO_ADDRESS}
              </p>
            </div>

            <div>
              <label className="text-gray-400 text-sm">Current Balance:</label>
              <p className="text-2xl font-bold text-[#FFCC00] mt-1">{balance}</p>
            </div>
          </div>
        </div>

        {/* Wallet Connection */}
        <div className="bg-[#101010] border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Wallet Connection</h2>

          {/* Step 1: Send Code */}
          {step === "initial" && (
            <div>
              <p className="text-gray-400 mb-4">
                Click the button below to send a verification code to <span className="text-[#FFCC00]">{FROM_EMAIL}</span>
              </p>
              <button
                onClick={handleSendCode}
                disabled={isSendingCode}
                className="px-6 py-3 bg-[#FFCC00] text-black font-bold rounded-lg hover:bg-[#FFD700] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSendingCode ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending Code...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Send Verification Code
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 2: Enter Code */}
          {step === "verify" && (
            <div>
              <p className="text-green-400 mb-4">
                ✅ Verification code sent to {FROM_EMAIL}
              </p>
              <p className="text-gray-400 mb-4">
                Check your email and enter the 6-digit code below:
              </p>
              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter code"
                  maxLength={6}
                  className="flex-1 px-4 py-3 bg-white text-black rounded-lg text-center text-xl font-mono tracking-widest"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleVerifyCode}
                  disabled={isVerifying || !verificationCode.trim()}
                  className="flex-1 px-6 py-3 bg-[#FFCC00] text-black font-bold rounded-lg hover:bg-[#FFD700] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifying ? "Verifying..." : "Verify & Connect"}
                </button>
                <button
                  onClick={() => setStep("initial")}
                  className="px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                >
                  Back
                </button>
              </div>
              <button
                onClick={handleSendCode}
                disabled={isSendingCode}
                className="mt-3 text-sm text-gray-400 hover:text-white"
              >
                Didn't receive code? Send again
              </button>
            </div>
          )}

          {/* Step 3: Connected */}
          {step === "connected" && connectedAddress && (
            <div>
              <p className="text-green-400 mb-2">✅ Connected</p>
              <p className="font-mono text-sm bg-black/50 p-2 rounded break-all">
                {connectedAddress}
              </p>
              {connectedAddress.toLowerCase() !== FROM_ADDRESS.toLowerCase() && (
                <p className="text-red-400 mt-2 text-sm">
                  ⚠️ This wallet doesn't match the source address!
                </p>
              )}
              {connectedAddress.toLowerCase() === FROM_ADDRESS.toLowerCase() && (
                <p className="text-green-400 mt-2 text-sm">
                  ✅ Address matches! Ready to transfer.
                </p>
              )}
              <button
                onClick={handleDisconnect}
                className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Transfer Button */}
        {step === "connected" && connectedAddress?.toLowerCase() === FROM_ADDRESS.toLowerCase() && !txHash && (
          <button
            onClick={handleTransfer}
            disabled={isTransferring || balanceRaw === BigInt(0)}
            className="w-full py-4 bg-green-600 text-white font-bold text-xl rounded-xl hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isTransferring ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Transferring...
              </span>
            ) : (
              `Transfer ${balance} to Destination`
            )}
          </button>
        )}

        {/* Success Message */}
        {txHash && (
          <div className="bg-green-900/20 border border-green-500 rounded-xl p-6">
            <h2 className="text-xl font-bold text-green-400 mb-4">✅ Transfer Successful!</h2>
            <p className="text-gray-300 mb-2">Transaction Hash:</p>
            <p className="font-mono text-sm bg-black/50 p-2 rounded break-all mb-4">
              {txHash}
            </p>
            <a
              href={`https://sepolia.basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FFCC00] hover:underline"
            >
              View on BaseScan →
            </a>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-xl p-6 mt-4">
            <h2 className="text-xl font-bold text-red-400 mb-2">❌ Error</h2>
            <p className="text-gray-300">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

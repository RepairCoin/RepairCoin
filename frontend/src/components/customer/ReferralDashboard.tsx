"use client";

import { useState, useEffect, useRef } from "react";
import { useCustomer } from "@/hooks/useCustomer";
import { toast } from "react-hot-toast";
import {
  Users,
  UserCheck,
  Clock,
  Coins,
  Copy,
  Link,
  HelpCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import Tooltip from "../ui/tooltip";

import { Referral } from "@/constants/types";
import apiClient from "@/services/api/client";

export function ReferralDashboard() {
  const {
    customerData,
    isLoading: dataLoading,
    fetchCustomerData,
    error: customerError,
  } = useCustomer();

  const [copying, setCopying] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  // Tracks the wallet address we've already requested a code for. Refs survive
  // StrictMode's double-invoked effects and re-renders, so keying the guard by
  // address makes the POST fire exactly once per wallet.
  const generateRequestedForRef = useRef<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [referralStats, setReferralStats] = useState<{
    totalReferrals: number;
    successfulReferrals: number;
    pendingReferrals: number;
    totalEarned: number;
    referrals: Referral[];
  }>({
    totalReferrals: 0,
    successfulReferrals: 0,
    pendingReferrals: 0,
    totalEarned: 0,
    referrals: [],
  });

  useEffect(() => {
    const fetchReferralStats = async () => {
      try {
        const resp = await apiClient.get("/referrals/stats");
        if (resp.data) {
          setReferralStats({
            totalReferrals: resp.data.totalReferrals || 0,
            successfulReferrals: resp.data.successfulReferrals || 0,
            pendingReferrals: resp.data.pendingReferrals || 0,
            totalEarned: resp.data.totalEarned ?? 0,
            referrals: resp.data.referrals || [],
          });
        }
      } catch (error) {
        console.error("Error fetching referral stats:", error);
      }
    };

    if (customerData?.address) {
      fetchReferralStats();
    }
  }, [customerData?.address]);

  // Clear any stale error when the wallet changes (the guard itself is keyed by
  // address, so it doesn't need an explicit reset here).
  useEffect(() => {
    setGenerateError(null);
  }, [customerData?.address]);

  // If the customer record exists but has no referral code yet, request the
  // backend to generate one and then refresh customer data so the UI updates.
  //
  // The guard is keyed by wallet address rather than a boolean so React's
  // StrictMode double-invoke (and any incidental re-render) can't fire a second
  // POST. We intentionally do NOT cancel the in-flight request on cleanup:
  // earlier this effect listed `generatingCode` in its deps and set it inside,
  // which made the cleanup run mid-flight and skip `fetchCustomerData`, leaving
  // referralCode empty. The backend /referrals/generate call is idempotent.
  useEffect(() => {
    const address = customerData?.address;
    if (!address || customerData?.referralCode) {
      return;
    }
    if (generateRequestedForRef.current === address) {
      return;
    }
    generateRequestedForRef.current = address;

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        setGeneratingCode(true);
        setGenerateError(null);

        const GENERATE_TIMEOUT_MS = 15_000;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () =>
              reject(
                new Error(
                  "Referral code generation timed out. Please try again."
                )
              ),
            GENERATE_TIMEOUT_MS
          );
        });

        const resp: any = await Promise.race([
          apiClient.post("/referrals/generate"),
          timeoutPromise,
        ]);

        const generatedCode: string | undefined =
          resp?.data?.referralCode ?? resp?.data?.data?.referralCode ?? resp?.referralCode;

        if (!generatedCode) {
          throw new Error(
            resp?.error || "Server did not return a referral code"
          );
        }

        await fetchCustomerData(true);
      } catch (error: any) {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          "Failed to generate referral code. Please try again.";
        console.error("Error generating referral code:", error);
        setGenerateError(message);
        toast.error(message);
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        setGeneratingCode(false);
      }
    })();
  }, [
    customerData?.address,
    customerData?.referralCode,
    fetchCustomerData,
    retryNonce,
  ]);

  const retryGenerateReferralCode = () => {
    generateRequestedForRef.current = null;
    setGenerateError(null);
    setRetryNonce((n) => n + 1);
  };

  const referralLink = customerData?.referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/register/customer?ref=${customerData.referralCode}`
    : "";

  const copyReferralLink = async () => {
    if (!referralLink) return;
    try {
      setCopying(true);
      await navigator.clipboard.writeText(referralLink);
      toast.success("Referral link copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy link");
    } finally {
      setCopying(false);
    }
  };

  const copyReferralCode = async () => {
    if (!customerData?.referralCode) return;
    try {
      setCopying(true);
      await navigator.clipboard.writeText(customerData.referralCode);
      toast.success("Referral code copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy code");
    } finally {
      setCopying(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const formatName = (address: string) => {
    if (!address) return "Pending";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (dataLoading && !customerData) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-[#1A1A1A] rounded-2xl p-5 animate-pulse"
            >
              <div className="h-4 bg-gray-800 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-800 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!customerData && !dataLoading) {
    return (
      <div className="bg-[#1A1A1A] rounded-2xl p-8 border border-gray-800 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
        <p className="text-white font-medium mb-1">
          Unable to load referral data
        </p>
        <p className="text-gray-400 text-sm mb-4">
          {customerError || "Please try again in a moment."}
        </p>
        <button
          onClick={() => fetchCustomerData(true)}
          disabled={dataLoading}
          className="px-6 py-2 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {dataLoading ? "Retrying..." : "Retry"}
        </button>
      </div>
    );
  }

  const stats = [
    {
      label: "Total Referrals",
      value: referralStats.totalReferrals,
      icon: <Users className="w-6 h-6 text-[#FFCC00]" />,
    },
    {
      label: "Successful",
      value: referralStats.successfulReferrals,
      icon: <UserCheck className="w-6 h-6 text-[#FFCC00]" />,
    },
    {
      label: "Pending",
      value: referralStats.pendingReferrals,
      icon: <Clock className="w-6 h-6 text-[#FFCC00]" />,
    },
    {
      label: "Total Earned",
      value: `${referralStats.totalEarned} RCN`,
      icon: <Coins className="w-6 h-6 text-[#FFCC00]" />,
    },
  ];

  const recentReferrals = referralStats.referrals.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#1A1A1A] rounded-2xl border border-gray-800 p-5 flex items-center gap-4"
          >
            <div className="p-2 bg-[#FFCC00]/10 rounded-xl flex-shrink-0">
              {stat.icon}
            </div>
            <div>
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-xl font-bold text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column - Referral Program Card */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#1A1A1A] rounded-2xl border border-gray-800 overflow-hidden">
            {/* Card Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-[#FFCC00]" />
                <h3 className="text-[#FFCC00] font-semibold text-lg">
                  Your Referral Program
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
                        <span className="text-xs font-bold text-blue-400">
                          1
                        </span>
                      </div>
                      <span className="text-gray-300">
                        Share your unique referral code or link with friends
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-blue-400">
                          2
                        </span>
                      </div>
                      <span className="text-gray-300">
                        When they register using your code, they become your
                        referral
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-blue-400">
                          3
                        </span>
                      </div>
                      <span className="text-gray-300">
                        After their first repair, you earn 25 RCN and they get
                        10 RCN bonus
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-blue-400">
                          4
                        </span>
                      </div>
                      <span className="text-gray-300">
                        Build your network and earn together with RepairCoin
                      </span>
                    </li>
                  </ul>
                }
              />
            </div>

            {/* Card Content */}
            <div className="p-6 space-y-6">
              <p className="text-sm text-gray-400">
                Earn 25 RCN when your referral completes their first repair!
                They&apos;ll get 10 RCN bonus too.
              </p>

              {/* Referral Code */}
              <div>
                <p className="text-sm font-medium text-white mb-2">
                  Your Referral Code
                </p>
                <div className="flex items-center gap-2 bg-[#2A2A2A] border border-gray-700 rounded-lg px-4 py-3">
                  <span
                    className={`text-2xl sm:text-3xl font-mono font-bold flex-1 ${
                      customerData?.referralCode
                        ? "text-white"
                        : generateError
                          ? "text-red-400 text-base sm:text-lg"
                          : "text-gray-500"
                    }`}
                  >
                    {customerData?.referralCode
                      ? customerData.referralCode
                      : generateError
                        ? "Unavailable"
                        : "Generating..."}
                  </span>
                  {generateError ? (
                    <button
                      onClick={retryGenerateReferralCode}
                      disabled={generatingCode}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Retry generating referral code"
                    >
                      <RefreshCw
                        className={`w-5 h-5 text-gray-400 ${generatingCode ? "animate-spin" : ""}`}
                      />
                    </button>
                  ) : (
                    <button
                      onClick={copyReferralCode}
                      disabled={copying || !customerData?.referralCode}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Copy referral code"
                    >
                      <Copy className="w-5 h-5 text-gray-400" />
                    </button>
                  )}
                </div>
                {generateError && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p>{generateError}</p>
                      <button
                        onClick={retryGenerateReferralCode}
                        disabled={generatingCode}
                        className="mt-1 text-red-300 hover:text-red-200 underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        {generatingCode ? "Retrying..." : "Try again"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Share Referral Link */}
              <div>
                <p className="text-sm font-medium text-white mb-2">
                  Share Your Referral Link
                </p>
                <button
                  onClick={copyReferralLink}
                  disabled={copying || !customerData?.referralCode}
                  className="w-full bg-[#FFCC00] text-black font-semibold py-3 px-4 rounded-lg hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#FFCC00]"
                >
                  <Link className="w-4 h-4" />
                  {copying ? "Copying..." : "Copy Referral Link"}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Share your link and earn token rewards every time someone joins
                  through you.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Recent Referrals */}
        <div className="w-full lg:w-[400px] flex-shrink-0">
          <div className="bg-[#1A1A1A] rounded-2xl border border-gray-800 overflow-hidden">
            {/* Card Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
              <Clock className="w-5 h-5 text-[#FFCC00]" />
              <h3 className="text-[#FFCC00] font-semibold">
                Recent Referrals
              </h3>
            </div>

            {recentReferrals.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <Users className="w-10 h-10 mx-auto mb-2 text-gray-700" />
                <p className="text-gray-500 text-sm">No referrals yet</p>
                <p className="text-gray-600 text-xs mt-1">
                  Share your code to start earning!
                </p>
              </div>
            ) : (
              <div>
                {/* Table Header */}
                <div className="grid grid-cols-4 gap-2 px-6 py-3 border-b border-gray-800">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </span>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </span>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                    Status
                  </span>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                    Earned
                  </span>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-gray-800/50">
                  {recentReferrals.map((referral) => (
                    <div
                      key={referral.id || referral.referredAddress}
                      className="grid grid-cols-4 gap-2 px-6 py-3 hover:bg-white/[0.02] transition-colors items-center"
                    >
                      <span className="text-xs text-gray-300 font-mono truncate">
                        {formatName(referral.referredAddress)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(referral.createdAt)}
                      </span>
                      <span className="text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                            referral.status === "completed"
                              ? "bg-green-500/15 text-green-400"
                              : "bg-yellow-500/15 text-yellow-400"
                          }`}
                        >
                          {referral.status === "completed"
                            ? "Joined"
                            : "Pending"}
                        </span>
                      </span>
                      <span className="text-right text-xs font-medium text-green-400">
                        {referral.status === "completed"
                          ? "+25 RCN"
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-gray-800 text-center">
                  <span className="text-xs text-gray-500">
                    Showing {recentReferrals.length} out of{" "}
                    {referralStats.totalReferrals} Referrals
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

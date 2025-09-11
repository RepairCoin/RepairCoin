"use client";

import { useState, useEffect } from "react";
import { useReadContract } from "thirdweb/react";
import { getContract, createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { useCustomer } from "@/hooks/useCustomer";
import { toast } from "react-hot-toast";
import {
  GroupHeadIcon,
  MailCheckIcon,
  ThreeDotsIcon,
  DbIcon,
} from "../../components/icon";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

const contract = getContract({
  client,
  chain: baseSepolia,
  address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
});

interface ReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalEarned: number;
  referrals: Array<{
    id: string;
    refereeAddress?: string;
    status: string;
    createdAt: string;
    completedAt?: string;
  }>;
}

export function ReferralDashboard() {
  const { 
    customerData, 
    earnedBalanceData,
    blockchainBalance,
    isLoading: dataLoading,
    fetchCustomerData,
    lastFetchTime
  } = useCustomer();
  
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [copying, setCopying] = useState(false);

  // Read token balance from contract
  const { data: tokenBalance } = useReadContract({
    contract,
    method: "function balanceOf(address) view returns (uint256)",
    params: customerData?.address ? [customerData.address] : [''],
  });

  // Update blockchain balance from contract if needed
  useEffect(() => {
    if (tokenBalance) {
      const formattedBalance = Number(tokenBalance) / 1e18;
      // This could update the store if needed
    }
  }, [tokenBalance]);

  // Initialize referral stats from customer data
  useEffect(() => {
    if (customerData) {
      const stats: ReferralStats = {
        totalReferrals: customerData.referralCount || 0,
        successfulReferrals: customerData.referralCount || 0,
        pendingReferrals: 0,
        totalEarned: (customerData.referralCount || 0) * 25, // 25 RCN per referral
        referrals: [], // Empty array for now - could be fetched separately if needed
      };
      setReferralStats(stats);
    }
  }, [customerData]);

  const referralCode = customerData?.referralCode || "Generating...";
  const referralLink = customerData?.referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/customer/register?ref=${customerData.referralCode}`
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
    if (!referralCode) return;

    try {
      setCopying(true);
      await navigator.clipboard.writeText(referralCode);
      toast.success("Referral code copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy code");
    } finally {
      setCopying(false);
    }
  };

  // Only show loading on initial load
  if (dataLoading && !customerData) {
    return (
      <div className="bg-[#212121] rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!customerData && !dataLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <p className="text-gray-600">
          Unable to load referral data. Please try again later.
        </p>
        <button 
          onClick={() => fetchCustomerData(true)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Refresh indicator */}
      {dataLoading && customerData && (
        <div className="mb-4 flex items-center justify-end">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-400 border-t-transparent"></div>
            <span>Refreshing data...</span>
          </div>
        </div>
      )}

      {/* Referral Code Section */}
      <div className="bg-[#212121] rounded-3xl">
        <div
          className="w-full px-4 md:px-8 py-4 text-white rounded-t-3xl flex justify-between items-center"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
            Your Referral Program
          </p>
          {lastFetchTime && (
            <button
              onClick={() => fetchCustomerData(true)}
              className="text-xs px-3 py-1 bg-black/20 hover:bg-black/30 rounded-full transition-colors"
              title="Refresh data"
            >
              🔄 Refresh
            </button>
          )}
        </div>
        <div className="w-full p-4 md:p-8 text-white">
          <p className="text-xs md:text-sm opacity-90 mb-6">
            Earn 25 RCN when your referral completes their first repair! They'll
            get 10 RCN bonus too.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-20">
            <div
              className="rounded-xl p-6 pb-20"
              style={{
                backgroundImage: `url('/img/cust-ref-widget2.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <p className="text-sm sm:text-base md:text-lg text-[#FFCC00] opacity-90 mb-2">
                Your Referral Code
              </p>
              <div className="flex items-center gap-2">
                <p className="text-2xl sm:text-3xl md:text-4xl font-mono font-semibold">
                  {referralCode}
                </p>
                <button
                  onClick={copyReferralCode}
                  className="p-2 hover:bg-white/20 rounded-lg transition"
                  disabled={copying}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div
              className="rounded-xl p-6 flex flex-col justify-between"
              style={{
                backgroundImage: `url('/img/cust-ref-widget2.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <p className="text-sm sm:text-base md:text-lg text-[#FFCC00] opacity-90 mb-2">
                Share Your Link
              </p>
              <button
                onClick={copyReferralLink}
                className="w-full bg-[#FFCC00] text-gray-900 font-semibold py-2 px-4 rounded-lg hover:bg-gray-100 transition flex items-center justify-center gap-2"
                disabled={copying}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                {copying ? "Copying..." : "Copy Referral Link"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div
          className="bg-gradient-to-r from-black to-[#3C3C3C] rounded-2xl px-6 py-4 shadow-lg flex justify-between items-center"
          style={{
            backgroundImage: `url('/img/stat-card.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div>
            <p className="text-yellow-400 text-sm md:text-base font-medium mb-1">
              Total Referrals
            </p>
            <p className="text-white text-lg sm:text-xl md:text-2xl font-semibold">
              {referralStats?.totalReferrals || 0}
            </p>
          </div>
          <div className="w-20 rounded-lg">
            <GroupHeadIcon />
          </div>
        </div>

        <div
          className="bg-gradient-to-r from-black to-[#3C3C3C] rounded-2xl px-6 py-4 shadow-lg flex justify-between items-center"
          style={{
            backgroundImage: `url('/img/stat-card.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div>
            <p className="text-yellow-400 text-sm md:text-base font-medium mb-1">
              Successful
            </p>
            <p className="text-white text-lg sm:text-xl md:text-2xl font-semibold">
              {referralStats?.successfulReferrals || 0}
            </p>
          </div>
          <div className="w-20 rounded-lg">
            <MailCheckIcon />
          </div>
        </div>

        <div
          className="bg-gradient-to-r from-black to-[#3C3C3C] rounded-2xl px-6 py-4 shadow-lg flex justify-between items-center"
          style={{
            backgroundImage: `url('/img/stat-card.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div>
            <p className="text-yellow-400 text-sm md:text-base font-medium mb-1">Pending</p>
            <p className="text-white text-lg sm:text-xl md:text-2xl font-semibold">
              {referralStats?.pendingReferrals || 0}
            </p>
          </div>
          <div className="w-20 rounded-lg">
            <ThreeDotsIcon />
          </div>
        </div>

        <div
          className="bg-gradient-to-r from-black to-[#3C3C3C] rounded-2xl px-6 py-4 shadow-lg flex justify-between items-center"
          style={{
            backgroundImage: `url('/img/stat-card.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div>
            <p className="text-yellow-400 text-sm md:text-base font-medium mb-1">
              Total Earned
            </p>
            <p className="text-white text-lg sm:text-xl md:text-2xl font-semibold">
              {referralStats?.totalEarned || 0}
            </p>
          </div>
          <div className="w-20 rounded-lg">
            <DbIcon />
          </div>
        </div>
      </div>

      {/* RCN Balance Breakdown */}
      <div className="bg-[#212121] rounded-3xl">
        <div
          className="w-full px-4 md:px-8 py-4 text-white rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">Your RCN Breakdown</p>
        </div>
        <div className="w-full p-4 md:p-8 text-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
              <p className="text-sm md:text-lg text-white font-semibold opacity-90 mb-2">
                Balance Overview
              </p>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-200 text-xs md:text-sm">Total Balance:</span>
                  <span className="font-semibold text-xs md:text-sm">
                    {blockchainBalance || 0} RCN
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-200 text-xs md:text-sm">Earned (Redeemable):</span>
                  <span className="font-semibold text-green-600 text-xs md:text-sm">
                    {(earnedBalanceData?.earnedBalance || 0).toFixed(2)}{" "}
                    RCN
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-200 text-xs md:text-sm">Market Bought:</span>
                  <span className="font-semibold text-gray-500 text-xs md:text-sm">
                    {(earnedBalanceData?.marketBalance || 0).toFixed(2)}{" "}
                    RCN
                  </span>
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-200 text-xs md:text-sm">
                      Cross-Shop Limit (20%):
                    </span>
                    <span className="font-semibold text-[#FFCC00] text-xs md:text-sm">
                      {(earnedBalanceData?.earnedBalance
                        ? earnedBalanceData.earnedBalance * 0.2
                        : 0
                      ).toFixed(2)}{" "}
                      RCN
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm md:text-lg text-white font-semibold opacity-90 mb-2">
                Earnings by Type
              </p>
              <div className="space-y-3">
                {earnedBalanceData?.earningHistory &&
                  Object.entries(earnedBalanceData.earningHistory).map(
                    ([type, amount]) => (
                      <div
                        key={type}
                        className="flex justify-between items-center"
                      >
                        <span className="text-gray-200 capitalize text-xs md:text-sm">
                          {type.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className="font-semibold text-xs md:text-sm">{amount} RCN</span>
                      </div>
                    )
                  )}
              </div>
            </div>
          </div>
        </div>

        {earnedBalanceData?.homeShop && (
          <div className="mt-2 px-8 py-4 bg-[#212121] rounded-b-3xl">
            <p className="text-sm text-white">
              <span className="font-semibold">Home Shop:</span>{" "}
              {earnedBalanceData.homeShop}
              <br />
              <span className="text-xs">
                You can redeem 100% of your earned RCN at your home shop
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Recent Referrals */}
      {referralStats?.referrals &&
        referralStats.referrals.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 mb-6">
              Recent Referrals
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Referee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {referralStats.referrals.map((referral) => (
                    <tr key={referral.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(referral.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {referral.refereeAddress ? (
                          <span className="font-mono">
                            {referral.refereeAddress.slice(0, 6)}...
                            {referral.refereeAddress.slice(-4)}
                          </span>
                        ) : (
                          <span className="text-gray-500">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            referral.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : referral.status === "expired"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {referral.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {referral.completedAt
                          ? new Date(referral.completedAt).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  );
}
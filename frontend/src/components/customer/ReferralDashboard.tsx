"use client";

import { useState, useEffect, useMemo } from "react";
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
import { DataTable, type Column } from "../ui/DataTable";
import { StatCard } from "../ui/StatCard";
import { DashboardHeader } from "../ui/DashboardHeader";
import Tooltip from "../ui/tooltip";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

const contract = getContract({
  client,
  chain: baseSepolia,
  address: (process.env.NEXT_PUBLIC_RCN_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xBFE793d78B6B83859b528F191bd6F2b8555D951C") as `0x${string}`,
});

import { Referral } from "@/constants/types";
import apiClient from "@/services/api/client";

// Define columns for the DataTable
const referralColumns: Column<Referral>[] = [
  {
    key: "date",
    header: "Date",
    accessor: (item) => new Date(item.createdAt).toLocaleDateString('en-US', { timeZone: 'America/Chicago' }),
    sortable: true,
  },
  {
    key: "referee",
    header: "Referee",
    accessor: (item) => item.referredAddress ? (
      <span className="font-mono text-sm">
        {item.referredAddress.slice(0, 6)}...{item.referredAddress.slice(-4)}
      </span>
    ) : (
      <span className="text-gray-500">Pending</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    accessor: (item) => (
      <span
        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          item.status === "completed"
            ? "bg-green-100 text-green-800"
            : "bg-yellow-100 text-yellow-800"
        }`}
      >
        {item.status}
      </span>
    ),
  },
  {
    key: "completed",
    header: "Completed",
    accessor: (item) => item.completedAt
      ? new Date(item.completedAt).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })
      : "-",
    sortable: true,
  },
];

export function ReferralDashboard() {
  const { 
    customerData, 
    isLoading: dataLoading,
    fetchCustomerData,
  } = useCustomer();
  
  const [copying, setCopying] = useState(false);
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
    referrals: []
  });

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

  useEffect(() => {
    const fetchReferralStats = async () => {
      try {
        const resp = await apiClient.get('/referrals/stats');
        if (resp.data) {
          setReferralStats({
            totalReferrals: resp.data.totalReferrals || 0,
            successfulReferrals: resp.data.successfulReferrals || 0,
            pendingReferrals: resp.data.pendingReferrals || 0,
            totalEarned: resp.data.totalEarned?.toString() || '0',
            referrals: resp.data.referrals || []
          });
        }
      } catch (error) {
        console.error('Error fetching referral stats:', error);
      }
    };

    if (customerData?.address) {
      fetchReferralStats();
    }
  }, [customerData?.address]);

  const referralCode = customerData?.referralCode || "Generating...";
  const referralLink = customerData?.referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register/customer?ref=${customerData.referralCode}`
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
      {/* Header with gradient background */}
      <DashboardHeader
        title="Referral Program"
        subtitle="Build your network and earn together"
      />

      {/* Referral Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Referrals"
          value={referralStats?.totalReferrals || 0}
          icon={<GroupHeadIcon />}
          titleClassName="text-yellow-400 text-sm md:text-base font-medium"
          valueClassName="text-white text-lg sm:text-xl md:text-2xl font-semibold"
        />
        
        <StatCard
          title="Successful"
          value={referralStats?.successfulReferrals || 0}
          icon={<MailCheckIcon />}
          titleClassName="text-yellow-400 text-sm md:text-base font-medium"
          valueClassName="text-white text-lg sm:text-xl md:text-2xl font-semibold"
        />
        
        <StatCard
          title="Pending"
          value={referralStats?.pendingReferrals || 0}
          icon={<ThreeDotsIcon />}
          titleClassName="text-yellow-400 text-sm md:text-base font-medium"
          valueClassName="text-white text-lg sm:text-xl md:text-2xl font-semibold"
        />
        
        <StatCard
          title="Total Earned"
          value={`${referralStats?.totalEarned || 0} RCN`}
          icon={<DbIcon />}
          titleClassName="text-yellow-400 text-sm md:text-base font-medium"
          valueClassName="text-white text-lg sm:text-xl md:text-2xl font-semibold"
        />
      </div>

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
                    Share your unique referral code or link with friends and family
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-400">
                      2
                    </span>
                  </div>
                  <span className="text-gray-300">
                    When they register using your code, they become your referral
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-400">
                      3
                    </span>
                  </div>
                  <span className="text-gray-300">
                    After their first repair, you earn 25 RCN and they get 10 RCN bonus
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-400">
                      4
                    </span>
                  </div>
                  <span className="text-gray-300">
                    Build your network and earn together with RepairCoin rewards
                  </span>
                </li>
              </ul>
            }
          />
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

      {/* Recent Referrals */}
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
          <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
            Recent Referrals
          </p>
        </div>
        <div className="p-4 md:p-8">
          <DataTable
            data={referralStats?.referrals || []}
            columns={referralColumns}
            keyExtractor={(item) => `${item.id}`}
            emptyMessage="No referrals yet. Share your referral code to start earning!"
            emptyIcon={
              <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">👥</div>
            }
            className="text-white"
            headerClassName="bg-gray-900/60 border-gray-800"
            showPagination={true}
            itemsPerPage={10}
            rowClassName="text-gray-300"
          />
        </div>
      </div>
    </div>
  );
}
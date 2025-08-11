"use client";

import { useState, useEffect } from "react";
import { ConnectButton, useReadContract } from "thirdweb/react";
import { getContract, createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { useAuth } from "../../hooks/useAuth";
import { useRouter } from "next/navigation";
import { SimpleUnsuspendModal } from "../../components/SimpleUnsuspendModal";
import { ReferralDashboard } from "../../components/customer/ReferralDashboard";
import { RedemptionApprovals } from "../../components/customer/RedemptionApprovals";
import { Toaster } from "react-hot-toast";
import {
  WalletIcon,
  TrophyIcon,
  RepairsIcon,
  CheckShieldIcon,
} from "../../components/icon";
import DashboardLayout from "@/components/ui/DashboardLayout";

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

interface CustomerData {
  address: string;
  email: string;
  name?: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetimeEarnings: number;
  currentBalance: number;
  totalRedemptions: number;
  dailyEarnings: number;
  monthlyEarnings: number;
  isActive: boolean;
  suspensionReason?: string;
  lastEarnedDate?: string;
  joinDate: string;
}

interface EarnedBalanceData {
  earnedBalance: number;
  marketBalance: number;
  totalBalance: number;
}

interface TransactionHistory {
  id: string;
  type: "earned" | "redeemed" | "bonus" | "referral";
  amount: number;
  shopId?: string;
  shopName?: string;
  description: string;
  createdAt: string;
}

export default function CustomerRegisterClient() {
  const router = useRouter();
  const { account, userProfile, isLoading, isAuthenticated } = useAuth();
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [blockchainBalance, setBlockchainBalance] = useState<number>(0);
  const [earnedBalanceData, setEarnedBalanceData] =
    useState<EarnedBalanceData | null>(null);
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUnsuspendModal, setShowUnsuspendModal] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "transactions" | "referrals" | "approvals"
  >("overview");

  // Read token balance from contract
  const { data: tokenBalance, isLoading: balanceLoading } = useReadContract({
    contract,
    method: "function balanceOf(address) view returns (uint256)",
    params: account?.address ? [account.address] : undefined,
  });

  const fetchCustomerData = async () => {
    if (!account?.address) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch customer data
      const customerResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/customers/${account.address}`
      );
      if (customerResponse.ok) {
        const customerResult = await customerResponse.json();
        console.log("Customer data from API:", customerResult.data);
        // Extract the customer object from the response
        const customerData =
          customerResult.data.customer || customerResult.data;
        setCustomerData(customerData);
        // Store blockchain balance separately
        if (customerResult.data.blockchainBalance !== undefined) {
          setBlockchainBalance(customerResult.data.blockchainBalance);
        }
      } else if (customerResponse.status === 404) {
        // Customer not found - they need to register
        router.push("/customer/register");
        return;
      }

      // Authenticate customer to get JWT token
      try {
        const authResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/customer`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ address: account.address }),
          }
        );

        if (authResponse.ok) {
          const authResult = await authResponse.json();
          // Store token for future requests
          localStorage.setItem("customerAuthToken", authResult.token);
          sessionStorage.setItem("customerAuthToken", authResult.token);
          console.log("Customer authenticated successfully");
        } else {
          console.error("Customer auth failed:", authResponse.status);
        }
      } catch (authError) {
        console.error("Customer authentication error:", authError);
      }

      // Fetch earned balance data
      const balanceResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/earned-balance/${account.address}`
      );
      if (balanceResponse.ok) {
        const balanceResult = await balanceResponse.json();
        setEarnedBalanceData(balanceResult.data);
      }

      // Fetch recent transactions
      const transactionsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/customers/${account.address}/transactions?limit=10`
      );
      if (transactionsResponse.ok) {
        const transactionsResult = await transactionsResponse.json();
        setTransactions(transactionsResult.data?.transactions || []);
      }
    } catch (err) {
      console.error("Error fetching customer data:", err);
      setError("Failed to load customer data");
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (balance: bigint | undefined): string => {
    if (!balance) return "0";
    return (Number(balance) / 1e18).toFixed(2);
  };

  const getTierColor = (tier: string): string => {
    switch (tier.toUpperCase()) {
      case "BRONZE":
        return "bg-orange-100 text-orange-800";
      case "SILVER":
        return "bg-gray-100 text-gray-800";
      case "GOLD":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTierEmoji = (tier: string): string => {
    switch (tier.toUpperCase()) {
      case "BRONZE":
        return "🥉";
      case "SILVER":
        return "🥈";
      case "GOLD":
        return "🥇";
      default:
        return "🏆";
    }
  };

  const getNextTier = (
    currentTier: string
  ): { tier: string; requirement: number } => {
    switch (currentTier.toUpperCase()) {
      case "BRONZE":
        return { tier: "SILVER", requirement: 200 };
      case "SILVER":
        return { tier: "GOLD", requirement: 1000 };
      case "GOLD":
        return { tier: "GOLD", requirement: 0 };
      default:
        return { tier: "SILVER", requirement: 200 };
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as any);
  };

  // Fetch customer data
  useEffect(() => {
    if (account?.address) {
      fetchCustomerData();
    }
  }, [account?.address]);

  // Update blockchain balance when contract read completes
  useEffect(() => {
    if (tokenBalance && !balanceLoading) {
      const formattedBalance = parseFloat(formatBalance(tokenBalance));
      setBlockchainBalance(formattedBalance);
    }
  }, [tokenBalance, balanceLoading]);

  useEffect(() => {
    if (!account?.address && !isAuthenticated) {
      router.push("/");
    }
  }, [account?.address, isAuthenticated]);

  // Check if customer is suspended
  if (customerData && !customerData.isActive) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="text-6xl mb-6">🚫</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Account Suspended
            </h1>
            <p className="text-gray-600 mb-6">
              Your account has been suspended. You cannot perform any token
              transactions while suspended.
            </p>
            {customerData.suspensionReason && (
              <div className="bg-red-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800 font-medium">Reason:</p>
                <p className="text-sm text-red-700">
                  {customerData.suspensionReason}
                </p>
              </div>
            )}
            <button
              onClick={() => setShowUnsuspendModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Request Unsuspend
            </button>
          </div>
        </div>

        {/* Unsuspend Request Modal */}
        <SimpleUnsuspendModal
          isOpen={showUnsuspendModal}
          onClose={() => setShowUnsuspendModal(false)}
          customerAddress={account?.address || ""}
          onSuccess={() => {
            setShowUnsuspendModal(false);
            // Optionally refresh customer data
            fetchCustomerData();
          }}
        />
      </>
    );
  }

  return (
    <DashboardLayout
      userRole="customer"
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      <Toaster position="top-right" />
      <div
        className="min-h-screen py-8 bg-[#0D0D0D]"
        style={{
          backgroundImage: `url('/img/dashboard-bg.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="relative my-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-[#FFCC00]">
                    Welcome back{" "}
                    {customerData?.name?.split(" ")[0] || "Customer"}!
                  </h1>
                  <p className="text-gray-400 flex items-center gap-2">
                    {customerData?.email ||
                      account?.address ||
                      "user@example.com"}
                  </p>
                </div>
              </div>
              <div className="mt-4 sm:mt-0 flex items-center gap-3">
                <ConnectButton
                  client={client}
                  connectModal={{ size: "compact" }}
                />
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* RCN Balance Card */}
                <div className="bg-gradient-to-r from-black to-[#3C3C3C] rounded-2xl px-6 py-4 shadow-lg flex justify-between items-center">
                  <div>
                    <p className="text-yellow-400 text-sm font-medium mb-1">
                      RCN Balance
                    </p>
                    <p className="text-white text-2xl font-bold">
                      {blockchainBalance || 0} RCN
                    </p>
                    {earnedBalanceData &&
                      earnedBalanceData.marketBalance > 0 && (
                        <p className="text-gray-400 text-xs mt-1">
                          {earnedBalanceData.earnedBalance} earned,{" "}
                          {earnedBalanceData.marketBalance} bought
                        </p>
                      )}
                  </div>
                  <div className="w-20 rounded-lg">
                    <WalletIcon />
                  </div>
                </div>

                {/* Customer Tier Card */}
                <div className="bg-gradient-to-r from-black to-[#3C3C3C] rounded-2xl px-6 py-4 shadow-lg flex justify-between items-center">
                  <div>
                    <p className="text-yellow-400 text-sm font-medium mb-1">
                      Your Tier Level
                    </p>
                    <p className="text-white text-2xl font-bold">
                      {customerData?.tier || "SILVER"}
                    </p>
                    {customerData && customerData.tier !== "GOLD" && (
                      <p className="text-gray-400 text-xs mt-1">
                        {getNextTier(customerData.tier).requirement -
                          customerData.lifetimeEarnings}{" "}
                        RCN to {getNextTier(customerData.tier).tier}
                      </p>
                    )}
                  </div>
                  <div className="w-20 rounded-lg">
                    <TrophyIcon />
                  </div>
                </div>

                {/* Total Repairs Card */}
                <div className="bg-gradient-to-r from-black to-[#3C3C3C] rounded-2xl px-6 py-4 shadow-lg flex justify-between items-center">
                  <div>
                    <p className="text-yellow-400 text-sm font-medium mb-1">
                      Total Repairs
                    </p>
                    <p className="text-white text-2xl font-bold">
                      {customerData?.lifetimeEarnings || 0}
                    </p>
                  </div>
                  <div className="w-20 rounded-lg">
                    <RepairsIcon />
                  </div>
                </div>
              </div>

              {/* Earnings Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Token Summary Card */}
                <div
                  className="rounded-2xl p-6 shadow-lg"
                  style={{
                    backgroundImage: `url(/img/tier-benefits.png)`,
                    backgroundSize: "cover",
                  }}
                >
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-yellow-400 text-lg font-bold">
                      Token Summary
                    </h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Tokens Earned:</span>
                      <span className="font-bold text-green-500">
                        {customerData?.lifetimeEarnings || 0} RCN
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Tokens Redeemed:</span>
                      <span className="font-bold text-red-500">
                        -{customerData?.totalRedemptions || 0} RCN
                      </span>
                    </div>
                    <div className="h-px bg-gray-700 my-3"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 font-medium">
                        Current Balance:
                      </span>
                      <span className="font-bold text-yellow-400">
                        {blockchainBalance || 0} RCN
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tier Benefits Card */}
                <div
                  className="flex rounded-2xl shadow-lg"
                  style={{
                    backgroundImage: `url(/img/tier-benefits.png)`,
                    backgroundSize: "cover",
                  }}
                >
                  <div className="flex-1 p-6">
                    <div className="flex justify-between items-start mb-6">
                      <h3 className="text-yellow-400 text-lg font-bold">
                        Tier Benefits
                      </h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <CheckShieldIcon width={25} height={25} />

                        <span className="text-gray-300">
                          All {customerData?.tier || "Bronze"} Benefits
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckShieldIcon width={25} height={25} />

                        <span className="text-gray-300">
                          Cross Shop Redemption
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckShieldIcon width={25} height={25} />

                        <span className="text-gray-300">
                          Referral Bonus Available
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckShieldIcon width={25} height={25} />

                        <span className="text-gray-300">
                          Early Access to Promos
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckShieldIcon width={25} height={25} />

                        <span className="text-gray-300">
                          Priority Support Access
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex justify-center items-center">
                    <img
                      src="/img/customer-avatar2.png"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              {/* Recent Transactions */}
              {transactions.length > 0 && (
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">
                    Recent Transactions
                  </h2>
                  <div className="space-y-3">
                    {transactions.slice(0, 5).map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex justify-between items-center p-4 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {transaction.description}
                          </p>
                          {transaction.shopName && (
                            <p className="text-sm text-gray-500">
                              at {transaction.shopName}
                            </p>
                          )}
                          <p className="text-xs text-gray-400">
                            {new Date(
                              transaction.createdAt
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <div
                          className={`font-bold ${
                            transaction.type === "redeemed"
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {transaction.type === "redeemed" ? "-" : "+"}
                          {transaction.amount} RCN
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* How to Earn More RepairCoin Section */}
              <div
                className="my-20 bg-gradient-to-b from-[#1A1A1A] to-[#2A2A2A] rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow"
                style={{
                  backgroundImage: `url('/img/cus-how-to-earn.png')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
              >
                <h2 className="text-3xl tracking-wide font-bold text-white my-6 text-center">
                  How to Earn More RepairCoin
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {/* Refer Friends Card */}
                  <div className="rounded-2xl p-6">
                    <div className="w-full h-48 mb-4 flex items-center justify-center overflow-hidden rounded-2xl">
                      <img
                        src="/img/story1.png"
                        alt="Refer Friends"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <h3 className="text-[#FFCC00] text-lg font-semibold mb-2 text-center tracking-wide">
                      Refer Friends
                    </h3>
                    <p className="text-gray-300 text-sm tracking-wide">
                      Earn 25 RCN for each successful referral. New customers
                      get 10 RCN bonus. No limit on referrals.
                    </p>
                  </div>

                  {/* Complete Repairs Card */}
                  <div className="rounded-2xl p-6">
                    <div className="w-full h-48 mb-4 flex items-center justify-center overflow-hidden rounded-2xl">
                      <img
                        src="/img/whatWeDo3.png"
                        alt="Complete Repairs"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <h3 className="text-[#FFCC00] text-lg font-semibold mb-2 text-center tracking-wide">
                      Complete Repairs
                    </h3>
                    <p className="text-gray-300 text-sm tracking-wide">
                      Earn 10 RCN for $50-99 repairs. Earn 25 RCN for $100+
                      repairs. Plus tier bonuses!
                    </p>
                  </div>

                  {/* Upgrade Your Tier Card */}
                  <div className="rounded-2xl p-6">
                    <div className="w-full h-48 mb-4 flex items-center justify-center overflow-hidden rounded-2xl">
                      <img
                        src="/img/customer-avatar.png"
                        alt="Upgrade Your Tier"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <h3 className="text-[#FFCC00] text-lg font-semibold mb-2 text-center tracking-wide">
                      Upgrade Your Tier
                    </h3>
                    <p className="text-gray-300 text-sm tracking-wide">
                      Bronze: 0-99 RCN Earned. Silver: 100-499 RCN Earned. Gold:
                      500+ RCN Earned.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Transactions Tab */}
          {activeTab === "transactions" && (
            <div className="bg-[#212121] rounded-3xl overflow-hidden">
              <div
                className="w-full px-8 py-4 text-white rounded-t-3xl"
                style={{
                  backgroundImage: `url('/img/cust-ref-widget3.png')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
              >
                <p className="text-xl text-gray-800 font-bold">
                  Transaction History
                </p>
              </div>
              <div className="bg-[#212121]">
                {/* Transaction History Table */}
                {loading ? (
                  <div className="animate-pulse p-6 space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="h-12 bg-gray-200 rounded"
                      ></div>
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">📋</div>
                    <p className="text-gray-500">No transactions yet</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Start earning RCN by visiting participating repair shops!
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Shop
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {transactions.map((transaction) => (
                          <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              <div>
                                <div>{new Date(transaction.createdAt).toLocaleDateString()}</div>
                                <div className="text-xs text-gray-400">
                                  {new Date(transaction.createdAt).toLocaleTimeString()}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="font-medium">
                                {transaction.description}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {transaction.shopName || 
                                <span className="text-gray-400">—</span>
                              }
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                transaction.type === 'redeemed' 
                                  ? 'bg-red-100 text-red-800' 
                                  : transaction.type === 'referral'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {transaction.type === 'earned' ? 'Repair Reward' : 
                                 transaction.type === 'referral' ? 'Referral Bonus' :
                                 transaction.type === 'redeemed' ? 'Redemption' : 
                                 transaction.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <span className={`text-sm font-bold ${
                                transaction.type === 'redeemed' 
                                  ? 'text-red-600' 
                                  : 'text-green-600'
                              }`}>
                                {transaction.type === 'redeemed' ? '-' : '+'}
                                {transaction.amount} RCN
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Referrals Tab */}
          {activeTab === "referrals" && <ReferralDashboard />}

          {/* Approvals Tab */}
          {activeTab === "approvals" && <RedemptionApprovals />}
        </div>
      </div>
    </DashboardLayout>
  );
}

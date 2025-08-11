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
import { OverviewTab } from "../../components/customer/OverviewTab";
import { Toaster } from "react-hot-toast";
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
    params: account?.address ? [account.address] : [''],
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
            <OverviewTab
              customerData={customerData}
              blockchainBalance={blockchainBalance}
              earnedBalanceData={earnedBalanceData}
              transactions={transactions}
            />
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
